#Persona

A peer-to-peer AI chat system using SvelteKit, PeerJS, llama.cpp, and a Rust WASM plugin. The host runs a local LLM (llama.cpp) and exposes it to clients on the same network via a QR code and P2P connection.

---

## Features
- **P2P chat** using PeerJS (no central server for chat)
- **Local LLM** (llama.cpp) runs on the host, answers client prompts
- **Rust WASM plugin (experimental)** for file operations 
- **QR code** for easy client connection

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

### Start the PeerJS Server
```sh
peerjs --port 9000 --host 0.0.0.0
```
- Make sure port 9000 is open in your firewall.
- The server must be accessible from other devices on your LAN.

---

## 5. Run the SvelteKit App

```sh
npm run dev -- --host 0.0.0.0
```
- Visit `http://localhost:5173` on your host machine.
- Scan the QR code with your phone (on the same Wi-Fi) to open the client page.

---

## 6. How it Works
- The host page generates a PeerJS ID and QR code for the client.
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
- **PeerJS connection refused:**
  - Make sure the PeerJS server is running and accessible on your LAN IP and port 9000.
  - Open port 9000 in your firewall.
- **llama.cpp not responding:**
  - Make sure the server is running and the model path is correct.
- **QR code not showing:**
  - Check browser console for errors.

---

## 9. Project Structure
- `src/routes/+page.svelte` — Host UI
- `src/routes/client/+page.svelte` — Client UI
- `llama.cpp/` — LLM server
- `rust-plugin-folder/` — Optional WASM plugin

---
