export type JlProfileMetadata = { name: string; color: string };
type Port = { read: (id: string) => JlProfileMetadata | null; write: (id: string, patch: Partial<JlProfileMetadata>) => void };
let port: Port | null = null;
export function configureJlProfileMetadata(next: Port | null): void { port = next; }
export function readJlProfileMetadata(id: string): JlProfileMetadata {
  const metadata = port?.read(id);
  if (!metadata) throw new Error("JL profile is not ready");
  return metadata;
}
export function writeJlProfileMetadata(id: string, patch: Partial<JlProfileMetadata>): void {
  if (!port?.read(id)) throw new Error("JL profile changed");
  port.write(id, patch);
}
