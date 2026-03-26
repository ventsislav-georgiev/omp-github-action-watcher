# omp-github-action-watcher

OpenCode plugin for watching GitHub Actions workflow runs from an active session.

It attaches a session-scoped watcher to a workflow run, polls GitHub periodically, and injects follow-up updates as the run moves through `queued`, `in_progress`, and `completed` states. Notifications include the workflow title, branch, commit SHA, run attempt, and the currently running or queued child jobs when GitHub exposes that context.

## Features

- Session-scoped workflow run watches
- Tool-driven start/stop controls
- Text-based follow-up notifications injected into sessions
- Automatic cleanup when the session goes idle or is deleted
- Targeted test coverage for API mapping, rendering, and watch state transitions

## Requirements

- [Bun](https://bun.sh/) >= 1.3.7
- [OpenCode](https://opencode.ai/)
- GitHub CLI (`gh`) installed and authenticated with `gh auth login`

## Install

Add to your `opencode.json`:

```json
{
  "plugin": ["omp-github-action-watcher@git+https://github.com/ventsislav-georgiev/omp-github-action-watcher.git#opencode"]
}
```

Or drop the plugin into `.opencode/plugins/`.

## Usage

### Start watching a workflow run

The agent can call the `watch_github_action_run` tool:

```text
watch_github_action_run owner=payhawk repo=emi-service run_id=23532645155
```

### Stop watching

By watch id:

```text
stop_github_action_watch watch_id=<watch-id>
```

By repository + run id:

```text
stop_github_action_watch owner=payhawk repo=emi-service run_id=23532645155
```

## Development

```bash
bun install
bun run verify
```

The plugin entry point is `src/plugin.ts`.

## Repository layout

```text
src/
  plugin.ts           # OpenCode plugin registration and tool wiring
  github-api.ts       # GitHub CLI integration and workflow/job mapping
  render.ts           # Text-based notification rendering
  watch-format.ts     # Human-readable summaries and detail lines
  watch-registry.ts   # Polling, diffing, and lifecycle management
  types.ts            # Shared types

test/
  github-api.test.ts
  render.test.ts
  watch-registry.test.ts
  plugin.test.ts
```

## License

MIT
