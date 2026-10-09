# Centipede — Roadmap

Extensión de Chrome (Manifest V3) para capturar interacciones del usuario (*Session Recording* / *Interaction Capture*) y convertirlas en evidencia reproducible: reportes de bugs (*Bug Report*) y casos de prueba (*Test Case*).

## Estado actual

- **Captura de pasos (*Event Capture*)**: listeners sobre `click`, `input`, `change`, `keydown`, `focus`, `scroll`, `mouseover`, `dblclick` y `contextmenu`, con enmascaramiento de campos `password`.
- **Escrituras consecutivas (*Write Coalescing*)**: varias escrituras seguidas sobre el mismo campo se reducen a un único paso con el valor final.
- **Captura de navegación (*Navigation Events*)**: pasos `navigate` para cargas de página y navegaciones sin recarga (Navigation API).
- **Identificación de elementos**: selector CSS (*CSS Selector*) y texto visible por elemento.
- **Exportación**: reporte en lenguaje natural, texto numerado y JSON, desde el popup, el panel flotante y el panel lateral. Todos usan el mismo módulo de formateo (`renderReport`).
- **Estado compartido (*Shared State*)**: la sesión activa vive en `chrome.storage.local`; el popup, el panel flotante y el panel lateral leen el mismo estado y se actualizan en vivo (`storage.onChanged`).
- **Continuidad entre páginas**: la grabación sobrevive a la navegación dentro de la pestaña dueña (el panel se restaura desde el storage).
- **Biblioteca de sesiones guardadas**: "Guardar" archiva la grabación activa en `chrome.storage.local` (clave `library`) y libera la sesión activa.
- **Panel lateral (*Side Panel*)**: lista de sesiones guardadas con filtro por rango de fechas, detalle con los pasos, reportes en natural/texto/JSON, eliminación, e inicio de nuevas grabaciones. Muestra también la grabación activa.
- **Nueva grabación con advertencia**: descartar una sesión con pasos sin guardar (o cerrar el panel) requiere confirmación.
- **Puente con Claude (*MCP POC*)**: servidor MCP en `mcp/` (stdio para Claude Code) que se comunica con la extensión por WebSocket en `127.0.0.1`, con token de emparejamiento. Herramientas: `centipede_status`, `centipede_get_session`, `centipede_get_report`. Validado con un cliente simulado; **pendiente de prueba en Chrome real**.
- **Build**: el popup, el panel lateral y el background se empaquetan como módulos ES; `content.js` se empaqueta aparte como IIFE (`vite.content.config.ts`), porque las content scripts no admiten `import`.

## Fase 2 — Formatos de salida múltiples (cerrada por ahora)

Cubierto: reporte en lenguaje natural, texto numerado y JSON, incluidos el reporte en texto y Markdown.

Pendiente, para más adelante:

- **Registro extensible de formatos (*Format Registry*)**: hoy `renderReport` resuelve los formatos con un `switch`. Sirve mientras sean pocos; si se agregan más, conviene una interfaz `Renderer` con registro.
- **Formatos previstos**:
  - HTML (para compartir o imprimir).
  - Caso de prueba (*Test Case*): precondiciones, pasos (*Steps*), resultado esperado y resultado obtenido.
  - Escenario en Gherkin (*BDD*: `Given / When / Then`).
  - Plantilla de bug report para trackers (Jira, Azure DevOps, GitHub Issues).
  - PDF.
- **Descarga de archivos**: además de copiar al portapapeles, exportar como archivo (`chrome.downloads`).

## Fase 3 — Calidad y enriquecimiento del registro

Hecho:

- ✅ **Escrituras consecutivas**: "mono" produce un único paso con el valor final. Cualquier otra acción (foco, tecla, clic) corta la secuencia.
- ✅ **Mouseover repetido**: pasar varias veces el mouse sobre el mismo elemento, sin otra acción en medio, genera un solo paso.
- ✅ **Grabación desde el panel lateral sin ventana flotante**: la grabación iniciada desde el panel lateral no inyecta el panel en la página. La preferencia se guarda en la sesión y se respeta al navegar.
- ✅ **Captura de navegación**: un paso `navigate` por cada cambio de página, incluidas las navegaciones sin recarga.
- ✅ **Guardado de grabaciones (*Save / Recording Library*)**: archivado en `library`, con fecha de guardado y un identificador.
- ✅ **Panel lateral de sesiones**: búsqueda por rango de fechas, visualización de pasos y generación de reportes.
- ✅ **Almacenamiento sin límite fijo**: se habilitó `unlimitedStorage`, así que el límite de 10 MB ya no aplica.

Pendiente:

- **Reducción de ruido en scroll**: hoy se limita a un paso cada 500 ms; falta colapsar los scrolls consecutivos de una misma sesión de desplazamiento.
- **Selectores resilientes (*Resilient Locators / Locator Strategy*)**: priorizar atributos estables (`data-testid`, `role` + nombre accesible, `label`) sobre rutas `nth-child`, que se rompen con cambios de DOM.
- **Evidencia visual (*Screenshot Capture*)**: captura por paso o ante cada acción crítica (`chrome.tabs.captureVisibleTab`).
- **Datos sensibles (*PII Redaction / Data Masking*)**: política configurable de enmascaramiento más allá de `type="password"` (emails, tarjetas, tokens). Relevante también antes de exponer el reporte a Claude.
- **Biblioteca, mejoras**: nombre editable de cada grabación, búsqueda por texto además de fecha, y eliminación masiva.

## Fase 4 — Campos de reporte y metadatos

- **Plantilla de bug report (*Bug Report Template*)**: título, severidad (*Severity*), prioridad (*Priority*), entorno (*Environment*: navegador, sistema operativo, versión de la aplicación), precondiciones, pasos para reproducir (*Steps to Reproduce*), resultado esperado y resultado obtenido (*Expected / Actual Result*), adjuntos.
- **Aserciones (*Assertions / Test Oracle*)**: permitir marcar el resultado esperado durante la grabación.
- **Parametrización de datos (*Data-driven Testing*)**: reemplazar valores concretos por variables para reutilizar el caso con otros datos.

## Fase 5 — Integración con agentes (MCP)

Objetivo: que Claude (u otro cliente MCP) consulte y maneje las grabaciones desde la conversación.

- **Validación en Chrome real (*Smoke Test*)**: confirmar que el service worker abre el WebSocket a `127.0.0.1` sin permisos de host adicionales, y que se mantiene vivo con el ping periódico.
- **Identidad fija de la extensión (*Stable Extension ID*)**: agregar el campo `key` al manifest para que el ID sea el mismo en todas las máquinas, y limitar el puente a ese origen (hoy acepta cualquier `chrome-extension://` con token).
- **Distribución del puente (*Packaging / Distribution*)**: publicar `centipede-mcp` como paquete instalable (npm interno o público) o empaquetarlo como ejecutable único para no requerir Node en cada equipo. Hoy el servidor corre desde el repo con `node mcp/server.mjs`.
- **Instalación de la extensión (*Extension Distribution*)**: Chrome Web Store como no listada, o política de empresa (`ExtensionInstallForcelist`). Confirmar primero qué políticas aplican en las máquinas de la empresa.
- **Gestión del token (*Pairing Token Rotation*)**: rotación, revocación y eliminación del token desde el popup; evaluar un flujo de emparejamiento de un solo uso en lugar de copiar y pegar.
- ✅ **Biblioteca desde Claude**: `centipede_list_sessions` (con filtro por fechas), y `session_id` en `centipede_get_session` y `centipede_get_report` para analizar grabaciones guardadas.
- **Más herramientas MCP**: iniciar y detener una grabación desde Claude, y devolver evidencia (capturas) cuando la Fase 3 la incluya.
- **Alternativa descartada por ahora**: *Native Messaging* (Chrome lanza un host local por stdio). Evita abrir un puerto, pero exige registrar un manifest por sistema operativo y, por lo tanto, un instalador por máquina.

## Fase 6 — Reproducción automatizada

Objetivo: reproducir un bug en el entorno del desarrollador a partir del registro, sin intervención manual.

- **Conversión a script (*Test Script Generation*)**: traducir los pasos a acciones de Playwright (`page.getByRole`, `page.fill`, `page.click`, etc.).
- **Servidor MCP de Playwright (*Model Context Protocol – Playwright MCP*)**: exponer la reproducción como herramientas que un agente de IA (o un cliente MCP) pueda invocar: cargar la sesión, ejecutar pasos, consultar el estado de la página. Se puede agregar al mismo puente de la Fase 5 o como servidor separado.
- **Perfiles de entorno (*Environment Profiles*)**: mapear la URL grabada (por ejemplo, producción o staging) a la URL local o de desarrollo del desarrollador.
- **Resultado de reproducción (*Replay Result*)**: estado por ejecución: `Reproduced`, `Not Reproduced`, `Flaky` o `Error`, con captura del momento en que falla.
- **Reproducción sobre `Test Runner`**: integrar con Playwright Test para ejecución repetida y reporte (*Test Report*).
- **Detección de regresiones (*Regression Testing*)**: volver a ejecutar un bug reportado como caso de regresión tras cada cambio.

## Fase 7 — Integraciones y plataforma

- **Integración con trackers (*Issue Tracker Integration*)**: crear o actualizar issues vía API (Jira, Azure DevOps, GitHub).
- **Soporte multi-navegador (*Cross-browser Support*)**: Firefox y Edge (Chromium), con adaptaciones de la API de extensiones.
- **Gestión de casos (*Test Management Integration*)**: sincronizar casos de prueba con herramientas como TestRail o Xray.

## Fuera de alcance por ahora

- Grabación de audio o video de la sesión (*Session Replay* completo).
- Grabación en aplicaciones nativas o de escritorio.
