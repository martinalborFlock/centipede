import type { Step } from "../src/types/index.ts";

/** Acción de Playwright que corresponde a un paso grabado. */
export type ReplayAction =
  | { kind: "goto"; url: string }
  | { kind: "click"; selector: string; button: "left" | "right"; clickCount: number }
  | { kind: "fill"; selector: string; value: string }
  | { kind: "select"; selector: string; value: string }
  | { kind: "check"; selector: string; checked: boolean }
  | { kind: "press"; key: string }
  | { kind: "scroll"; x: number; y: number }
  | { kind: "skip"; reason: string };

/** Traduce un paso grabado a una acción reproducible. Sin efectos: solo decide qué hacer. */
export function planStep(step: Step): ReplayAction {
  const selector = step.selector;

  switch (step.action) {
    case "navigate":
      return step.value
        ? { kind: "goto", url: step.value }
        : { kind: "skip", reason: "navegación sin URL" };

    case "click":
      return selector
        ? { kind: "click", selector, button: "left", clickCount: 1 }
        : { kind: "skip", reason: "clic sin selector" };

    case "dblclick":
      return selector
        ? { kind: "click", selector, button: "left", clickCount: 2 }
        : { kind: "skip", reason: "doble clic sin selector" };

    case "contextmenu":
      return selector
        ? { kind: "click", selector, button: "right", clickCount: 1 }
        : { kind: "skip", reason: "clic derecho sin selector" };

    case "input":
      if (step.value === "***") {
        return { kind: "skip", reason: "contraseña enmascarada: no se puede reproducir" };
      }
      return selector && step.value !== undefined
        ? { kind: "fill", selector, value: step.value }
        : { kind: "skip", reason: "escritura sin selector o valor" };

    case "change":
      if (!selector) return { kind: "skip", reason: "cambio sin selector" };
      if (step.tagName.toUpperCase() === "SELECT" && step.value !== undefined) {
        return { kind: "select", selector, value: step.value };
      }
      // El paso de checkbox/radio no guarda el estado: sale de la etiqueta ("Marcar" / "Desmarcar").
      if (step.label.startsWith("Marcar ")) {
        return { kind: "check", selector, checked: true };
      }
      if (step.label.startsWith("Desmarcar ")) {
        return { kind: "check", selector, checked: false };
      }
      if (step.value !== undefined) {
        return { kind: "fill", selector, value: step.value };
      }
      return { kind: "skip", reason: "cambio sin valor reproducible" };

    case "keydown":
      return step.key && step.key !== "?"
        ? { kind: "press", key: step.key }
        : { kind: "skip", reason: "tecla sin identificar" };

    case "scroll":
      return { kind: "scroll", x: step.scrollX ?? 0, y: step.scrollY ?? 0 };

    case "focus":
      return { kind: "skip", reason: "foco: lo cubre la acción siguiente" };

    case "mouseover":
      return { kind: "skip", reason: "pasar el mouse: no se reproduce" };

    case "select":
      return { kind: "skip", reason: "selección de texto: no se reproduce" };

    default:
      return { kind: "skip", reason: `acción no soportada: ${step.action}` };
  }
}
