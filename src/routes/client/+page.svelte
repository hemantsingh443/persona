
<script lang="ts">
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';
  import Peer from 'peerjs';

  let conversation: { author: 'me' | 'ai'; text: string }[] = [];
  let status: string = 'Initializing...';
  let isLoading: boolean = false;
  let prompt = '';
  let conn: any;

  function formatConversation(): string {
  const systemPrompt = `<|system|>
You are a helpful AI assistant with access to tools.
To use a tool, you MUST respond with ONLY the exact command format.
Available Tools:
- Calculator: [CALCULATOR:add(num1, num2)] or [CALCULATOR:subtract(num1, num2)]
- File System: [FILE_PLUGIN:readFile("path/to/file.txt")] or [FILE_PLUGIN:writeFile("path/to/file.txt", "content")]
<|end|>\n`;

    let history = '';
    for (const message of conversation) {
      if (message.author === 'me') {
        history += `<|user|>\n${message.text}<|end|>\n`;
      } else {
        if (!message.text.startsWith('[TOOL_')) {
          history += `<|assistant|>\n${message.text}<|end|>\n`;
        }
      }
    }
    return systemPrompt + history + `<|assistant|>\n`;
  }

  onMount(() => {
    if (!browser) return;
    const urlParams = new URLSearchParams(window.location.search);
    const hostId = urlParams.get('id');
    const hostIp = window.location.hostname;

    if (!hostId || !hostIp) { return; }

    const peer = new Peer({ host: hostIp, port: 9000, path: '/' });

    peer.on('open', (id) => {
      console.log('Client is ready with ID:', id);
      status = `Connecting to host: ${hostId}...`;
      conn = peer.connect(hostId);
      conn.on('open', () => { status = '✅ Connected to AI Host!'; });
      conn.on('data', (dataFromServer: any) => {
        const text = dataFromServer.toString().trim();

        if (text.startsWith('[TOOL_RESULT:')) {
          const result = text.slice(13, -1); 
          conversation = [...conversation, { author: 'ai', text: result }];
        } else if (text.startsWith('[TOOL_ERROR:')) {
          const error = text.slice(12, -1);
          conversation = [...conversation, { author: 'ai', text: `An error occurred: ${error}` }];
        } else {
          conversation = [...conversation, { author: 'ai', text: text }];
        }
        isLoading = false;
      });
    });
    peer.on('error', (err) => { });
  });


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