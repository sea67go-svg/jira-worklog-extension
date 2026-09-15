import type { JiraPageFetch, JiraPageFetchResult } from "../lib/jira/page-fetch";

export default defineContentScript({
  matches: ["https://tasks.adv.ru/*"],
  runAt: "document_idle",
  main() {
    chrome.runtime.onMessage.addListener(
      (message: JiraPageFetch, _sender, sendResponse) => {
        if (message?.type !== "JIRA_PAGE_FETCH") return;
        void (async () => {
          try {
            const res = await fetch(message.url, {
              method: message.method,
              headers: message.headers,
              body: message.body,
              credentials: "include",
            });
            sendResponse({
              ok: true,
              status: res.status,
              text: await res.text(),
            } satisfies JiraPageFetchResult);
          } catch (error) {
            sendResponse({
              ok: false,
              error: error instanceof Error ? error.message : String(error),
            } satisfies JiraPageFetchResult);
          }
        })();
        return true;
      },
    );
  },
});
