## Persona

A peer-to-peer AI chat system using SvelteKit, PeerJS, llama.cpp, and a Rust WASM plugin. The host runs a local LLM (llama.cpp) and exposes it to clients on the same network via a QR code and P2P connection.

---

## Features
- **P2P chat** using PeerJS (no central server for chat)
- **Local LLM** (llama.cpp) runs on the host, answers client prompts
- **Rust WASM plugin (experimental)** for file operations 
- **QR code** for easy client connection
- **Persistent cryptographic identity** for each host and client (Ed25519 keypair, used as PeerJS ID)
- **Per-host identity storage** for clients (each client gets a unique identity per host link)

---

## Identity-Based Connection System

- **Each host and client generates a persistent Ed25519 keypair** (using the Web Crypto API or a JS fallback library).
- **PeerJS IDs are derived from the public key** (the `x` property of the JWK), ensuring stable, cryptographically unique identities.
- **Clients store their identity per host**: when you connect to a new host, a new identity is generated and stored in your browser's localStorage under a key like `persona-identity-<hostId>`.
- **This enables persistent, secure, and collision-free P2P connections** across reloads and devices.

### Mobile Browser Requirements
- **Ed25519 key generation via Web Crypto API** this is only supported in the latest desktop browsers and is available in Chrome for Android 138+ (June 2025). (check[caniuse](https://caniuse.com/) for other browsers compatibity) 

- **If your mobile browser does not support Ed25519**, you will see an error and cannot connect as a client. Use a desktop browser or check for updates to your mobile browser.
- **HTTPS is required** for all connections (including WebSockets). You must run both the SvelteKit app and PeerJS server with SSL certificates (see below).
- **If using self-signed certificates (e.g., mkcert), you must trust the CA on your mobile device** for connections to work.

---

## Prerequisites
- Node.js (18+ recommended)
- Rust (for WASM plugin, optional)
- CMake, CUDA (for llama.cpp with GPU)
- Python 3 (for some llama.cpp scripts)

---

## 1. llama.cpp Setup

### Clone llama.cpp
```sh
git clone https://github.com/ggerganov/llama.cpp.git
cd llama.cpp
```

### Build with CUDA (GPU support)
```sh
cmake -B build -DGGML_CUDA=ON -DGGML_MTMD=OFF -DLLAMA_CURL=OFF
cmake --build build -j$(nproc)
```

### Download a GGUF Model
- Download a model (e.g., `Phi-3-mini-4k-instruct-q4.gguf`) from [HuggingFace](https://huggingface.co/models?library=llama.cpp&sort=downloads)
- Place it in `llama.cpp/models/`

### Run the Llama Server
```sh
./build/bin/llama-server -m models/<MODEL_NAME>.gguf -c 4096 --gpu-layers 20
```
- Replace `<MODEL_NAME>.gguf` with your downloaded model filename.
- The server will listen on `localhost:8080` by default.

---

## 2. Rust WASM Plugin (Experimental)
If you want file reading or custom Rust logic:

### Build the WASM Plugin
```sh
cd rust-plugin-folder
wasm-pack build --target web
```
- Copy the generated `.js` and `.wasm` files to your SvelteKit `static/pkg/` or `src/lib/pkg/` as needed.

---

## 3. SvelteKit App Setup

### Install dependencies
```sh
npm install
```

### Environment Setup
Create a `.env` file in the project root:
```
VITE_HOST_IP=YOUR.LAN.IP.ADDRESS
```
- Replace with your host machine's LAN IP (e.g., `192.168.0.100`)

---

## 4. PeerJS Server

### Install PeerJS globally (if not already)
```sh
npm install -g peer
```

### Start the PeerJS Server (with SSL for HTTPS/WSS)
```sh
peerjs --port 9000 --host 0.0.0.0 --sslkey ./192.168.x.xxx-key.pem --sslcert ./192.168.x.xxx.pem
```
- Make sure port 9000 is open in your firewall.
- The server must be accessible from other devices on your LAN.
- You must use SSL certificates for mobile/HTTPS support. Use [mkcert](https://github.com/FiloSottile/mkcert) to generate trusted local certs.

---

## 5. Run the SvelteKit App (with HTTPS)

```sh
npm run dev -- --host 0.0.0.0
```
- Configure `vite.config.js` to use your SSL certs:
```js
import { defineConfig } from 'vite';
import fs from 'fs';
export default defineConfig({
  server: {
    https: {
      key: fs.readFileSync('./192.168.x.xxx-key.pem'),
      cert: fs.readFileSync('./192.168.x.xxx.pem'),
    },
    host: '0.0.0.0',
  },
});
```
- Visit `https://<your-lan-ip>:5173` on your host machine.
- Scan the QR code with your phone (on the same Wi-Fi) to open the client page.
- If using self-signed certs, you must trust the CA on your mobile device.

---

## 6. How it Works
- The host page generates a persistent cryptographic PeerJS ID and QR code for the client.
- The client generates a unique identity per host and connects using its own persistent PeerJS ID.
- The client connects to the host via PeerJS and sends prompts.
- The host forwards prompts to llama.cpp and returns the response.
- All communication is P2P (no central chat server).

---

## 7. Testing

### Test llama.cpp
- Visit `http://localhost:8080` or use curl:
```sh
curl -X POST http://localhost:8080/completion -d '{"prompt":"Hello, AI!", "n_predict":32}' -H 'Content-Type: application/json'
```

### Test PeerJS
- Open the host app and start the PeerJS server.
- Open the client app (scan QR or open `/client?id=<host-id>`).
- Send a message and check for a response.

---

## 8. Troubleshooting
- **PeerJS connection refused or stuck on identity:**
  - Make sure the PeerJS server is running and accessible on your LAN IP and port 9000.
  - Open port 9000 in your firewall.
  - Make sure your browser supports Ed25519 (see above for mobile requirements).
  - If you see a certificate warning, trust the mkcert CA on your device.
- **llama.cpp not responding:**
  - Make sure the server is running and the model path is correct.
- **QR code not showing:**
  - Check browser console for errors.
- **Client stuck on 'Getting identity...' or 'Failed to get identity':**
  - Your browser does not support Ed25519. Use a supported desktop browser or update your mobile browser when support is available.

---

## 9. Project Structure
- `src/routes/+page.svelte` — Host UI
- `src/routes/client/+page.svelte` — Client UI
- `llama.cpp/` — LLM server
- `rust-plugin-folder/` — Optional WASM plugin

---
