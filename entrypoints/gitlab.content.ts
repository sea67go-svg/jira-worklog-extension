import type { SitePageFetch, SitePageFetchResult } from "../lib/jira/page-fetch";

function isSiteFetch(message: unknown): message is SitePageFetch {
  const type = (message as { type?: string } | null)?.type;
  return type === "SITE_PAGE_FETCH" || type === "JIRA_PAGE_FETCH";
}

export default defineContentScript({
  matches: ["https://gitlab.adv.ru/*"],
  runAt: "document_idle",
  main() {
    chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      if (!isSiteFetch(message)) return;
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
          } satisfies SitePageFetchResult);
        } catch (error) {
          sendResponse({
            ok: false,
            error: error instanceof Error ? error.message : String(error),
          } satisfies SitePageFetchResult);
        }
      })();
      return true;
    });
  },
});
