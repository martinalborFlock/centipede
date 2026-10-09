# Centipede

Extensión de Chrome que graba las interacciones del usuario en una página (clics, escritura, navegación, etc.) y genera reportes en lenguaje natural, texto o JSON. Las grabaciones se pueden guardar en una biblioteca y consultarlas desde un panel lateral. Un puente MCP permite que Claude consulte las grabaciones desde la conversación.

El proyecto tiene dos módulos:

| Módulo | Carpeta | Qué hace |
|---|---|---|
| **Extensión** | `src/`, `dist/` (generado) | Graba, muestra el panel, guarda la biblioteca y expone el panel lateral. |
| **Puente MCP** | `mcp/` | Servidor MCP que Claude Code arranca. Se conecta a la extensión por WebSocket local. |

Podés usar solo la extensión. El puente es opcional y sirve para consultar las grabaciones desde Claude.

---

## Requisitos

| Componente | Versión | Notas |
|---|---|---|
| **Sistema operativo** | Windows 10/11, macOS o Linux | El desarrollo y las pruebas se hicieron en Windows 10. Los otros sistemas no están verificados. |
| **Google Chrome** | 114 o superior | El panel lateral usa la API `sidePanel`, disponible desde Chrome 114. Chromium y Edge basados en Chromium deberían funcionar, sin verificar. |
| **Node.js** | 20 LTS o superior | Se usó Node 22. Lo necesitan la compilación y el puente MCP. |
| **npm** | 9 o superior | Viene con Node. |
| **Claude Code** (CLI) | Versión reciente | Solo para el puente MCP. Ver [la documentación de Claude Code](https://docs.claude.com/en/docs/claude-code). |

> **Estado de las pruebas:** la lógica se verificó con compilación y con un cliente MCP simulado. El funcionamiento completo en Chrome real está pendiente de validación.

---

## Estructura del repositorio

```
centipede/
├── src/                 Código de la extensión (TypeScript)
│   ├── background/      Service worker: enruta comandos y conecta con el puente
│   ├── content/         Grabación, panel flotante y captura de navegación
│   ├── popup/           Popup de la extensión
│   ├── sidepanel/       Panel lateral: sesiones guardadas
│   ├── bridge/          Cliente WebSocket hacia el puente MCP
│   ├── report/          Formateo de reportes (natural, texto, JSON)
│   └── storage/         Acceso a chrome.storage (sesión y biblioteca)
├── manifest.json        Manifest de la extensión (fuente)
├── icons/               Íconos
├── mcp/                 Puente MCP
│   ├── server.mjs       Servidor MCP + WebSocket local
│   └── .token           Token de emparejamiento (se genera al primer arranque)
├── .mcp.json            Registro del servidor MCP para Claude Code (a nivel proyecto)
├── dist/                Extensión compilada: esta es la carpeta que se carga en Chrome
├── vite.config.ts       Build de popup, panel lateral y background
└── vite.content.config.ts  Build de la content script (IIFE)
```

---

## Parte 1: Instalar y usar la extensión

### 1.1 Compilar

Desde la raíz del repositorio:

```bash
npm install
npm run build
```

El build genera la carpeta `dist/`. Ese es el paquete que se carga en Chrome.

> `npm run build` compila dos configuraciones: una para popup, panel lateral y background, y otra para la content script. Hay que ejecutarlo completo después de cada cambio; `npm run watch` solo recompila la primera parte.

### 1.2 Cargar la extensión en Chrome

1. Abrí `chrome://extensions`.
2. Activá **Modo de desarrollador** (arriba a la derecha).
3. Hacé clic en **Cargar descomprimida** (*Load unpacked*).
4. Seleccioná la carpeta **`dist`** del repositorio (no la raíz).
5. Verificá que aparezca **Centipede** en la lista.

Para actualizar después de un cambio: ejecutá `npm run build` y luego presioná el ícono de recarga de la extensión en `chrome://extensions`.

### 1.3 Usar la extensión

**Grabar desde el popup o el panel flotante**

1. Abrí la página que querés grabar. Recargala si la abriste antes de cargar la extensión.
2. Hacé clic en el ícono de Centipede y luego en **Grabar**. Aparece el panel flotante en la esquina inferior derecha.
3. Interactuá con la página. Cada acción aparece como un paso.
4. Presioná **Detener** cuando termines.
5. Copiá el reporte con **Reporte** (lenguaje natural), **Texto** o **JSON**.
6. Para guardar la grabación en la biblioteca, presioná **Guardar**. Esto cierra la grabación activa.

**Grabar desde el panel lateral (sin ventana flotante)**

1. Hacé clic en el ícono de Centipede y luego en **Ver sesiones**. Se abre el panel lateral de Chrome.
2. En el panel, presioná **Nueva grabación**. La grabación corre sin mostrar la ventana flotante en la página.
3. Detené, guardá o copiá desde el panel lateral.

**Consultar sesiones guardadas**

En el panel lateral, la sección **Sesiones guardadas** lista las grabaciones más recientes primero. Usá los campos **Desde** y **Hasta** para filtrar por fecha. Hacé clic en una sesión para ver sus pasos, copiar los reportes o eliminarla.

### 1.4 Qué se registra

- Clics, dobles clics, clic derecho, escritura, cambios de selección, teclas especiales (Enter, Tab, Escape, flechas, etc.), foco, scroll y pasar el mouse.
- Escrituras consecutivas sobre el mismo campo: se registra un único paso con el valor final.
- Pasar el mouse repetidas veces sobre el mismo elemento: se registra una sola vez.
- Cambios de página, con recarga o sin ella (`Navegar a "<url>"`).
- Los campos de contraseña se registran como `***`.

---

## Parte 2: Puente MCP (conectar con Claude)

Esta parte permite que Claude consulte las grabaciones de Centipede. Claude Code arranca el servidor MCP automáticamente cuando abrís el proyecto.

### 2.1 Instalar las dependencias del puente

```bash
cd mcp
npm install
cd ..
```

### 2.2 Registrar el servidor en Claude Code

El repositorio ya trae el archivo `.mcp.json`, con este contenido:

```json
{
  "mcpServers": {
    "centipede": {
      "type": "stdio",
      "command": "node",
      "args": ["mcp/server.mjs"]
    }
  }
}
```

Si `.mcp.json` no existe, registrá el servidor manualmente desde la raíz del repositorio:

```bash
claude mcp add --scope project centipede -- node mcp/server.mjs
```

### 2.3 Abrir Claude Code y aprobar el servidor

1. Desde la raíz del repositorio, ejecutá `claude`.
2. Claude Code pide aprobación para el servidor del proyecto `centipede`. Aceptalo.
3. Dentro de Claude Code, ejecutá `/mcp` y verificá que `centipede` aparezca como conectado.

### 2.4 Emparejar la extensión con el puente

El puente genera un token de emparejamiento la primera vez que arranca. Se guarda en `mcp/.token`.

1. Abrí `mcp/.token` y copiá el contenido (una cadena de caracteres).
2. Hacé clic en el ícono de Centipede para abrir el popup.
3. En la sección **Claude**, pegá el token en **Token de emparejamiento** y presioná **Guardar**.
4. El indicador debería cambiar a **Claude: conectado**. Si no cambia, revisá la sección de problemas.

> El token es un secreto local. No lo compartas ni lo subas al repositorio. `mcp/.token` está en `.gitignore`.

### 2.5 Usar Claude con las grabaciones

Con la extensión conectada, Claude puede usar estas herramientas:

| Herramienta | Qué devuelve |
|---|---|
| `centipede_status` | Si la extensión está conectada, si hay una grabación activa (pasos, URL, título) y cuántas grabaciones están guardadas. |
| `centipede_list_sessions` | Las grabaciones guardadas, de la más reciente a la más antigua: id, título, URL, fechas y cantidad de pasos. Acepta `from` y `to` (`YYYY-MM-DD`) para filtrar por fecha. |
| `centipede_get_session` | Una grabación en JSON, con los pasos completos. Sin `session_id`, devuelve la activa; con `session_id`, una guardada. |
| `centipede_get_report` | El reporte de una grabación. Formatos: `natural` (por defecto), `text` o `json`. Sin `session_id`, usa la activa; con `session_id`, una guardada. |

Ejemplos de pedidos a Claude:

- *"¿Qué pasos grabé?"* y *"Generame un reporte de la grabación actual en texto"*.
- *"Listá las grabaciones de marzo de 2026"* y *"Analizá la grabación `<id>` y decime qué pasos llevaron al error"*.

> Para analizar grabaciones viejas, la extensión tiene que estar conectada (Chrome abierto con Centipede y el token emparejado), porque las grabaciones se leen desde el storage de la extensión.

---

## Solución de problemas

| Síntoma | Causa probable | Qué hacer |
|---|---|---|
| "Esta página no permite grabar" | La pestaña se abrió antes de cargar la extensión, o es una página de sistema (`chrome://`, la Web Store, etc.). | Recargá la pestaña. Probá en una página web normal. |
| El panel flotante no aparece | Se inició desde el panel lateral, a propósito. | Es el comportamiento esperado. Usá el panel lateral para controlar la grabación. |
| "Claude: desconectado" en el popup | El servidor MCP no está corriendo, el token es incorrecto, o el puerto `47315` está ocupado. | Verificá con `/mcp` en Claude Code que `centipede` esté conectado. Revisá el token. Si hay otra sesión de Claude con el puente abierto, cerrala: solo una puede usar el puerto. |
| Claude dice que la extensión no está conectada | La extensión no tiene el token, o Chrome está cerrado. | Abrí Chrome con la extensión cargada y verificá el token en el popup. |
| Los cambios no se ven en Chrome | No se recargó la extensión, o no se ejecutó el build completo. | Ejecutá `npm run build`, luego recargá la extensión en `chrome://extensions` y recargá la pestaña. |
| El botón **Ver sesiones** no abre el panel lateral | Algunas versiones de Chrome exigen un gesto directo para abrir el panel. | Abrí el panel desde el menú de Chrome (ícono de panel lateral) o desde la barra lateral. |
| Error de compilación con `chrome` no definido | Faltan los tipos de Chrome para TypeScript. | Son advertencias del compilador; el build de Vite funciona igual. Para eliminarlas, instalar `@types/chrome` como dependencia de desarrollo. |

---

## Limitaciones conocidas

- Una sola grabación activa a la vez por perfil de Chrome.
- La grabación está atada a la pestaña donde se inició. Si esa pestaña se cierra, la grabación queda detenida y sus pasos se conservan.
- El scroll se registra con una limitación de frecuencia (un paso cada 500 ms); no se colapsan todas las repeticiones.
- El puente acepta cualquier extensión de Chrome que presente el token. Pendiente: fijar el ID de la extensión.
- Los reportes pueden incluir valores que el usuario escribió en formularios (las contraseñas se enmascaran). Revisá los datos antes de compartirlos.
- Las capturas de pantalla, la reproducción automatizada y las herramientas de biblioteca para Claude están en el roadmap (`ROADMAP.md`).

---

## Desarrollo

- `npm run build`: compila la extensión completa en `dist/`.
- `npm run watch`: recompila popup, panel lateral y background. La content script requiere `npm run build`.
- `npx tsc --noEmit`: verificación de tipos. Hoy reporta errores de `chrome` (faltan los tipos) y uno en `element-analyzer.ts`, ambos preexistentes.
- `node mcp/server.mjs`: arranca el puente a mano (útil para depurar). Los logs van a stderr; stdout está reservado para el protocolo MCP.

Ver `ROADMAP.md` para el plan de desarrollo.
