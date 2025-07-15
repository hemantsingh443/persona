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

  onMount(() => {
    if (!browser || !data.ip) {
      status = "❌ IP Address not found. Check .env file.";
      return;
    }
const peer = new Peer({
  host: data.ip,
  port: 9000,
});


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
  const fullPrompt = dataFromClient.toString();
  lastMessage = `Received prompt...`; 
  status = 'Processing...';

  try {
    const res = await fetch('http://localhost:8080/completion', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: fullPrompt,
        n_predict: 256,
        stop: ["<|end|>", "<|user|>"]
      }),
    });
    const result = await res.json();
    conn.send(result.content); 
  } catch (e) {
    conn.send('Error: Could not get response from local AI.');
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