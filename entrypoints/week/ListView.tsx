import type { WorklogEntry } from "../../lib/jira/types";
import {
  formatDaySpan,
  formatEntrySpan,
  formatHours,
  isoWeekNumber,
  parseDateKey,
  parseJiraStarted,
  projectKey,
  weekdayLabel,
} from "../../lib/jira/dates";

type Props = {
  keys: string[];
  days: Record<string, WorklogEntry[]>;
  todayKey: string;
  hoursPerDay: number;
  baseUrl: string;
  onDrop: (dateKey: string, entry: WorklogEntry) => void;
  onEdit: (dateKey: string, entry?: WorklogEntry) => void;
};

const PALETTE = ["#1b8474", "#2f6fed", "#c05621", "#7b4b94", "#0f766e", "#b45309"];

function badgeColor(project: string): string {
  let hash = 0;
  for (const ch of project) hash = (hash * 31 + ch.charCodeAt(0)) | 0;
  return PALETTE[Math.abs(hash) % PALETTE.length];
}

export function ListView({
  keys,
  days,
  todayKey,
  hoursPerDay,
  baseUrl,
  onDrop,
  onEdit,
}: Props) {
  const weekStart = parseDateKey(keys[0]);
  const weekEnd = parseDateKey(keys[6]);
  const weekNo = isoWeekNumber(weekStart);
  const weekTotal = keys.reduce(
    (sum, key) => sum + (days[key] || []).reduce((s, e) => s + e.timeSpentSeconds, 0),
    0,
  );
  const byProject = new Map<string, number>();
  for (const key of keys) {
    for (const entry of days[key] || []) {
      const project = projectKey(entry.issueKey);
      byProject.set(project, (byProject.get(project) || 0) + entry.timeSpentSeconds);
    }
  }

  return (
    <div className="report">
      <div className="report-week-title">
        Неделя {weekNo} · {pad(weekStart.getDate())}.{pad(weekStart.getMonth() + 1)}–
        {pad(weekEnd.getDate())}.{pad(weekEnd.getMonth() + 1)}
      </div>
      {keys.map((key) => {
        const date = parseDateKey(key);
        const entries = [...(days[key] || [])].sort((a, b) =>
          a.started.localeCompare(b.started),
        );
        const seconds = entries.reduce((s, e) => s + e.timeSpentSeconds, 0);
        const weekend = date.getDay() === 0 || date.getDay() === 6;
        const under = seconds < hoursPerDay * 3600 - 60 && !weekend;
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
            <div className="report-day-meta">
              <div className="report-date">
                <strong>
                  {pad(date.getDate())}.{pad(date.getMonth() + 1)}
                </strong>
                <span>{weekdayLabel(date).toUpperCase()}</span>
              </div>
              <div className="report-span">
                {entries.length ? formatDaySpan(entries) : weekend ? "выходной" : "нет работы"}
              </div>
            </div>
            <div className="report-entries">
              {entries.length === 0 && (
                <div className="report-empty">
                  {weekend ? "выходной / нет работы" : "нет записей"}
                  <button className="btn" onClick={() => onEdit(key)}>
                    + Добавить
                  </button>
                </div>
              )}
              {entries.map((entry) => {
                const project = projectKey(entry.issueKey);
                return (
                  <article
                    key={`${entry.issueKey}-${entry.id}`}
                    className="report-row"
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData("application/json", JSON.stringify(entry));
                      e.dataTransfer.effectAllowed = "move";
                    }}
                    onClick={() => onEdit(key, entry)}
                  >
                    <span className="badge" style={{ background: badgeColor(project) }}>
                      {project}
                    </span>
                    <span className="report-time">
                      {formatEntrySpan(entry.started, entry.timeSpentSeconds)}
                    </span>
                    <div className="report-body">
                      <a
                        href={`${baseUrl}/browse/${entry.issueKey}`}
                        target="_blank"
                        rel="noreferrer"
                        onClick={(ev) => ev.stopPropagation()}
                      >
                        {entry.issueKey}
                      </a>
                      <span className="summary">{entry.summary}</span>
                      {entry.comment && (
                        <span className="comment"> — {entry.comment}</span>
                      )}
                    </div>
                    <b className="report-hours">{formatHours(entry.timeSpentSeconds)}</b>
                  </article>
                );
              })}
              {entries.length > 0 && (
                <div className="report-day-actions">
                  <button className="btn" onClick={() => onEdit(key)}>
                    + Добавить
                  </button>
                </div>
              )}
            </div>
            <div className="report-day-total">{seconds ? formatHours(seconds) : "0ч"}</div>
          </section>
        );
      })}
      <div className="report-footer">
        <div>
          Итого за неделю{" "}
          <b>
            {pad(weekStart.getDate())}.{pad(weekStart.getMonth() + 1)}–
            {pad(weekEnd.getDate())}.{pad(weekEnd.getMonth() + 1)}
          </b>
        </div>
        <div className="report-projects">
          <span className="report-chip">
            Всего <b>{formatHours(weekTotal)}</b>
          </span>
          {[...byProject.entries()]
            .sort((a, b) => b[1] - a[1])
            .map(([project, seconds]) => (
              <span key={project} className="report-chip">
                <i style={{ background: badgeColor(project) }} />
                {project} <b>{formatHours(seconds)}</b>
              </span>
            ))}
        </div>
      </div>
    </div>
  );
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}
