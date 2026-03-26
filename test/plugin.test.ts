import { describe, expect, it, mock } from "bun:test";
import type { PluginInput } from "@opencode-ai/plugin";
import { GithubActionWatcherPlugin } from "../src/plugin";

function createMockPluginInput(overrides: Partial<PluginInput> = {}): PluginInput {
	return {
		client: {
			session: {
				promptAsync: mock(() => Promise.resolve({ data: undefined, error: undefined })),
			},
		} as unknown as PluginInput["client"],
		project: { id: "test-project", name: "test" } as unknown as PluginInput["project"],
		directory: "/tmp/test-dir",
		worktree: "/tmp/test-dir",
		serverUrl: new URL("http://localhost:3000"),
		$: (() => {
			throw new Error("shell not mocked for this test");
		}) as unknown as PluginInput["$"],
		...overrides,
	};
}

describe("GithubActionWatcherPlugin", () => {
	it("returns hooks with tool and event keys", async () => {
		const hooks = await GithubActionWatcherPlugin(createMockPluginInput());

		expect(hooks).toHaveProperty("tool");
		expect(hooks).toHaveProperty("event");
		expect(typeof hooks.event).toBe("function");
	});

	it("registers watch_github_action_run tool with correct args schema", async () => {
		const hooks = await GithubActionWatcherPlugin(createMockPluginInput());
		const watchTool = hooks.tool!["watch_github_action_run"];

		expect(watchTool).toBeDefined();
		expect(watchTool.description).toContain("GitHub Actions workflow run");
		expect(watchTool.args).toHaveProperty("owner");
		expect(watchTool.args).toHaveProperty("repo");
		expect(watchTool.args).toHaveProperty("run_id");
	});

	it("registers stop_github_action_watch tool with optional args", async () => {
		const hooks = await GithubActionWatcherPlugin(createMockPluginInput());
		const stopTool = hooks.tool!["stop_github_action_watch"];

		expect(stopTool).toBeDefined();
		expect(stopTool.description).toContain("Stop");
		expect(stopTool.args).toHaveProperty("watch_id");
		expect(stopTool.args).toHaveProperty("owner");
		expect(stopTool.args).toHaveProperty("repo");
		expect(stopTool.args).toHaveProperty("run_id");
	});

	it("stop tool returns not-found message when no watch exists", async () => {
		const hooks = await GithubActionWatcherPlugin(createMockPluginInput());
		const stopTool = hooks.tool!["stop_github_action_watch"];

		const result = await stopTool.execute(
			{ watch_id: "nonexistent" },
			{
				sessionID: "test-session",
				messageID: "msg-1",
				agent: "test-agent",
				directory: "/tmp",
				worktree: "/tmp",
				abort: new AbortController().signal,
				metadata: () => {},
				ask: async () => {},
			},
		);

		expect(result).toContain("No active GitHub Actions watch");
	});

	it("event handler handles session.idle by stopping watches for that session", async () => {
		const hooks = await GithubActionWatcherPlugin(createMockPluginInput());

		await hooks.event!({
			event: { type: "session.idle", properties: { sessionID: "unknown-session" } },
		});
	});

	it("event handler handles session.deleted by stopping watches for that session", async () => {
		const hooks = await GithubActionWatcherPlugin(createMockPluginInput());

		await hooks.event!({
			event: {
				type: "session.deleted",
				properties: {
					info: {
						id: "deleted-session",
						projectID: "proj",
						directory: "/tmp",
						title: "test",
						version: "1",
						time: { created: 0, updated: 0 },
					},
				},
			},
		});
	});
});
