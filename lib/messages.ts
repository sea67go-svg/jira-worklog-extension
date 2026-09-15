import type { Settings } from "./settings";
import type {
  IssuePickerIssue,
  JiraUser,
  WeekLoadStats,
  WorklogEntry,
} from "./jira/types";

export type WeekPayload = {
  myself: JiraUser;
  weekStart: string;
  days: Record<string, WorklogEntry[]>;
  stats: WeekLoadStats;
};

export type ExtensionRequest =
  | { type: "GET_SETTINGS" }
  | { type: "SAVE_SETTINGS"; settings: Settings }
  | { type: "LOAD_WEEK"; weekStart: string }
  | { type: "SEARCH_ISSUES"; query: string }
  | {
      type: "CREATE_WORKLOG";
      issueKey: string;
      started: string;
      timeSpent: string;
      comment: string;
    }
  | {
      type: "UPDATE_WORKLOG";
      issueKey: string;
      worklogId: string;
      started: string;
      timeSpent: string;
      comment: string;
    }
  | {
      type: "MOVE_WORKLOG";
      issueKey: string;
      worklogId: string;
      fromStarted: string;
      toDateKey: string;
      timeSpent: string;
      comment: string;
    }
  | { type: "DELETE_WORKLOG"; issueKey: string; worklogId: string };

export type ExtensionResponse<T = unknown> =
  | { ok: true; data: T }
  | { ok: false; error: string; auth?: boolean };

export async function sendMessage<T>(
  request: ExtensionRequest,
): Promise<T> {
  const response = (await chrome.runtime.sendMessage(
    request,
  )) as ExtensionResponse<T>;
  if (!response?.ok) {
    const error = new Error(response?.error || "Ошибка расширения");
    (error as Error & { auth?: boolean }).auth = Boolean(response?.auth);
    throw error;
  }
  return response.data;
}

export function getSettingsMsg(): Promise<Settings> {
  return sendMessage<Settings>({ type: "GET_SETTINGS" });
}

export function saveSettingsMsg(settings: Settings): Promise<Settings> {
  return sendMessage<Settings>({ type: "SAVE_SETTINGS", settings });
}

export function loadWeekMsg(weekStart: string): Promise<WeekPayload> {
  return sendMessage<WeekPayload>({ type: "LOAD_WEEK", weekStart });
}

export function searchIssuesMsg(query: string): Promise<IssuePickerIssue[]> {
  return sendMessage<IssuePickerIssue[]>({ type: "SEARCH_ISSUES", query });
}
