/**
 * Discover MiMo process and CDP endpoint. Localhost only. No outbound net.
 */
import { execSync } from "node:child_process";
import { checkPort, listTargets } from "../inject/cdp-client.mjs";
import { DEFAULT_CDP_PORT, findMimoExe } from "./config.mjs";

export function mimoRunning() {
  try {
    const out = execSync('tasklist /FI "IMAGENAME eq Xiaomi MiMo.exe" /FO CSV /NH', {
      encoding: "utf8",
      timeout: 4000,
      windowsHide: true,
    });
    return /Xiaomi MiMo\.exe/i.test(out);
  } catch {
    return false;
  }
}

export function mimoCommandLineHasCdp() {
  try {
    const out = execSync(
      `powershell -NoProfile -Command "Get-CimInstance Win32_Process -Filter \\"Name='Xiaomi MiMo.exe'\\" | Select-Object -ExpandProperty CommandLine"`,
      { encoding: "utf8", timeout: 5000, windowsHide: true, stdio: ["ignore", "pipe", "ignore"] }
    );
    return /remote-debugging-port/i.test(out);
  } catch {
    return null;
  }
}

export async function cdpReady(port = DEFAULT_CDP_PORT) {
  const r = await checkPort(port);
  return r.ok;
}

export async function listCdpTargets(port = DEFAULT_CDP_PORT) {
  try {
    return await listTargets(port);
  } catch {
    return [];
  }
}

export async function discover(port = DEFAULT_CDP_PORT) {
  const exe = findMimoExe();
  const running = mimoRunning();
  const cdp = await cdpReady(port);
  const cmdCdp = running ? mimoCommandLineHasCdp() : null;
  return {
    mimoExe: exe,
    mimoInstalled: !!exe,
    mimoRunning: running,
    cdpPort: port,
    cdpReady: cdp,
    commandLineHasCdp: cmdCdp,
    canAttach: cdp,
    // Honest limitation: normal double-click without CDP cannot be injected
    limitation:
      running && !cdp
        ? "MiMo is running WITHOUT --remote-debugging-port. Cannot attach until MiMo is started with CDP (use the Token Status shortcut)."
        : null,
  };
}
