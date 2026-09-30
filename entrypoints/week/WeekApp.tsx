import { useCallback, useEffect, useMemo, useState } from "react";
import type { WorklogEntry } from "../../lib/jira/types";
import {
  addDays,
  addMonths,
  formatDayHeading,
  formatHours,
  formatMonthLabel,
  parseDateKey,
  periodAnchorKey,
  periodKeys,
  secondsToJira,
  toDateKey,
  type Period,
} from "../../lib/jira/dates";
import { getSettingsMsg, loadWeekMsg, saveSettingsMsg, sendMessage } from "../../lib/messages";
import type { WeekView } from "../../lib/settings";
import { AgentChat } from "./AgentChat";
import { LogForm } from "./LogForm";
import { ReportView } from "./ReportView";

type FormState = { dateKey: string; entry?: WorklogEntry | null };

function padMonthCells(keys: string[]): (string | null)[] {
  const first = parseDateKey(keys[0]);
  const lead = (first.getDay() + 6) % 7;
  const cells: (string | null)[] = [...Array(lead).fill(null), ...keys];
  while (cells.length % 7) cells.push(null);
  return cells;
}

export function WeekApp() {
  const [anchor, setAnchor] = useState(() => periodAnchorKey(new Date(), "month"));
  const [period, setPeriod] = useState<Period>("month");
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
  const [chatOpen, setChatOpen] = useState(false);
  const todayKey = toDateKey(new Date());

  const keys = useMemo(
    () => periodKeys(parseDateKey(anchor), period),
    [anchor, period],
  );

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [settings, data] = await Promise.all([
        getSettingsMsg(),
        loadWeekMsg(anchor, period),
      ]);
      setHoursPerDay(settings.hoursPerDay);
      setBaseUrl(settings.baseUrl);
      setWeekView(settings.weekView);
      setDays(data.days);
      setAnchor(data.weekStart);
      const total = Object.values(data.days).reduce(
        (sum, list) => sum + list.length,
        0,
      );
      if (total === 0) {
        setHint(
          `Пусто для ${data.stats.user}. Задач по JQL: ${data.stats.issues}. Источник: ${data.stats.source}. Откройте вкладку ${settings.baseUrl}, затем «Сегодня» и «Обновить».`,
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
  }, [anchor, period]);

  useEffect(() => {
    void getSettingsMsg().then((s) => {
      setPeriod(s.period);
      setAnchor(periodAnchorKey(new Date(), s.period));
    });
  }, []);

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
    const settings = await getSettingsMsg();
    await saveSettingsMsg({ ...settings, weekView: next });
  }

  async function changePeriod(next: Period) {
    const nextAnchor = periodAnchorKey(parseDateKey(anchor), next);
    setPeriod(next);
    setAnchor(nextAnchor);
    const settings = await getSettingsMsg();
    await saveSettingsMsg({ ...settings, period: next });
  }

  function reloadExtension() {
    chrome.runtime.reload();
  }

  function goPrev() {
    const d = parseDateKey(anchor);
    setAnchor(
      period === "month"
        ? toDateKey(addMonths(d, -1))
        : toDateKey(addDays(d, -7)),
    );
  }

  function goNext() {
    const d = parseDateKey(anchor);
    setAnchor(
      period === "month"
        ? toDateKey(addMonths(d, 1))
        : toDateKey(addDays(d, 7)),
    );
  }

  const rangeLabel =
    period === "month"
      ? formatMonthLabel(parseDateKey(keys[0]))
      : `${formatDayHeading(parseDateKey(keys[0]))} — ${formatDayHeading(parseDateKey(keys[keys.length - 1]))}`;
  const periodTotal = keys.reduce(
    (sum, key) =>
      sum + (days[key] || []).reduce((s, e) => s + e.timeSpentSeconds, 0),
    0,
  );
  const boardCells = period === "month" ? padMonthCells(keys) : keys;

  function renderDay(key: string) {
    const entries = days[key] || [];
    const seconds = entries.reduce((s, e) => s + e.timeSpentSeconds, 0);
    const weekend =
      parseDateKey(key).getDay() === 0 || parseDateKey(key).getDay() === 6;
    const under = !weekend && seconds < hoursPerDay * 3600 - 60;
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
          <div>
            <div className="meta">{formatDayHeading(parseDateKey(key))}</div>
            <div className="sum">{formatHours(seconds)}</div>
          </div>
          <button
            className="btn btn-add-head"
            type="button"
            onClick={() => setForm({ dateKey: key })}
          >
            +
          </button>
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
              {entry.comment && <div className="comment">{entry.comment}</div>}
              <div className="row">
                <span>{formatHours(entry.timeSpentSeconds)}</span>
              </div>
            </article>
          ))}
        </div>
        <button className="btn day-add" onClick={() => setForm({ dateKey: key })}>
          + Добавить
        </button>
      </section>
    );
  }

  return (
    <div className="page">
      <header className="topbar">
        <div className="brand">Jira Worklog</div>
        <div className="nav">
          <button className="btn" onClick={goPrev}>
            ←
          </button>
          <strong>{rangeLabel}</strong>
          <button className="btn" onClick={goNext}>
            →
          </button>
          <button
            className="btn"
            onClick={() => setAnchor(periodAnchorKey(new Date(), period))}
          >
            Сегодня
          </button>
        </div>
        <div className="topbar-right">
          <div className="view-switch">
            <button
              className={`btn${period === "week" ? " btn-primary" : ""}`}
              onClick={() => void changePeriod("week")}
            >
              Неделя
            </button>
            <button
              className={`btn${period === "month" ? " btn-primary" : ""}`}
              onClick={() => void changePeriod("month")}
            >
              Месяц
            </button>
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
            {period === "month" ? "Месяц" : "Неделя"}:{" "}
            <b>{formatHours(periodTotal)}</b>
          </span>
          <button className="btn" onClick={() => void reload()}>
            Обновить
          </button>
          <button className="btn" onClick={reloadExtension} title="Перезагрузить расширение">
            Перезагрузить
          </button>
          <button
            className={`btn${chatOpen ? " btn-primary" : ""}`}
            onClick={() => setChatOpen((open) => !open)}
          >
            Агент
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
          weekTotal={periodTotal}
          hoursPerDay={hoursPerDay}
          totalLabel={period === "month" ? "Итого за месяц" : "Итого за неделю"}
          onOpen={(dateKey, entry) => setForm({ dateKey, entry })}
          onDrop={(dateKey, entry) => void onDrop(dateKey, entry)}
        />
      )}

      {!loading && !error && weekView === "board" && period === "week" && (
        <div className="week">{keys.map((key) => renderDay(key))}</div>
      )}

      {!loading && !error && weekView === "board" && period === "month" && (
        <div className="month-board">
          <div className="month-wd">
            {["пн", "вт", "ср", "чт", "пт", "сб", "вс"].map((d) => (
              <div key={d}>{d}</div>
            ))}
          </div>
          <div className="week month-days">
            {boardCells.map((key, i) =>
              key ? renderDay(key) : <div key={`pad-${i}`} className="day day-pad" />,
            )}
          </div>
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
      <AgentChat
        weekStart={anchor}
        open={chatOpen}
        onClose={() => setChatOpen(false)}
        onWeekChanged={() => void reload()}
      />
    </div>
  );
}
