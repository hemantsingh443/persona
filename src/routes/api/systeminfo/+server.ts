import { json } from '@sveltejs/kit';
import * as os from 'os';
const osAdapter = {
    getCpuLoad: () => os.loadavg(),
    getFreeMemory: () => os.freemem(),
    getTotalMemory: () => os.totalmem()
};

// We can't easily load Wasm compiled for Node.js in SvelteKit's ESM environment.
// FOR SIMPLICITY AND RELIABILITY, we will perform the logic directly here.
// The Wasm plugin pattern is better suited for computationally intensive, browser-safe tasks.

export async function POST() {
    try {
        const status = {
            cpu_load: osAdapter.getCpuLoad(),
            free_memory: osAdapter.getFreeMemory(),
            total_memory: osAdapter.getTotalMemory()
        };

        return json({ success: true, data: status });

    } catch (error: any) {
        return json({ success: false, error: error.message }, { status: 500 });
    }
}