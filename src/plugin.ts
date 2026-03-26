import type { Plugin } from "@opencode-ai/plugin";
import { tool } from "@opencode-ai/plugin";
import { GithubActionsClient, type GithubCommandExecutor } from "./github-api";
import {
	DEFAULT_POLL_INTERVAL_MS,
	type GithubActionRunTarget,
	type GithubActionWatchChange,
	type GithubActionWatchNotificationDetails,
	type StopGithubActionWatchParams,
	type WatchGithubActionRunParams,
} from "./types";
import { buildGithubActionWatchSummary } from "./watch-format";
import { WatchRegistry } from "./watch-registry";

export const GithubActionWatcherPlugin: Plugin = async ({ client, directory, $ }) => {
	const exec: GithubCommandExecutor = async (command, args, options) => {
		try {
			const proc = await $`${command} ${args}`.cwd(options?.cwd ?? directory).quiet();
			return { code: proc.exitCode, stdout: proc.stdout.toString(), stderr: proc.stderr.toString() };
		} catch (error: unknown) {
			if (error && typeof error === "object" && "exitCode" in error) {
				const e = error as { exitCode: number; stdout: Buffer; stderr: Buffer };
				return { code: e.exitCode, stdout: e.stdout.toString(), stderr: e.stderr.toString() };
			}
			throw error;
		}
	};

	const ghClient = new GithubActionsClient(exec, directory);

	const registry = new WatchRegistry({
		client: ghClient,
		onChange: (change) => publishWatchUpdate(client, directory, change),
		pollIntervalMs: DEFAULT_POLL_INTERVAL_MS,
		logger: { debug: () => {}, warn: () => {} },
	});

	return {
		tool: {
			watch_github_action_run: tool({
				description:
					"Attach a session-scoped watcher to a GitHub Actions workflow run by repository owner, repo, and run ID.",
				args: {
					owner: tool.schema.string().min(1).describe("Repository owner"),
					repo: tool.schema.string().min(1).describe("Repository name"),
					run_id: tool.schema.string().min(1).describe("Workflow run ID"),
				},
				async execute(args, ctx) {
					const target = normalizeTarget({
						owner: args.owner,
						repo: args.repo,
						run_id: Number(args.run_id),
					});
					const { watch, reused } = await registry.attach(ctx.sessionID, target);
					return reused
						? `Reusing GitHub Actions watch ${watch.id} for ${formatTarget(target)} (${formatState(watch.state)}).`
						: `Started GitHub Actions watch ${watch.id} for ${formatTarget(target)} (${formatState(watch.state)}).`;
				},
			}),

			stop_github_action_watch: tool({
				description:
					"Stop a session-scoped GitHub Actions workflow run watcher by watch ID or by owner, repo, and run ID.",
				args: {
					watch_id: tool.schema.string().min(1).optional().describe("Watch ID to stop"),
					owner: tool.schema.string().min(1).optional().describe("Repository owner"),
					repo: tool.schema.string().min(1).optional().describe("Repository name"),
					run_id: tool.schema.string().min(1).optional().describe("Workflow run ID"),
				},
				async execute(args, ctx) {
					const params: StopGithubActionWatchParams = {
						watch_id: args.watch_id,
						owner: args.owner,
						repo: args.repo,
						run_id: args.run_id ? Number(args.run_id) : undefined,
					};
					const stopTarget = resolveStopTarget(params);
					const stopped =
						"watchId" in stopTarget
							? registry.stopById(ctx.sessionID, stopTarget.watchId)
							: registry.stopByTarget(ctx.sessionID, stopTarget.target);

					if (!stopped) {
						return "watchId" in stopTarget
							? `No active GitHub Actions watch with id ${stopTarget.watchId} exists in this session.`
							: `No active GitHub Actions watch exists for ${formatTarget(stopTarget.target)} in this session.`;
					}

					return `Stopped GitHub Actions watch ${stopped.id} for ${formatTarget(stopped.target)}.`;
				},
			}),
		},

		event: async ({ event }) => {
			if (event.type === "session.idle") {
				registry.stopSession(event.properties.sessionID);
			}
			if (event.type === "session.deleted") {
				registry.stopSession(event.properties.info.id);
			}
		},
	};
};

function publishWatchUpdate(
	client: Parameters<Plugin>[0]["client"],
	directory: string,
	change: GithubActionWatchChange,
): void {
	const details: GithubActionWatchNotificationDetails = {
		watchId: change.watch.id,
		owner: change.watch.target.owner,
		repo: change.watch.target.repo,
		runId: change.watch.target.runId,
		previousState: change.previousState,
		currentState: change.currentState,
		observedAt: change.observedAt,
	};

	const summary = buildGithubActionWatchSummary(details);

	void client.session.promptAsync({
		path: { id: change.watch.sessionId },
		body: {
			parts: [
				{
					type: "text",
					text: `[GitHub Actions Watch Update]\n\n${summary}\n\nPlease acknowledge this update and decide if any action is needed.`,
				},
			],
		},
		query: { directory },
	});
}

function normalizeTarget(params: WatchGithubActionRunParams): GithubActionRunTarget {
	const owner = params.owner.trim();
	const repo = params.repo.trim();
	const runId = Math.trunc(params.run_id);
	if (!owner || !repo || runId <= 0) {
		throw new Error("owner, repo, and run_id must all be provided to watch a GitHub Actions run.");
	}
	return { owner, repo, runId };
}

type StopTarget = { watchId: string } | { target: GithubActionRunTarget };

function resolveStopTarget(params: StopGithubActionWatchParams): StopTarget {
	if (params.watch_id) {
		return { watchId: params.watch_id.trim() };
	}

	if (!params.owner || !params.repo || params.run_id === undefined) {
		throw new Error(
			"Provide either watch_id or the full owner, repo, and run_id tuple to stop a GitHub Actions watch.",
		);
	}

	return { target: normalizeTarget({ owner: params.owner, repo: params.repo, run_id: params.run_id }) };
}

function formatTarget(target: GithubActionRunTarget): string {
	return `${target.owner}/${target.repo}#${target.runId}`;
}

function formatState(state: { status: string; conclusion?: string }): string {
	return state.status === "completed" && state.conclusion ? `${state.status}/${state.conclusion}` : state.status;
}
