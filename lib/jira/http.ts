import { getSettings } from "../settings";
import { JiraApiError, JiraAuthError } from "./errors";
import { siteRequest } from "../site-fetch";

function looksLikeJson(text: string): boolean {
  const trimmed = text.trim();
  return trimmed.startsWith("{") || trimmed.startsWith("[");
}

export async function jiraRequest(path: string, init: RequestInit = {}): Promise<string> {
  const { baseUrl } = await getSettings();
  const url = path.startsWith("http") ? path : `${baseUrl}${path}`;
  const headers = new Headers(init.headers);
  headers.set("Accept", "application/json");
  headers.set("X-Atlassian-Token", "no-check");
  const { status, text } = await siteRequest(url, { ...init, headers });
  if (status === 401) throw new JiraAuthError();
  if (status === 204 || !text) {
    if (status >= 400) throw new JiraApiError(status, "empty");
    return "";
  }
  if (status >= 400) {
    throw new JiraApiError(status, text.slice(0, 500));
  }
  if (!looksLikeJson(text)) {
    throw new JiraAuthError("Откройте вкладку https://tasks.adv.ru и войдите в Jira");
  }
  return text;
}

export async function jiraJson<T>(path: string, init: RequestInit = {}): Promise<T> {
  const text = await jiraRequest(path, init);
  if (!text) return undefined as T;
  return JSON.parse(text) as T;
}
