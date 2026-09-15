import { useEffect, useState } from "react";
import {
  formatHours,
  mondayOf,
  toDateKey,
} from "../../lib/jira/dates";
import { getSettingsMsg, loadWeekMsg } from "../../lib/messages";

export function PopupApp() {
  const [today, setToday] = useState("—");
  const [week, setWeek] = useState("—");
  const [error, setError] = useState<string | null>(null);
  const [baseUrl, setBaseUrl] = useState("https://tasks.adv.ru");

  useEffect(() => {
    void (async () => {
      try {
        const settings = await getSettingsMsg();
        setBaseUrl(settings.baseUrl);
        const start = toDateKey(mondayOf(new Date()));
        const data = await loadWeekMsg(start);
        const todayKey = toDateKey(new Date());
        const todaySec = (data.days[todayKey] || []).reduce(
          (s, e) => s + e.timeSpentSeconds,
          0,
        );
        const weekSec = Object.values(data.days)
          .flat()
          .reduce((s, e) => s + e.timeSpentSeconds, 0);
        setToday(formatHours(todaySec));
        setWeek(formatHours(weekSec));
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
            <span>Неделя</span>
            <b>{week}</b>
          </div>
        </>
      )}
      <button className="btn btn-primary" onClick={openWeek}>
        Открыть неделю
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
