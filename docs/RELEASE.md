# MiMo Composer Token Status v2.2.0

Agent-native runtime extension for Xiaomi MiMo Desktop.

## Highlights

- Composer **Cache Hit Rate**
- **Token Plan Usage Remaining** (account menu source)
- Event-driven refresh
- Agent-first installation
- Automatic **Xiaomi MiMo** shortcut bootstrap (same name/icon)
- Rollback / repair / verify
- Zero additional LLM requests
- Zero external network requests in production
- No `app.asar` modification

## Compatibility

- Windows 10 / 11  
- Xiaomi MiMo Desktop  
- Node.js ≥ 18  

## Important limitation

The supported zero-friction path is the installed **desktop/start-menu Xiaomi MiMo shortcut** (wrapped by the installer).

Launching the **raw** `Xiaomi MiMo.exe` directly without `--remote-debugging-port` remains **unsupported** without modifying the host application.

## Security

- No telemetry  
- No analytics  
- No prompt upload  
- No token upload  
- No additional LLM inference requests  
- Localhost CDP only  

## Install

See [INSTALLATION.md](INSTALLATION.md) and repository [AGENTS.md](../AGENTS.md).

## License

MIT. Unofficial; not affiliated with Xiaomi.
