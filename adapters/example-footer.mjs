/**
 * Concept-only composer footer item (not bound to a real host SDK).
 * Hosts implement `align: "center"` slot ownership; plugins must not
 * absolute-position across the whole app window.
 */
import { formatStatus, formatA11y } from "./format.mjs";

/**
 * @param {object} host
 * @param {(item: { id: string, align: string, priority: number, el: HTMLElement }) => void} host.register
 */
export function registerTokenStatus(host) {
  const el = document.createElement("div");
  el.className = "cts-footer";
  el.setAttribute("role", "status");
  el.style.cssText = [
    "font-size:11px",
    "line-height:1.2",
    "color:var(--text-tertiary, #9b9b9b)",
    "user-select:none",
    "white-space:nowrap",
  ].join(";");

  host.register({
    id: "token-status",
    align: "center",
    priority: 10,
    el,
  });

  return {
    update(session) {
      el.textContent = formatStatus(session);
      el.setAttribute("aria-label", formatA11y(session));
    },
    clear() {
      el.textContent = "—";
      el.setAttribute("aria-label", "暂无用量数据");
    },
  };
}
