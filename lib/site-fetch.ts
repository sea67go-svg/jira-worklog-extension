import type { SitePageFetch, SitePageFetchResult } from "./jira/page-fetch";

function headerMap(headers: Headers): Record<string, string> {
  const out: Record<string, string> = {};
  headers.forEach((value, key) => {
    out[key] = value;
  });
  return out;
}

function originPattern(url: string): string {
  return `${new URL(url).origin}/*`;
}

async function findTabForUrl(url: string): Promise<number | null> {
  const pattern = originPattern(url);
  const tabs = await chrome.tabs.query({ url: [pattern] });
  const tab = tabs.find((item) => item.id && item.url?.startsWith("http"));
  return tab?.id ?? null;
}

async function injectFetch(
  tabId: number,
  url: string,
  method: string,
  headers: Record<string, string>,
  body?: string,
): Promise<SitePageFetchResult> {
  const [injection] = await chrome.scripting.executeScript({
    target: { tabId },
    args: [url, method, headers, body ?? null],
    func: async (fetchUrl, fetchMethod, fetchHeaders, fetchBody) => {
      const res = await fetch(fetchUrl, {
        method: fetchMethod,
        headers: fetchHeaders,
        body: fetchBody ?? undefined,
        credentials: "include",
      });
      return { ok: true, status: res.status, text: await res.text() };
    },
  });
  return (injection?.result as SitePageFetchResult) || { ok: false, error: "empty script" };
}

async function fetchViaTab(
  url: string,
  method: string,
  headers: Record<string, string>,
  body?: string,
): Promise<SitePageFetchResult | null> {
  const tabId = await findTabForUrl(url);
  if (!tabId) return null;
  const payload: SitePageFetch = {
    type: "SITE_PAGE_FETCH",
    url,
    method,
    headers,
    body,
  };
  try {
    const viaMessage = (await chrome.tabs.sendMessage(
      tabId,
      payload,
    )) as SitePageFetchResult;
    if (viaMessage?.status) return viaMessage;
  } catch {
    /* content script missing */
  }
  try {
    return await injectFetch(tabId, url, method, headers, body);
  } catch {
    return null;
  }
}

export async function siteRequest(
  url: string,
  init: RequestInit = {},
): Promise<{ status: number; text: string }> {
  const headers = new Headers(init.headers);
  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  if (!headers.has("Accept")) headers.set("Accept", "application/json");
  const method = (init.method || "GET").toUpperCase();
  const body = typeof init.body === "string" ? init.body : undefined;
  const map = headerMap(headers);

  const page = await fetchViaTab(url, method, map, body);
  if (page?.status && page.text != null) {
    return { status: page.status, text: page.text };
  }

  const res = await fetch(url, { ...init, method, headers, credentials: "include" });
  return { status: res.status, text: await res.text() };
}
