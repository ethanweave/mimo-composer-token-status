# Composer Token Status — 贴边融入层（方案 B+）

透明、**点击穿透**、置顶的小字层，贴在 **MiMo 主窗口底栏中央**，观感上尽量像原生 footer 中央项。  
**不是** Desktop 原生插件（宿主无该扩展点），但是你要求的「出现在那个位置、融入对话栏」形态。

## 启动

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File overlay\embed_overlay.ps1
```

关闭：结束该 PowerShell 进程，或 `Get-Process powershell | Where-Object Id -eq <pid> | Stop-Process`。

## 数据

- 调用 `overlay/statusbar.py --once` 读取本地 `mimocode.db` 中最近有效 assistant usage  
- 格式：`缓存 xx% · 剩余 xx%`（SPEC）  
- **限制**：仍是本地库轮询，不是流式引擎事件；会话进行中可能略滞后  

## 位置微调

| 环境变量 | 默认 | 含义 |
|----------|------|------|
| `OVERLAY_Y_FROM_BOTTOM` | `72` | 距 MiMo 窗口底边的像素（对齐输入框底栏） |
| `OVERLAY_X_CENTER` | `0.5` | 水平中心比例 |
| `CONTEXT_BUDGET` | `200000` | 「剩余」分母 |

示例：

```powershell
$env:OVERLAY_Y_FROM_BOTTOM = '80'
$env:OVERLAY_X_CENTER = '0.52'
powershell -NoProfile -ExecutionPolicy Bypass -File overlay\embed_overlay.ps1
```

## 已知限制

- 依赖窗口标题/进程名匹配 `Xiaomi MiMo`  
- 主题变浅时文字色可能需改（`#9B9BA1`）  
- 无法感知 UI 布局变化（右栏开合等）；需手动调 X/Y  
- **非实时流式 token**，为秒级本地库读取  

旧的独立 Tk 小条已废弃；`embed_overlay.py` 的 ctypes 版本有稳定性问题，请用 `.ps1`。
