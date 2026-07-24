import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const CONFIG_DIR = path.join(os.homedir(), ".gitto");
const CONFIG_FILE = path.join(CONFIG_DIR, "config.json");

export interface GittoConfig {
  token?: string;
  login?: string;
}

function ensureConfigDir(): void {
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
  }
}

export function configExists(): boolean {
  return fs.existsSync(CONFIG_FILE);
}

export function readConfig(): GittoConfig {
  if (!configExists()) return {};
  try {
    return JSON.parse(fs.readFileSync(CONFIG_FILE, "utf8"));
  } catch {
    return {};
  }
}

export function writeConfig(update: Partial<GittoConfig>): void {
  ensureConfigDir();
  const current = readConfig();
  const next = { ...current, ...update };
  // Write to a temp file and rename over the target instead of writing the
  // target directly — rename is atomic, so a crash or Ctrl+C mid-write can't
  // leave config.json truncated (which readConfig's JSON.parse would then
  // silently swallow, logging the user out with no explanation).
  const tempFile = `${CONFIG_FILE}.${process.pid}.tmp`;
  fs.writeFileSync(tempFile, JSON.stringify(next, null, 2), { mode: 0o600 });
  fs.renameSync(tempFile, CONFIG_FILE);
}

export function clearConfig(): void {
  if (configExists()) fs.rmSync(CONFIG_FILE);
}

export function getToken(): string | undefined {
  return readConfig().token;
}

export function getLogin(): string | undefined {
  return readConfig().login;
}
