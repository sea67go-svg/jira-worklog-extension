import type {
  IssuePickerIssue,
  JiraIssue,
  JiraUser,
  JiraWorklog,
  WeekLoadStats,
  WorklogEntry,
} from "./types";
import {
  dateKeysForStarted,
  parseDateKey,
  periodKeys,
  toDateKey,
  withDateKeepingTime,
  type Period,
} from "./dates";
import { jiraJson } from "./http";

export { JiraApiError, JiraAuthError } from "./errors";

function userIds(user?: JiraUser | null): string[] {
  if (!user) return [];
  return [user.accountId, user.key, user.name, user.emailAddress, user.displayName]
    .filter((value): value is string => Boolean(value))
    .map((value) => value.trim().toLowerCase());
}

function sameUser(a?: JiraUser | null, b?: JiraUser | null): boolean {
  const left = userIds(a);
  const right = userIds(b);
  return left.some((id) => right.includes(id));
}

function isMine(myself: JiraUser, log: JiraWorklog): boolean {
  if (!log.author) return true;
  return sameUser(myself, log.author);
}

function readComment(comment: unknown): string {
  if (!comment) return "";
  if (typeof comment === "string") return comment;
  return "";
}

export async function getMyself(): Promise<JiraUser> {
  return jiraJson<JiraUser>("/rest/api/2/myself");
}

async function searchPost(jql: string, startAt: number, maxResults: number) {
  return jiraJson<{
    startAt: number;
    maxResults: number;
    total: number;
    issues: JiraIssue[];
  }>("/rest/api/2/search", {
    method: "POST",
    body: JSON.stringify({
      jql,
      startAt,
      maxResults,
      fields: ["summary"],
    }),
  });
}

async function searchGet(jql: string, startAt: number, maxResults: number) {
  const qs = new URLSearchParams({
    jql,
    startAt: String(startAt),
    maxResults: String(maxResults),
    fields: "summary",
  });
  return jiraJson<{
    startAt: number;
    maxResults: number;
    total: number;
    issues: JiraIssue[];
  }>(`/rest/api/2/search?${qs.toString()}`);
}

async function searchIssues(jql: string, limit = 100): Promise<JiraIssue[]> {
  const issues: JiraIssue[] = [];
  let startAt = 0;
  const maxResults = 50;
  let useGet = false;
  while (issues.length < limit) {
    let page: {
      startAt: number;
      maxResults: number;
      total: number;
      issues: JiraIssue[];
    };
    try {
      page = useGet
        ? await searchGet(jql, startAt, maxResults)
        : await searchPost(jql, startAt, maxResults);
    } catch (error) {
      if (!useGet) {
        useGet = true;
        page = await searchGet(jql, startAt, maxResults);
      } else {
        throw error;
      }
    }
    issues.push(...(page.issues || []));
    startAt += page.issues?.length || 0;
    if (startAt >= page.total || !page.issues?.length) break;
  }
  return issues.slice(0, limit);
}

async function listWorklogs(issueKey: string): Promise<JiraWorklog[]> {
  const worklogs: JiraWorklog[] = [];
  let startAt = 0;
  const maxResults = 1000;
  while (true) {
    const page = await jiraJson<{
      startAt: number;
      maxResults: number;
      total: number;
      worklogs: JiraWorklog[];
    }>(
      `/rest/api/2/issue/${encodeURIComponent(issueKey)}/worklog?startAt=${startAt}&maxResults=${maxResults}`,
    );
    worklogs.push(...(page.worklogs || []));
    startAt += page.worklogs?.length || 0;
    if (startAt >= page.total || !page.worklogs?.length) break;
  }
  return worklogs;
}

function toEntry(issue: Pick<JiraIssue, "id" | "key"> & { fields: { summary: string } }, log: JiraWorklog, dateKey: string): WorklogEntry {
  return {
    id: String(log.id),
    issueKey: issue.key,
    issueId: issue.id,
    summary: issue.fields.summary,
    started: log.started,
    dateKey,
    timeSpent: log.timeSpent,
    timeSpentSeconds: log.timeSpentSeconds,
    comment: readComment(log.comment),
    authorName: log.author?.displayName || log.author?.name || "",
  };
}

function emptyDays(keys: string[]): Record<string, WorklogEntry[]> {
  const days: Record<string, WorklogEntry[]> = {};
  for (const key of keys) days[key] = [];
  return days;
}

function addLogToDays(
  days: Record<string, WorklogEntry[]>,
  allowed: Set<string>,
  issue: JiraIssue,
  log: JiraWorklog,
) {
  const keys = dateKeysForStarted(log.started).filter((key) => allowed.has(key));
  const dateKey = keys[0];
  if (!dateKey) return;
  const exists = days[dateKey].some(
    (entry) => entry.id === String(log.id) && entry.issueKey === issue.key,
  );
  if (exists) return;
  days[dateKey].push(toEntry(issue, log, dateKey));
}

async function fillFromIssues(
  issues: JiraIssue[],
  myself: JiraUser,
  days: Record<string, WorklogEntry[]>,
  allowed: Set<string>,
) {
  const unique = new Map<string, JiraIssue>();
  for (const issue of issues) unique.set(issue.key, issue);
  const list = [...unique.values()];
  const batch = 6;
  for (let i = 0; i < list.length; i += batch) {
    const chunk = list.slice(i, i + batch);
    const logsPerIssue = await Promise.all(
      chunk.map(async (issue) => ({ issue, logs: await listWorklogs(issue.key) })),
    );
    for (const { issue, logs } of logsPerIssue) {
      const mine = logs.filter((log) => isMine(myself, log));
      const usable =
        mine.length > 0
          ? mine
          : logs.filter((log) =>
              dateKeysForStarted(log.started).some((key) => allowed.has(key)),
            );
      for (const log of usable) {
        addLogToDays(days, allowed, issue, log);
      }
    }
  }
}

function slashDate(iso: string): string {
  return iso.replaceAll("-", "/");
}

function jqlVariants(myself: JiraUser, startKey: string, endKey: string): string[] {
  const user = myself.name || myself.key;
  const quoted = user ? `"${user.replaceAll('"', '\\"')}"` : "";
  const variants = [
    `worklogAuthor = currentUser() ORDER BY updated DESC`,
    `worklogAuthor = currentUser() AND updated >= "${startKey}" ORDER BY updated DESC`,
    `worklogAuthor = currentUser() AND worklogDate >= "${startKey}" AND worklogDate <= "${endKey}"`,
    `worklogAuthor = currentUser() AND worklogDate >= "${slashDate(startKey)}" AND worklogDate <= "${slashDate(endKey)}"`,
  ];
  if (quoted) {
    variants.push(
      `worklogAuthor = ${quoted} ORDER BY updated DESC`,
      `worklogAuthor = ${quoted} AND worklogDate >= "${startKey}" AND worklogDate <= "${endKey}"`,
    );
  }
  return variants;
}

type TempoWorklog = {
  tempoWorklogId?: number;
  originId?: number;
  dateStarted?: string;
  started?: string;
  timeSpentSeconds?: number;
  comment?: string;
  issue?: { id?: number | string; key?: string; summary?: string };
  author?: JiraUser;
};

async function loadTempoWeek(
  startKey: string,
  endKey: string,
  myself: JiraUser,
): Promise<JiraIssue[]> {
  const user = myself.name || myself.key || "";
  const qs = new URLSearchParams({
    dateFrom: startKey,
    dateTo: endKey,
  });
  if (user) qs.set("username", user);
  try {
    const rows = await jiraJson<TempoWorklog[]>(
      `/rest/tempo-timesheets/3/worklogs?${qs.toString()}`,
    );
    if (!Array.isArray(rows) || rows.length === 0) return [];
    const byKey = new Map<string, JiraIssue & { _logs: JiraWorklog[] }>();
    for (const row of rows) {
      const key = row.issue?.key;
      if (!key) continue;
      const started = row.dateStarted || row.started;
      if (!started) continue;
      const issue =
        byKey.get(key) ||
        ({
          id: String(row.issue?.id || key),
          key,
          fields: { summary: row.issue?.summary || key },
          _logs: [],
        } as JiraIssue & { _logs: JiraWorklog[] });
      issue._logs.push({
        id: String(row.tempoWorklogId || row.originId || `${key}-${started}`),
        started,
        timeSpent: "",
        timeSpentSeconds: row.timeSpentSeconds || 0,
        comment: row.comment,
        author: row.author || myself,
      });
      byKey.set(key, issue);
    }
    return [...byKey.values()].map((issue) => {
      (issue as JiraIssue).fields.worklog = {
        startAt: 0,
        maxResults: issue._logs.length,
        total: issue._logs.length,
        worklogs: issue._logs,
      };
      return issue;
    });
  } catch {
    return [];
  }
}

export async function loadWeek(
  weekStartKey: string,
  period: Period = "week",
): Promise<{
  myself: JiraUser;
  weekStart: string;
  days: Record<string, WorklogEntry[]>;
  stats: WeekLoadStats;
}> {
  const keys = periodKeys(parseDateKey(weekStartKey), period);
  const startKey = keys[0];
  const endKey = keys[keys.length - 1];
  const myself = await getMyself();
  const allowed = new Set(keys);
  const days = emptyDays(keys);

  let issues: JiraIssue[] = [];
  let usedJql = "";
  const seen = new Set<string>();
  for (const jql of jqlVariants(myself, startKey, endKey)) {
    try {
      const found = await searchIssues(jql);
      if (!usedJql) usedJql = jql;
      for (const issue of found) {
        if (!seen.has(issue.key)) {
          seen.add(issue.key);
          issues.push(issue);
        }
      }
      if (issues.length >= 80) break;
    } catch {
      continue;
    }
  }

  await fillFromIssues(issues, myself, days, allowed);

  let source = "jira-worklog";
  const count = () =>
    Object.values(days).reduce((sum, list) => sum + list.length, 0);

  if (count() === 0) {
    const tempoIssues = await loadTempoWeek(startKey, endKey, myself);
    if (tempoIssues.length) {
      source = "tempo";
      for (const issue of tempoIssues) {
        for (const log of issue.fields.worklog?.worklogs || []) {
          addLogToDays(days, allowed, issue, log);
        }
      }
    }
  }

  for (const key of allowed) {
    days[key].sort((a, b) => a.started.localeCompare(b.started));
  }

  return {
    myself,
    weekStart: startKey,
    days,
    stats: {
      user: myself.displayName || myself.name || myself.key || "unknown",
      issues: issues.length,
      entries: count(),
      source,
      jql: usedJql,
    },
  };
}

export async function createWorklog(input: {
  issueKey: string;
  started: string;
  timeSpent: string;
  comment: string;
}): Promise<JiraWorklog> {
  return jiraJson<JiraWorklog>(
    `/rest/api/2/issue/${encodeURIComponent(input.issueKey)}/worklog`,
    {
      method: "POST",
      body: JSON.stringify({
        started: input.started,
        timeSpent: input.timeSpent,
        comment: input.comment,
      }),
    },
  );
}

export async function updateWorklog(input: {
  issueKey: string;
  worklogId: string;
  started: string;
  timeSpent: string;
  comment: string;
}): Promise<JiraWorklog> {
  return jiraJson<JiraWorklog>(
    `/rest/api/2/issue/${encodeURIComponent(input.issueKey)}/worklog/${encodeURIComponent(input.worklogId)}`,
    {
      method: "PUT",
      body: JSON.stringify({
        started: input.started,
        timeSpent: input.timeSpent,
        comment: input.comment,
      }),
    },
  );
}

export async function moveWorklog(input: {
  issueKey: string;
  worklogId: string;
  fromStarted: string;
  toDateKey: string;
  timeSpent: string;
  comment: string;
}): Promise<JiraWorklog> {
  return updateWorklog({
    issueKey: input.issueKey,
    worklogId: input.worklogId,
    started: withDateKeepingTime(input.fromStarted, input.toDateKey),
    timeSpent: input.timeSpent,
    comment: input.comment,
  });
}

export async function deleteWorklog(issueKey: string, worklogId: string): Promise<void> {
  await jiraJson(
    `/rest/api/2/issue/${encodeURIComponent(issueKey)}/worklog/${encodeURIComponent(worklogId)}`,
    { method: "DELETE" },
  );
}

export async function searchIssuesPicker(query: string): Promise<IssuePickerIssue[]> {
  const q = query.trim();
  if (!q) return [];
  const data = await jiraJson<{
    sections?: { issues?: IssuePickerIssue[] }[];
  }>(`/rest/api/2/issue/picker?query=${encodeURIComponent(q)}&showSubTasks=true`);
  const issues = (data.sections || []).flatMap((s) => s.issues || []);
  const seen = new Set<string>();
  return issues.filter((issue) => {
    if (seen.has(issue.key)) return false;
    seen.add(issue.key);
    return true;
  });
}
