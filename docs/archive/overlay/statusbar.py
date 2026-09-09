#!/usr/bin/env python3
"""Always-on-top Composer Token Status strip (local, read-only).

Reads the latest assistant usage from MiMoCode's local SQLite store.
No LLM calls. Format locked by SPEC.md / DECISIONS.md.
"""
from __future__ import annotations

import json
import os
import sqlite3
import sys
import tkinter as tk
from pathlib import Path

DB_PATH = Path(
    os.environ.get(
        "MIMOCODE_DB",
        str(Path.home() / ".local" / "share" / "mimocode" / "mimocode.db"),
    )
)
# Context budget for "剩余". Default assumes ~200k window; override with CONTEXT_BUDGET.
BUDGET = int(os.environ.get("CONTEXT_BUDGET", "200000"))
POLL_MS = int(os.environ.get("OVERLAY_POLL_MS", "3000"))

# Light theme tokens (MiMo-like neutrals; adjust freely)
BG = "#141416"
FG = "#8e8e93"
FG_STRONG = "#c4c4c8"
BORDER = "#2a2a2e"


def parse_tokens(data: str) -> dict | None:
    try:
        d = json.loads(data)
    except json.JSONDecodeError:
        return None
    if d.get("role") != "assistant":
        return None
    t = d.get("tokens") or {}
    cache = t.get("cache") or {}
    input_t = int(t.get("input") or 0)
    cache_read = int(cache.get("read") or 0)
    total = int(t.get("total") or (input_t + cache_read + int(t.get("output") or 0)))
    return {
        "input": input_t,
        "cache_read": cache_read,
        "cache_write": int(cache.get("write") or 0),
        "output": int(t.get("output") or 0),
        "total": total,
    }


def load_usage() -> dict:
    if not DB_PATH.exists():
        return {"ok": False, "reason": "db_missing"}
    try:
        conn = sqlite3.connect(f"file:{DB_PATH.as_posix()}?mode=ro", uri=True, timeout=1.0)
    except sqlite3.Error as e:
        return {"ok": False, "reason": str(e)}
    try:
        rows = conn.execute(
            "SELECT data FROM message ORDER BY time_updated DESC LIMIT 80"
        ).fetchall()
    finally:
        conn.close()
    for (data,) in rows:
        tok = parse_tokens(data)
        if tok is None:
            continue
        # Skip empty/placeholder assistant rows (all-zero tokens)
        if tok["input"] + tok["cache_read"] + tok["output"] + tok["total"] <= 0:
            continue
        denom = max(tok["input"] + tok["cache_read"], 1)
        cache_hit = tok["cache_read"] / denom
        used = min(tok["total"] or denom, BUDGET)
        remaining = 1.0 - (used / BUDGET if BUDGET > 0 else 0.0)
        return {
            "ok": True,
            "cacheHitRate": cache_hit,
            "remainingRatio": max(0.0, min(1.0, remaining)),
            "input": tok["input"],
            "cache_read": tok["cache_read"],
            "output": tok["output"],
            "total": tok["total"] or denom,
            "budget": BUDGET,
        }
    return {"ok": False, "reason": "no_usage"}


def format_strip(session: dict, locale: str = "zh-CN") -> str:
    if not session.get("ok"):
        return "—"
    cache = round(session["cacheHitRate"] * 100)
    left = round(session["remainingRatio"] * 100)
    if locale.startswith("zh"):
        return f"缓存 {cache}% · 剩余 {left}%"
    return f"Cache {cache}% · Left {left}%"


class Overlay(tk.Tk):
    def __init__(self) -> None:
        super().__init__()
        self.overrideredirect(True)
        self.attributes("-topmost", True)
        self.configure(bg=BG, highlightbackground=BORDER, highlightthickness=1)
        self.label = tk.Label(
            self,
            text="缓存 — · 剩余 —",
            bg=BG,
            fg=FG,
            font=("Segoe UI", 11),
            padx=14,
            pady=8,
        )
        self.label.pack()
        self.title("Composer Token Status")
        # drag by holding label
        self._dx = self._dy = 0
        self.label.bind("<Button-1>", self._press)
        self.label.bind("<B1-Motion>", self._drag)
        self._place_default()
        self._tick()

    def _place_default(self) -> None:
        self.update_idletasks()
        w = self.winfo_reqwidth()
        self.geometry(f"+{max(8, (self.winfo_screenwidth() - w) // 2)}+24")

    def _press(self, event: tk.Event) -> None:
        self._dx = event.x
        self._dy = event.y

    def _drag(self, event: tk.Event) -> None:
        x = self.winfo_pointerx() - self._dx
        y = self.winfo_pointery() - self._dy
        self.geometry(f"+{x}+{y}")

    def _tick(self) -> None:
        usage = load_usage()
        text = format_strip(usage)
        self.label.configure(text=text, fg=FG_STRONG if usage.get("ok") else FG)
        tip = (
            f"input={usage.get('input')} cacheRead={usage.get('cache_read')} "
            f"total≈{usage.get('total')}/{usage.get('budget')}"
            if usage.get("ok")
            else str(usage.get("reason", "—"))
        )
        self.label.configure(cursor="fleur")
        self._tip = tip
        self.label.bind(
            "<Enter>",
            lambda e: self.label.configure(text=f"{text}  ·  {tip}") if usage.get("ok") else None,
        )
        self.label.bind("<Leave>", lambda e: self.label.configure(text=text))
        self.after(POLL_MS, self._tick)


def main() -> int:
    if "--once" in sys.argv:
        print(format_strip(load_usage()))
        return 0
    app = Overlay()
    app.mainloop()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
