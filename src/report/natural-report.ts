import { RecordingData, Step } from "../types";

function toSentence(step: Step): string {
  const text = step.label.trim();
  return /[.!?]$/.test(text) ? text : `${text}.`;
}

export function formatNaturalReport(data: RecordingData): string {
  const header = [
    "Pasos para reproducir",
    "",
    `Página: ${data.title || "(sin título)"}`,
    `URL: ${data.url}`,
    `Fecha: ${new Date(data.timestamp).toLocaleString("es-AR")}`,
    `Cantidad de pasos: ${data.steps.length}`,
  ];

  if (data.steps.length === 0) {
    return [...header, "", "No se registraron pasos."].join("\n");
  }

  const steps = data.steps.map((step, index) => `${index + 1}. ${toSentence(step)}`);

  return [...header, "", "Pasos:", ...steps].join("\n");
}
