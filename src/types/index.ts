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
  | "select";

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
}

export type Message =
  | { type: "START_RECORDING"; tabId?: number }
  | { type: "STOP_RECORDING" }
  | { type: "CLOSE_PANEL" }
  | { type: "DETACH_PANEL" }
  | { type: "GET_TAB_ID" };
