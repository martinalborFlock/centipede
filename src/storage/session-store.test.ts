import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SavedSession, Step } from "../types";
import { updateSavedSession } from "./session-store";

// Simulación mínima de chrome.storage.local: suficiente para leer y escribir la biblioteca.
function stubChromeStorage(initial: Record<string, unknown>) {
  const data: Record<string, unknown> = { ...initial };
  const local = {
    get: vi.fn(async (key: string) => ({ [key]: data[key] })),
    set: vi.fn(async (values: Record<string, unknown>) => {
      Object.assign(data, values);
    }),
  };
  vi.stubGlobal("chrome", { storage: { local } });
  return { data, local };
}

function entry(id: string, steps: Step[]): SavedSession {
  return {
    id,
    savedAt: "2026-10-09T12:00:00.000Z",
    steps,
    url: "https://example.com",
    title: id,
    timestamp: "2026-10-09T11:00:00.000Z",
  };
}

const step = (label: string): Step => ({
  order: 1,
  action: "click",
  label,
  selector: "#x",
  tagName: "button",
  innerText: label,
});

describe("updateSavedSession", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("reemplaza los pasos de la grabación indicada y guarda la biblioteca", async () => {
    const { data } = stubChromeStorage({
      library: [entry("a", [step("viejo")]), entry("b", [step("otro")])],
    });

    const updated = await updateSavedSession("a", [step("nuevo")]);

    expect(updated?.steps[0].label).toBe("nuevo");
    const library = data.library as SavedSession[];
    expect(library[0].steps[0].label).toBe("nuevo");
    expect(library[1].steps[0].label).toBe("otro");
  });

  it("conserva los demás campos de la grabación", async () => {
    stubChromeStorage({ library: [entry("a", [step("viejo")])] });

    const updated = await updateSavedSession("a", [step("nuevo")]);

    expect(updated).toMatchObject({ id: "a", url: "https://example.com", title: "a" });
  });

  it("devuelve null y no escribe si la grabación ya no existe", async () => {
    const { local } = stubChromeStorage({ library: [entry("a", [step("x")])] });

    const result = await updateSavedSession("no-existe", [step("nuevo")]);

    expect(result).toBeNull();
    expect(local.set).not.toHaveBeenCalled();
  });

  it("funciona con una biblioteca vacía", async () => {
    stubChromeStorage({});
    expect(await updateSavedSession("a", [step("x")])).toBeNull();
  });
});
