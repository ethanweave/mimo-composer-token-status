#!/usr/bin/env python3
"""Transparent, click-through status strip overlaid on MiMo Desktop's composer footer.

Visual goal: the text sits in the same place as a native footer center item.
This is NOT a native plugin — it is a layered overlay window (WS_EX_TRANSPARENT).
"""
from __future__ import annotations

import ctypes
import ctypes.wintypes as wt
import json
import os
import sqlite3
import sys
import time
from pathlib import Path

user32 = ctypes.windll.user32
gdi32 = ctypes.windll.gdi32
kernel32 = ctypes.windll.kernel32

DB_PATH = Path(
    os.environ.get(
        "MIMOCODE_DB",
        str(Path.home() / ".local" / "share" / "mimocode" / "mimocode.db"),
    )
)
BUDGET = int(os.environ.get("CONTEXT_BUDGET", "200000"))
POLL_MS = int(os.environ.get("OVERLAY_POLL_MS", "1500"))
# Distance from bottom of MiMo window rect to status baseline (tuned to default layout)
Y_FROM_BOTTOM = int(os.environ.get("OVERLAY_Y_FROM_BOTTOM", "72"))
X_CENTER = float(os.environ.get("OVERLAY_X_CENTER", "0.50"))
X_OFFSET = int(os.environ.get("OVERLAY_X_OFFSET", "0"))

# Near-MiMo secondary text on pure transparent key color
TEXT_RGB = (0x9B, 0x9B, 0xA1)
KEY_RGB = (0x01, 0x01, 0x02)  # color key → transparent

GWL_EXSTYLE = -20
WS_EX_LAYERED = 0x00080000
WS_EX_TRANSPARENT = 0x00000020
WS_EX_TOOLWINDOW = 0x00000080
WS_EX_NOACTIVATE = 0x08000000
WS_EX_TOPMOST = 0x00000008
LWA_COLORKEY = 0x00000001
HWND_TOPMOST = -1
SWP_NOSIZE = 0x0001
SWP_NOACTIVATE = 0x0010
SWP_SHOWWINDOW = 0x0040

WM_PAINT = 0x000F
WM_DESTROY = 0x0002
WM_TIMER = 0x0113
WS_POPUP = 0x80000000
WS_VISIBLE = 0x10000000
CS_OWNDC = 0x20
CW_USEDEFAULT = 0x80000000
TRANSPARENT = 1
DT_CENTER = 0x1
DT_VCENTER = 0x4
DT_SINGLELINE = 0x20
DT_NOPREFIX = 0x800


class WNDCLASSEXW(ctypes.Structure):
    _fields_ = [
        ("cbSize", ctypes.c_uint),
        ("style", ctypes.c_uint),
        ("lpfnWndProc", ctypes.c_void_p),
        ("cbClsExtra", ctypes.c_int),
        ("cbWndExtra", ctypes.c_int),
        ("hInstance", ctypes.c_void_p),
        ("hIcon", ctypes.c_void_p),
        ("hCursor", ctypes.c_void_p),
        ("hbrBackground", ctypes.c_void_p),
        ("lpszMenuName", ctypes.c_wchar_p),
        ("lpszClassName", ctypes.c_wchar_p),
        ("hIconSm", ctypes.c_void_p),
    ]


class PAINTSTRUCT(ctypes.Structure):
    _fields_ = [
        ("hdc", wt.HDC),
        ("fErase", wt.BOOL),
        ("rcPaint", wt.RECT),
        ("fRestore", wt.BOOL),
        ("fIncUpdate", wt.BOOL),
        ("rgbReserved", ctypes.c_byte * 32),
    ]

WNDPROC = ctypes.WINFUNCTYPE(ctypes.c_longlong, wt.HWND, ctypes.c_uint, wt.WPARAM, wt.LPARAM)


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
    output_t = int(t.get("output") or 0)
    total = int(t.get("total") or (input_t + cache_read + output_t))
    return {
        "input": input_t,
        "cache_read": cache_read,
        "output": output_t,
        "total": total,
    }


def load_usage() -> dict:
    if not DB_PATH.exists():
        return {"ok": False, "reason": "db_missing", "text": "—"}
    try:
        conn = sqlite3.connect(
            f"file:{DB_PATH.as_posix()}?mode=ro", uri=True, timeout=0.4
        )
    except sqlite3.Error as e:
        return {"ok": False, "reason": str(e), "text": "—"}
    try:
        rows = conn.execute(
            "SELECT data FROM message ORDER BY time_updated DESC LIMIT 120"
        ).fetchall()
    except sqlite3.Error as e:
        conn.close()
        return {"ok": False, "reason": str(e), "text": "—"}
    conn.close()
    for (data,) in rows:
        tok = parse_tokens(data)
        if not tok:
            continue
        if tok["input"] + tok["cache_read"] + tok["output"] <= 0:
            continue
        denom = max(tok["input"] + tok["cache_read"], 1)
        cache_hit = tok["cache_read"] / denom
        used = min(tok["total"] or denom, BUDGET)
        remaining = max(0.0, min(1.0, 1.0 - used / max(BUDGET, 1)))
        cache = round(cache_hit * 100)
        left = round(remaining * 100)
        return {
            "ok": True,
            "text": f"缓存 {cache}% · 剩余 {left}%",
            "cacheHitRate": cache_hit,
            "remainingRatio": remaining,
        }
    return {"ok": False, "reason": "no_usage", "text": "—"}


def find_mimo_hwnd() -> int | None:
    found: list[int] = []

    @WNDPROC
    def enum_proc(hwnd, _lparam):
        if not user32.IsWindowVisible(hwnd):
            return 1
        length = user32.GetWindowTextLengthW(hwnd)
        if length <= 0:
            return 1
        buf = ctypes.create_unicode_buffer(length + 1)
        user32.GetWindowTextW(hwnd, buf, length + 1)
        title = buf.value
        if "Xiaomi MiMo" in title or title.strip() == "MiMo":
            found.append(hwnd)
        return 1

    WNDENUMPROC = ctypes.WINFUNCTYPE(ctypes.c_bool, wt.HWND, wt.LPARAM)
    user32.EnumWindows(WNDENUMPROC(enum_proc), 0)
    if not found:
        return None
    best_h = found[0]
    best_area = -1
    for h in found:
        r = wt.RECT()
        if user32.GetWindowRect(h, ctypes.byref(r)):
            area = (r.right - r.left) * (r.bottom - r.top)
            if area > best_area:
                best_area = area
                best_h = h
    return best_h


class OverlayApp:
    def __init__(self) -> None:
        self.hinstance = kernel32.GetModuleHandleW(None)
        self.class_name = "CtsEmbedOverlay"
        self.hwnd = 0
        self.hdc_mem = 0
        self.hbitmap = 0
        self.hfont = 0
        self.width = 220
        self.height = 22
        self.text = "—"
        self._brush_bg = 0
        self._register_class()
        self._create_window()
        self._create_font()

    def _register_class(self) -> None:
        wc = ctypes.sizeof(WNDCLASSEXW)
        cls = WNDCLASSEXW()
        cls.cbSize = wc
        cls.style = CS_OWNDC
        cls.lpfnWndProc = ctypes.cast(WNDPROC(self._wndproc), ctypes.c_void_p)
        cls.hInstance = self.hinstance
        cls.hCursor = user32.LoadCursorW(None, 32512)
        cls.lpszClassName = self.class_name
        cls.hbrBackground = 0
        if not user32.RegisterClassExW(ctypes.byref(cls)):
            # class may already exist from prior run in same process
            pass

    def _create_window(self) -> None:
        style = WS_POPUP | WS_VISIBLE
        ex = WS_EX_TOOLWINDOW | WS_EX_LAYERED | WS_EX_TRANSPARENT | WS_EX_NOACTIVATE | WS_EX_TOPMOST
        self.hwnd = user32.CreateWindowExW(
            ex,
            self.class_name,
            "cts-overlay",
            style,
            0,
            0,
            self.width,
            self.height,
            None,
            None,
            self.hinstance,
            None,
        )
        if not self.hwnd:
            raise OSError("CreateWindowExW failed")
        # color-key transparency
        r, g, b = KEY_RGB
        color = r | (g << 8) | (b << 16)
        user32.SetLayeredWindowAttributes(self.hwnd, color, 0, LWA_COLORKEY)
        user32.SetWindowPos(self.hwnd, HWND_TOPMOST, 0, 0, 0, 0, SWP_NOSIZE | SWP_NOACTIVATE)

    def _create_font(self) -> None:
        # Segoe UI 11px
        self.hfont = gdi32.CreateFontW(
            -11,
            0,
            0,
            0,
            400,
            0,
            0,
            0,
            1,  # DEFAULT_CHARSET
            0,
            0,
            0,
            0,
            "Segoe UI",
        )

    def _wndproc(self, hwnd, msg, wparam, lparam):
        if msg == WM_PAINT:
            self._paint(hwnd)
            return 0
        if msg == WM_TIMER:
            self._refresh_text()
            self._reposition()
            user32.InvalidateRect(hwnd, None, 1)
            return 0
        if msg == WM_DESTROY:
            user32.PostQuitMessage(0)
            return 0
        return user32.DefWindowProcW(hwnd, msg, wparam, lparam)

    def _paint(self, hwnd: int) -> None:
        ps = PAINTSTRUCT()
        hdc = user32.BeginPaint(hwnd, ctypes.byref(ps))
        rc = wt.RECT()
        user32.GetClientRect(hwnd, ctypes.byref(rc))
        # fill key color
        br = gdi32.CreateSolidBrush(KEY_RGB[0] | (KEY_RGB[1] << 8) | (KEY_RGB[2] << 16))
        gdi32.FillRect(hdc, ctypes.byref(rc), br)
        gdi32.DeleteObject(br)
        old = gdi32.SelectObject(hdc, self.hfont)
        gdi32.SetBkMode(hdc, TRANSPARENT)
        color = TEXT_RGB[0] | (TEXT_RGB[1] << 8) | (TEXT_RGB[2] << 16)
        gdi32.SetTextColor(hdc, color)
        user32.DrawTextW(
            hdc,
            self.text,
            -1,
            ctypes.byref(rc),
            DT_CENTER | DT_VCENTER | DT_SINGLELINE | DT_NOPREFIX,
        )
        gdi32.SelectObject(hdc, old)
        user32.EndPaint(hwnd, ctypes.byref(ps))

    def _refresh_text(self) -> None:
        self.text = load_usage()["text"]

    def _reposition(self) -> None:
        target = find_mimo_hwnd()
        if not target:
            return
        r = wt.RECT()
        if not user32.GetWindowRect(target, ctypes.byref(r)):
            return
        w = r.right - r.left
        h = r.bottom - r.top
        if w < 100 or h < 100:
            return
        cx = r.left + int(w * X_CENTER) + X_OFFSET
        x = cx - self.width // 2
        y = r.bottom - Y_FROM_BOTTOM
        user32.SetWindowPos(
            self.hwnd,
            HWND_TOPMOST,
            x,
            y,
            0,
            0,
            SWP_NOSIZE | SWP_NOACTIVATE,
        )

    def run(self) -> None:
        self._refresh_text()
        self._reposition()
        user32.ShowWindow(self.hwnd, 5)  # SW_SHOW
        user32.UpdateWindow(self.hwnd)
        user32.SetTimer(self.hwnd, 1, POLL_MS, None)
        msg = wt.MSG()
        while user32.GetMessageW(ctypes.byref(msg), None, 0, 0) > 0:
            user32.TranslateMessage(ctypes.byref(msg))
            user32.DispatchMessageW(ctypes.byref(msg))


def main() -> int:
    if "--once" in sys.argv:
        print(load_usage()["text"])
        return 0
    app = OverlayApp()
    app.run()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
