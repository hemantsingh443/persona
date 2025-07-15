import { json, error } from '@sveltejs/kit';
import { readFileSync, writeFileSync } from 'fs';

export async function POST(event) {
    const body = await event.request.json();
    const { action, path, content } = body;

    try {
        if (action === 'readFile') {
            const data = readFileSync(path, 'utf8');
            return json({ success: true, data: data });
        } else if (action === 'writeFile') {
            writeFileSync(path, content || '');
            return json({ success: true, message: `File written to ${path}` });
        } else {
            throw error(400, 'Invalid action');
        }
    } catch (e: any) {
        throw error(500, e.message);
    }
}