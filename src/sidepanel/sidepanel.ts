import { RecordingData, SavedSession, Session, Step } from "../types";
import { ReportFormat, renderReport } from "../report/render-report";
import {
  CONFIRM_DISCARD_MESSAGE,
  deleteSavedSession,
  loadLibrary,
  loadSession,
  onLibraryChange,
  onSessionChange,
  updateSavedSession,
} from "../storage/session-store";
import { hasChanges, moveStep, navigationChanges, removeStep, renumber, updateStep } from "./step-edit";

type DetailView = { kind: "current" } | { kind: "saved"; id: string };

const DISCARD_EDIT_MESSAGE = "Hay cambios sin guardar en los pasos. ¿Descartarlos?";

let session: Session | null = null;
let library: SavedSession[] = [];
let detail: DetailView | null = null;
// Borrador de edición (solo grabaciones guardadas). `null` cuando no se está editando.
let draft: Step[] | null = null;
// Pasos guardados al empezar a editar: contra ellos se compara el borrador.
let draftBase: Step[] = [];

function $<T extends HTMLElement>(id: string): T {
  return document.getElementById(id) as T;
}

const viewList = $<HTMLElement>("view-list");
const viewDetail = $<HTMLElement>("view-detail");
const btnNew = $<HTMLButtonElement>("btn-new");
const currentStatus = $<HTMLDivElement>("current-status");
const btnStop = $<HTMLButtonElement>("btn-stop");
const btnSave = $<HTMLButtonElement>("btn-save");
const btnCurrentView = $<HTMLButtonElement>("btn-current-view");
const currentButtons: Array<[HTMLButtonElement, ReportFormat]> = [
  [$<HTMLButtonElement>("current-report"), "natural"],
  [$<HTMLButtonElement>("current-text"), "text"],
  [$<HTMLButtonElement>("current-json"), "json"],
];
const filterFrom = $<HTMLInputElement>("filter-from");
const filterTo = $<HTMLInputElement>("filter-to");
const btnClearFilters = $<HTMLButtonElement>("btn-clear-filters");
const libraryCount = $<HTMLSpanElement>("library-count");
const libraryList = $<HTMLUListElement>("library-list");
const btnBack = $<HTMLButtonElement>("btn-back");
const detailTitle = $<HTMLDivElement>("detail-title");
const detailMeta = $<HTMLDivElement>("detail-meta");
const detailSteps = $<HTMLOListElement>("detail-steps");
const detailButtons: Array<[HTMLButtonElement, ReportFormat]> = [
  [$<HTMLButtonElement>("detail-report"), "natural"],
  [$<HTMLButtonElement>("detail-text"), "text"],
  [$<HTMLButtonElement>("detail-json"), "json"],
];
const btnDetailDelete = $<HTMLButtonElement>("detail-delete");
const btnDetailEdit = $<HTMLButtonElement>("detail-edit");
const btnDetailSave = $<HTMLButtonElement>("detail-save");
const btnDetailCancel = $<HTMLButtonElement>("detail-cancel");
const detailDirty = $<HTMLDivElement>("detail-dirty");
const toast = $<HTMLDivElement>("toast");

function send(message: unknown): Promise<any> {
  return chrome.runtime.sendMessage(message).catch(() => null);
}

let toastTimer: number | undefined;
function showToast(message: string): void {
  toast.textContent = message;
  toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => (toast.hidden = true), 1800);
}

function copyReport(data: RecordingData, format: ReportFormat): void {
  navigator.clipboard
    .writeText(renderReport(data, format))
    .then(() => showToast("Copiado al portapapeles"))
    .catch(() => showToast("No se pudo copiar"));
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("es-AR", { dateStyle: "medium", timeStyle: "short" });
}

/** Fecha local en formato YYYY-MM-DD, comparable con los valores de los filtros. */
function localDateKey(iso: string): string {
  const date = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function filteredLibrary(): SavedSession[] {
  const from = filterFrom.value;
  const to = filterTo.value;
  return library.filter((entry) => {
    const key = localDateKey(entry.timestamp);
    return (!from || key >= from) && (!to || key <= to);
  });
}

/** Datos de la vista de detalle: la sesión activa (en vivo) o una guardada. */
function detailData(): RecordingData | null {
  if (!detail) return null;
  if (detail.kind === "current") return session;
  const id = detail.id;
  return library.find((entry) => entry.id === id) ?? null;
}

function renderCurrent(): void {
  const steps = session?.steps.length ?? 0;
  const isRecording = session?.isRecording ?? false;

  currentStatus.textContent = !session
    ? "Sin grabación activa"
    : `${isRecording ? "Grabando" : "Detenida"} · ${steps} pasos`;
  currentStatus.classList.toggle("active", isRecording);

  btnStop.disabled = !isRecording;
  btnSave.disabled = steps === 0;
  btnCurrentView.disabled = !session;
  for (const [button] of currentButtons) button.disabled = steps === 0;
}

function libraryItem(entry: SavedSession): HTMLLIElement {
  const item = document.createElement("li");
  item.className = "sp-item";

  const title = document.createElement("div");
  title.className = "sp-item-title";
  title.textContent = entry.title || entry.url;

  const meta = document.createElement("div");
  meta.className = "sp-item-meta";
  meta.textContent = `${formatDate(entry.timestamp)} · ${entry.steps.length} pasos`;

  item.append(title, meta);
  item.addEventListener("click", () => {
    detail = { kind: "saved", id: entry.id };
    render();
  });
  return item;
}

function renderLibrary(): void {
  const entries = filteredLibrary();
  libraryCount.textContent = `(${entries.length} de ${library.length})`;

  if (entries.length === 0) {
    const empty = document.createElement("div");
    empty.className = "sp-empty";
    empty.textContent = library.length === 0
      ? "Todavía no hay grabaciones guardadas"
      : "No hay grabaciones en ese rango de fechas";
    libraryList.replaceChildren(empty);
    return;
  }
  libraryList.replaceChildren(...entries.map(libraryItem));
}

function isDirty(): boolean {
  return draft !== null && hasChanges(draftBase, draft);
}

/** Pide confirmación si hay cambios sin guardar. Devuelve `true` si se puede salir de la edición. */
function confirmDiscard(): boolean {
  return !isDirty() || confirm(DISCARD_EDIT_MESSAGE);
}

/** Muestra u oculta los controles de edición y bloquea las acciones que no corresponden mientras se edita. */
function updateEditState(): void {
  const isSaved = detail?.kind === "saved";
  const editing = draft !== null;

  btnDetailEdit.hidden = !isSaved || editing;
  btnDetailSave.hidden = !editing;
  btnDetailCancel.hidden = !editing;
  btnDetailSave.disabled = !isDirty();
  detailDirty.hidden = !isDirty();
  btnDetailDelete.hidden = !isSaved || editing;
  for (const [button] of detailButtons) button.disabled = editing;
}

function readonlyStep(step: Step): HTMLLIElement {
  const item = document.createElement("li");
  item.textContent = step.label;
  return item;
}

function iconButton(text: string, label: string, disabled: boolean, onClick: () => void): HTMLButtonElement {
  const button = document.createElement("button");
  button.className = "sp-btn ghost icon";
  button.textContent = text;
  button.title = label;
  button.setAttribute("aria-label", label);
  button.disabled = disabled;
  button.addEventListener("click", onClick);
  return button;
}

/** Paso editable. Los campos de texto actualizan el borrador sin volver a renderizar, para no perder el foco. */
function editableStep(step: Step, index: number, count: number): HTMLLIElement {
  const item = document.createElement("li");
  item.className = "sp-step-edit";

  const row = document.createElement("div");
  row.className = "sp-step-row";

  // En un paso de navegación, el único campo es la URL: la descripción se deriva de ella.
  const isNavigation = step.action === "navigate";
  const label = document.createElement("input");
  label.className = "sp-input";
  label.value = isNavigation ? step.value ?? "" : step.label;
  label.setAttribute(
    "aria-label",
    isNavigation ? `URL del paso ${index + 1}` : `Descripción del paso ${index + 1}`
  );
  label.addEventListener("input", () => {
    if (!draft) return;
    const changes = isNavigation ? navigationChanges(label.value) : { label: label.value };
    draft = updateStep(draft, index, changes);
    updateEditState();
  });

  row.append(
    label,
    iconButton("↑", "Subir paso", index === 0, () => commitDraft(moveStep(draft!, index, -1))),
    iconButton("↓", "Bajar paso", index === count - 1, () => commitDraft(moveStep(draft!, index, 1))),
    iconButton("✕", "Eliminar paso", false, () => commitDraft(removeStep(draft!, index)))
  );
  item.append(row);

  if (!isNavigation && step.value !== undefined) {
    const value = document.createElement("input");
    value.className = "sp-input sp-step-value";
    value.value = step.value;
    value.placeholder = "Valor";
    value.setAttribute("aria-label", `Valor del paso ${index + 1}`);
    value.addEventListener("input", () => {
      if (draft) draft = updateStep(draft, index, { value: value.value });
      updateEditState();
    });
    item.append(value);
  }

  return item;
}

/** Reemplaza el borrador por una versión nueva de los pasos y vuelve a renderizar la lista. */
function commitDraft(next: Step[]): void {
  draft = next;
  renderDetail();
}

function startEdit(): void {
  if (detail?.kind !== "saved") return;
  const entry = detailData();
  if (!entry) return;
  draftBase = entry.steps;
  draft = entry.steps.map((step) => ({ ...step }));
  renderDetail();
}

function cancelEdit(): void {
  if (!confirmDiscard()) return;
  draft = null;
  render();
}

async function saveEdit(): Promise<void> {
  if (draft === null || detail?.kind !== "saved") return;
  if (draft.some((step) => step.label.trim() === "")) {
    showToast("Todos los pasos necesitan una descripción");
    return;
  }

  const id = detail.id;
  const saved = await updateSavedSession(id, renumber(draft));
  draft = null;
  showToast(saved ? "Cambios guardados" : "La grabación ya no existe");
  render();
}

function renderDetail(): void {
  const data = detailData();
  if (!data) return;

  detailTitle.textContent = data.title || data.url;
  detailMeta.textContent = `${data.url}\nFecha: ${formatDate(data.timestamp)} · ${data.steps.length} pasos`;

  const steps = draft ?? data.steps;
  detailSteps.replaceChildren(
    ...steps.map((step, index) =>
      draft ? editableStep(step, index, steps.length) : readonlyStep(step)
    )
  );

  updateEditState();
}

function render(): void {
  // Si la vista de detalle apunta a algo que ya no existe, se vuelve a la lista (descartando el borrador).
  if (detail && !detailData()) {
    detail = null;
    draft = null;
  }

  renderCurrent();
  renderLibrary();
  viewList.hidden = detail !== null;
  viewDetail.hidden = detail === null;
  if (detail) renderDetail();
}

// ---- Acciones ----

btnNew.addEventListener("click", async () => {
  if (session && session.steps.length > 0 && !confirm(CONFIRM_DISCARD_MESSAGE)) return;
  // Desde el panel lateral no se muestra la ventana flotante en la página.
  const response = await send({ type: "START_RECORDING", withPanel: false });
  if (!response?.success) showToast(response?.error ?? "No se pudo iniciar la grabación");
});

btnStop.addEventListener("click", async () => {
  await send({ type: "STOP_RECORDING" });
});

btnSave.addEventListener("click", async () => {
  const response = await send({ type: "SAVE_SESSION" });
  if (!response?.success) {
    showToast(response?.error ?? "No se pudo guardar la grabación");
    return;
  }
  showToast("Grabación guardada");
});

btnCurrentView.addEventListener("click", () => {
  detail = { kind: "current" };
  render();
});

for (const [button, format] of currentButtons) {
  button.addEventListener("click", () => {
    if (session) copyReport(session, format);
  });
}

for (const [button, format] of detailButtons) {
  button.addEventListener("click", () => {
    const data = detailData();
    if (data) copyReport(data, format);
  });
}

btnBack.addEventListener("click", () => {
  if (!confirmDiscard()) return;
  detail = null;
  draft = null;
  render();
});

btnDetailEdit.addEventListener("click", startEdit);
btnDetailSave.addEventListener("click", saveEdit);
btnDetailCancel.addEventListener("click", cancelEdit);

// Al cerrar la página con cambios sin guardar, el navegador pide confirmación (según el navegador, no siempre aparece).
window.addEventListener("beforeunload", (event) => {
  if (!isDirty()) return;
  event.preventDefault();
  event.returnValue = "";
});

btnDetailDelete.addEventListener("click", async () => {
  if (detail?.kind !== "saved") return;
  if (!confirm("¿Eliminar esta grabación de la biblioteca? No se puede deshacer.")) return;
  await deleteSavedSession(detail.id);
  detail = null;
  showToast("Grabación eliminada");
  render();
});

filterFrom.addEventListener("input", renderLibrary);
filterTo.addEventListener("input", renderLibrary);
btnClearFilters.addEventListener("click", () => {
  filterFrom.value = "";
  filterTo.value = "";
  renderLibrary();
});

// ---- Inicio y sincronización en vivo ----

async function init(): Promise<void> {
  session = await loadSession();
  library = await loadLibrary();
  render();

  onSessionChange((updated) => {
    session = updated;
    render();
  });
  onLibraryChange((updated) => {
    library = updated;
    render();
  });
}

// ---- Emparejamiento con Claude (puente MCP) ----

const bridgeStatus = $<HTMLDivElement>("bridge-status");
const bridgeToken = $<HTMLInputElement>("bridge-token");
const btnSaveToken = $<HTMLButtonElement>("btn-save-token");

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

async function initBridgeUi(): Promise<void> {
  const stored = await chrome.storage.local.get("bridgeConnected");
  renderBridge(Boolean(stored.bridgeConnected));
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === "local" && "bridgeConnected" in changes) {
      renderBridge(Boolean(changes.bridgeConnected.newValue));
    }
  });
}

init();
initBridgeUi();
