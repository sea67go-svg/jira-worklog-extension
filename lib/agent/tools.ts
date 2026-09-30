import {
  addDays,
  formatHours,
  formatJiraStarted,
  mondayOf,
  parseDateKey,
  parseTimeInput,
  toDateKey,
} from "../jira/dates";
import { createWorklog, loadWeek, searchIssuesPicker } from "../jira/client";
import { getSettings } from "../settings";
import { listBranches, listCommits } from "../github";
import { fetchGitLabMr, parseGitLabMrUrls } from "../gitlab";
import { siteRequest } from "../site-fetch";

export type AgentFlags = {
  reload?: boolean;
  refreshWeek?: boolean;
  steps?: string[];
};

export type StatusFn = (text: string) => void;

function startedFor(dateKey: string): string {
  const day = parseDateKey(dateKey);
  day.setHours(10, 0, 0, 0);
  return formatJiraStarted(day);
}

function todayKey(): string {
  return toDateKey(new Date());
}

export const AGENT_TOOLS = [
  {
    type: "function",
    function: {
      name: "get_week_summary",
      description: "Сводка worklog текущего пользователя за неделю",
      parameters: {
        type: "object",
        properties: {
          weekStart: { type: "string", description: "Понедельник YYYY-MM-DD" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "search_issues",
      description: "Поиск задач Jira по тексту или ключу",
      parameters: {
        type: "object",
        properties: { query: { type: "string" } },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_worklog",
      description: "Создать worklog в Jira. date по умолчанию сегодня.",
      parameters: {
        type: "object",
        properties: {
          issueKey: { type: "string" },
          date: { type: "string", description: "YYYY-MM-DD" },
          timeSpent: { type: "string", description: "Например 2h, 30m или 1.5" },
          comment: { type: "string" },
        },
        required: ["issueKey", "timeSpent"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "fetch_url",
      description:
        "GET URL с сессией браузера (Jira, GitLab). Нужна открытая вкладка того же origin.",
      parameters: {
        type: "object",
        properties: { url: { type: "string" } },
        required: ["url"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_gitlab_mr",
      description:
        "Загрузить merge request GitLab по URL вида https://gitlab.adv.ru/group/proj/-/merge_requests/54 (описание, коммиты, diff).",
      parameters: {
        type: "object",
        properties: { url: { type: "string" } },
        required: ["url"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_commits",
      description: "Коммиты GitHub-репозитория расширения",
      parameters: {
        type: "object",
        properties: {
          since: { type: "string" },
          until: { type: "string" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_branches",
      description: "Ветки GitHub-репозитория расширения",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "cursor_code_task",
      description:
        "Поручить локальному Cursor SDK host правки кода/git в репозитории расширения. Нужен запущенный npm run agent-host.",
      parameters: {
        type: "object",
        properties: { prompt: { type: "string" } },
        required: ["prompt"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "reload_extension",
      description: "Перезагрузить браузерное расширение",
      parameters: { type: "object", properties: {} },
    },
  },
];

export async function executeAgentTool(
  name: string,
  rawArgs: string,
  weekStart: string,
  flags: AgentFlags,
  onStatus?: StatusFn,
): Promise<string> {
  const args = rawArgs ? (JSON.parse(rawArgs) as Record<string, string>) : {};
  const start = mondayOf(parseDateKey(args.weekStart || weekStart));
  const startKey = toDateKey(start);
  const endKey = toDateKey(addDays(start, 6));
  flags.steps = flags.steps || [];
  flags.steps.push(name);
  onStatus?.(`Инструмент: ${name}`);

  switch (name) {
    case "get_week_summary": {
      const settings = await getSettings();
      const data = await loadWeek(startKey, settings.period);
      const days = Object.keys(data.days)
        .sort()
        .map((key) => {
          const list = data.days[key] || [];
          const sec = list.reduce((s, e) => s + e.timeSpentSeconds, 0);
          const items = list
            .map((e) => `${e.issueKey} ${formatHours(e.timeSpentSeconds)} ${e.comment || e.summary}`)
            .join("; ");
          return { date: key, total: formatHours(sec), entries: items };
        });
      return JSON.stringify({
        user: data.stats.user,
        days,
        source: data.stats.source,
      });
    }
    case "search_issues": {
      const issues = await searchIssuesPicker(args.query || "");
      return JSON.stringify(issues.slice(0, 10));
    }
    case "create_worklog": {
      const spent = parseTimeInput(String(args.timeSpent || "").replace(",", "."));
      const date = args.date || todayKey();
      await createWorklog({
        issueKey: args.issueKey.toUpperCase(),
        started: startedFor(date),
        timeSpent: spent,
        comment: args.comment || "",
      });
      flags.refreshWeek = true;
      return JSON.stringify({ ok: true, issueKey: args.issueKey, date, timeSpent: spent });
    }
    case "fetch_url": {
      const { status, text } = await siteRequest(args.url);
      const clipped = text.length > 80_000 ? `${text.slice(0, 80_000)}…` : text;
      return JSON.stringify({ status, text: clipped });
    }
    case "get_gitlab_mr": {
      const refs = parseGitLabMrUrls(args.url || "");
      if (!refs.length) {
        return JSON.stringify({ error: "Не похоже на URL merge request GitLab" });
      }
      const data = await fetchGitLabMr(refs[0]);
      return JSON.stringify(data);
    }
    case "list_commits": {
      const { githubRepo } = await getSettings();
      const commits = await listCommits(args.since || startKey, args.until || endKey);
      return JSON.stringify({ repo: githubRepo, commits });
    }
    case "list_branches": {
      const { githubRepo } = await getSettings();
      const branches = await listBranches();
      return JSON.stringify({ repo: githubRepo, branches });
    }
    case "cursor_code_task": {
      const { agentHostUrl, cursorApiKey } = await getSettings();
      const host = (agentHostUrl || "http://127.0.0.1:7845").replace(/\/+$/, "");
      const res = await fetch(`${host}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: args.prompt, apiKey: cursorApiKey }),
      });
      const text = await res.text();
      if (!res.ok) {
        return JSON.stringify({
          error: `Cursor host ${res.status}: ${text.slice(0, 400)}. Запустите npm run agent-host`,
        });
      }
      return text.length > 80_000 ? text.slice(0, 80_000) : text;
    }
    case "reload_extension":
      flags.reload = true;
      return JSON.stringify({ ok: true });
    default:
      return JSON.stringify({ error: `unknown tool ${name}` });
  }
}
