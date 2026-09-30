import { useEffect, useState } from "react";
import { formatHours, periodAnchorKey, toDateKey } from "../../lib/jira/dates";
import { getSettingsMsg, loadWeekMsg } from "../../lib/messages";

export function PopupApp() {
  const [today, setToday] = useState("—");
  const [periodTotal, setPeriodTotal] = useState("—");
  const [periodLabel, setPeriodLabel] = useState("Месяц");
  const [error, setError] = useState<string | null>(null);
  const [baseUrl, setBaseUrl] = useState("https://tasks.adv.ru");

  useEffect(() => {
    void (async () => {
      try {
        const settings = await getSettingsMsg();
        setBaseUrl(settings.baseUrl);
        const period = settings.period || "month";
        setPeriodLabel(period === "month" ? "Месяц" : "Неделя");
        const start = periodAnchorKey(new Date(), period);
        const data = await loadWeekMsg(start, period);
        const todayKey = toDateKey(new Date());
        const todaySec = (data.days[todayKey] || []).reduce(
          (s, e) => s + e.timeSpentSeconds,
          0,
        );
        const rangeSec = Object.values(data.days)
          .flat()
          .reduce((s, e) => s + e.timeSpentSeconds, 0);
        setToday(formatHours(todaySec));
        setPeriodTotal(formatHours(rangeSec));
      } catch (err) {
        setError(
          (err as { auth?: boolean }).auth
            ? "Войдите в Jira"
            : err instanceof Error
              ? err.message
              : "Ошибка",
        );
      }
    })();
  }, []);

  function openWeek() {
    void chrome.tabs.create({ url: chrome.runtime.getURL("/week.html") });
  }

  return (
    <div className="popup">
      <h1>Jira Worklog</h1>
      {error ? (
        <p>
          {error}. Откройте{" "}
          <a href={`${baseUrl}/secure/Dashboard.jspa`} target="_blank" rel="noreferrer">
            Jira
          </a>
          .
        </p>
      ) : (
        <>
          <div className="stat">
            <span>Сегодня</span>
            <b>{today}</b>
          </div>
          <div className="stat">
            <span>{periodLabel}</span>
            <b>{periodTotal}</b>
          </div>
        </>
      )}
      <button className="btn btn-primary" onClick={openWeek}>
        Открыть календарь
      </button>
      <button
        className="btn"
        onClick={() => chrome.runtime.openOptionsPage()}
      >
        Настройки
      </button>
    </div>
  );
}
