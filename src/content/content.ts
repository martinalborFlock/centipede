import { Recorder } from "./recorder";
import { FloatingPanel } from "./floating-panel";
import { Message, RecordingState, Session, Step } from "../types";
import { loadSession, saveSession } from "../storage/session-store";

let recorder: Recorder | null = null;
let panel: FloatingPanel | null = null;
let tabId: number | null = null;
let startedAt = new Date().toISOString();

function buildSession(steps: Step[], isRecording: boolean): Session {
  return {
    tabId,
    isRecording,
    steps,
    url: window.location.href,
    title: document.title,
    timestamp: startedAt,
  };
}

function onRecorderChange(steps: Step[], state: RecordingState): void {
  panel?.updateSteps(steps, startedAt);
  panel?.updateState(state);
  saveSession(buildSession(steps, state.isRecording)).catch(console.error);
}

function copyToClipboard(text: string): void {
  navigator.clipboard.writeText(text).catch(() => {
    fallbackCopy(text);
  });
}

function fallbackCopy(text: string): void {
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  try {
    document.execCommand("copy");
  } catch (e) {
    console.error("Failed to copy:", e);
  }
  textarea.remove();
}

function createPanel(): FloatingPanel {
  return new FloatingPanel({
    onStop: () => stopRecording(),
    onNewRecording: () => beginRecording([], new Date().toISOString()),
    onClose: () => {
      closeSession();
    },
    onCopyReport: copyToClipboard,
    onCopyText: copyToClipboard,
    onCopyJson: copyToClipboard,
  });
}

/** Detiene la grabación y oculta el panel sin tocar el storage. */
function teardown(): void {
  const previous = recorder;
  recorder = null;
  if (previous?.getState().isRecording) {
    previous.stop();
  }
  panel?.hide();
  panel = null;
}

function beginRecording(steps: Step[], timestamp: string): void {
  teardown();
  startedAt = timestamp;
  panel = createPanel();
  panel.show();

  // Solo la grabación vigente escribe en el storage; las anteriores quedan silenciadas.
  const current: Recorder = new Recorder((updatedSteps, state) => {
    if (current === recorder) onRecorderChange(updatedSteps, state);
  });
  recorder = current;
  current.start(steps);
}

function restoreStoppedSession(session: Session): void {
  teardown();
  startedAt = session.timestamp;
  panel = createPanel();
  panel.show();
  panel.updateSteps(session.steps, startedAt);
  panel.updateState({ isRecording: false, stepCount: session.steps.length });
}

function stopRecording(): void {
  recorder?.stop();
}

async function closeSession(): Promise<void> {
  teardown();
  await saveSession(null);
}

/** Al cargar la página, retoma la sesión si la pestaña es su dueña (p. ej. tras navegar). */
async function restoreSession(): Promise<void> {
  const response = await chrome.runtime.sendMessage({ type: "GET_TAB_ID" } as Message);
  tabId = response?.tabId ?? null;

  const session = await loadSession();
  if (!session || tabId === null || session.tabId !== tabId) return;

  if (session.isRecording) {
    beginRecording(session.steps, session.timestamp);
  } else {
    restoreStoppedSession(session);
  }
}

chrome.runtime.onMessage.addListener(
  (message: Message, _sender, sendResponse) => {
    switch (message.type) {
      case "START_RECORDING":
        if (message.tabId !== undefined) tabId = message.tabId;
        beginRecording([], new Date().toISOString());
        sendResponse({ success: true });
        return false;

      case "STOP_RECORDING":
        stopRecording();
        sendResponse({ success: true });
        return false;

      case "DETACH_PANEL":
        teardown();
        sendResponse({ success: true });
        return false;

      case "CLOSE_PANEL":
        closeSession().then(() => sendResponse({ success: true }));
        return true;

      default:
        return false;
    }
  }
);

restoreSession().catch((error) =>
  console.error("[Bug Recorder] No se pudo restaurar la sesión:", error)
);

console.log("[Bug Recorder] Content script loaded");
