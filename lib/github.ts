import { getSettings } from "./settings";

export type GithubCommit = {
  sha: string;
  message: string;
  date: string;
  author: string;
  url: string;
};

export type GithubBranch = {
  name: string;
  sha: string;
};

function repoParts(repo: string): { owner: string; name: string } {
  const [owner, name] = repo.split("/");
  if (!owner || !name) {
    throw new Error("Укажите репозиторий в настройках как owner/name");
  }
  return { owner, name };
}

async function githubJson<T>(path: string): Promise<T> {
  const { githubToken } = await getSettings();
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  if (githubToken) headers.Authorization = `Bearer ${githubToken}`;
  const res = await fetch(`https://api.github.com${path}`, { headers });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`GitHub ${res.status}: ${text.slice(0, 240)}`);
  }
  return JSON.parse(text) as T;
}

export async function listCommits(since?: string, until?: string): Promise<GithubCommit[]> {
  const { githubRepo } = await getSettings();
  const { owner, name } = repoParts(githubRepo);
  const qs = new URLSearchParams({ per_page: "30" });
  if (since) qs.set("since", `${since}T00:00:00Z`);
  if (until) qs.set("until", `${until}T23:59:59Z`);
  const rows = await githubJson<
    {
      sha: string;
      html_url: string;
      commit: { message: string; author?: { name?: string; date?: string } };
    }[]
  >(`/repos/${owner}/${name}/commits?${qs.toString()}`);
  return rows.map((row) => ({
    sha: row.sha.slice(0, 7),
    message: (row.commit.message || "").split("\n")[0],
    date: (row.commit.author?.date || "").slice(0, 10),
    author: row.commit.author?.name || "",
    url: row.html_url,
  }));
}

export async function listBranches(): Promise<GithubBranch[]> {
  const { githubRepo } = await getSettings();
  const { owner, name } = repoParts(githubRepo);
  const rows = await githubJson<{ name: string; commit: { sha: string } }[]>(
    `/repos/${owner}/${name}/branches?per_page=50`,
  );
  return rows.map((row) => ({ name: row.name, sha: row.commit.sha.slice(0, 7) }));
}
