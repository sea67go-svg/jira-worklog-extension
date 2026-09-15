import { useCallback, useEffect, useMemo, useState } from "react";
import type { WorklogEntry } from "../../lib/jira/types";
import {
  addDays,
  formatDayHeading,
  formatHours,
  mondayOf,
  parseDateKey,
  secondsToJira,
  toDateKey,
  weekKeys,
} from "../../lib/jira/dates";
import { getSettingsMsg, loadWeekMsg, saveSettingsMsg, sendMessage } from "../../lib/messages";
import type { WeekView } from "../../lib/settings";
import { LogForm } from "./LogForm";
import { ReportView } from "./ReportView";

type FormState = { dateKey: string; entry?: WorklogEntry | null };

export function WeekApp() {
  const [weekStart, setWeekStart] = useState(() => toDateKey(mondayOf(new Date())));
  const [days, setDays] = useState<Record<string, WorklogEntry[]>>({});
  const [hoursPerDay, setHoursPerDay] = useState(8);
  const [baseUrl, setBaseUrl] = useState("https://tasks.adv.ru");
  const [hint, setHint] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<{ message: string; auth?: boolean } | null>(
    null,
  );
  const [form, setForm] = useState<FormState | null>(null);
  const [weekView, setWeekView] = useState<WeekView>("report");
  const todayKey = toDateKey(new Date());

  const keys = useMemo(() => weekKeys(parseDateKey(weekStart)), [weekStart]);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [settings, data] = await Promise.all([
        getSettingsMsg(),
        loadWeekMsg(weekStart),
      ]);
      setHoursPerDay(settings.hoursPerDay);
      setBaseUrl(settings.baseUrl);
      setWeekView(settings.weekView);
      setDays(data.days);
      setWeekStart(data.weekStart);
      const total = Object.values(data.days).reduce(
        (sum, list) => sum + list.length,
        0,
      );
      if (total === 0) {
        setHint(
          `Пусто для ${data.stats.user}. Задач по JQL: ${data.stats.issues}. Источник: ${data.stats.source}. Откройте вкладку ${settings.baseUrl}, нажмите «Сегодня» если смотрите не ту неделю, и «Обновить». Если время ведётся только в Tempo без записи в Jira Worklog — задача не появится, пока Tempo API недоступен.`,
        );
      } else {
        setHint(`${data.stats.user}: ${total} записей (${data.stats.source})`);
      }
    } catch (err) {
      setError({
        message: err instanceof Error ? err.message : "Ошибка загрузки",
        auth: Boolean((err as { auth?: boolean }).auth),
      });
    } finally {
      setLoading(false);
    }
  }, [weekStart]);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function onDrop(dateKey: string, entry: WorklogEntry) {
    if (entry.dateKey === dateKey) return;
    try {
      await sendMessage({
        type: "MOVE_WORKLOG",
        issueKey: entry.issueKey,
        worklogId: entry.id,
        fromStarted: entry.started,
        toDateKey: dateKey,
        timeSpent: secondsToJira(entry.timeSpentSeconds),
        comment: entry.comment,
      });
      await reload();
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "Не удалось перенести");
    }
  }

  async function changeView(next: WeekView) {
    setWeekView(next);
    await saveSettingsMsg({
      baseUrl,
      hoursPerDay,
      weekView: next,
    });
  }

  const rangeLabel = `${formatDayHeading(parseDateKey(keys[0]))} — ${formatDayHeading(parseDateKey(keys[6]))}`;
  const weekTotal = keys.reduce(
    (sum, key) =>
      sum + (days[key] || []).reduce((s, e) => s + e.timeSpentSeconds, 0),
    0,
  );

  return (
    <div className="page">
      <header className="topbar">
        <div className="brand">Jira Worklog</div>
        <div className="nav">
          <button
            className="btn"
            onClick={() =>
              setWeekStart(toDateKey(addDays(parseDateKey(weekStart), -7)))
            }
          >
            ←
          </button>
          <strong>{rangeLabel}</strong>
          <button
            className="btn"
            onClick={() =>
              setWeekStart(toDateKey(addDays(parseDateKey(weekStart), 7)))
            }
          >
            →
          </button>
          <button
            className="btn"
            onClick={() => setWeekStart(toDateKey(mondayOf(new Date())))}
          >
            Сегодня
          </button>
        </div>
        <div className="topbar-right">
          <div className="view-switch">
            <button
              className={`btn${weekView === "report" ? " btn-primary" : ""}`}
              onClick={() => void changeView("report")}
            >
              Список
            </button>
            <button
              className={`btn${weekView === "board" ? " btn-primary" : ""}`}
              onClick={() => void changeView("board")}
            >
              Сетка
            </button>
          </div>
          <span>
            Неделя: <b>{formatHours(weekTotal)}</b>
          </span>
          <button className="btn" onClick={() => void reload()}>
            Обновить
          </button>
        </div>
      </header>

      {error?.auth && (
        <div className="status">
          Откройте{" "}
          <a href={`${baseUrl}/secure/Dashboard.jspa`} target="_blank" rel="noreferrer">
            {baseUrl}
          </a>{" "}
          и войдите в Jira, затем обновите страницу.
        </div>
      )}
      {error && !error.auth && <div className="status">{error.message}</div>}
      {!error && hint && <div className="status hint">{hint}</div>}
      {loading && !error && <div className="status">Загрузка worklog…</div>}

      {!loading && !error && weekView === "report" && (
        <ReportView
          keys={keys}
          days={days}
          todayKey={todayKey}
          baseUrl={baseUrl}
          weekTotal={weekTotal}
          hoursPerDay={hoursPerDay}
          onOpen={(dateKey, entry) => setForm({ dateKey, entry })}
          onDrop={(dateKey, entry) => void onDrop(dateKey, entry)}
        />
      )}

      {!loading && !error && weekView === "board" && (
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
                  void onDrop(key, JSON.parse(raw) as WorklogEntry);
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
                        e.dataTransfer.setData(
                          "application/json",
                          JSON.stringify(entry),
                        );
                        e.dataTransfer.effectAllowed = "move";
                      }}
                      onClick={() => setForm({ dateKey: key, entry })}
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
                      {entry.comment && (
                        <div className="comment">{entry.comment}</div>
                      )}
                      <div className="row">
                        <span>{formatHours(entry.timeSpentSeconds)}</span>
                      </div>
                    </article>
                  ))}
                </div>
                <button
                  className="btn day-add"
                  onClick={() => setForm({ dateKey: key })}
                >
                  + Добавить
                </button>
              </section>
            );
          })}
        </div>
      )}

      {form && (
        <LogForm
          dateKey={form.dateKey}
          entry={form.entry}
          onClose={() => setForm(null)}
          onSaved={() => {
            setForm(null);
            void reload();
          }}
        />
      )}
    </div>
  );
}
