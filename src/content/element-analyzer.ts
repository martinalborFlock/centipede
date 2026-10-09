import { ActionType } from "../types";

export function getCssSelector(element: Element): string {
  if (element.id) {
    return `#${element.id}`;
  }

  const path: string[] = [];
  let current: Element | null = element;

  while (current && current !== document.body) {
    let selector = current.tagName.toLowerCase();

    if (current.id) {
      path.unshift(`#${current.id}`);
      break;
    }

    if (current.className && typeof current.className === "string") {
      const classes = current.className.trim().split(/\s+/).filter(Boolean);
      if (classes.length > 0) {
        selector += "." + classes.slice(0, 2).join(".");
      }
    }

    const parent = current.parentElement;
    if (parent) {
      const siblings = Array.from(parent.children).filter(
        (child) => child.tagName === current!.tagName
      );
      if (siblings.length > 1) {
        const index = siblings.indexOf(current) + 1;
        selector += `:nth-child(${index})`;
      }
    }

    path.unshift(selector);
    current = current.parentElement;
  }

  return path.join(" > ");
}

export function getVisibleText(element: Element): string {
  const el = element as HTMLElement;

  if (el.value !== undefined && el.value !== "") {
    return el.value;
  }

  if (el.innerText) {
    const text = el.innerText.trim();
    if (text.length > 0) {
      return text.length > 50 ? text.substring(0, 50) + "..." : text;
    }
  }

  if (el.textContent) {
    const text = el.textContent.trim();
    if (text.length > 0) {
      return text.length > 50 ? text.substring(0, 50) + "..." : text;
    }
  }

  const ariaLabel = el.getAttribute("aria-label");
  if (ariaLabel) return ariaLabel;

  const title = el.getAttribute("title");
  if (title) return title;

  const placeholder = el.getAttribute("placeholder");
  if (placeholder) return placeholder;

  const name = el.getAttribute("name");
  if (name) return name;

  const type = el.getAttribute("type");
  if (type) return `[${type}]`;

  return el.tagName.toLowerCase();
}

export function getActionLabel(
  action: ActionType,
  element: Element,
  value?: string,
  key?: string
): string {
  const tag = element.tagName.toLowerCase();
  const text = getVisibleText(element);
  const isButton =
    tag === "button" ||
    tag === "input" &&
      ["submit", "button", "reset"].includes(
        (element as HTMLInputElement).type
      );
  const isInput =
    tag === "input" ||
    tag === "textarea" ||
    element.getAttribute("contenteditable") === "true";
  const isSelect = tag === "select";

  switch (action) {
    case "click":
      if (isButton) return `Presionar botón "${text}"`;
      if (tag === "a") return `Hacer clic en enlace "${text}"`;
      if (isInput) return `Hacer clic en campo "${text}"`;
      return `Hacer clic en "${text}"`;

    case "dblclick":
      return `Hacer doble clic en "${text}"`;

    case "contextmenu":
      return `Hacer clic derecho en "${text}"`;

    case "input": {
      const displayValue =
        value && value.length > 30
          ? value.substring(0, 30) + "..."
          : value || "";
      return `Ingresar "${displayValue}" en campo "${text}"`;
    }

    case "change":
      if (isSelect) {
        const selectEl = element as HTMLSelectElement;
        const selectedOption =
          selectEl.options[selectEl.selectedIndex]?.text || "";
        return `Seleccionar "${selectedOption}" en lista "${text}"`;
      }
      if (
        (element as HTMLInputElement).type === "checkbox" ||
        (element as HTMLInputElement).type === "radio"
      ) {
        const checked = (element as HTMLInputElement).checked;
        return `${checked ? "Marcar" : "Desmarcar"} "${text}"`;
      }
      return `Cambiar valor en "${text}"`;

    case "keydown":
      return `Presionar tecla "${key || "?"}"`;

    case "focus":
      return `Seleccionar campo "${text}"`;

    case "mouseover":
      return `Pasar mouse sobre "${text}"`;

    case "scroll": {
      const scrollY = (element as HTMLElement).scrollTop || window.scrollY;
      return `Hacer scroll ${scrollY > 0 ? "hacia abajo" : "hacia arriba"}`;
    }

    case "select":
      return `Seleccionar texto en "${text}"`;

    default:
      return `Interactuar con "${text}"`;
  }
}
