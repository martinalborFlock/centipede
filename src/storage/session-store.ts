import { RecordingData, Session } from "../types";

const SESSION_KEY = "session";

export const CONFIRM_DISCARD_MESSAGE =
  "Los pasos grabados todavía no están guardados y se perderán. ¿Querés continuar?";

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
