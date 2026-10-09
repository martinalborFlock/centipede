import type { Step } from "../types";

/** Campos que se pueden editar desde el panel lateral. */
export type StepChanges = Partial<Pick<Step, "label" | "value">>;

/** Reasigna `order` como 1..n según la posición actual. Devuelve copias: no modifica la entrada. */
export function renumber(steps: Step[]): Step[] {
  return steps.map((step, index) => ({ ...step, order: index + 1 }));
}

/** Mueve el paso de `index` una posición arriba (-1) o abajo (+1). Fuera de rango, no cambia nada. */
export function moveStep(steps: Step[], index: number, direction: -1 | 1): Step[] {
  const target = index + direction;
  if (!isValidIndex(steps, index) || !isValidIndex(steps, target)) {
    return [...steps];
  }
  const next = [...steps];
  [next[index], next[target]] = [next[target], next[index]];
  return renumber(next);
}

/** Elimina el paso de `index` y renumera. Fuera de rango, no cambia nada. */
export function removeStep(steps: Step[], index: number): Step[] {
  if (!isValidIndex(steps, index)) return [...steps];
  return renumber(steps.filter((_, i) => i !== index));
}

/** Aplica cambios de texto al paso de `index`. Fuera de rango, no cambia nada. */
export function updateStep(steps: Step[], index: number, changes: StepChanges): Step[] {
  if (!isValidIndex(steps, index)) return [...steps];
  return steps.map((step, i) => (i === index ? { ...step, ...changes } : step));
}

/**
 * Cambios para un paso `navigate` a partir de su URL. La URL es el único campo editable:
 * la descripción se regenera con el mismo formato que el recorder y el valor es lo que usa el replay.
 */
export function navigationChanges(url: string): StepChanges {
  return { value: url, label: `Navegar a "${url}"` };
}

/** `true` si el borrador difiere de la versión guardada. */
export function hasChanges(saved: Step[], draft: Step[]): boolean {
  return JSON.stringify(saved) !== JSON.stringify(draft);
}

function isValidIndex(steps: Step[], index: number): boolean {
  return Number.isInteger(index) && index >= 0 && index < steps.length;
}
