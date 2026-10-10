import { invoke } from "@tauri-apps/api/core";

export async function downloadShader(id: string, force = false): Promise<string> {
  return invoke<string>("shader_download", { id, force });
}

export async function shaderDir(id: string): Promise<string | null> {
  return invoke<string | null>("shader_dir", { id });
}
