import { RecordingData } from "../types";
import { ReportFormat, renderReport } from "../report/render-report";
import { loadLibrary, loadSession, localDateKey } from "../storage/session-store";

// Puerto del puente MCP (mcp/server.mjs). Debe coincidir con CENTIPEDE_PORT.
const BRIDGE_PORT = 47315;
const TOKEN_KEY = "bridgeToken";
const STATUS_KEY = "bridgeConnected";
const ALARM_NAME = "centipede-bridge";

interface BridgeParams {
  format?: ReportFormat;
  /** Id de una grabación guardada. Si se omite, se usa la sesión activa. */
  sessionId?: string;
  /** Filtros de fecha (YYYY-MM-DD) para list_sessions. */
  from?: string;
  to?: string;
}

interface BridgeRequest {
  id: string;
  method: string;
  params?: BridgeParams;
}

let socket: WebSocket | null = null;

function setConnected(connected: boolean): Promise<void> {
  return chrome.storage.local.set({ [STATUS_KEY]: connected });
}

function pickRecording(data: RecordingData): RecordingData {
  return { steps: data.steps, url: data.url, title: data.title, timestamp: data.timestamp };
}

/** Grabación guardada si se pasa un id; si no, la sesión activa. */
async function resolveRecording(
  sessionId?: string
): Promise<{ recording: RecordingData; isRecording: boolean }> {
  if (sessionId) {
    const entry = (await loadLibrary()).find((saved) => saved.id === sessionId);
    if (!entry) throw new Error(`No hay una grabación guardada con id "${sessionId}"`);
    return { recording: pickRecording(entry), isRecording: false };
  }

  const session = await loadSession();
  if (!session) throw new Error("No hay una grabación en curso ni guardada");
  return { recording: pickRecording(session), isRecording: session.isRecording };
}

function inDateRange(timestamp: string, from?: string, to?: string): boolean {
  const key = localDateKey(timestamp);
  return (!from || key >= from) && (!to || key <= to);
}

async function dispatch(method: string, params: BridgeParams | undefined): Promise<unknown> {
  switch (method) {
    case "ping":
      return "pong";

    case "status": {
      const session = await loadSession();
      return {
        connected: true,
        isRecording: session?.isRecording ?? false,
        stepCount: session?.steps.length ?? 0,
        url: session?.url ?? null,
        title: session?.title ?? null,
        savedSessions: (await loadLibrary()).length,
      };
    }

    case "list_sessions": {
      const library = await loadLibrary();
      return library
        .filter((entry) => inDateRange(entry.timestamp, params?.from, params?.to))
        .map((entry) => ({
          id: entry.id,
          title: entry.title,
          url: entry.url,
          timestamp: entry.timestamp,
          savedAt: entry.savedAt,
          stepCount: entry.steps.length,
        }));
    }

    case "get_session": {
      const { recording, isRecording } = await resolveRecording(params?.sessionId);
      return { isRecording, ...recording };
    }

    case "get_report": {
      const { recording } = await resolveRecording(params?.sessionId);
      return renderReport(recording, params?.format ?? "natural");
    }

    default:
      throw new Error(`Método desconocido: ${method}`);
  }
}

async function handleMessage(ws: WebSocket, raw: string): Promise<void> {
  const request = JSON.parse(raw) as BridgeRequest;
  try {
    const result = await dispatch(request.method, request.params);
    ws.send(JSON.stringify({ id: request.id, result }));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    ws.send(JSON.stringify({ id: request.id, error: message }));
  }
}

export async function connectBridge(): Promise<void> {
  if (socket && socket.readyState <= WebSocket.OPEN) return;

  const stored = await chrome.storage.local.get(TOKEN_KEY);
  const token = stored[TOKEN_KEY] as string | undefined;
  if (!token) {
    await setConnected(false);
    return;
  }

  const ws = new WebSocket(`ws://127.0.0.1:${BRIDGE_PORT}/?token=${encodeURIComponent(token)}`);
  socket = ws;

  ws.onopen = () => {
    setConnected(true);
  };
  ws.onmessage = (event) => {
    handleMessage(ws, String(event.data)).catch((error) =>
      console.error("[Bug Recorder] Error atendiendo al puente:", error)
    );
  };
  ws.onclose = () => {
    if (socket === ws) socket = null;
    setConnected(false);
  };
}

function disconnectBridge(): void {
  socket?.close();
  socket = null;
}

/** Reconexión periódica (alarma), al iniciar Chrome y al cambiar el token desde el popup. */
export function initBridge(): void {
  chrome.alarms.create(ALARM_NAME, { periodInMinutes: 1 });
  chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === ALARM_NAME) connectBridge();
  });

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === "local" && TOKEN_KEY in changes) {
      disconnectBridge();
      connectBridge();
    }
  });

  connectBridge();
}
