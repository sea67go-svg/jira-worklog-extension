import { siteRequest } from "./site-fetch";

export type GitLabMrRef = {
  host: string;
  project: string;
  iid: string;
  webUrl: string;
};

const MR_RE =
  /https?:\/\/([^/\s]+)\/(.+?)\/-\/merge_requests\/(\d+)/gi;

export function parseGitLabMrUrls(text: string): GitLabMrRef[] {
  const found: GitLabMrRef[] = [];
  const seen = new Set<string>();
  for (const match of text.matchAll(MR_RE)) {
    const host = match[1];
    const project = match[2].replace(/^\/+|\/+$/g, "");
    const iid = match[3];
    const webUrl = `https://${host}/${project}/-/merge_requests/${iid}`;
    if (seen.has(webUrl)) continue;
    seen.add(webUrl);
    found.push({ host, project, iid, webUrl });
  }
  return found;
}

export async function fetchGitLabMr(ref: GitLabMrRef): Promise<unknown> {
  const encoded = encodeURIComponent(ref.project);
  const base = `https://${ref.host}/api/v4/projects/${encoded}/merge_requests/${ref.iid}`;
  const mr = await gitlabJson(base);
  const commits = await gitlabJson(`${base}/commits`);
  let changes: unknown = null;
  try {
    const raw = await gitlabJson(`${base}/changes`);
    changes = trimChanges(raw);
  } catch {
    changes = null;
  }
  return { merge_request: mr, commits, changes };
}

async function gitlabJson(url: string): Promise<unknown> {
  const { status, text } = await siteRequest(url, {
    headers: { Accept: "application/json" },
  });
  if (status === 401 || status === 403) {
    throw new Error(`GitLab ${status}: откройте вкладку https://gitlab.adv.ru и войдите`);
  }
  if (status >= 400) {
    throw new Error(`GitLab ${status}: ${text.slice(0, 300)}`);
  }
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new Error("GitLab вернула не JSON. Откройте gitlab.adv.ru в браузере.");
  }
}

function trimChanges(raw: unknown): unknown {
  const json = JSON.stringify(raw);
  if (json.length < 60_000) return raw;
  if (raw && typeof raw === "object" && "changes" in raw && Array.isArray((raw as { changes: unknown[] }).changes)) {
    const sliced = (raw as { changes: unknown[] }).changes.slice(0, 20);
    return { ...(raw as object), changes: sliced, truncated: true };
  }
  return { truncated: true, preview: json.slice(0, 60_000) };
}
