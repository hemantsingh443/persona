declare module '/pkg/file_reader_plugin.js' {
    export default function init(): Promise<void>;
    export function greet(name: string): string;
    export function read_file(path: string): string;
  }