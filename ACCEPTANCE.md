# Acceptance — v2.0.0

## Static

- [x] `npm run check` (`node --check` core modules)
- [x] `npm run verify` formatter/contract
- [x] Runtime has no live `setInterval` / `MutationObserver` / `rAF`
- [x] No `app.asar` write path in supported scripts
- [x] `additionalLLMRequests` constant `0` in injector

## Live (Manual / CDP)

- [x] Strip: `缓存命中率 XX% · 剩余用量 XX%`
- [x] Cache updates when conversation usage updates (100% → 91% → 100% observed)
- [x] Plan remaining tracks `getUserUsage` (85.7% → 84.7% → 83.5% observed)
- [x] `timers=0` `observers=0` `subs=3`
- [x] Single strip after reinject
- [x] No renderer freeze during continuous manual use

## Partial / not claimed

- [ ] Fully unattended scripted Round1/2/3 DOM automation — **interrupted**
- [ ] Multi-machine CI
- [ ] Dark/light visual sign-off on this machine (code uses theme tokens)

## Sign-off

Release docs: `docs/RELEASE.md` · Changelog: `CHANGELOG.md`
