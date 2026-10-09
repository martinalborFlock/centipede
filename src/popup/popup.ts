import { Message, Session } from "../types";
import { formatNaturalReport } from "../report/natural-report";
import {
  CONFIRM_DISCARD_MESSAGE,
  loadSession,
  onSessionChange,
  toRecordingData,
} from "../storage/session-store";

let session: Session | null = null;

const btnRecord = document.getElementById("btn-record") as HTMLButtonElement;
const btnStop = document.getElementById("btn-stop") as HTMLButtonElement;
const btnClose = document.getElementById("btn-close") as HTMLButtonElement;
const btnSave = document.getElementById("btn-save") as HTMLButtonElement;
const btnSessions = document.getElementById("btn-sessions") as HTMLButtonElement;
const btnCopyReport = document.getElementById("btn-copy-report") as HTMLButtonElement;
const btnCopyText = document.getElementById("btn-copy-text") as HTMLButtonElement;
const btnCopyJson = document.getElementById("btn-copy-json") as HTMLButtonElement;
const statusDot = document.getElementById("status-dot") as HTMLDivElement;
const statusText = document.getElementById("status-text") as HTMLSpanElement;
const stepCountText = document.getElementById("step-count-text") as HTMLSpanElement;
const previewContent = document.getElementById("preview-content") as HTMLDivElement;
const btnRecordText = document.getElementById("btn-record-text") as HTMLSpanElement;

function sendMessage(message: Message): Promise<any> {
  return chrome.runtime.sendMessage(message).catch(() => null);
}

function render(): void {
  const isRecording = session?.isRecording ?? false;
  const steps = session?.steps ?? [];
  const hasSteps = steps.length > 0;

  statusDot.classList.toggle("active", isRecording);
  statusText.textContent = isRecording
    ? "Grabando..."
    : session
      ? "Grabación detenida"
      : "Inactivo";

  btnRecordText.textContent = isRecording
    ? "Grabando"
    : hasSteps
      ? "Nueva grabación"
      : "Grabar";
  btnRecord.classList.toggle("recording", isRecording);
  btnRecord.disabled = isRecording;
  btnStop.disabled = !isRecording;
  btnClose.disabled = !session;
  btnSave.disabled = !hasSteps;

  btnCopyReport.disabled = !hasSteps;
  btnCopyText.disabled = !hasSteps;
  btnCopyJson.disabled = !hasSteps;

  stepCountText.textContent = `${steps.length} pasos grabados`;
  previewContent.textContent = hasSteps
    ? steps.map((s) => `${s.order} - ${s.label}`).join("\n")
    : "No hay pasos grabados";
}

function showToast(message: string): void {
  const toast = document.createElement("div");
  toast.className = "copied-toast";
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 1500);
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

function copyToClipboard(text: string): void {
  navigator.clipboard
    .writeText(text)
    .catch(() => fallbackCopy(text))
    .finally(() => showToast("Copiado al portapapeles"));
}

function confirmDiscard(): boolean {
  return !session?.steps.length || window.confirm(CONFIRM_DISCARD_MESSAGE);
}

btnRecord.addEventListener("click", async () => {
  if (!confirmDiscard()) return;
  const response = await sendMessage({ type: "START_RECORDING" });
  if (!response?.success) {
    showToast(response?.error ?? "No se pudo iniciar la grabación");
  }
});

btnStop.addEventListener("click", async () => {
  await sendMessage({ type: "STOP_RECORDING" });
});

btnClose.addEventListener("click", async () => {
  if (!confirmDiscard()) return;
  await sendMessage({ type: "CLOSE_PANEL" });
});

btnCopyReport.addEventListener("click", () => {
  if (session) copyToClipboard(formatNaturalReport(toRecordingData(session)));
});

btnCopyText.addEventListener("click", () => {
  if (!session) return;
  copyToClipboard(session.steps.map((s) => `${s.order} - ${s.label}`).join("\n"));
});

btnCopyJson.addEventListener("click", () => {
  if (session) copyToClipboard(JSON.stringify(toRecordingData(session), null, 2));
});

btnSave.addEventListener("click", async () => {
  const response = await sendMessage({ type: "SAVE_SESSION" });
  if (!response?.success) {
    showToast(response?.error ?? "No se pudo guardar la grabación");
    return;
  }
  showToast("Grabación guardada");
});

btnSessions.addEventListener("click", async () => {
  const browserWindow = await chrome.windows.getCurrent();
  await chrome.sidePanel.open({ windowId: browserWindow.id! });
});

const bridgeStatus = document.getElementById("bridge-status") as HTMLDivElement;
const bridgeToken = document.getElementById("bridge-token") as HTMLInputElement;
const btnSaveToken = document.getElementById("btn-save-token") as HTMLButtonElement;

function renderBridge(connected: boolean): void {
  bridgeStatus.textContent = connected ? "Claude: conectado" : "Claude: desconectado";
  bridgeStatus.classList.toggle("connected", connected);
}

btnSaveToken.addEventListener("click", async () => {
  const token = bridgeToken.value.trim();
  if (!token) {
    showToast("Ingresá el token");
    return;
  }
  await chrome.storage.local.set({ bridgeToken: token });
  bridgeToken.value = "";
  showToast("Token guardado");
});

async function init(): Promise<void> {
  session = await loadSession();
  render();
  onSessionChange((updated) => {
    session = updated;
    render();
  });

  const stored = await chrome.storage.local.get("bridgeConnected");
  renderBridge(Boolean(stored.bridgeConnected));
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === "local" && "bridgeConnected" in changes) {
      renderBridge(Boolean(changes.bridgeConnected.newValue));
    }
  });
}

init();
