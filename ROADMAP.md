# Centipede — Roadmap

Extensión de Chrome (Manifest V3) para capturar interacciones del usuario (*Session Recording* / *Interaction Capture*) y convertirlas en evidencia reproducible: reportes de bugs (*Bug Report*) y casos de prueba (*Test Case*).

## Estado actual

- **Captura de pasos (*Event Capture*)**: listeners sobre `click`, `input`, `change`, `keydown`, `focus`, `scroll`, `mouseover`, `dblclick` y `contextmenu`, con enmascaramiento de campos `password`.
- **Identificación de elementos**: selector CSS (*CSS Selector*) y texto visible por elemento.
- **Exportación**: texto numerado y JSON (`RecordingData`), copiados al portapapeles.
- **Reporte en lenguaje natural**: texto legible con encabezado (página, URL, fecha, cantidad de pasos) y pasos numerados en oraciones completas. Disponible en el panel flotante y en el popup.
- **Estado compartido (*Shared State*)**: la sesión vive en `chrome.storage.local`; el popup y el panel flotante leen el mismo estado y se actualizan en vivo (`storage.onChanged`).
- **Continuidad entre páginas**: la grabación sobrevive a la navegación dentro de la pestaña dueña (el panel se restaura desde el storage).
- **Nueva grabación con advertencia**: descartar una sesión con pasos no guardados requiere confirmación.

## Fase 2 — Formatos de salida múltiples

Objetivo: que un mismo registro de sesión (*Session Record*) pueda renderizarse en distintos formatos según el contexto.

- **Arquitectura de renderers (*Exporter / Renderer Pattern*)**: una interfaz común `Renderer` con `format(session) → string | Blob` y un registro de formatos (*Format Registry*). El popup lista los formatos disponibles sin conocer sus detalles.
- **Formatos previstos**:
  - Texto plano y Markdown.
  - HTML (para compartir o imprimir).
  - Caso de prueba (*Test Case*): precondiciones, pasos (*Steps*), resultado esperado y resultado obtenido.
  - Escenario en Gherkin (*BDD*: `Given / When / Then`).
  - Plantilla de bug report para trackers (Jira, Azure DevOps, GitHub Issues).
  - PDF.
- **Descarga de archivos**: además de copiar al portapapeles, exportar como archivo (`chrome.downloads`).

## Fase 3 — Calidad y enriquecimiento del registro

- **Reducción de ruido (*Noise Filtering / Event Deduplication*)**: colapsar `mouseover` y `scroll` repetidos, unificar `input` consecutivos sobre el mismo campo en un único paso.
- **Captura de navegación (*Navigation Events*)**: registrar cambios de URL y cargas de página, que hoy no se capturan.
- **Selectores resilientes (*Resilient Locators / Locator Strategy*)**: priorizar atributos estables (`data-testid`, `role` + nombre accesible, `label`) sobre rutas `nth-child`, que se rompen con cambios de DOM.
- **Evidencia visual (*Screenshot Capture*)**: captura por paso o ante cada acción crítica (`chrome.tabs.captureVisibleTab`).
- **Datos sensibles (*PII Redaction / Data Masking*)**: política configurable de enmascaramiento más allá de `type="password"` (emails, tarjetas, tokens).
- **Guardado de grabaciones (*Save / Recording Library*)**: guardar la sesión con nombre y fecha, listarla, reabrirla y eliminarla. Hoy la sesión existe hasta que se crea otra o se cierra, por eso la advertencia de descarte. Si el volumen supera el límite de `chrome.storage.local` (10 MB por defecto), evaluar `unlimitedStorage` o `IndexedDB`.

## Fase 4 — Campos de reporte y metadatos

- **Plantilla de bug report (*Bug Report Template*)**: título, severidad (*Severity*), prioridad (*Priority*), entorno (*Environment*: navegador, sistema operativo, versión de la aplicación), precondiciones, pasos para reproducir (*Steps to Reproduce*), resultado esperado y resultado obtenido (*Expected / Actual Result*), adjuntos.
- **Aserciones (*Assertions / Test Oracle*)**: permitir marcar el resultado esperado durante la grabación.
- **Parametrización de datos (*Data-driven Testing*)**: reemplazar valores concretos por variables para reutilizar el caso con otros datos.

## Fase 5 — Reproducción automatizada

Objetivo: reproducir un bug en el entorno del desarrollador a partir del registro, sin intervención manual.

- **Conversión a script (*Test Script Generation*)**: traducir los pasos a acciones de Playwright (`page.getByRole`, `page.fill`, `page.click`, etc.).
- **Servidor MCP de Playwright (*Model Context Protocol – Playwright MCP*)**: exponer la reproducción como herramientas que un agente de IA (o un cliente MCP) pueda invocar: cargar la sesión, ejecutar pasos, consultar el estado de la página.
- **Perfiles de entorno (*Environment Profiles*)**: mapear la URL grabada (por ejemplo, producción o staging) a la URL local o de desarrollo del desarrollador.
- **Resultado de reproducción (*Replay Result*)**: estado por ejecución: `Reproduced`, `Not Reproduced`, `Flaky` o `Error`, con captura del momento en que falla.
- **Reproducción sobre `Test Runner`**: integrar con Playwright Test para ejecución repetida y reporte (*Test Report*).
- **Detección de regresiones (*Regression Testing*)**: volver a ejecutar un bug reportado como caso de regresión tras cada cambio.

## Fase 6 — Integraciones y plataforma

- **Integración con trackers (*Issue Tracker Integration*)**: crear o actualizar issues vía API (Jira, Azure DevOps, GitHub).
- **Soporte multi-navegador (*Cross-browser Support*)**: Firefox y Edge (Chromium), con adaptaciones de la API de extensiones.
- **Gestión de casos (*Test Management Integration*)**: sincronizar casos de prueba con herramientas como TestRail o Xray.

## Fuera de alcance por ahora

- Grabación de audio o video de la sesión (*Session Replay* completo).
- Grabación en aplicaciones nativas o de escritorio.
