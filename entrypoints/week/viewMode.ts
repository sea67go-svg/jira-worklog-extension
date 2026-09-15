export type ViewMode = "board" | "report";

export async function getViewMode(): Promise<ViewMode> {
  const stored = await chrome.storage.local.get("viewMode");
  return stored.viewMode === "board" ? "board" : "report";
}

export async function saveViewMode(viewMode: ViewMode): Promise<void> {
  await chrome.storage.local.set({ viewMode });
}
