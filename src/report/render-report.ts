import { RecordingData } from "../types";
import { formatNaturalReport } from "./natural-report";

export type ReportFormat = "natural" | "text" | "json";

/** Único punto de formateo de reportes: lo usan el popup, el panel, el panel lateral y el puente MCP. */
export function renderReport(data: RecordingData, format: ReportFormat): string {
  switch (format) {
    case "text":
      return data.steps.map((step) => `${step.order} - ${step.label}`).join("\n");
    case "json":
      return JSON.stringify(data, null, 2);
    default:
      return formatNaturalReport(data);
  }
}
