import { describe, expect, it } from "vitest";
import type { Step } from "../types";
import { hasChanges, moveStep, navigationChanges, removeStep, renumber, updateStep } from "./step-edit";

function step(order: number, label: string, extra: Partial<Step> = {}): Step {
  return { order, action: "click", label, selector: `#${label}`, tagName: "button", innerText: label, ...extra };
}

const steps: Step[] = [step(1, "a"), step(2, "b"), step(3, "c")];

describe("renumber", () => {
  it("asigna order 1..n según la posición", () => {
    const shuffled = [step(9, "x"), step(4, "y")];
    expect(renumber(shuffled).map((s) => s.order)).toEqual([1, 2]);
  });

  it("no modifica la lista original", () => {
    const original = [step(5, "x")];
    renumber(original);
    expect(original[0].order).toBe(5);
  });
});

describe("moveStep", () => {
  it("sube un paso e intercambia con el anterior", () => {
    const result = moveStep(steps, 1, -1);
    expect(result.map((s) => s.label)).toEqual(["b", "a", "c"]);
    expect(result.map((s) => s.order)).toEqual([1, 2, 3]);
  });

  it("baja un paso e intercambia con el siguiente", () => {
    const result = moveStep(steps, 0, 1);
    expect(result.map((s) => s.label)).toEqual(["b", "a", "c"]);
  });

  it("no hace nada al subir el primero ni bajar el último", () => {
    expect(moveStep(steps, 0, -1).map((s) => s.label)).toEqual(["a", "b", "c"]);
    expect(moveStep(steps, 2, 1).map((s) => s.label)).toEqual(["a", "b", "c"]);
  });

  it("no hace nada con un índice inválido", () => {
    expect(moveStep(steps, 10, 1).map((s) => s.label)).toEqual(["a", "b", "c"]);
  });
});

describe("removeStep", () => {
  it("elimina el paso y renumera", () => {
    const result = removeStep(steps, 1);
    expect(result.map((s) => s.label)).toEqual(["a", "c"]);
    expect(result.map((s) => s.order)).toEqual([1, 2]);
  });

  it("con índice inválido devuelve los mismos pasos", () => {
    expect(removeStep(steps, -1)).toEqual(steps);
  });
});

describe("updateStep", () => {
  it("cambia la descripción sin tocar el resto", () => {
    const result = updateStep(steps, 0, { label: "nuevo" });
    expect(result[0]).toEqual({ ...steps[0], label: "nuevo" });
    expect(result[1]).toBe(steps[1]);
  });

  it("cambia el valor de un paso", () => {
    const withValue = [step(1, "campo", { action: "input", value: "viejo" })];
    expect(updateStep(withValue, 0, { value: "nuevo" })[0].value).toBe("nuevo");
  });

  it("no modifica la lista original", () => {
    updateStep(steps, 0, { label: "nuevo" });
    expect(steps[0].label).toBe("a");
  });
});

describe("navigationChanges", () => {
  it("usa la URL como valor y deriva la descripción con el mismo formato del recorder", () => {
    expect(navigationChanges("https://a.test/x")).toEqual({
      value: "https://a.test/x",
      label: 'Navegar a "https://a.test/x"',
    });
  });
});

describe("hasChanges", () => {
  it("es falso si el borrador es igual a lo guardado", () => {
    const copy = steps.map((s) => ({ ...s }));
    expect(hasChanges(steps, copy)).toBe(false);
  });

  it("es verdadero si cambia una descripción", () => {
    expect(hasChanges(steps, updateStep(steps, 0, { label: "otra" }))).toBe(true);
  });

  it("es verdadero si se elimina o reordena un paso", () => {
    expect(hasChanges(steps, removeStep(steps, 0))).toBe(true);
    expect(hasChanges(steps, moveStep(steps, 0, 1))).toBe(true);
  });

  it("vuelve a falso si se deshace el cambio", () => {
    const edited = updateStep(steps, 0, { label: "otra" });
    expect(hasChanges(steps, updateStep(edited, 0, { label: "a" }))).toBe(false);
  });
});
