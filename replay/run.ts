import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { chromium, type Page } from "playwright";
import type { RecordingData } from "../src/types/index.ts";
import { planStep, type ReplayAction } from "./convert.ts";

export interface ReplayOptions {
  /** URL inicial. Si no se indica, se usa la URL de la grabación. */
  startUrl: string;
  headed: boolean;
  timeoutMs: number;
  /** Pausa entre un paso y el siguiente, en ms. Útil para seguir la reproducción en modo visible. */
  delayMs: number;
  /** Pausa al final, antes de cerrar el navegador, en ms. Para dejar ver el resultado. */
  pauseMs: number;
  /** Carpeta donde se guarda la captura del paso que falla. */
  outDir: string;
}

export interface StepResult {
  order: number;
  label: string;
  status: "ok" | "skipped" | "failed";
  message?: string;
}

export interface ReplayResult {
  passed: boolean;
  steps: StepResult[];
  screenshot?: string;
}

async function execute(page: Page, action: ReplayAction, timeout: number): Promise<void> {
  switch (action.kind) {
    case "goto":
      await page.goto(action.url, { waitUntil: "load", timeout });
      return;
    case "click":
      await page.locator(action.selector).click({
        button: action.button,
        clickCount: action.clickCount,
        timeout,
      });
      return;
    case "fill":
      await page.locator(action.selector).fill(action.value, { timeout });
      return;
    case "select":
      await page.locator(action.selector).selectOption(action.value, { timeout });
      return;
    case "check":
      if (action.checked) {
        await page.locator(action.selector).check({ timeout });
      } else {
        await page.locator(action.selector).uncheck({ timeout });
      }
      return;
    case "press":
      await page.keyboard.press(action.key);
      return;
    case "scroll":
      await page.evaluate(([x, y]) => window.scrollTo(x, y), [action.x, action.y]);
      return;
    case "skip":
      return;
  }
}

/**
 * Un `navigate` a la URL original de la grabación se redirige a la URL inicial de la reproducción
 * (por ejemplo, un staging o un localhost distinto). Perfil de entorno mínimo.
 */
function mapToStartUrl(action: ReplayAction, recordedUrl: string, startUrl: string): ReplayAction {
  if (action.kind === "goto" && action.url === recordedUrl) {
    return { kind: "goto", url: startUrl };
  }
  return action;
}

/**
 * Reproduce la grabación en Chromium. Se detiene en el primer paso que falla
 * y guarda una captura de ese momento.
 */
export async function replay(data: RecordingData, options: ReplayOptions): Promise<ReplayResult> {
  const browser = await chromium.launch({ headless: !options.headed });
  const results: StepResult[] = [];

  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    await page.goto(options.startUrl, { waitUntil: "load", timeout: options.timeoutMs });

    for (const step of data.steps) {
      if (options.delayMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, options.delayMs));
      }

      const action = mapToStartUrl(planStep(step), data.url, options.startUrl);
      const label = step.label;

      if (action.kind === "skip") {
        results.push({ order: step.order, label, status: "skipped", message: action.reason });
        continue;
      }

      try {
        await execute(page, action, options.timeoutMs);
        results.push({ order: step.order, label, status: "ok" });
      } catch (error) {
        const message = error instanceof Error ? error.message.split("\n")[0] : String(error);
        results.push({ order: step.order, label, status: "failed", message });

        await mkdir(options.outDir, { recursive: true });
        const screenshot = join(options.outDir, `failed-step-${step.order}.png`);
        await page.screenshot({ path: screenshot, fullPage: true });

        return { passed: false, steps: results, screenshot };
      }
    }

    return { passed: true, steps: results };
  } finally {
    if (options.pauseMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, options.pauseMs));
    }
    await browser.close();
  }
}
