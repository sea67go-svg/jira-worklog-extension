import { getSettings } from "../settings";
import { parseGitLabMrUrls } from "../gitlab";
import { AGENT_TOOLS, executeAgentTool, type AgentFlags, type StatusFn } from "./tools";

export type ChatMessage = { role: "user" | "assistant"; content: string };

type LlmMessage = {
  role: "system" | "user" | "assistant" | "tool";
  content?: string | null;
  tool_calls?: {
    id: string;
    type: "function";
    function: { name: string; arguments: string };
  }[];
  tool_call_id?: string;
};

function todayKey(): string {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

function systemPrompt(weekStart: string, userText: string): string {
  const mrs = parseGitLabMrUrls(userText);
  const mrHint = mrs.length
    ? `В сообщении пользователя есть GitLab MR: ${mrs.map((m) => m.webUrl).join(", ")}. Сначала вызови get_gitlab_mr по каждому URL, потом суммируй и только затем create_worklog на сегодня (${todayKey()}), если просят залогировать. Ключ Jira бери из названия MR/ветки (SKIAPP-…). Часы оцени по объёму, если не указаны.`
    : "";
  return `Ты агент в Chrome-расширении Jira Worklog, по возможностям близкий к Cursor: многоходовой диалог и инструменты.
Отвечай по-русски. Действия делай сам через tools, не проси пользователя копировать команды.
Сегодня ${todayKey()}, открытая неделя с ${weekStart}.
Инструменты: Jira worklog, поиск задач, fetch_url (сессия вкладки), GitLab MR (gitlab.adv.ru), GitHub коммиты/ветки, cursor_code_task (правки кода через локальный host), reload.
Не выдумывай содержимое MR и коммитов — сначала tool.
Для правок файлов расширения вызывай cursor_code_task (нужен npm run agent-host).
${mrHint}`;
}

type Endpoint = { url: string; key: string; model: string };

async function resolveEndpoint(): Promise<Endpoint> {
  const s = await getSettings();
  if (s.agentApiKey) {
    const url = (s.agentApiUrl || "https://api.openai.com/v1/chat/completions").replace(/\/+$/, "");
    const completions = url.endsWith("/chat/completions") ? url : `${url}/chat/completions`;
    return { url: completions, key: s.agentApiKey, model: s.agentModel || "gpt-4o-mini" };
  }
  if (s.githubToken) {
    const model = s.agentModel.includes("/")
      ? s.agentModel
      : `openai/${s.agentModel || "gpt-4o-mini"}`;
    return {
      url: "https://models.github.ai/inference/chat/completions",
      key: s.githubToken,
      model,
    };
  }
  throw new Error(
    "Для чата укажите в настройках OpenAI-совместимый API-ключ или GitHub token.",
  );
}

async function chatCompletions(endpoint: Endpoint, messages: LlmMessage[]): Promise<LlmMessage> {
  const origin = new URL(endpoint.url).origin + "/*";
  if (chrome.permissions?.request) {
    try {
      await chrome.permissions.request({ origins: [origin] });
    } catch {
      /* ignore */
    }
  }
  const res = await fetch(endpoint.url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${endpoint.key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: endpoint.model,
      messages,
      tools: AGENT_TOOLS,
      tool_choice: "auto",
    }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Модель ${res.status}: ${text.slice(0, 400)}`);
  const json = JSON.parse(text) as { choices?: { message?: LlmMessage }[] };
  const message = json.choices?.[0]?.message;
  if (!message) throw new Error("Пустой ответ модели");
  return message;
}

export async function runAgent(
  text: string,
  weekStart: string,
  history: ChatMessage[],
  onStatus?: StatusFn,
): Promise<{ reply: string; reload?: boolean; refreshWeek?: boolean }> {
  const q = text.trim();
  if (!q) return { reply: "Напишите, что сделать." };
  const endpoint = await resolveEndpoint();
  const flags: AgentFlags = { steps: [] };
  onStatus?.("Думаю…");
  const messages: LlmMessage[] = [
    { role: "system", content: systemPrompt(weekStart, q) },
    ...history.slice(-20).map((m) => ({ role: m.role, content: m.content })),
    { role: "user", content: q },
  ];

  for (let i = 0; i < 12; i++) {
    const reply = await chatCompletions(endpoint, messages);
    if (reply.tool_calls?.length) {
      messages.push(reply);
      for (const call of reply.tool_calls) {
        const result = await executeAgentTool(
          call.function.name,
          call.function.arguments || "{}",
          weekStart,
          flags,
          onStatus,
        );
        messages.push({
          role: "tool",
          tool_call_id: call.id,
          content: result,
        });
      }
      continue;
    }
    const content = (reply.content || "").trim() || "Готово.";
    return { reply: content, ...flags };
  }
  return { reply: "Слишком длинная цепочка действий, остановился.", ...flags };
}
