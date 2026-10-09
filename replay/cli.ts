import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import type { RecordingData } from "../src/types/index.ts";
import { replay } from "./run.ts";

const USAGE = `Uso: npm run replay -- <grabacion.json> [opciones]

Opciones:
  --url <url>        URL inicial (por defecto, la de la grabación)
  --headed           Muestra el navegador mientras reproduce
  --timeout <ms>     Tiempo máximo por acción (por defecto 5000)
  --delay <ms>       Pausa entre cada paso (por defecto 0)
  --pause <ms>       Pausa al final, antes de cerrar el navegador (por defecto 0)
  --out <carpeta>    Dónde guardar capturas (por defecto replay/output)
`;

interface CliArgs {
  file?: string;
  url?: string;
  headed: boolean;
  timeoutMs: number;
  delayMs: number;
  pauseMs: number;
  outDir: string;
}

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = {
    headed: false,
    timeoutMs: 5000,
    delayMs: 0,
    pauseMs: 0,
    outDir: join(import.meta.dirname, "output"),
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--headed") args.headed = true;
    else if (arg === "--url") args.url = argv[++i];
    else if (arg === "--timeout") args.timeoutMs = Number(argv[++i]);
    else if (arg === "--delay") args.delayMs = Number(argv[++i]);
    else if (arg === "--pause") args.pauseMs = Number(argv[++i]);
    else if (arg === "--out") args.outDir = resolve(argv[++i]);
    else if (arg === "--help" || arg === "-h") {
      console.log(USAGE);
      process.exit(0);
    } else if (!arg.startsWith("--")) args.file = arg;
    else throw new Error(`Opción desconocida: ${arg}`);
  }

  return args;
}

async function loadRecording(path: string): Promise<RecordingData> {
  const raw = JSON.parse(await readFile(path, "utf8")) as Partial<RecordingData>;
  // Algunos exports envuelven la sesión: `steps` contiene un único objeto con `steps`, `url` y `title`.
  const wrapped = raw.steps?.[0] as Partial<RecordingData> | undefined;
  if (raw.steps?.length === 1 && wrapped && Array.isArray(wrapped.steps)) {
    return wrapped as RecordingData;
  }
  if (!Array.isArray(raw.steps)) {
    throw new Error("El archivo no tiene una lista de pasos (`steps`). Exportalo como JSON desde Centipede.");
  }
  if (!raw.url && !raw.steps.length) {
    throw new Error("La grabación no tiene URL ni pasos.");
  }
  return raw as RecordingData;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  if (!args.file) {
    console.error(USAGE);
    process.exit(2);
  }

  const data = await loadRecording(resolve(args.file));
  const startUrl = args.url ?? data.url;
  if (!startUrl) {
    throw new Error("No hay URL inicial: pasá --url.");
  }

  console.log(`Reproduciendo ${data.steps.length} pasos desde ${startUrl}`);
  const result = await replay(data, {
    startUrl,
    headed: args.headed,
    timeoutMs: args.timeoutMs,
    delayMs: args.delayMs,
    pauseMs: args.pauseMs,
    outDir: args.outDir,
  });

  for (const step of result.steps) {
    const mark = step.status === "ok" ? "OK     " : step.status === "skipped" ? "OMITIDO" : "FALLA  ";
    const detail = step.message ? `  (${step.message})` : "";
    console.log(`${mark} ${step.order}. ${step.label}${detail}`);
  }

  if (result.screenshot) {
    console.log(`\nCaptura del paso que falla: ${result.screenshot}`);
  }
  console.log(result.passed ? "\nResultado: reproducido" : "\nResultado: falló la reproducción");
  process.exit(result.passed ? 0 : 1);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(2);
});
