import { Step, ActionType, RecordingData, RecordingState } from "../types";
import {
  getCssSelector,
  getVisibleText,
  getActionLabel,
} from "./element-analyzer";

export class Recorder {
  private steps: Step[] = [];
  private isRecording = false;
  private listeners: Array<{
    event: string;
    handler: EventListener;
    target: EventTarget;
  }> = [];
  private stepCounter = 0;
  private onChange?: (steps: Step[], state: RecordingState) => void;
  private scrollTimeout: ReturnType<typeof setTimeout> | null = null;

  constructor(onChange?: (steps: Step[], state: RecordingState) => void) {
    this.onChange = onChange;
  }

  start(initialSteps: Step[] = []): void {
    if (this.isRecording) return;
    this.isRecording = true;
    this.steps = [...initialSteps];
    this.stepCounter = initialSteps.length;
    this.attachListeners();
    this.notifyStateChange();
  }

  stop(): RecordingData {
    if (!this.isRecording) {
      return this.getEmptyData();
    }
    this.isRecording = false;
    if (this.scrollTimeout) {
      clearTimeout(this.scrollTimeout);
      this.scrollTimeout = null;
    }
    this.detachListeners();
    this.notifyStateChange();
    return this.getRecordingData();
  }

  getState(): RecordingState {
    return {
      isRecording: this.isRecording,
      stepCount: this.stepCounter,
    };
  }

  private notifyStateChange(): void {
    if (this.onChange) {
      this.onChange([...this.steps], this.getState());
    }
  }

  private getRecordingData(): RecordingData {
    return {
      steps: [...this.steps],
      url: window.location.href,
      timestamp: new Date().toISOString(),
      title: document.title,
    };
  }

  private getEmptyData(): RecordingData {
    return {
      steps: [],
      url: window.location.href,
      timestamp: new Date().toISOString(),
      title: document.title,
    };
  }

  private addStep(
    action: ActionType,
    element: Element,
    value?: string,
    key?: string
  ): void {
    if (!this.isRecording) return;
    if (this.isRecorderUI(element)) return;

    const selector = getCssSelector(element);
    const innerText = getVisibleText(element);
    const label = getActionLabel(action, element, value, key);

    this.stepCounter++;
    const step: Step = {
      order: this.stepCounter,
      action,
      label,
      selector,
      tagName: element.tagName.toLowerCase(),
      innerText,
      value,
      key,
    };

    this.steps.push(step);
    this.notifyStateChange();
  }

  private isRecorderUI(element: Element): boolean {
    let current: Element | null = element;
    while (current) {
      if (
        current.id === "bug-recorder-panel" ||
        current.classList?.contains("bug-recorder-panel")
      ) {
        return true;
      }
      current = current.parentElement;
    }
    return false;
  }

  private handleInput = (event: Event): void => {
    const target = event.target as HTMLInputElement | HTMLTextAreaElement;
    if (!target) return;

    const value =
      target.type === "password"
        ? "***"
        : target.value;

    const action: ActionType = event.type === "input" ? "input" : "change";
    this.addStep(action, target, value);
  };

  private handleClick = (event: Event): void => {
    const mouseEvent = event as MouseEvent;
    const target = (mouseEvent.target as Element)?.closest(
      "button, a, input[type='submit'], input[type='button'], input[type='reset'], [role='button'], [onclick]"
    ) || (mouseEvent.target as Element);

    if (!target) return;

    const isInput =
      target.tagName === "INPUT" ||
      target.tagName === "TEXTAREA" ||
      target.getAttribute("contenteditable") === "true";

    if (!isInput) {
      this.addStep("click", target);
    }
  };

  private handleDblClick = (event: Event): void => {
    const target = (event.target as Element)?.closest(
      "button, a, [role='button']"
    ) || (event.target as Element);
    if (target) this.addStep("dblclick", target);
  };

  private handleContextMenu = (event: Event): void => {
    const target = (event.target as Element)?.closest(
      "button, a, input, [role='button']"
    ) || (event.target as Element);
    if (target) this.addStep("contextmenu", target);
  };

  private handleKeydown = (event: Event): void => {
    const keyEvent = event as KeyboardEvent;
    const specialKeys = [
      "Enter",
      "Tab",
      "Escape",
      "Backspace",
      "Delete",
      "ArrowUp",
      "ArrowDown",
      "ArrowLeft",
      "ArrowRight",
      "Home",
      "End",
      "PageUp",
      "PageDown",
    ];

    if (specialKeys.includes(keyEvent.key)) {
      const target = keyEvent.target as Element;
      if (target && !this.isRecorderUI(target)) {
        this.addStep("keydown", target, undefined, keyEvent.key);
      }
    }
  };

  private handleFocus = (event: Event): void => {
    const target = event.target as Element;
    if (!target) return;

    const tag = target.tagName.toLowerCase();
    if (
      tag === "input" ||
      tag === "textarea" ||
      tag === "select" ||
      target.getAttribute("contenteditable") === "true"
    ) {
      this.addStep("focus", target);
    }
  };

  private handleChange = (event: Event): void => {
    const target = event.target as HTMLSelectElement | HTMLInputElement;
    if (!target) return;

    const tag = target.tagName.toLowerCase();
    if (tag === "select") {
      this.addStep("change", target);
    } else if (target.type === "checkbox" || target.type === "radio") {
      this.addStep("change", target);
    }
  };

  private handleMouseover = (event: Event): void => {
    const target = (event.target as Element)?.closest(
      "button, a, [data-tooltip], [title], [role='tooltip']"
    );
    if (target) {
      this.addStep("mouseover", target);
    }
  };

  private handleScroll = (event: Event): void => {
    if (this.scrollTimeout) return;

    this.scrollTimeout = setTimeout(() => {
      this.scrollTimeout = null;
    }, 500);

    const target =
      event.target === document
        ? (document.documentElement as Element)
        : (event.target as Element);
    this.addStep("scroll", target);
  };

  private attachListeners(): void {
    const documentTarget = document;
    const windowTarget = window;

    const events: Array<{
      event: string;
      handler: EventListener;
      target: EventTarget;
    }> = [
      { event: "click", handler: this.handleClick, target: documentTarget },
      {
        event: "dblclick",
        handler: this.handleDblClick,
        target: documentTarget,
      },
      {
        event: "contextmenu",
        handler: this.handleContextMenu,
        target: documentTarget,
      },
      {
        event: "input",
        handler: this.handleInput as EventListener,
        target: documentTarget,
      },
      {
        event: "change",
        handler: this.handleChange as EventListener,
        target: documentTarget,
      },
      {
        event: "keydown",
        handler: this.handleKeydown as EventListener,
        target: documentTarget,
      },
      {
        event: "focus",
        handler: this.handleFocus as EventListener,
        target: documentTarget,
      },
      {
        event: "mouseover",
        handler: this.handleMouseover,
        target: documentTarget,
      },
      {
        event: "scroll",
        handler: this.handleScroll,
        target: windowTarget,
      },
    ];

    for (const { event, handler, target } of events) {
      target.addEventListener(event, handler, { capture: true, passive: true });
      this.listeners.push({ event, handler, target });
    }
  }

  private detachListeners(): void {
    for (const { event, handler, target } of this.listeners) {
      target.removeEventListener(event, handler, { capture: true } as any);
    }
    this.listeners = [];
  }
}
