import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PORT = Number(process.env.AGENT_HOST_PORT || 7845);
const CWD =
  process.env.AGENT_HOST_CWD ||
  path.resolve(fileURLToPath(new URL(".", import.meta.url)), "..");

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

function send(res, status, body) {
  const json = typeof body === "string" ? body : JSON.stringify(body);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS, GET",
  });
  res.end(json);
}

async function runCursor(prompt, apiKey) {
  const key = apiKey || process.env.CURSOR_API_KEY;
  if (!key) {
    throw new Error("Нет CURSOR_API_KEY (настройки расширения или env)");
  }
  const { Agent } = await import("@cursor/sdk");
  const result = await Agent.prompt(prompt, {
    apiKey: key,
    model: { id: process.env.CURSOR_MODEL || "composer-2.5" },
    local: { cwd: CWD },
  });
  const text =
    typeof result.result === "string"
      ? result.result
      : result.result
        ? JSON.stringify(result.result)
        : "";
  return { status: result.status, text, id: result.id };
}

const server = http.createServer(async (req, res) => {
  if (req.method === "OPTIONS") {
    send(res, 204, "");
    return;
  }
  if (req.method === "GET" && req.url === "/health") {
    send(res, 200, { ok: true, cwd: CWD });
    return;
  }
  if (req.method === "POST" && req.url === "/chat") {
    try {
      const payload = JSON.parse((await readBody(req)) || "{}");
      const prompt = String(payload.prompt || "").trim();
      if (!prompt) {
        send(res, 400, { error: "prompt required" });
        return;
      }
      const out = await runCursor(prompt, payload.apiKey);
      send(res, 200, out);
    } catch (err) {
      send(res, 500, {
        error: err instanceof Error ? err.message : String(err),
      });
    }
    return;
  }
  send(res, 404, { error: "not found" });
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`agent-host http://127.0.0.1:${PORT} cwd=${CWD}`);
});
