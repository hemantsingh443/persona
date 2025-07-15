import { readFileSync, writeFileSync } from 'fs';
import { Buffer } from 'buffer'; // Needed for encoding

// Export a function that matches the Rust declaration
export function readFileSync(path) {
  // We read the file as a buffer and convert to a UTF-8 string
  return Buffer.from(readFileSync(path)).toString();
}

// Export a function that matches the Rust declaration
export function writeFileSync(path, content) {
  writeFileSync(path, content);
}