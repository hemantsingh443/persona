import { readFileSync, writeFileSync } from 'fs';
import { Buffer } from 'buffer'; // Needed for encoding

// Export a function that matches the Rust declaration
export function readFileSync(path) {
  return Buffer.from(readFileSync(path)).toString();
}

// Export a function that matches the Rust declaration
export function writeFileSync(path, content) {
  writeFileSync(path, content);
}