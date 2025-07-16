import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import fs from 'fs';

export default defineConfig({
    plugins: [sveltekit()],
    server: {
        https: {
            key: fs.readFileSync('./192.168.0.100-key.pem'),
            cert: fs.readFileSync('./192.168.0.100.pem'),
        },
        host: '0.0.0.0',
    }
});