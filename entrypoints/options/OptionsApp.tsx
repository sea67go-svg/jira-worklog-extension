import { useEffect, useState } from "react";
import {
  DEFAULT_AGENT_API_URL,
  DEFAULT_AGENT_HOST_URL,
  DEFAULT_AGENT_MODEL,
  DEFAULT_BASE_URL,
  DEFAULT_GITHUB_REPO,
} from "../../lib/settings";
import { getSettingsMsg, saveSettingsMsg } from "../../lib/messages";
import type { Period } from "../../lib/jira/dates";

export function OptionsApp() {
  const [baseUrl, setBaseUrl] = useState(DEFAULT_BASE_URL);
  const [hoursPerDay, setHoursPerDay] = useState(8);
  const [period, setPeriod] = useState<Period>("month");
  const [githubRepo, setGithubRepo] = useState(DEFAULT_GITHUB_REPO);
  const [githubToken, setGithubToken] = useState("");
  const [agentApiUrl, setAgentApiUrl] = useState(DEFAULT_AGENT_API_URL);
  const [agentApiKey, setAgentApiKey] = useState("");
  const [agentModel, setAgentModel] = useState(DEFAULT_AGENT_MODEL);
  const [cursorApiKey, setCursorApiKey] = useState("");
  const [agentHostUrl, setAgentHostUrl] = useState(DEFAULT_AGENT_HOST_URL);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    void getSettingsMsg().then((s) => {
      setBaseUrl(s.baseUrl || DEFAULT_BASE_URL);
      setHoursPerDay(s.hoursPerDay || 8);
      setPeriod(s.period || "month");
      setGithubRepo(s.githubRepo || DEFAULT_GITHUB_REPO);
      setGithubToken(s.githubToken);
      setAgentApiUrl(s.agentApiUrl || DEFAULT_AGENT_API_URL);
      setAgentApiKey(s.agentApiKey);
      setAgentModel(s.agentModel || DEFAULT_AGENT_MODEL);
      setCursorApiKey(s.cursorApiKey);
      setAgentHostUrl(s.agentHostUrl || DEFAULT_AGENT_HOST_URL);
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
        await chrome.permissions.request({
          origins: [origin, "https://gitlab.adv.ru/*", "http://127.0.0.1/*"],
        });
      }
      const current = await getSettingsMsg();
      await saveSettingsMsg({
        ...current,
        baseUrl: url.origin,
        hoursPerDay: Number(hoursPerDay) || 8,
        period,
        githubRepo: githubRepo.trim() || DEFAULT_GITHUB_REPO,
        githubToken: githubToken.trim(),
        agentApiUrl: agentApiUrl.trim() || DEFAULT_AGENT_API_URL,
        agentApiKey: agentApiKey.trim(),
        agentModel: agentModel.trim() || DEFAULT_AGENT_MODEL,
        cursorApiKey: cursorApiKey.trim(),
        agentHostUrl: agentHostUrl.trim() || DEFAULT_AGENT_HOST_URL,
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
      <label className="field">
        Период по умолчанию
        <select value={period} onChange={(e) => setPeriod(e.target.value as Period)}>
          <option value="month">Месяц</option>
          <option value="week">Неделя</option>
        </select>
      </label>
      <label className="field">
        GitHub репозиторий (owner/name)
        <input value={githubRepo} onChange={(e) => setGithubRepo(e.target.value)} />
      </label>
      <label className="field">
        GitHub token (необязательно, для чата через GitHub Models)
        <input
          type="password"
          value={githubToken}
          placeholder="ghp_… или github_pat_…"
          onChange={(e) => setGithubToken(e.target.value)}
        />
      </label>
      <label className="field">
        URL чата OpenAI-compatible
        <input
          value={agentApiUrl}
          placeholder={DEFAULT_AGENT_API_URL}
          onChange={(e) => setAgentApiUrl(e.target.value)}
        />
      </label>
      <label className="field">
        API-ключ агента (OpenAI / совместимый)
        <input
          type="password"
          value={agentApiKey}
          placeholder="sk-…"
          onChange={(e) => setAgentApiKey(e.target.value)}
        />
      </label>
      <label className="field">
        Модель
        <input value={agentModel} onChange={(e) => setAgentModel(e.target.value)} />
      </label>
      <label className="field">
        Cursor API key (для правок кода через agent-host)
        <input
          type="password"
          value={cursorApiKey}
          onChange={(e) => setCursorApiKey(e.target.value)}
        />
      </label>
      <label className="field">
        Cursor host URL
        <input
          value={agentHostUrl}
          onChange={(e) => setAgentHostUrl(e.target.value)}
        />
      </label>
      <p className="options-hint">
        Ключи не хранятся в репозитории: вставьте GitHub token, OpenAI key и Cursor
        API key сюда и нажмите «Сохранить». Без ключа чат агента не вызовет модель.
      </p>
      {saved && <p>Сохранено.</p>}
      {error && <p className="status">{error}</p>}
      <button className="btn btn-primary" type="submit">
        Сохранить
      </button>
    </form>
  );
}
