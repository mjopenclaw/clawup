# ClawUp 🐾

Self-evolving automation framework for [OpenClaw](https://github.com/openclaw/openclaw).

## Features

- **CLI-first**: All operations via command line
- **Self-evolving rules**: Learn and optimize behavior over time
- **Safety bounds**: Human-controlled limits AI cannot override
- **Modular design**: Extensible module system

## Quick Start

```bash
# Clone
git clone https://github.com/mjopenclaw/clawup.git
cd clawup

# Install
pnpm install  # or npm install

# Setup config
cp config/config.example.yaml config/config.yaml
cp config/bounds.example.yaml config/bounds.yaml
# Edit with your settings

# Build
pnpm build

# Run
npx tsx src/cli/index.ts status
```

## Architecture

```
clawup/
├── src/           # TypeScript source
│   └── cli/       # CLI commands
├── core/          # Core logic
├── modules/       # Module definitions (YAML)
├── config/        # User configuration
│   ├── config.yaml      # Your settings (gitignored)
│   └── bounds.yaml      # Safety limits (gitignored)
├── state/         # Learned rules (gitignored)
├── data/          # Database (gitignored)
└── memory/        # Agent memory (gitignored)
```

## Philosophy

- **Bounds are sacred**: `bounds.yaml` = human-only limits
- **Rules evolve**: `state/rules.yaml` = AI-learned optimizations  
- **Code is stable**: Source rarely changes; behavior changes via config

## License

MIT
