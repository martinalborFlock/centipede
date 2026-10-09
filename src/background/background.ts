import { Message } from "../types";
import { archiveSession, loadSession, saveSession } from "../storage/session-store";
import { initBridge } from "../bridge/bridge-client";

initBridge();

const UNSUPPORTED_PAGE_ERROR = "Esta página no permite grabar";

async function getActiveTabId(): Promise<number | null> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab?.id ?? null;
}

async function sendToTab(tabId: number, message: Message): Promise<any> {
  try {
    return await chrome.tabs.sendMessage(tabId, message);
  } catch (error) {
    console.error("Failed to send message to tab:", error);
    return null;
  }
}

async function startRecording(withPanel: boolean): Promise<unknown> {
  const tabId = await getActiveTabId();
  if (tabId === null) {
    return { success: false, error: "No hay una pestaña activa" };
  }

  // Se lee antes de iniciar: al iniciar, el content script de la nueva pestaña sobrescribe la sesión.
  const previous = await loadSession();

  const response = await sendToTab(tabId, { type: "START_RECORDING", tabId, withPanel });
  if (!response?.success) {
    return { success: false, error: UNSUPPORTED_PAGE_ERROR };
  }

  if (previous?.tabId != null && previous.tabId !== tabId) {
    await sendToTab(previous.tabId, { type: "DETACH_PANEL" });
  }
  return { success: true };
}

async function stopRecording(): Promise<unknown> {
  const session = await loadSession();
  if (!session || session.tabId === null) {
    return { success: false, error: "No hay una grabación activa" };
  }

  const response = await sendToTab(session.tabId, { type: "STOP_RECORDING" });
  if (!response?.success) {
    // La pestaña dueña ya no tiene el content script (p. ej. navegó a una página no compatible).
    await saveSession({ ...session, tabId: null, isRecording: false });
  }
  return { success: true };
}

async function closeSession(): Promise<unknown> {
  const session = await loadSession();
  if (session?.tabId != null) {
    await sendToTab(session.tabId, { type: "CLOSE_PANEL" });
  }
  await saveSession(null);
  return { success: true };
}

/** Archiva la grabación en la biblioteca y cierra la sesión activa. */
async function saveCurrentSession(): Promise<unknown> {
  const session = await loadSession();
  if (!session || session.steps.length === 0) {
    return { success: false, error: "No hay pasos para guardar" };
  }

  await archiveSession(session);
  if (session.tabId != null) {
    await sendToTab(session.tabId, { type: "CLOSE_PANEL" });
  }
  await saveSession(null);
  return { success: true };
}

async function handleMessage(message: Message, sender: chrome.runtime.MessageSender): Promise<unknown> {
  switch (message.type) {
    case "GET_TAB_ID":
      return { tabId: sender.tab?.id ?? null };
    case "START_RECORDING":
      return startRecording(message.withPanel !== false);
    case "STOP_RECORDING":
      return stopRecording();
    case "CLOSE_PANEL":
      return closeSession();
    case "SAVE_SESSION":
      return saveCurrentSession();
    default:
      return { success: false, error: "Unknown message type" };
  }
}

chrome.runtime.onMessage.addListener((message: Message, sender, sendResponse) => {
  handleMessage(message, sender)
    .then(sendResponse)
    .catch((error) => sendResponse({ success: false, error: String(error) }));
  return true;
});

// Si se cierra la pestaña dueña, la grabación queda detenida pero sus pasos se conservan.
chrome.tabs.onRemoved.addListener(async (tabId) => {
  const session = await loadSession();
  if (session && session.tabId === tabId) {
    await saveSession({ ...session, tabId: null, isRecording: false });
  }
});
