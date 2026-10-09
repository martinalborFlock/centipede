// Puente entre Claude (MCP por stdio) y la extensión Centipede (WebSocket local).
// stdout pertenece al protocolo MCP: todo log va a stderr.

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { WebSocketServer } from "ws";
import { randomBytes, randomUUID } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";

const PORT = Number(process.env.CENTIPEDE_PORT ?? 47315);
const REQUEST_TIMEOUT_MS = 10_000;
const PING_INTERVAL_MS = 20_000;

const here = dirname(fileURLToPath(import.meta.url));
const tokenFile = join(here, ".token");

function log(...args) {
  console.error("[centipede-mcp]", ...args);
}

function loadOrCreateToken() {
  if (existsSync(tokenFile)) return readFileSync(tokenFile, "utf8").trim();
  const token = randomBytes(24).toString("hex");
  writeFileSync(tokenFile, token);
  return token;
}

const TOKEN = process.env.CENTIPEDE_TOKEN ?? loadOrCreateToken();

let extension = null; // socket de la extensión conectada
const pending = new Map(); // id -> { resolve, reject, timer }

function rejectAllPending(reason) {
  for (const [id, request] of pending) {
    clearTimeout(request.timer);
    request.reject(new Error(reason));
    pending.delete(id);
  }
}

const wss = new WebSocketServer({
  host: "127.0.0.1",
  port: PORT,
  verifyClient: ({ req }) => {
    const origin = req.headers.origin ?? "";
    const url = new URL(req.url ?? "/", "http://127.0.0.1");
    return origin.startsWith("chrome-extension://") && url.searchParams.get("token") === TOKEN;
  },
});

wss.on("error", (error) => {
  log(`No se pudo abrir el puerto ${PORT}:`, error.message);
});

wss.on("connection", (socket) => {
  if (extension) extension.close(4000, "replaced");
  extension = socket;
  log("Extensión conectada");

  socket.on("message", (raw) => {
    let message;
    try {
      message = JSON.parse(raw.toString());
    } catch {
      return;
    }
    const request = pending.get(message.id);
    if (!request) return;
    clearTimeout(request.timer);
    pending.delete(message.id);
    if (message.error) request.reject(new Error(message.error));
    else request.resolve(message.result);
  });

  socket.on("close", () => {
    if (extension === socket) extension = null;
    rejectAllPending("La extensión se desconectó");
    log("Extensión desconectada");
  });
});

function request(method, params = {}) {
  if (!extension) {
    return Promise.reject(
      new Error(
        "La extensión de Centipede no está conectada. Abrí Chrome con la extensión cargada y verificá el token en su popup."
      )
    );
  }
  const id = randomUUID();
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(new Error("La extensión no respondió a tiempo"));
    }, REQUEST_TIMEOUT_MS);
    pending.set(id, { resolve, reject, timer });
    extension.send(JSON.stringify({ id, method, params }));
  });
}

// Mantiene vivo el service worker de la extensión (Chrome lo suspende tras ~30 s sin actividad).
setInterval(() => {
  if (extension) request("ping").catch(() => {});
}, PING_INTERVAL_MS).unref();

const server = new McpServer({ name: "centipede", version: "0.2.0" });

function toolResult(text) {
  return { content: [{ type: "text", text }] };
}

function toolError(error) {
  return { content: [{ type: "text", text: error.message }], isError: true };
}

async function runTool(fn) {
  try {
    return toolResult(await fn());
  } catch (error) {
    return toolError(error);
  }
}

const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Formato esperado: YYYY-MM-DD")
  .optional();

const sessionIdSchema = z
  .string()
  .optional()
  .describe("Id de una grabación guardada (ver centipede_list_sessions). Si se omite, se usa la grabación activa.");

server.registerTool(
  "centipede_status",
  {
    description:
      "Indica si la extensión Centipede está conectada, el estado de la grabación activa (si está grabando, cantidad de pasos, URL y título) y cuántas grabaciones hay guardadas.",
    inputSchema: {},
  },
  () =>
    runTool(async () => {
      if (!extension) return JSON.stringify({ connected: false }, null, 2);
      return JSON.stringify(await request("status"), null, 2);
    })
);

server.registerTool(
  "centipede_list_sessions",
  {
    description:
      "Lista las grabaciones guardadas en la biblioteca de Centipede, de la más reciente a la más antigua. Permite filtrar por fecha de grabación. Devuelve id, título, URL, fechas y cantidad de pasos de cada una.",
    inputSchema: {
      from: dateSchema.describe("Fecha inicial inclusive (YYYY-MM-DD)"),
      to: dateSchema.describe("Fecha final inclusive (YYYY-MM-DD)"),
    },
  },
  ({ from, to }) => runTool(async () => JSON.stringify(await request("list_sessions", { from, to }), null, 2))
);

server.registerTool(
  "centipede_get_session",
  {
    description:
      "Devuelve una grabación en JSON: pasos (con acción, etiqueta, selector y valor), URL, título y fecha. Sirve tanto para la grabación activa como para una guardada (pasando session_id).",
    inputSchema: {
      session_id: sessionIdSchema,
    },
  },
  ({ session_id }) =>
    runTool(async () => JSON.stringify(await request("get_session", { sessionId: session_id }), null, 2))
);

server.registerTool(
  "centipede_get_report",
  {
    description:
      "Devuelve el reporte de una grabación de Centipede. Formatos: 'natural' (texto legible en oraciones), 'text' (una línea por paso) o 'json'. Sirve tanto para la grabación activa como para una guardada (pasando session_id).",
    inputSchema: {
      format: z.enum(["natural", "text", "json"]).default("natural"),
      session_id: sessionIdSchema,
    },
  },
  ({ format, session_id }) =>
    runTool(() => request("get_report", { format, sessionId: session_id }))
);

await server.connect(new StdioServerTransport());
log(`Listo. Puerto ${PORT}. Token en ${tokenFile}`);
