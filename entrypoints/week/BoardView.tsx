import type { WorklogEntry } from "../../lib/jira/types";
import {
  formatDayHeading,
  formatHours,
  parseDateKey,
  parseJiraStarted,
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

export function BoardView({
  keys,
  days,
  todayKey,
  hoursPerDay,
  baseUrl,
  onDrop,
  onEdit,
}: Props) {
  return (
    <div className="week">
      {keys.map((key) => {
        const entries = days[key] || [];
        const seconds = entries.reduce((s, e) => s + e.timeSpentSeconds, 0);
        const under = seconds < hoursPerDay * 3600 - 60;
        return (
          <section
            key={key}
            className={`day${key === todayKey ? " today" : ""}${under ? " under" : ""}`}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const raw = e.dataTransfer.getData("application/json");
              if (!raw) return;
              onDrop(key, JSON.parse(raw) as WorklogEntry);
            }}
          >
            <div className="day-head">
              <div className="meta">{formatDayHeading(parseDateKey(key))}</div>
              <div className="sum">{formatHours(seconds)}</div>
            </div>
            <div className="cards">
              {entries.map((entry) => (
                <article
                  key={`${entry.issueKey}-${entry.id}`}
                  className="card"
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData("application/json", JSON.stringify(entry));
                    e.dataTransfer.effectAllowed = "move";
                  }}
                  onClick={() => onEdit(key, entry)}
                >
                  <div className="key">
                    <a
                      href={`${baseUrl}/browse/${entry.issueKey}`}
                      target="_blank"
                      rel="noreferrer"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {entry.issueKey}
                    </a>
                  </div>
                  <div className="summary">{entry.summary}</div>
                  <div className="row">
                    <span>{formatHours(entry.timeSpentSeconds)}</span>
                    <span>{formatClock(entry.started)}</span>
                  </div>
                  {entry.comment && <div className="comment">{entry.comment}</div>}
                </article>
              ))}
            </div>
            <button className="btn day-add" onClick={() => onEdit(key)}>
              + Добавить
            </button>
          </section>
        );
      })}
    </div>
  );
}

function formatClock(started: string): string {
  const d = parseJiraStarted(started);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}
