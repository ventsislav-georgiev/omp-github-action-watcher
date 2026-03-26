---
name: github-action-watcher
description: Watch GitHub Actions workflow runs for state changes. Use when asked to "watch a CI run", "monitor a workflow", "track a GitHub Actions build", or when you need to be notified when a CI pipeline completes, fails, or changes state. Provides fire-and-forget watchers that automatically notify you on state transitions.
---

# GitHub Action Watcher

Session-scoped watchers that poll GitHub Actions workflow runs and automatically notify you when the run changes state (e.g. queued → in_progress → completed/failure). You don't need to manually check — the watcher sends a prompt notification on every state change.

## Tools

- **`watch_github_action_run`** — Start watching a workflow run. Requires `owner`, `repo`, and `run_id`. The watcher polls in the background and sends automatic notifications on state changes.
- **`stop_github_action_watch`** — Stop an active watcher. Provide either `watch_id` (returned when starting) or the `owner`/`repo`/`run_id` tuple.

## Usage

### Watch a run

```
watch_github_action_run(owner="octocat", repo="hello-world", run_id="12345678")
```

After calling this, you'll receive automatic notifications like:

```
[GitHub Actions Watch Update]
Run octocat/hello-world#12345678 transitioned from in_progress to completed/failure
```

### Stop watching

```
stop_github_action_watch(owner="octocat", repo="hello-world", run_id="12345678")
```

Or by watch ID:

```
stop_github_action_watch(watch_id="w_abc123")
```

## Behavior

- **Fire-and-forget**: Once attached, the watcher runs in the background. Continue your work — you'll be notified automatically.
- **Session-scoped**: Watchers are tied to the current session and cleaned up automatically when the session ends.
- **Deduplication**: Watching the same run twice reuses the existing watcher.
- **State transitions**: Notifications include previous state, current state, conclusion (success/failure/cancelled), and timing.

## When to Use

- User asks to "watch", "monitor", or "track" a GitHub Actions run
- You triggered a CI pipeline and want to know when it finishes
- You need to react to CI failures (investigate logs, fix code, re-trigger)
- You want to verify a fix by watching the re-triggered run

## Reacting to Failure Notifications

When a watcher notifies you of a **failure**:

1. Use `gh` CLI to fetch the failed job logs: `gh run view <run_id> --repo owner/repo --log-failed`
2. Analyze the failure output to identify the root cause
3. Fix the issue in the relevant source files
4. Commit and push the fix
5. Optionally re-trigger the workflow and watch the new run

## Important

- **Always use this tool** instead of manually polling with `gh run view` in a loop.
- The `run_id` must be a string (the tool handles conversion internally).
- You can watch multiple runs simultaneously across different repositories.
