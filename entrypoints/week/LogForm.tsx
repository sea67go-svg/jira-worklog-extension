import { useEffect, useState } from "react";
import type { IssuePickerIssue, WorklogEntry } from "../../lib/jira/types";
import {
  formatJiraStarted,
  parseJiraStarted,
  parseTimeInput,
} from "../../lib/jira/dates";
import { searchIssuesMsg, sendMessage } from "../../lib/messages";

type Props = {
  dateKey: string;
  entry?: WorklogEntry | null;
  onClose: () => void;
  onSaved: () => void;
};

export function LogForm({ dateKey, entry, onClose, onSaved }: Props) {
  const [query, setQuery] = useState(entry?.issueKey || "");
  const [issueKey, setIssueKey] = useState(entry?.issueKey || "");
  const [summary, setSummary] = useState(entry?.summary || "");
  const [issues, setIssues] = useState<IssuePickerIssue[]>([]);
  const [timeSpent, setTimeSpent] = useState(
    entry ? String(entry.timeSpentSeconds / 3600) : "",
  );
  const [comment, setComment] = useState(entry?.comment || "");
  const [selectedDate, setSelectedDate] = useState(dateKey);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (entry || query.trim().length < 2) {
      setIssues([]);
      return;
    }
    const timer = window.setTimeout(async () => {
      try {
        setIssues(await searchIssuesMsg(query));
      } catch {
        setIssues([]);
      }
    }, 250);
    return () => window.clearTimeout(timer);
  }, [query, entry]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    try {
      if (!issueKey) throw new Error("Выберите задачу");
      if (!/^\d{4}-\d{2}-\d{2}$/.test(selectedDate)) {
        throw new Error("Выберите дату");
      }
      const spent = parseTimeInput(timeSpent);
      const original = entry ? parseJiraStarted(entry.started) : null;
      const startedDate = new Date(
        Number(selectedDate.slice(0, 4)),
        Number(selectedDate.slice(5, 7)) - 1,
        Number(selectedDate.slice(8, 10)),
        original?.getHours() ?? 10,
        original?.getMinutes() ?? 0,
        original?.getSeconds() ?? 0,
        0,
      );
      const started = formatJiraStarted(startedDate);
      setBusy(true);
      if (entry) {
        await sendMessage({
          type: "UPDATE_WORKLOG",
          issueKey: entry.issueKey,
          worklogId: entry.id,
          started,
          timeSpent: spent,
          comment,
        });
      } else {
        await sendMessage({
          type: "CREATE_WORKLOG",
          issueKey,
          started,
          timeSpent: spent,
          comment,
        });
      }
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка сохранения");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!entry) return;
    if (!window.confirm("Удалить эту запись?")) return;
    setBusy(true);
    setError("");
    try {
      await sendMessage({
        type: "DELETE_WORKLOG",
        issueKey: entry.issueKey,
        worklogId: entry.id,
      });
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка удаления");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="overlay" onClick={onClose}>
      <form className="modal" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <h2>{entry ? "Редактировать worklog" : "Новая запись"}</h2>
        <label className="field">
          Задача
          <input
            value={query}
            disabled={Boolean(entry)}
            placeholder="KEY или текст"
            onChange={(e) => {
              setQuery(e.target.value);
              setIssueKey("");
            }}
          />
        </label>
        {!entry && issues.length > 0 && (
          <div className="suggest">
            {issues.map((issue) => (
              <button
                type="button"
                key={issue.key}
                onClick={() => {
                  setIssueKey(issue.key);
                  setQuery(issue.key);
                  setSummary(issue.summaryText || issue.summary || "");
                  setIssues([]);
                }}
              >
                <strong>{issue.key}</strong>{" "}
                {issue.summaryText || issue.summary || ""}
              </button>
            ))}
          </div>
        )}
        {(issueKey || summary) && (
          <div className="meta">
            {issueKey} {summary}
          </div>
        )}
        <label className="field">
          Часы (1.5 или 1h 30m)
          <input
            value={timeSpent}
            onChange={(e) => setTimeSpent(e.target.value)}
            required
          />
        </label>
        <label className="field">
          Дата
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            required
          />
        </label>
        <label className="field">
          Комментарий
          <textarea
            rows={3}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
          />
        </label>
        {error && <div className="comment">{error}</div>}
        <div className="actions">
          {entry && (
            <button type="button" className="btn btn-danger" onClick={remove} disabled={busy}>
              Удалить
            </button>
          )}
          <button type="button" className="btn" onClick={onClose} disabled={busy}>
            Отмена
          </button>
          <button type="submit" className="btn btn-primary" disabled={busy}>
            Сохранить
          </button>
        </div>
      </form>
    </div>
  );
}
