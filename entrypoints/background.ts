import {
  createWorklog,
  deleteWorklog,
  JiraAuthError,
  loadWeek,
  moveWorklog,
  searchIssuesPicker,
  updateWorklog,
} from "../lib/jira/client";
import { getSettings, saveSettings } from "../lib/settings";
import type { ExtensionRequest, ExtensionResponse } from "../lib/messages";

export default defineBackground(() => {
  chrome.runtime.onMessage.addListener(
    (request: ExtensionRequest, _sender, sendResponse) => {
      if (!request?.type) return;
      handle(request)
        .then((data) => sendResponse({ ok: true, data } satisfies ExtensionResponse))
        .catch((err: unknown) => {
          const auth = err instanceof JiraAuthError;
          const message =
            err instanceof Error ? err.message : "Неизвестная ошибка";
          sendResponse({
            ok: false,
            error: auth
              ? "Откройте https://tasks.adv.ru и войдите в Jira"
              : message,
            auth,
          } satisfies ExtensionResponse);
        });
      return true;
    },
  );
});

async function handle(request: ExtensionRequest): Promise<unknown> {
  switch (request.type) {
    case "GET_SETTINGS":
      return getSettings();
    case "SAVE_SETTINGS":
      await saveSettings(request.settings);
      return getSettings();
    case "LOAD_WEEK":
      return loadWeek(request.weekStart);
    case "SEARCH_ISSUES":
      return searchIssuesPicker(request.query);
    case "CREATE_WORKLOG":
      return createWorklog(request);
    case "UPDATE_WORKLOG":
      return updateWorklog(request);
    case "MOVE_WORKLOG":
      return moveWorklog(request);
    case "DELETE_WORKLOG":
      await deleteWorklog(request.issueKey, request.worklogId);
      return true;
    default:
      throw new Error("Неизвестный запрос");
  }
}
