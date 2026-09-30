import { useEffect, useRef, useState } from "react";
import { sendMessage } from "../../lib/messages";

type ChatItem = { role: "user" | "assistant" | "status"; content: string };

const WELCOME: ChatItem = {
  role: "assistant",
  content:
    "Напишите задание: разобрать GitLab MR, списать время в Jira, посмотреть неделю или поручить правки кода локальному Cursor host.",
};

type Props = {
  weekStart: string;
  open: boolean;
  onClose: () => void;
  onWeekChanged: () => void;
};

export function AgentChat({ weekStart, open, onClose, onWeekChanged }: Props) {
  const [items, setItems] = useState<ChatItem[]>([WELCOME]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [items, open, busy, status]);

  useEffect(() => {
    function onMessage(message: { type?: string; text?: string }) {
      if (message?.type === "AGENT_STATUS" && message.text) {
        setStatus(message.text);
      }
    }
    chrome.runtime.onMessage.addListener(onMessage);
    return () => chrome.runtime.onMessage.removeListener(onMessage);
  }, []);

  async function send() {
    const q = draft.trim();
    if (!q || busy) return;
    setDraft("");
    const next: ChatItem[] = [...items, { role: "user", content: q }];
    setItems(next);
    setBusy(true);
    setStatus("Думаю…");
    try {
      const history = next
        .filter((m) => m.role !== "status" && m.content !== WELCOME.content)
        .slice(0, -1)
        .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));
      const result = await sendMessage<{
        reply: string;
        reload?: boolean;
        refreshWeek?: boolean;
      }>({ type: "AGENT_CHAT", text: q, weekStart, history });
      setItems((prev) => [...prev, { role: "assistant", content: result.reply }]);
      if (result.refreshWeek) onWeekChanged();
      if (result.reload) window.setTimeout(() => chrome.runtime.reload(), 500);
    } catch (err) {
      setItems((prev) => [
        ...prev,
        {
          role: "assistant",
          content: err instanceof Error ? err.message : "Ошибка агента",
        },
      ]);
    } finally {
      setBusy(false);
      setStatus("");
    }
  }

  if (!open) return null;

  return (
    <aside className="chat-panel">
      <div className="chat-head">
        <strong>Агент</strong>
        <div className="chat-head-actions">
          <button className="btn" type="button" onClick={() => setItems([WELCOME])}>
            Новый чат
          </button>
          <button className="btn" type="button" onClick={onClose}>
            Закрыть
          </button>
        </div>
      </div>
      <div className="chat-log">
        {items.map((item, i) => (
          <div key={i} className={`chat-msg ${item.role}`}>
            {item.content}
          </div>
        ))}
        {busy && <div className="chat-msg assistant chat-typing">{status || "Думаю…"}</div>}
        <div ref={endRef} />
      </div>
      <form
        className="chat-form"
        onSubmit={(e) => {
          e.preventDefault();
          void send();
        }}
      >
        <textarea
          rows={3}
          value={draft}
          placeholder="Сообщение агенту…"
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void send();
            }
          }}
        />
        <button className="btn btn-primary" type="submit" disabled={busy || !draft.trim()}>
          Отправить
        </button>
      </form>
    </aside>
  );
}
