import { readdirSync } from 'fs';
import { env } from '$env/dynamic/private';

export function load() {
    const ip = env.VITE_HOST_IP || null;
    if (!ip) {
        console.error("\n\nFATAL ERROR: VITE_HOST_IP is not set in your .env file!");
        console.error("Please create a .env file in the root of your project and add the line:");
        console.error('VITE_HOST_IP="YOUR.REAL.IP.ADDRESS"\n\n');
    }

    const plugins = readdirSync('./static/plugins').filter(p => !p.startsWith('.'));

    return {
        ip: ip,
        port: 5173,
        plugins: plugins 
    };
}