import type { WorklogEntry } from "../../lib/jira/types";
import {
  formatDayShort,
  formatHours,
  parseDateKey,
  projectKey,
  weekdayUpper,
} from "../../lib/jira/dates";

type Props = {
  keys: string[];
  days: Record<string, WorklogEntry[]>;
  todayKey: string;
  baseUrl: string;
  weekTotal: number;
  hoursPerDay: number;
  onOpen: (dateKey: string, entry?: WorklogEntry) => void;
  onDrop: (dateKey: string, entry: WorklogEntry) => void;
};

const PROJECT_COLORS = [
  "#2b6cb0",
  "#2f855a",
  "#6b46c1",
  "#c05621",
  "#2c7a7b",
  "#9b2c2c",
];

function projectColor(issueKey: string): string {
  const name = projectKey(issueKey);
  let hash = 0;
  for (const char of name) hash = (hash * 31 + char.charCodeAt(0)) | 0;
  return PROJECT_COLORS[Math.abs(hash) % PROJECT_COLORS.length];
}

export function ReportView({
  keys,
  days,
  todayKey,
  baseUrl,
  weekTotal,
  hoursPerDay,
  onOpen,
  onDrop,
}: Props) {
  return (
    <div className="report">
      {keys.map((key) => {
        const date = parseDateKey(key);
        const entries = days[key] || [];
        const seconds = entries.reduce((sum, entry) => sum + entry.timeSpentSeconds, 0);
        const weekend = date.getDay() === 0 || date.getDay() === 6;
        const under = !weekend && seconds < hoursPerDay * 3600 - 60;
        return (
          <section
            key={key}
            className={`report-day${key === todayKey ? " today" : ""}${under ? " under" : ""}`}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const raw = e.dataTransfer.getData("application/json");
              if (!raw) return;
              onDrop(key, JSON.parse(raw) as WorklogEntry);
            }}
          >
            <div className="report-date">
              <div className="report-num">{formatDayShort(date)}</div>
              <div className="report-wd">{weekdayUpper(date)}</div>
            </div>
            <div className="report-lines">
              {entries.length === 0 && (
                <div className="report-empty">
                  {weekend ? "выходной / нет работы" : "нет записей"}
                  <button type="button" className="btn" onClick={() => onOpen(key)}>
                    + Добавить
                  </button>
                </div>
              )}
              {entries.map((entry) => (
                <button
                  type="button"
                  key={`${entry.issueKey}-${entry.id}`}
                  className="report-line"
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData(
                      "application/json",
                      JSON.stringify(entry),
                    );
                    e.dataTransfer.effectAllowed = "move";
                  }}
                  onClick={() => onOpen(key, entry)}
                >
                  <span
                    className="report-project"
                    style={{ color: projectColor(entry.issueKey) }}
                  >
                    {projectKey(entry.issueKey)}
                  </span>
                  <a
                    className="report-key"
                    href={`${baseUrl}/browse/${entry.issueKey}`}
                    target="_blank"
                    rel="noreferrer"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {entry.issueKey}
                  </a>
                  <span className="report-text">
                    {entry.comment || entry.summary}
                  </span>
                  <span className="report-hours">
                    {formatHours(entry.timeSpentSeconds)}
                  </span>
                </button>
              ))}
              {entries.length > 0 && (
                <div className="report-empty report-empty-add">
                  <button type="button" className="btn" onClick={() => onOpen(key)}>
                    + Добавить
                  </button>
                </div>
              )}
            </div>
            <div className="report-sum">{formatHours(seconds)}</div>
          </section>
        );
      })}
      <div className="report-total">
        <span>Итого за неделю</span>
        <b>{formatHours(weekTotal)}</b>
      </div>
    </div>
  );
}
