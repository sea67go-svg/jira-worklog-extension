export const DEFAULT_BASE_URL = "https://tasks.adv.ru";
export const DEFAULT_HOURS_PER_DAY = 8;

export type WeekView = "board" | "report";

export type Settings = {
  baseUrl: string;
  hoursPerDay: number;
  weekView: WeekView;
};

export async function getSettings(): Promise<Settings> {
  const stored = await chrome.storage.local.get([
    "baseUrl",
    "hoursPerDay",
    "weekView",
  ]);
  const baseUrl = String(stored.baseUrl || DEFAULT_BASE_URL).replace(/\/+$/, "");
  const hoursPerDay = Number(stored.hoursPerDay);
  const weekView: WeekView = stored.weekView === "board" ? "board" : "report";
  return {
    baseUrl: baseUrl || DEFAULT_BASE_URL,
    hoursPerDay:
      Number.isFinite(hoursPerDay) && hoursPerDay > 0
        ? hoursPerDay
        : DEFAULT_HOURS_PER_DAY,
    weekView,
  };
}

export async function saveSettings(settings: Settings): Promise<void> {
  await chrome.storage.local.set({
    baseUrl: settings.baseUrl.replace(/\/+$/, ""),
    hoursPerDay: settings.hoursPerDay,
    weekView: settings.weekView,
  });
}
