import { Step, RecordingState } from "../types";
import { formatNaturalReport } from "../report/natural-report";
import { CONFIRM_DISCARD_MESSAGE } from "../storage/session-store";

const PANEL_ID = "bug-recorder-panel";
const PANEL_STYLE_ID = "bug-recorder-panel-style";

export class FloatingPanel {
  private panel: HTMLDivElement | null = null;
  private stepsContainer: HTMLDivElement | null = null;
  private stopButton: HTMLButtonElement | null = null;
  private copyTextButton: HTMLButtonElement | null = null;
  private copyJsonButton: HTMLButtonElement | null = null;
  private statusIndicator: HTMLDivElement | null = null;
  private copyReportButton: HTMLButtonElement | null = null;
  private newRecordingButton: HTMLButtonElement | null = null;
  private saveButton: HTMLButtonElement | null = null;
  private steps: Step[] = [];
  private timestamp = new Date().toISOString();
  // URL donde empezó la grabación (se exporta como `url`).
  private startUrl = window.location.href;
  private onStop?: () => void;
  private onNewRecording?: () => void;
  private onSave?: () => void;
  private onClose?: () => void;
  private onCopyReport?: (text: string) => void;
  private onCopyText?: (text: string) => void;
  private onCopyJson?: (json: string) => void;
  private isVisible = false;

  constructor(callbacks: {
    onStop?: () => void;
    onNewRecording?: () => void;
    onSave?: () => void;
    onClose?: () => void;
    onCopyReport?: (text: string) => void;
    onCopyText?: (text: string) => void;
    onCopyJson?: (json: string) => void;
  }) {
    this.onStop = callbacks.onStop;
    this.onNewRecording = callbacks.onNewRecording;
    this.onSave = callbacks.onSave;
    this.onClose = callbacks.onClose;
    this.onCopyReport = callbacks.onCopyReport;
    this.onCopyText = callbacks.onCopyText;
    this.onCopyJson = callbacks.onCopyJson;
  }

  show(): void {
    if (this.isVisible) return;
    this.isVisible = true;
    this.injectStyles();
    this.createPanel();
  }

  hide(): void {
    if (!this.isVisible) return;
    this.isVisible = false;
    this.removePanel();
    this.removeStyles();
  }

  updateSteps(steps: Step[], timestamp: string, startUrl: string): void {
    this.steps = steps;
    this.timestamp = timestamp;
    this.startUrl = startUrl;
    this.renderSteps();
  }

  updateState(state: RecordingState): void {
    if (this.statusIndicator) {
      this.statusIndicator.className = state.isRecording
        ? "br-status-indicator recording"
        : "br-status-indicator";
    }

    if (this.stopButton) {
      this.stopButton.disabled = !state.isRecording;
    }

    const countEl = document.getElementById("br-step-count");
    if (countEl) {
      countEl.textContent = `${state.stepCount} pasos`;
    }

    const hasSteps = state.stepCount > 0;
    if (this.saveButton) this.saveButton.disabled = !hasSteps;
    if (this.copyReportButton) this.copyReportButton.disabled = !hasSteps;
    if (this.copyTextButton) this.copyTextButton.disabled = !hasSteps;
    if (this.copyJsonButton) this.copyJsonButton.disabled = !hasSteps;
  }

  private injectStyles(): void {
    if (document.getElementById(PANEL_STYLE_ID)) return;

    const style = document.createElement("style");
    style.id = PANEL_STYLE_ID;
    style.textContent = `
      #${PANEL_ID} {
        position: fixed;
        bottom: 20px;
        right: 20px;
        width: 360px;
        max-height: 500px;
        background: #1a1a2e;
        color: #e0e0e0;
        border-radius: 12px;
        box-shadow: 0 8px 32px rgba(0,0,0,0.4);
        z-index: 2147483647;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        font-size: 13px;
        display: flex;
        flex-direction: column;
        overflow: hidden;
        user-select: none;
        border: 1px solid rgba(255,255,255,0.1);
      }

      .br-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 12px 16px;
        background: #16213e;
        border-bottom: 1px solid rgba(255,255,255,0.1);
      }

      .br-header-left {
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .br-status-indicator {
        width: 10px;
        height: 10px;
        border-radius: 50%;
        background: #4caf50;
        transition: background 0.3s;
      }

      .br-status-indicator.recording {
        background: #f44336;
        animation: br-pulse 1s infinite;
      }

      @keyframes br-pulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.4; }
      }

      .br-title {
        font-weight: 600;
        font-size: 14px;
        color: #fff;
      }

      .br-step-count {
        font-size: 12px;
        color: #9e9e9e;
      }

      .br-minimize-btn {
        background: none;
        border: none;
        color: #9e9e9e;
        cursor: pointer;
        font-size: 18px;
        padding: 0 4px;
        line-height: 1;
      }

      .br-minimize-btn:hover {
        color: #fff;
      }

      .br-close-btn {
        background: none;
        border: none;
        color: #9e9e9e;
        cursor: pointer;
        font-size: 18px;
        padding: 0 4px;
        line-height: 1;
      }

      .br-close-btn:hover {
        color: #f44336;
      }

      .br-body {
        flex: 1;
        overflow-y: auto;
        padding: 8px;
        max-height: 320px;
      }

      .br-body::-webkit-scrollbar {
        width: 6px;
      }

      .br-body::-webkit-scrollbar-track {
        background: transparent;
      }

      .br-body::-webkit-scrollbar-thumb {
        background: #444;
        border-radius: 3px;
      }

      .br-empty {
        text-align: center;
        color: #666;
        padding: 32px 16px;
        font-style: italic;
      }

      .br-step {
        display: flex;
        gap: 8px;
        padding: 8px 10px;
        margin-bottom: 4px;
        border-radius: 6px;
        background: rgba(255,255,255,0.03);
        border: 1px solid rgba(255,255,255,0.05);
        transition: background 0.2s;
      }

      .br-step:hover {
        background: rgba(255,255,255,0.06);
      }

      .br-step:last-child {
        border-left: 2px solid #f44336;
      }

      .br-step-number {
        color: #64b5f6;
        font-weight: 700;
        min-width: 24px;
        font-size: 12px;
      }

      .br-step-label {
        flex: 1;
        color: #e0e0e0;
        line-height: 1.4;
        word-break: break-word;
      }

      .br-step-action {
        font-size: 10px;
        color: #9e9e9e;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        margin-top: 2px;
      }

      .br-footer {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        padding: 10px 12px;
        background: #16213e;
        border-top: 1px solid rgba(255,255,255,0.1);
      }

      .br-btn {
        flex: 1 1 auto;
        padding: 8px 12px;
        border: none;
        border-radius: 6px;
        cursor: pointer;
        font-size: 12px;
        font-weight: 600;
        transition: all 0.2s;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 4px;
      }

      .br-btn:disabled {
        opacity: 0.4;
        cursor: not-allowed;
      }

      .br-btn-stop {
        background: #f44336;
        color: white;
      }

      .br-btn-stop:hover:not(:disabled) {
        background: #d32f2f;
      }

      .br-btn-copy {
        background: #333;
        color: #e0e0e0;
      }

      .br-btn-copy:hover:not(:disabled) {
        background: #444;
      }

      .br-copied-toast {
        position: fixed;
        bottom: 80px;
        right: 20px;
        background: #4caf50;
        color: white;
        padding: 8px 16px;
        border-radius: 6px;
        font-size: 12px;
        font-weight: 600;
        z-index: 2147483647;
        animation: br-fadeout 2s forwards;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      }

      @keyframes br-fadeout {
        0% { opacity: 1; transform: translateY(0); }
        70% { opacity: 1; transform: translateY(0); }
        100% { opacity: 0; transform: translateY(-10px); }
      }
    `;
    document.head.appendChild(style);
  }

  private removeStyles(): void {
    const style = document.getElementById(PANEL_STYLE_ID);
    if (style) style.remove();
  }

  private createPanel(): void {
    if (document.getElementById(PANEL_ID)) return;

    this.panel = document.createElement("div");
    this.panel.id = PANEL_ID;
    this.panel.className = "bug-recorder-panel";

    this.panel.innerHTML = `
      <div class="br-header">
        <div class="br-header-left">
          <div class="br-status-indicator recording"></div>
          <span class="br-title">Bug Recorder</span>
          <span class="br-step-count" id="br-step-count">0 pasos</span>
        </div>
        <div style="display:flex;gap:2px;">
          <button class="br-minimize-btn" id="br-minimize" title="Minimizar">_</button>
          <button class="br-close-btn" id="br-close" title="Cerrar panel">&times;</button>
        </div>
      </div>
      <div class="br-body" id="br-steps-container">
        <div class="br-empty">Grabando... interactuá con la página</div>
      </div>
      <div class="br-footer">
        <button class="br-btn br-btn-stop" id="br-stop-btn">Detener</button>
        <button class="br-btn br-btn-copy" id="br-new-btn">Nueva grabación</button>
        <button class="br-btn br-btn-copy" id="br-save-btn" disabled>Guardar</button>
        <button class="br-btn br-btn-copy" id="br-copy-report" disabled>Reporte</button>
        <button class="br-btn br-btn-copy" id="br-copy-text" disabled>Texto</button>
        <button class="br-btn br-btn-copy" id="br-copy-json" disabled>JSON</button>
      </div>
    `;

    document.body.appendChild(this.panel);

    this.stepsContainer = document.getElementById(
      "br-steps-container"
    ) as HTMLDivElement;
    this.stopButton = document.getElementById(
      "br-stop-btn"
    ) as HTMLButtonElement;
    this.copyTextButton = document.getElementById(
      "br-copy-text"
    ) as HTMLButtonElement;
    this.copyJsonButton = document.getElementById(
      "br-copy-json"
    ) as HTMLButtonElement;
    this.copyReportButton = document.getElementById(
      "br-copy-report"
    ) as HTMLButtonElement;
    this.newRecordingButton = document.getElementById(
      "br-new-btn"
    ) as HTMLButtonElement;
    this.saveButton = document.getElementById("br-save-btn") as HTMLButtonElement;
    this.statusIndicator = this.panel.querySelector(
      ".br-status-indicator"
    ) as HTMLDivElement;

    this.stopButton.addEventListener("click", () => this.onStop?.());

    this.saveButton.addEventListener("click", () => this.onSave?.());

    this.newRecordingButton.addEventListener("click", () => {
      if (this.confirmDiscard()) this.onNewRecording?.();
    });

    this.copyReportButton.addEventListener("click", () => {
      this.onCopyReport?.(this.formatAsReport());
      this.showToast("Reporte copiado al portapapeles");
    });

    this.copyTextButton.addEventListener("click", () => {
      const text = this.formatAsText();
      this.onCopyText?.(text);
      this.showToast("Texto copiado al portapapeles");
    });

    this.copyJsonButton.addEventListener("click", () => {
      const json = this.formatAsJson();
      this.onCopyJson?.(json);
      this.showToast("JSON copiado al portapapeles");
    });

    const minimizeBtn = document.getElementById("br-minimize");
    minimizeBtn?.addEventListener("click", () => {
      const body = document.getElementById("br-steps-container");
      const footer = this.panel?.querySelector(".br-footer") as HTMLElement;
      if (body && footer) {
        const isMinimized = body.style.display === "none";
        body.style.display = isMinimized ? "block" : "none";
        footer.style.display = isMinimized ? "flex" : "none";
        minimizeBtn.textContent = isMinimized ? "_" : "+";
      }
    });

    const closeBtn = document.getElementById("br-close");
    closeBtn?.addEventListener("click", () => {
      if (this.confirmDiscard()) this.onClose?.();
    });
  }

  private removePanel(): void {
    if (this.panel) {
      this.panel.remove();
      this.panel = null;
    }
  }

  private renderSteps(): void {
    if (!this.stepsContainer) return;

    if (this.steps.length === 0) {
      this.stepsContainer.innerHTML =
        '<div class="br-empty">Grabando... interactuá con la página</div>';
      return;
    }

    this.stepsContainer.innerHTML = this.steps
      .map(
        (step) => `
      <div class="br-step">
        <span class="br-step-number">${step.order}</span>
        <div>
          <div class="br-step-label">${this.escapeHtml(step.label)}</div>
          <div class="br-step-action">${step.action} - ${step.selector}</div>
        </div>
      </div>
    `
      )
      .join("");

    this.stepsContainer.scrollTop = this.stepsContainer.scrollHeight;
  }

  private formatAsText(): string {
    return this.steps.map((step) => `${step.order} - ${step.label}`).join("\n");
  }

  private formatAsReport(): string {
    return formatNaturalReport({
      steps: this.steps,
      url: this.startUrl,
      title: document.title,
      timestamp: this.timestamp,
    });
  }

  private confirmDiscard(): boolean {
    return this.steps.length === 0 || window.confirm(CONFIRM_DISCARD_MESSAGE);
  }

  private formatAsJson(): string {
    return JSON.stringify(
      {
        steps: this.steps,
        url: this.startUrl,
        timestamp: this.timestamp,
        title: document.title,
      },
      null,
      2
    );
  }

  private escapeHtml(text: string): string {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }

  private showToast(message: string): void {
    const toast = document.createElement("div");
    toast.className = "br-copied-toast";
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 2000);
  }
}
