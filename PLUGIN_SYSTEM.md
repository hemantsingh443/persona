# Modular Plugin System for persona

## Overview

The AI OS features a **modular plugin system** that allows the core AI (LLM) to dynamically access and use a variety of tools (plugins) at runtime. This design enables:
- Easy extension of AI capabilities by simply adding new plugins.
- Dynamic switching between tools based on the LLM's needs or user requests.
- Separation of browser-safe and server-only plugins for security and compatibility.

## How It Works

### 1. **Plugin Structure**
- **Each plugin** is a self-contained JavaScript (or WASM+JS) module.
- Plugins are placed in `static/plugins/PLUGIN_NAME/PLUGIN_FILE.js` for browser-safe plugins, or in a server directory for Node-only plugins.
- Plugins must use **ES module syntax** (`export`/`export default`) if they are to be loaded in the browser.

### 2. **Dynamic Loading**
- On startup, the server lists available plugins and sends the list to the client.
- The client dynamically loads browser-compatible plugins using `import()`.
- Node-only plugins (e.g., those requiring filesystem access) are not loaded in the browser, but are available via API endpoints.

### 3. **LLM Tool Use and Switching**
- The LLM is prompted with a system message that describes available tools and how to invoke them (e.g., `[CALCULATOR:add(2,3)]`).
- When the LLM wants to use a tool, it emits a command in a special format (e.g., `[PLUGIN_NAME:action(args)]`).
- The host page parses this command and dispatches it to the appropriate plugin, either in-browser or via a server endpoint.
- The result is sent back to the LLM, which can then continue its reasoning or respond to the user.

### 4. **Dynamic Switching**
- The LLM can choose which tool to use at any time, based on the user's request or its own reasoning.
- This allows for seamless switching between plugins (e.g., from calculation to file access) within a single conversation.

---

## Examples

### **A. Calculator Plugin (Browser-Compatible)**

- **Location:** `static/plugins/CALCULATOR_PLUGIN/calculator_plugin.js`
- **Exports:**
  ```js
  export function add(a, b) { return a + b; }
  export function subtract(a, b) { return a - b; }
  export default { add, subtract };
  ```
- **LLM Usage Example:**
  - LLM emits: `[CALCULATOR_PLUGIN:add(2,3)]`
  - Host loads the plugin and calls `add(2,3)`, returning `5`.

### **B. File Plugin (Node-Only, Server-Side)**

- **Location:** `static/plugins/FILE_PLUGIN/file_plugin.js` (Node.js/WASM, not loaded in browser)
- **Exports:**
  ```js
  // Node.js style, used only on the server
  module.exports.readFile = function(path) { ... };
  module.exports.writeFile = function(path, content) { ... };
  ```
- **LLM Usage Example:**
  - LLM emits: `[FILE_PLUGIN:readFile("/home/user/file.txt")]`
  - Host detects this and calls `/api/filesystem` endpoint, which uses the Node plugin to read the file and returns the contents.

---

## Adding New Plugins

1. **For browser plugins:**
   - Place your ES module JS file in `static/plugins/NEW_PLUGIN/new_plugin.js`.
   - Export functions you want the LLM to use.
2. **For server-only plugins:**
   - Place your Node.js or WASM+JS file in a server directory.
   - Expose an API endpoint for the browser to call.
3. **Update the system prompt** to describe the new tool to the LLM.

---

## Benefits
- **Extensible:** Add new capabilities without changing core logic.
- **Safe:** Browser only loads safe plugins; server handles privileged operations.
- **Flexible:** LLM can switch tools on the fly, enabling complex workflows.

---

## Future Ideas
- Plugin metadata for auto-discovery and documentation.
- Permission system for sensitive plugins.
- Hot-reloading or live plugin updates. 