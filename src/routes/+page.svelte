<script lang="ts">

import { onMount, onDestroy } from 'svelte';
import { browser } from '$app/environment';
import { tick } from 'svelte';
import Peer from 'peerjs';
import QRCode from 'qrcode';
import { getIdentity } from '$lib/identity';

export let data;
let status: string = 'Initializing...';
let lastMessage: string = '';
let clientUrl: string | null = null;
let canvasElement: HTMLCanvasElement;
let peer: Peer | undefined;
let tickerInterval: any = null; 

const plugins: Map<string, any> = new Map();
let pluginsReady = false;

async function loadPlugin(name: string, path: string) {
  if (!browser) return;
  if (name === 'SYSTEM_INFO_PLUGIN') return; // Node-only plugin
  try {
    const module = await import(/* @vite-ignore */ path);
    await module.default();
    plugins.set(name, module);
    console.log(`✅ Plugin '${name}' loaded successfully.`);
  } catch (e) {
    console.error(`❌ Failed to load plugin '${name}':`, e);
  }
}

function getPlugin(toolName: string) {
  // Try exact match first
  let plugin = plugins.get(toolName);
  if (plugin) return plugin;
  // Try case-insensitive match
  for (let key of plugins.keys()) {
    if (key.toLowerCase() === toolName.toLowerCase()) return plugins.get(key);
  }
  // Try Levenshtein distance <= 1 (for simple typos)
  function levenshtein(a: string, b: string) {
    if (a.length === 0) return b.length;
    if (b.length === 0) return a.length;
    const matrix = [];
    for (let i = 0; i <= b.length; i++) matrix[i] = [i];
    for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
    for (let i = 1; i <= b.length; i++) {
      for (let j = 1; j <= a.length; j++) {
        if (b.charAt(i - 1) === a.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1, // substitution
            matrix[i][j - 1] + 1,     // insertion
            matrix[i - 1][j] + 1      // deletion
          );
        }
      }
    }
    return matrix[b.length][a.length];
  }
  for (let key of plugins.keys()) {
    if (levenshtein(key, toolName) === 1) return plugins.get(key);
  }
  return undefined;
}

function startTicker(conn: any) {
  if (tickerInterval) clearInterval(tickerInterval); // Clear any old ticker
  const scheduler = plugins.get('SCHEDULER');
  if (!scheduler) {
    console.warn("Scheduler plugin not found. Reminders will not work.");
    return;
  }
  tickerInterval = setInterval(() => {
    try {
      const dueTasks: string[] = scheduler.checkTasks();
      console.log('Due tasks:', dueTasks, 'at', Math.floor(Date.now() / 1000));
      if (dueTasks && dueTasks.length > 0) {
        console.log('Sending reminders:', dueTasks);
        for (const message of dueTasks) {
          if (conn && conn.open) {
            conn.send(`[SCHEDULED_MESSAGE:${message}]`);
          }
        }
      }
    } catch (e) {
      console.error("Error checking scheduled tasks:", e);
    }
  }, 5000); // Check for tasks every 5 seconds
}

async function connectToPeerServer(peerId: string, retries = 3) {
  if (!browser || !data.ip) return;
  if (peer) peer.destroy();
  peer = new Peer(peerId, {
    host: data.ip,
    port: 9000,
    path: '/',
    secure: true
  });

  peer.on('open', async (id) => {
    console.log('Host is online with stable Peer ID:', id);
    clientUrl = `https://${data.ip}:${data.port}/client?id=${id}`;
    status = `✅ Ready. Scan QR code to connect.`;
    await tick();
    if (canvasElement) {
      QRCode.toCanvas(canvasElement, clientUrl, (error) => {
        if (error) console.error('QR Code Error:', error);
      });
    }
  });

  peer.on('connection', (conn) => {
    if (!pluginsReady) {
      conn.send('[TOOL_ERROR:Plugins are not loaded yet. Please try again in a moment.]');
      return;
    }
    status = '✅ Peer Connected!';
    startTicker(conn);
    conn.on('data', async (dataFromClient: any) => {
      const promptFromClient = dataFromClient.toString();
      lastMessage = `Received prompt...`;
      status = 'Processing...';

      let llmResponse = '';
      try {
        console.log('Sending to LLM:', promptFromClient);
        const res = await fetch('http://localhost:8080/completion', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt: promptFromClient,
            n_predict: 256,
            stop: ['<|end|>', '<|user|>', ']'],
          }),
        });
        if (!res.ok) throw new Error(`LLM server responded with status: ${res.status}`);
        const result = await res.json();
        console.log('Raw LLM Response:', JSON.stringify(result, null, 2));
        llmResponse = (result.content || '').trim();
      } catch (e: any) {
        console.error('LLM Fetch Error:', e.message);
        conn.send(`[TOOL_ERROR:Could not reach the AI model.]`);
        status = '✅ Peer Connected!';
        return;
      }

      console.log('LLM response for tool call detection:', llmResponse);
      // Regex: TOOLNAME:action(args)
      const toolCallMatch = llmResponse.match(/([A-Z_]+):([a-zA-Z0-9_]+)\(([^)]*)\)/);
      if (toolCallMatch) {
        const toolName = toolCallMatch[1];
        const actionName = toolCallMatch[2];
        const argsStr = toolCallMatch[3];
        const action = `${actionName}(${argsStr})`;
        console.log('Matched tool call:', { toolName, action });
        // Dispatch to the correct tool handler
        if (toolName === 'SYSTEM_INFO') {
          try {
            const apiResponse = await fetch('/api/systeminfo', { method: 'POST' });
            if (!apiResponse.ok) throw new Error(await apiResponse.text());
            const result = await apiResponse.json();
            if (!result.success) throw new Error(result.error);
            conn.send(`[TOOL_RESULT:${JSON.stringify(result.data)}]`);
          } catch (e: any) {
            conn.send(`[TOOL_ERROR:${e.message}]`);
          }
        } else if (toolName === 'FILE_PLUGIN') {
          try {
            const funcName = actionName;
            const args = argsStr.length > 0 ? argsStr.match(/(?:(?:"[^"]*")|[^,])+/g)?.map(arg => arg.trim().replace(/^"|"$/g, '')) : [];
            let apiResponse;
            if (funcName === 'readFile') {
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
          } catch (e: any) {
            conn.send(`[TOOL_ERROR:${e.message}]`);
          }
        } else if (toolName === 'CALCULATOR' || toolName === 'CALCULATOR_PLUGIN') {
          const plugin = getPlugin('CALCULATOR_PLUGIN');
          if (!plugin) {
            conn.send(`[TOOL_ERROR:Plugin 'CALCULATOR_PLUGIN' not loaded, misspelled, or not recognized]`);
            return;
          }
          try {
            const funcName = actionName;
            const args = argsStr.split(',').map(Number);
            if (typeof plugin[funcName] === 'function') {
              const toolResult = plugin[funcName](...args);
              conn.send(`[TOOL_RESULT:${toolResult}]`);
            } else {
              throw new Error(`Function '${funcName}' not found.`);
            }
          } catch (e: any) {
            console.error('Tool execution error:', e.message);
            conn.send(`[TOOL_ERROR:${e.message}]`);
          }
        } else if (toolName === 'SCHEDULER') {
          const plugin = plugins.get(toolName);
          try {
            const schedulerRegex = /addTask\("([^"]*)",\s*(.+)\)/;
            const match = action.match(schedulerRegex);
            if (match && match.length === 3) {
                const message = match[1];
                let timestampArg = match[2].trim();

                // If the timestamp is not a number, compute it from the prompt
                let timestamp;
                if (/^\d+$/.test(timestampArg)) {
                    timestamp = timestampArg;
                } else {
                    // Fallback: parse from prompt (e.g., "in 5 seconds")
                    const executeAt = parseTimeFromPrompt(promptFromClient);
                    timestamp = Math.floor(executeAt.getTime() / 1000).toString();
                }

                console.log('SCHEDULER tool call:', { message, timestampArg, promptFromClient });
                console.log('Computed timestamp:', timestamp, 'Current time:', Math.floor(Date.now() / 1000));
                const result = plugin.addTask(timestamp, message);
                console.log('addTask result:', result);
                conn.send(`[TOOL_RESULT:${result}]`);
            } else {
                throw new Error("Invalid scheduler command from LLM");
            }
          } catch (e: any) {
            conn.send(`[TOOL_ERROR:${e.message}]`);
          }
        } else {
          conn.send(`[TOOL_ERROR:Plugin '${toolName}' not found]`);
        }
      } else {
        // Not a tool call, just send the LLM response as normal
        conn.send(llmResponse);
      }
      status = '✅ Peer Connected!';
    });
  });

  peer.on('error', (err) => {
    console.error('PeerJS Error on Host:', err);
    if (err.type === 'unavailable-id' && retries > 0) {
      status = `ID is taken. Retrying in 2 seconds... (${retries} left)`;
      setTimeout(() => connectToPeerServer(peerId, retries - 1), 2000);
    } else {
      status = `❌ P2P Error: ${err.type}`;
    }
  });

  peer.on('disconnected', () => {
    status = 'Signaling server connection lost. Attempting to reconnect...';
    if (peer) {
      peer.reconnect();
    }
  });
}

onMount(async () => {
  if (!browser) return;
  const identity = await getIdentity();
  const pubJwk = JSON.parse(identity.publicKey);
  const hostPeerId = pubJwk.x;
  status = `Loading ${data.plugins.length} plugins...`;
  for (const pluginName of data.plugins) {
    if (pluginName === 'SYSTEM_INFO_PLUGIN') continue;
    if (pluginName === 'FILE_PLUGIN') continue;
    await loadPlugin(pluginName, `/plugins/${pluginName}/${pluginName.toLowerCase()}.js`);
    if (pluginName === 'SCHEDULER_PLUGIN') {
      plugins.set('SCHEDULER', plugins.get('SCHEDULER_PLUGIN'));
    }
  }
  pluginsReady = true;
  if (!data.ip) {
    status = '❌ IP Address not found. Check .env file.';
    return;
  }
  if (hostPeerId) {
    connectToPeerServer(hostPeerId);
  } else {
    status = '❌ Could not derive Peer ID.';
  }
});

function cleanup() {
  if (tickerInterval) clearInterval(tickerInterval); // Clear the timer
  if (peer) {
    console.log('Destroying host peer object.');
    peer.destroy();
    peer = undefined;
  }
}

onDestroy(cleanup);
if (browser) {
  window.addEventListener('beforeunload', cleanup);
}

// Helper: Parse time from user prompt (robust, supports 'in' and 'for' patterns)
function parseTimeFromPrompt(prompt: string): Date {
    const now = new Date();
    // Look for patterns like "in 1 minute", "for 2 hours", etc.
    const match = prompt.match(/(\d+)\s+(minute|hour|second)s?/);
    if (match && match.length === 3) {
        const amount = parseInt(match[1]);
        const unit = match[2];
        if (unit === 'minute') now.setMinutes(now.getMinutes() + amount);
        if (unit === 'hour') now.setHours(now.getHours() + amount);
        if (unit === 'second') now.setSeconds(now.getSeconds() + amount);
    }
    // Default to now if no time found
    return now;
}
</script>

<main>
  <h1>PERSONA</h1>
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