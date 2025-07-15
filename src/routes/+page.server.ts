import { env } from '$env/dynamic/private';

export function load() {
    const foundIp = env.VITE_HOST_IP || null;

    if (!foundIp) {
        console.error("\n\nFATAL ERROR: VITE_HOST_IP is not set in your .env file!");
        console.error("Please create a .env file in the root of your project and add the line:");
        console.error('VITE_HOST_IP="YOUR.REAL.IP.ADDRESS"\n\n');
    }

    return {
        ip: foundIp,
        port: 5173
    };
}