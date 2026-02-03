# ClawUp 🐾

Self-evolving SNS automation framework for [OpenClaw](https://github.com/openclaw/openclaw).

## Features

- **CLI-first**: All SNS actions via command line
- **Self-evolving rules**: Learn optimal posting times, hashtags, engagement patterns
- **Safety bounds**: Human-controlled limits AI cannot override
- **Multi-platform**: X (Twitter), Threads support

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

## CLI Usage

```bash
# Status
cli status

# Post (requires approval)
cli post -c x -t "content" --dry-run

# Engagement (autonomous within bounds)
cli engage -c x -a like --limit 10
cli engage -c x -a follow-back
cli engage -c x -a repost --limit 5

# Content
cli content collect    # Gather trends
cli content metrics    # View analytics
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
