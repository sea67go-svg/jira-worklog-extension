import { useEffect, useState } from "react";
import { getSettingsMsg, saveSettingsMsg } from "../../lib/messages";

export function OptionsApp() {
  const [baseUrl, setBaseUrl] = useState("https://tasks.adv.ru");
  const [hoursPerDay, setHoursPerDay] = useState(8);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    void getSettingsMsg().then((s) => {
      setBaseUrl(s.baseUrl);
      setHoursPerDay(s.hoursPerDay);
    });
  }, []);

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSaved(false);
    try {
      const url = new URL(baseUrl);
      const origin = `${url.origin}/*`;
      if (chrome.permissions?.request) {
        await chrome.permissions.request({ origins: [origin] });
      }
      await saveSettingsMsg({
        baseUrl: url.origin,
        hoursPerDay: Number(hoursPerDay) || 8,
        weekView: (await getSettingsMsg()).weekView,
      });
      setSaved(true);
    } catch {
      setError("Проверьте URL, например https://tasks.adv.ru");
    }
  }

  return (
    <form className="options" onSubmit={onSave}>
      <h1>Настройки Jira Worklog</h1>
      <label className="field">
        URL Jira
        <input value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} />
      </label>
      <label className="field">
        Цель часов в день
        <input
          type="number"
          min={1}
          step={0.5}
          value={hoursPerDay}
          onChange={(e) => setHoursPerDay(Number(e.target.value))}
        />
      </label>
      {error && <p>{error}</p>}
      {saved && <p>Сохранено.</p>}
      <button className="btn btn-primary" type="submit">
        Сохранить
      </button>
    </form>
  );
}
