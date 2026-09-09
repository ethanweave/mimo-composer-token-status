# SPEC: Composer Token Status

**Version:** 2.0  
**Status:** Stable  
**License:** MIT (code) · CC BY 4.0 (this document)

Host-neutral contract for a **two-field, integer-percent usage strip** in an agent client’s composer footer.

---

## 1. Goal

Show live session health without a full HUD, timeline pollution, or LLM polling.

Default (zh-CN):

```text
缓存命中率 25% · 剩余用量 86%
```

Default (en-US):

```text
Cache Hit Rate 25% · Usage Left 86%
```

Compact (narrow):

```text
命中率 25% · 剩余 86%
```

---

## 2. Placement

| Rule | Requirement |
|------|-------------|
| Container | Composer card **footer row** |
| Horizontal | Centered in the footer content box |
| Vertical | Optical baseline with side control clusters |
| Forbidden | New footer line; absolute overlay outside the card; covering the AI disclaimer |

---

## 3. Display rules

| Label key | zh-CN | en-US | Value |
|-----------|-------|-------|--------|
| `cacheHitRate` | 缓存命中率 | Cache Hit Rate | integer percent 0–100 |
| `planRemainingRatio` | 剩余用量 | Usage Left | integer percent 0–100 |

- Separator: middle dot ` · `
- No fractional percents in the strip
- Empty: omit missing fields; never invent `0%`
- Colors: host semantic tokens only
- No green cache bars, glow, or pulse

---

## 4. Data contract (Usage Snapshot)

```json
{
  "schemaVersion": 2,
  "session": {
    "id": "ses_xxx",
    "cacheHitRate": 0.25,
    "planRemainingRatio": 0.86,
    "planRemainingPercent": 86,
    "planResetDate": "2026-09-16",
    "planRemainingSource": "mimo:getUserUsage",
    "contextRemainingRatio": null,
    "cacheMetricScope": "conversation-cumulative"
  }
}
```

| Field | Type | Required | Notes |
|-------|------|----------|--------|
| `schemaVersion` | int | yes | `2` for this spec |
| `cacheHitRate` | float 0–1 | yes* | Conversation cumulative Prompt Cache hit rate |
| `planRemainingRatio` | float 0–1 | yes* | **Token Plan / Account remaining** |
| `planRemainingPercent` | number | no | Native percent before /100 |
| `planResetDate` | string | no | Native reset date |
| `planRemainingSource` | string | no | Host source id |
| `contextRemainingRatio` | float 0–1 | no | **Debug only** — never labeled 剩余用量 |
| `cacheMetricScope` | string | no | e.g. `conversation-cumulative` |

\* At least one of `cacheHitRate` / `planRemainingRatio` must be present to render.

### Deprecated

| Field | Status |
|-------|--------|
| `remainingRatio` | **Deprecated.** Ambiguous (context vs plan). Use `planRemainingRatio`. |
| Context ring / `1 - total/contextLimit` as plan remaining | **Forbidden.** |

### Suggested formulas

```text
cacheHitRate       = cacheRead / max(cacheRead + cacheWrite + input, 1)
planRemainingRatio = nativeAccount.percent / 100
contextRemainingRatio = 1 - usedContext / contextBudget   // optional debug
```

`input` is **fresh / uncached** input when the host follows the MiMo model. If a host’s `input` already includes cache reads, document the host mapping and adjust the formula accordingly.

---

## 5. Refresh

Hosts should refresh on **agent turn completion** (or equivalent usage commit), not on a 1 Hz timer.

Allowed:

- Native completion / done events
- Usage-store subscription with completion coalescing
- Manual refresh API

Disallowed for production injectors:

- `setInterval` / busy `setTimeout` loops
- Document-wide `MutationObserver` feedback loops
- Per-token UI paints
- LLM round-trips for stats

---

## 6. Non-goals

- Multi-metric IDE status bars
- User-defined metric editors
- Cloud usage sync
- Billing mutation

---

## 7. Acceptance

1. Dark + light: centered strip, no layout jump  
2. Narrow: no overflow; send remains usable  
3. Empty session: no `0% · 0%`  
4. Zero LLM round-trips  
5. Third party can implement from this SPEC in &lt; 1 day  

---

## 8. i18n

| Locale | String |
|--------|--------|
| `zh-CN` | `缓存命中率 {cache}% · 剩余用量 {remaining}%` |
| `zh-CN` compact | `命中率 {cache}% · 剩余 {remaining}%` |
| `en-US` | `Cache Hit Rate {cache}% · Usage Left {remaining}%` |
| `zh-CN` a11y | `缓存命中率 {cache}%，剩余用量 {remaining}%（Token Plan）` |
