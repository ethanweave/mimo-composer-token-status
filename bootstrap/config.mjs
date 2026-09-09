/**
 * Installer / bootstrap shared config.
 * Install root defaults to %LOCALAPPDATA%\composer-token-status
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const PRODUCT = "Composer Token Status";
export const VERSION = "2.2.0";
export const RUN_NAME = "ComposerTokenStatus";
export const DEFAULT_CDP_PORT = 9222;

export function defaultInstallRoot() {
  return path.join(os.homedir(), "AppData", "Local", "composer-token-status");
}

export function repoRootFromBootstrap() {
  // bootstrap/ is inside repo or install root
  return path.resolve(__dirname, "..");
}

export function resolveInstallRoot(explicit) {
  if (explicit) return path.resolve(explicit);
  if (process.env.CTS_INSTALL_ROOT) return path.resolve(process.env.CTS_INSTALL_ROOT);
  return defaultInstallRoot();
}

export function configPath(installRoot) {
  return path.join(installRoot, "cts-config.json");
}

export function loadConfig(installRoot) {
  const p = configPath(installRoot);
  try {
    if (!fs.existsSync(p)) return null;
    return JSON.parse(fs.readFileSync(p, "utf8"));
  } catch {
    return null;
  }
}

export function saveConfig(installRoot, config) {
  const p = configPath(installRoot);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(config, null, 2) + "\n", "utf8");
  return p;
}

export function findMimoExe() {
  const candidates = [
    process.env.CTS_MIMO_EXE,
    path.join(
      process.env.LOCALAPPDATA || "",
      "Programs",
      "Xiaomi MiMo",
      "Xiaomi MiMo.exe"
    ),
    path.join(
      process.env.LOCALAPPDATA || "",
      "Programs",
      "XiaomiMiMo",
      "Xiaomi MiMo.exe"
    ),
    "C:\\Program Files\\Xiaomi MiMo\\Xiaomi MiMo.exe",
  ].filter(Boolean);
  for (const c of candidates) {
    try {
      if (c && fs.existsSync(c)) return c;
    } catch {}
  }
  return null;
}

export function findNodeExe() {
  // Prefer the running node; else PATH
  if (process.execPath && /node\.exe$/i.test(process.execPath)) return process.execPath;
  return null;
}
