import type { Period } from "./jira/dates";

export const DEFAULT_BASE_URL = "https://tasks.adv.ru";
export const DEFAULT_HOURS_PER_DAY = 8;

export type WeekView = "board" | "report";
export type { Period };

export const DEFAULT_GITHUB_REPO = "sea67go-svg/jira-worklog-extension";

export const DEFAULT_AGENT_MODEL = "gpt-4o-mini";
export const DEFAULT_AGENT_API_URL = "https://api.openai.com/v1";
export const DEFAULT_AGENT_HOST_URL = "http://127.0.0.1:7845";

export type Settings = {
  baseUrl: string;
  hoursPerDay: number;
  weekView: WeekView;
  period: Period;
  githubRepo: string;
  githubToken: string;
  agentApiUrl: string;
  agentApiKey: string;
  agentModel: string;
  cursorApiKey: string;
  agentHostUrl: string;
};

export async function getSettings(): Promise<Settings> {
  const stored = await chrome.storage.local.get([
    "baseUrl",
    "hoursPerDay",
    "weekView",
    "period",
    "githubRepo",
    "githubToken",
    "agentApiUrl",
    "agentApiKey",
    "agentModel",
    "cursorApiKey",
    "agentHostUrl",
  ]);
  const baseUrl = String(stored.baseUrl || DEFAULT_BASE_URL).replace(/\/+$/, "");
  const hoursPerDay = Number(stored.hoursPerDay);
  const weekView: WeekView = stored.weekView === "board" ? "board" : "report";
  const period: Period = stored.period === "week" ? "week" : "month";
  return {
    baseUrl: baseUrl || DEFAULT_BASE_URL,
    hoursPerDay:
      Number.isFinite(hoursPerDay) && hoursPerDay > 0
        ? hoursPerDay
        : DEFAULT_HOURS_PER_DAY,
    weekView,
    period,
    githubRepo: String(stored.githubRepo || DEFAULT_GITHUB_REPO),
    githubToken: String(stored.githubToken || ""),
    agentApiUrl: String(stored.agentApiUrl || DEFAULT_AGENT_API_URL),
    agentApiKey: String(stored.agentApiKey || ""),
    agentModel: String(stored.agentModel || DEFAULT_AGENT_MODEL),
    cursorApiKey: String(stored.cursorApiKey || ""),
    agentHostUrl: String(stored.agentHostUrl || DEFAULT_AGENT_HOST_URL),
  };
}

export async function saveSettings(settings: Settings): Promise<void> {
  await chrome.storage.local.set({
    baseUrl: settings.baseUrl.replace(/\/+$/, ""),
    hoursPerDay: settings.hoursPerDay,
    weekView: settings.weekView,
    period: settings.period,
    githubRepo: settings.githubRepo,
    githubToken: settings.githubToken,
    agentApiUrl: settings.agentApiUrl,
    agentApiKey: settings.agentApiKey,
    agentModel: settings.agentModel,
    cursorApiKey: settings.cursorApiKey,
    agentHostUrl: settings.agentHostUrl,
  });
}
