export type ActionType =
  | "click"
  | "input"
  | "change"
  | "mouseover"
  | "scroll"
  | "keydown"
  | "focus"
  | "dblclick"
  | "contextmenu"
  | "select"
  | "navigate";

export interface Step {
  order: number;
  action: ActionType;
  label: string;
  selector: string;
  tagName: string;
  innerText: string;
  value?: string;
  scrollX?: number;
  scrollY?: number;
  key?: string;
}

export interface RecordingData {
  steps: Step[];
  url: string;
  timestamp: string;
  title: string;
}

export interface RecordingState {
  isRecording: boolean;
  stepCount: number;
}

/** Sesión compartida entre el panel flotante y el popup (`chrome.storage.local`). */
export interface Session extends RecordingData {
  /** Pestaña que tiene la grabación. `null` si la pestaña ya no existe. */
  tabId: number | null;
  isRecording: boolean;
  /** `false` si la grabación se inició desde el panel lateral: no se muestra el panel flotante. */
  showPanel?: boolean;
}

/** Grabación archivada en la biblioteca. */
export interface SavedSession extends RecordingData {
  id: string;
  savedAt: string;
}

export type Message =
  | { type: "START_RECORDING"; tabId?: number; withPanel?: boolean }
  | { type: "STOP_RECORDING" }
  | { type: "CLOSE_PANEL" }
  | { type: "DETACH_PANEL" }
  | { type: "GET_TAB_ID" }
  | { type: "SAVE_SESSION" };
