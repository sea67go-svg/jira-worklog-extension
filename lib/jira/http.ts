import { getSettings } from "../settings";
import type { JiraPageFetch, JiraPageFetchResult } from "./page-fetch";
import { JiraApiError, JiraAuthError } from "./errors";

function headerMap(headers: Headers): Record<string, string> {
  const out: Record<string, string> = {};
  headers.forEach((value, key) => {
    out[key] = value;
  });
  return out;
}

function looksLikeJson(text: string): boolean {
  const trimmed = text.trim();
  return trimmed.startsWith("{") || trimmed.startsWith("[");
}

async function findJiraTab(baseUrl: string): Promise<number | null> {
  const origin = `${baseUrl.replace(/\/+$/, "")}/*`;
  const tabs = await chrome.tabs.query({ url: [origin, "https://tasks.adv.ru/*"] });
  const tab = tabs.find((item) => item.id && item.url?.startsWith("http"));
  return tab?.id ?? null;
}

async function injectFetch(
  tabId: number,
  url: string,
  method: string,
  headers: Record<string, string>,
  body?: string,
): Promise<JiraPageFetchResult> {
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
  return (injection?.result as JiraPageFetchResult) || { ok: false, error: "empty script" };
}

async function fetchViaTab(
  url: string,
  method: string,
  headers: Record<string, string>,
  body?: string,
): Promise<JiraPageFetchResult | null> {
  const { baseUrl } = await getSettings();
  const tabId = await findJiraTab(baseUrl);
  if (!tabId) return null;
  const payload: JiraPageFetch = {
    type: "JIRA_PAGE_FETCH",
    url,
    method,
    headers,
    body,
  };
  try {
    const viaMessage = (await chrome.tabs.sendMessage(
      tabId,
      payload,
    )) as JiraPageFetchResult;
    if (viaMessage?.status) return viaMessage;
  } catch {
    /* content script may be missing until reload */
  }
  try {
    return await injectFetch(tabId, url, method, headers, body);
  } catch {
    return null;
  }
}

export async function jiraRequest(path: string, init: RequestInit = {}): Promise<string> {
  const { baseUrl } = await getSettings();
  const url = path.startsWith("http") ? path : `${baseUrl}${path}`;
  const headers = new Headers(init.headers);
  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  headers.set("Accept", "application/json");
  headers.set("X-Atlassian-Token", "no-check");
  const method = (init.method || "GET").toUpperCase();
  const body = typeof init.body === "string" ? init.body : undefined;
  const map = headerMap(headers);

  const page = await fetchViaTab(url, method, map, body);
  if (page?.status === 401) throw new JiraAuthError();
  if (page?.ok && page.status && page.status < 400 && page.text && looksLikeJson(page.text)) {
    return page.text;
  }
  if (page?.status && page.status >= 400 && page.text && looksLikeJson(page.text)) {
    throw new JiraApiError(page.status, page.text.slice(0, 500));
  }

  const res = await fetch(url, { ...init, method, headers, credentials: "include" });
  const text = await res.text();
  if (res.status === 401) throw new JiraAuthError();
  if (!res.ok) {
    throw new JiraApiError(res.status, text.slice(0, 500) || res.statusText);
  }
  if (res.status === 204 || !text) return "";
  if (!looksLikeJson(text)) {
    throw new JiraAuthError("Откройте вкладку https://tasks.adv.ru и обновите расширение");
  }
  return text;
}

export async function jiraJson<T>(path: string, init: RequestInit = {}): Promise<T> {
  const text = await jiraRequest(path, init);
  if (!text) return undefined as T;
  return JSON.parse(text) as T;
}
