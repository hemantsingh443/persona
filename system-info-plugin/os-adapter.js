import { loadavg, freemem, totalmem } from 'os';

export function getCpuLoad() {
  return loadavg(); // Returns an array of 1, 5, and 15 minute load averages
}

export function getFreeMemory() {
  return freemem(); // Returns free memory in bytes
}

export function getTotalMemory() {
  return totalmem(); // Returns total memory in bytes
}