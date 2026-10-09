import { Recorder } from "./recorder";
import { FloatingPanel } from "./floating-panel";
import { Message, RecordingState, Session, Step } from "../types";
import { loadSession, saveSession } from "../storage/session-store";

let recorder: Recorder | null = null;
let panel: FloatingPanel | null = null;
let tabId: number | null = null;
let startedAt = new Date().toISOString();
// URL de la página actual; se actualiza antes de la navegación para que la sesión quede con el destino.
let currentUrl = window.location.href;
// `false` cuando la grabación se inició desde el panel lateral: la ventana flotante no se muestra.
let panelEnabled = true;

function buildSession(steps: Step[], isRecording: boolean): Session {
  return {
    tabId,
    isRecording,
    showPanel: panelEnabled,
    steps,
    url: currentUrl,
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
    onNewRecording: () => beginRecording([], new Date().toISOString(), true),
    onSave: () => {
      chrome.runtime.sendMessage({ type: "SAVE_SESSION" } as Message).catch(() => {});
    },
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

function beginRecording(steps: Step[], timestamp: string, withPanel: boolean): void {
  teardown();
  startedAt = timestamp;
  panelEnabled = withPanel;
  if (withPanel) {
    panel = createPanel();
    panel.show();
  }

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
  panelEnabled = true;
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

/** Captura navegaciones dentro de la página (pushState, enlaces internos, historial). */
function listenForNavigation(): void {
  // Navigation API: disponible en Chrome 102+. Se accede sin tipar para no depender de lib.dom.
  const navigation = (window as any).navigation;
  navigation?.addEventListener("navigate", (event: { destination: { url: string } }) => {
    const destination = event.destination.url;
    if (destination === currentUrl) return;
    currentUrl = destination;
    if (recorder?.getState().isRecording) recorder.recordNavigation(destination);
  });
}

/** Al cargar la página, retoma la sesión si la pestaña es su dueña (p. ej. tras navegar). */
async function restoreSession(): Promise<void> {
  const response = await chrome.runtime.sendMessage({ type: "GET_TAB_ID" } as Message);
  tabId = response?.tabId ?? null;

  const session = await loadSession();
  if (!session || tabId === null || session.tabId !== tabId) return;

  const withPanel = session.showPanel !== false;
  if (session.isRecording) {
    beginRecording(session.steps, session.timestamp, withPanel);
    // Navegación entre documentos: si la URL guardada no es la actual, la página cambió.
    if (session.url !== currentUrl) recorder?.recordNavigation(currentUrl);
  } else if (withPanel) {
    restoreStoppedSession(session);
  }
}

chrome.runtime.onMessage.addListener(
  (message: Message, _sender, sendResponse) => {
    switch (message.type) {
      case "START_RECORDING":
        if (message.tabId !== undefined) tabId = message.tabId;
        beginRecording([], new Date().toISOString(), message.withPanel !== false);
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

listenForNavigation();

restoreSession().catch((error) =>
  console.error("[Bug Recorder] No se pudo restaurar la sesión:", error)
);

console.log("[Bug Recorder] Content script loaded");
