import type { GithubActionWatchNotificationDetails } from "./types";
import { buildGithubActionWatchRenderLines } from "./watch-format";

export function renderWatchNotification(details: GithubActionWatchNotificationDetails): string {
	return buildGithubActionWatchRenderLines(details).join("\n");
}
