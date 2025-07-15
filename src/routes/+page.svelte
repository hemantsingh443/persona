<script lang="ts">
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';
  import { tick } from 'svelte';
  import Peer from 'peerjs';
  import QRCode from 'qrcode';


  export let data;
  let status: string = 'Initializing...';
  let lastMessage: string = '';
  let clientUrl: string | null = null;
  let canvasElement: HTMLCanvasElement;

  const plugins: Map<string, any> = new Map();
  async function loadPlugin(name: string, path: string) {
    if (!browser) return;
    try {
      const module = await import(/* @vite-ignore */ path);
      await module.default();
      plugins.set(name, module);
      console.log(`✅ Plugin '${name}' loaded successfully.`);
    } catch (e) {
      console.error(`❌ Failed to load plugin '${name}':`, e);
    }
  }


  onMount(async () => {
    if (!browser) return;
    status = `Loading ${data.plugins.length} plugins...`;
    for (const pluginName of data.plugins) {
      if (pluginName === 'FILE_PLUGIN') continue;
      await loadPlugin(pluginName, `/plugins/${pluginName}/${pluginName.toLowerCase()}.js`);
    }

    if (!data.ip) {
      status = "❌ IP Address not found. Check .env file.";
      return;
    }

    const peer = new Peer({ host: data.ip, port: 9000, path: '/' });

    peer.on('open', async (id) => {
      console.log('My Peer ID is:', id);
      clientUrl = `http://${data.ip}:${data.port}/client?id=${id}`;
      status = `✅ Ready. Scan QR code to connect.`;
      await tick();
      if (canvasElement) {
        QRCode.toCanvas(canvasElement, clientUrl, (error) => {
          if (error) console.error('QR Code Error:', error);
        });
      }
    });


    peer.on('connection', (conn) => {
      status = '✅ Peer Connected!';
      conn.on('data', async (dataFromClient: any) => {
        const promptFromClient = dataFromClient.toString();
        lastMessage = `Received prompt...`;
        status = 'Processing...';

        let llmResponse = '';
        try {
            console.log("Sending to LLM:", promptFromClient);
            const res = await fetch('http://localhost:8080/completion', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    prompt: promptFromClient,
                    n_predict: 256,
                    stop: ["<|end|>", "<|user|>"],
                }),
            });
            if (!res.ok) throw new Error(`LLM server responded with status: ${res.status}`);
            const result = await res.json();
            console.log("Raw LLM Response:", JSON.stringify(result, null, 2));
            llmResponse = (result.content || '').trim(); 
        } catch (e: any) {
            console.error("LLM Fetch Error:", e.message);
            conn.send(`[TOOL_ERROR:Could not reach the AI model.]`);
            status = '✅ Peer Connected!';
            return; 
        }

        if (llmResponse.startsWith('[') && llmResponse.endsWith(']')) {
            console.log(`LLM wants to use a tool: ${llmResponse}`);
            const command = llmResponse.slice(1, -1);
            const [toolName, action] = command.split(':');

            if (toolName === 'FILE_PLUGIN') {
                try {
                    const funcName = action.substring(0, action.indexOf('('));
                    const argsStr = action.substring(action.indexOf('(') + 1, action.length - 1);
                    // Advanced parser for quoted strings (handles commas inside quotes)
                    const args = argsStr.length > 0 ? argsStr.match(/(?:"[^"]*"|[^,])+/g)?.map(arg => arg.trim().replace(/^"|"$/g, '')) : [];

                    let apiResponse;
                    if(funcName === 'readFile') {
                        apiResponse = await fetch('/api/filesystem', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ action: 'readFile', path: args?.[0] })
                        });
                    } else if (funcName === 'writeFile') {
                        apiResponse = await fetch('/api/filesystem', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ 
                                action: 'writeFile', 
                                path: args?.[0], 
                                content: args?.[1] 
                            })
                        });
                    }

                    if (!apiResponse || !apiResponse.ok) {
                        throw new Error(await apiResponse?.text() || 'API Error');
                    }

                    const result = await apiResponse.json();
                    conn.send(`[TOOL_RESULT:${result.data || result.message}]`);

                } catch(e: any) {
                    conn.send(`[TOOL_ERROR:${e.message}]`);
                }

            } else if (toolName === 'CALCULATOR') {
                const plugin = plugins.get(toolName);
                try {
                    const regex = /([\w]+)\((.*)\)/;
                    const match = action.match(regex);
                    if (match && match.length === 3) {
                        const funcName = match[1];
                        const argsStr = match[2];
                        const args = argsStr.split(',').map(Number);
                        if (typeof plugin[funcName] === 'function') {
                            const toolResult = plugin[funcName](...args);
                            conn.send(`[TOOL_RESULT:${toolResult}]`);
                        } else { throw new Error(`Function '${funcName}' not found.`); }
                    } else { throw new Error("Invalid command format from LLM."); }
                } catch (e: any) {
                    console.error("Tool execution error:", e.message);
                    conn.send(`[TOOL_ERROR:${e.message}]`);
                }
            } else {
                conn.send(`[TOOL_ERROR:Plugin '${toolName}' not found]`);
            }
        } else {
            conn.send(llmResponse);
        }
        status = '✅ Peer Connected!';
      });
    });
    peer.on('error', (err) => {
      console.error('PeerJS Error:', err);
      status = `❌ P2P Error: ${err.type}`;
    });
  });
</script>

<main>
  <h1>AI OS Host</h1>
  <p>Scan the QR code with your phone to connect.</p>

  {#if browser}
    <div class="qr-container">
      {#if clientUrl}
        <canvas bind:this={canvasElement}></canvas>
        <p class="url-text">{clientUrl}</p>
      {:else}
        <p>Initializing P2P connection...</p>
      {/if}
    </div>
  {/if}

  <div class="status-box">
    <strong>Status:</strong> {status}
  </div>
  {#if lastMessage}
    <div class="last-message">
      {lastMessage}
    </div>
  {/if}
</main>

<style>
  main { max-width: 800px; margin: 2rem auto; text-align: center; font-family: sans-serif; }
  .status-box, .last-message { border: 1px solid #ccc; padding: 1.5rem; margin-top: 1rem; border-radius: 8px; background-color: #f9f9f9; }  
  .qr-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 2rem;
  background-color: white;
  border-radius: 10px;
  margin: 2rem auto;
  max-width: 300px;
}
.url-text {
    margin-top: 1rem;
    font-family: monospace;
    font-size: 0.9rem;
    word-break: break-all;
}
</style>