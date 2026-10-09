import { RecordingData, SavedSession, Session, Step } from "../types";

const SESSION_KEY = "session";
const LIBRARY_KEY = "library";

export const CONFIRM_DISCARD_MESSAGE =
  "Los pasos de esta grabación todavía no están guardados y se perderán. ¿Querés continuar?";

// ---- Sesión activa ----

export async function loadSession(): Promise<Session | null> {
  const result = await chrome.storage.local.get(SESSION_KEY);
  return (result[SESSION_KEY] as Session | undefined) ?? null;
}

export async function saveSession(session: Session | null): Promise<void> {
  await chrome.storage.local.set({ [SESSION_KEY]: session });
}

export function onSessionChange(listener: (session: Session | null) => void): void {
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== "local" || !(SESSION_KEY in changes)) return;
    listener((changes[SESSION_KEY].newValue as Session | undefined) ?? null);
  });
}

export function toRecordingData({ steps, url, title, timestamp }: Session): RecordingData {
  return { steps, url, title, timestamp };
}

/** Fecha local en formato YYYY-MM-DD, comparable con filtros de rango. */
export function localDateKey(iso: string): string {
  const date = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

// ---- Biblioteca de grabaciones guardadas ----

export async function loadLibrary(): Promise<SavedSession[]> {
  const result = await chrome.storage.local.get(LIBRARY_KEY);
  return (result[LIBRARY_KEY] as SavedSession[] | undefined) ?? [];
}

/** Copia la sesión a la biblioteca (la más reciente primero). No modifica la sesión activa. */
export async function archiveSession(session: Session): Promise<SavedSession> {
  const entry: SavedSession = {
    id: crypto.randomUUID(),
    savedAt: new Date().toISOString(),
    ...toRecordingData(session),
  };
  const library = await loadLibrary();
  await chrome.storage.local.set({ [LIBRARY_KEY]: [entry, ...library] });
  return entry;
}

/** Reemplaza los pasos de una grabación guardada. Devuelve `null` si ya no existe. */
export async function updateSavedSession(id: string, steps: Step[]): Promise<SavedSession | null> {
  const library = await loadLibrary();
  const index = library.findIndex((entry) => entry.id === id);
  if (index === -1) return null;

  const updated: SavedSession = { ...library[index], steps };
  const next = [...library];
  next[index] = updated;
  await chrome.storage.local.set({ [LIBRARY_KEY]: next });
  return updated;
}

export async function deleteSavedSession(id: string): Promise<void> {
  const library = await loadLibrary();
  await chrome.storage.local.set({ [LIBRARY_KEY]: library.filter((entry) => entry.id !== id) });
}

export function onLibraryChange(listener: (library: SavedSession[]) => void): void {
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== "local" || !(LIBRARY_KEY in changes)) return;
    listener((changes[LIBRARY_KEY].newValue as SavedSession[] | undefined) ?? []);
  });
}
