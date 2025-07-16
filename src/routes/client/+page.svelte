<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { browser } from '$app/environment';
  import Peer from 'peerjs';
  import { getIdentity } from '$lib/identity'; 

  let conversation: { author: 'me' | 'ai'; text: string }[] = [];
  let status: string = 'Initializing...';
  let isLoading: boolean = false;
  let prompt = '';
  let conn: any;
  let peer: Peer | undefined;


  function formatConversation(): string {
  const systemPrompt = `<|system|>
You are a helpful AI assistant with access to tools.
To use a tool, you MUST respond with ONLY the exact command format.
Available Tools:
- Calculator: [CALCULATOR:add(num1, num2)] or [CALCULATOR:subtract(num1, num2)]
- File System: [FILE_PLUGIN:readFile("path/to/file.txt")] or [FILE_PLUGIN:writeFile("path/to/file.txt", "content")]
- System Info: [SYSTEM_INFO:getStatus()]
- Scheduler: [SCHEDULER:addTask("reminder text", unix_timestamp)] 

<|end|>\n`;

  let history = '';
  for (const message of conversation) {
    if (message.author === 'me') {
      history += `<|user|>\n${message.text}<|end|>\n`;
    } else {
      // CRITICAL FIX: Do not include the AI's previous tool USE in its memory.
      // Only include its actual text responses.
      if (!message.text.includes('[CALCULATOR:') && !message.text.includes('[FILE_PLUGIN:') && !message.text.includes('[SYSTEM_INFO:') && !message.text.includes('[SCHEDULER:')) {
         history += `<|assistant|>\n${message.text}<|end|>\n`;
      }
    }
  }
  return systemPrompt + history + `<|assistant|>\n`;
}

  function connectToHost(myId: string, hostId: string, hostIp: string) {
    status = 'Creating PeerJS client...';
    if (peer) {
        peer.destroy();
    }

    peer = new Peer(myId, { host: hostIp, port: 9000, path: '/', secure: true });

    peer.on('open', () => {
        status = 'PeerJS open, connecting to host...';
        if (!peer) {
          status = '❌ Peer object is undefined.';
          return;
        }
        console.log('Client is ready with stable ID:', myId);
        status = `Connecting to host: ${hostId}...`;
        conn = peer.connect(hostId);
        conn.on('open', () => { status = '✅ Connected to AI Host!'; });
        conn.on('data', (dataFromServer: any) => {
          const text = dataFromServer.toString().trim();
          let processed = false; // Flag to see if we've handled the message

          // --- UNIFIED TOOL & JSON HANDLER ---
          try {
            const jsonResult = JSON.parse(text);
            // If it's valid JSON, we assume it's a tool result.
            const formattedResult = `<pre>${JSON.stringify(jsonResult, null, 2)}</pre>`;
            conversation = [...conversation, { author: 'ai', text: formattedResult }];
            processed = true;
          } catch (e) {
            // Not a JSON object, do nothing and proceed.
          }

          // If it was not processed as JSON, treat it as a normal text message.
          if (!processed) {
            if (text.startsWith('[TOOL_RESULT:')) {
                const result = text.slice(13, -1);
                conversation = [...conversation, { author: 'ai', text: result }];
            } else if (text.startsWith('[SCHEDULED_MESSAGE:')) {
                const reminder = text.slice(18, -1);
                conversation = [...conversation, { author: 'ai', text: `⏰ Reminder: ${reminder}` }];
            } else {
                // It's a normal chat message
                conversation = [...conversation, { author: 'ai', text: text }];
            }
          }

          isLoading = false;
        });
    });

    peer.on('error', (err) => {
        status = `❌ PeerJS Error: ${err.type}`;
        console.error('PeerJS Error on Client:', err);
        // Note: The client's own ID should almost never be taken.
        // Most errors here will be connection-related.
        status = `❌ P2P Error: ${err.type}`;
    });
  }

  onMount(async () => {
    if (!browser) return;
    status = 'Parsing URL...';
    const urlParams = new URLSearchParams(window.location.search);
    const hostId = urlParams.get('id');
    const hostIp = window.location.hostname;

    if (!hostId || !hostIp) { status = '❌ Host ID or IP not found.'; return; }

    status = 'Getting identity...';
    const storageKey = `persona-identity-${hostId}`;
    let identity;
    try {
      identity = await getIdentity(storageKey);
    } catch (e) {
      status = `❌ Failed to get identity: ${e instanceof Error ? e.message : e}`;
      console.error('getIdentity error:', e);
      return;
    }
    status = 'Parsing public key...';
    const myPeerId = JSON.parse(identity.publicKey).x;

    if (myPeerId) {
      status = 'Connecting to host peer...';
      connectToHost(myPeerId, hostId, hostIp);
    } else {
      status = '❌ Could not derive client Peer ID.';
    }
  });

  function cleanup() {
      if (peer) {
          console.log('Destroying client peer object.');
          peer.destroy();
          peer = undefined;
      }
  }

  onDestroy(cleanup);
  if (browser) {
      window.addEventListener('beforeunload', cleanup);
  }


  function handleSubmit() {
    if (!prompt.trim() || !conn) return;
    isLoading = true;
    conversation = [...conversation, { author: 'me', text: prompt }];
     const fullPrompt = formatConversation();
    conn.send(fullPrompt);

    prompt = '';
  }
</script>
  
  <main>
    <h1>P2P AI Client</h1>
    <p>Status: {status}</p>
  
    <div class="chat-window">
      {#each conversation as message}
        <div class="message" class:me={message.author === 'me'} class:ai={message.author === 'ai'}>
          {message.text}
        </div>
      {/each}
      {#if isLoading}
        <div class="message ai">🧠...</div>
      {/if}
    </div>
  
    <form on:submit|preventDefault={handleSubmit}>
      <input bind:value={prompt} placeholder="Ask the remote AI..." disabled={isLoading}/>
      <button type="submit" disabled={isLoading}>Send</button>
    </form>
  </main>
  
  <style>
    main { max-width: 800px; margin: 0 auto; padding: 1rem; display: flex; flex-direction: column; height: 90vh; }
    .chat-window { flex-grow: 1; border: 1px solid #ccc; border-radius: 8px; padding: 1rem; overflow-y: auto; display: flex; flex-direction: column; gap: 0.5rem; }
    .message { padding: 0.5rem 1rem; border-radius: 1rem; max-width: 80%; }
    .ai { background-color: #eee; align-self: flex-start; }
    .me { background-color: #007bff; color: white; align-self: flex-end; }
    form { display: flex; gap: 10px; margin-top: 1rem; }
    input { flex-grow: 1; padding: 10px; border: 1px solid #ccc; border-radius: 5px; }
    button { padding: 10px; border: none; background-color: #007bff; color: white; border-radius: 5px; cursor: pointer; }
    button:disabled { background-color: #ccc; }
  </style>