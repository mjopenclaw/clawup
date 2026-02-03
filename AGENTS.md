# AGENTS.md - ClawUp Framework

This workspace is a **self-evolving SNS automation framework**.

## ⚠️ Primary Rule: CLI Only

**All SNS operations MUST go through CLI.**

```
✅ Correct: npx tsx src/cli/index.ts engage -c x -a like
❌ Forbidden: Direct browser manipulation
```

## On Session Start

1. `state/rules.yaml` - Current learned rules
2. `config/bounds.yaml` - Safety limits (NEVER modify!)
3. `memory/MEMORY.md` - Long-term memory

## Core Principles

### 1. Bounds are Immutable
```
config/bounds.yaml → Read-only for AI
```

### 2. Rules Evolve via Learning
```
state/rules.yaml → Auto-update based on confidence
```
- confidence >= 0.7: Auto-apply
- confidence >= 0.9: Require approval

### 3. Code is Fixed, Config Evolves
```
src/          → Don't modify (except bug fixes)
modules/      → Add new features
config/       → User settings
state/        → Learning results
```

## CLI Commands

```bash
cli status                              # Check status
cli post -c x -t "content" --dry-run    # Post (dry-run first)
cli engage -c x -a like --limit 10      # Like
cli engage -c x -a follow-back          # Follow back
cli engage -c x -a repost --limit 5     # Repost
cli content collect                     # Collect trends
cli content metrics                     # View metrics
```

## Approval Required

| Action | Approval | Command |
|--------|----------|---------|
| Status | ❌ | `cli status` |
| Like | ❌ (within limits) | `cli engage -a like` |
| Follow | ❌ (within limits) | `cli engage -a follow` |
| **Post** | ✅ | `cli post --dry-run` first |
| **Reply** | ✅ | `cli engage -a reply --collect-only` first |
| bounds.yaml | 🚫 Never | - |

## Self-Evolution Cycle

```
Observe → Analyze → Hypothesize → Experiment → Validate → Apply
```
