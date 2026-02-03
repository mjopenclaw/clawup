# AGENTS.md - ClawUp Framework

Self-evolving automation framework.

## Core Principles

### 1. Bounds are Immutable
```
config/bounds.yaml → Read-only for AI
```
Human-controlled safety limits. AI cannot modify.

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

## On Session Start

1. `state/rules.yaml` - Current learned rules
2. `config/bounds.yaml` - Safety limits (NEVER modify!)
3. `memory/MEMORY.md` - Long-term memory

## Self-Evolution Cycle

```
Observe → Analyze → Hypothesize → Experiment → Validate → Apply
```

## Approval Required

| Action | Approval |
|--------|----------|
| Read state/config | ❌ |
| Actions within bounds | ❌ |
| Update rules (confidence < 0.9) | ❌ |
| **Update rules (confidence >= 0.9)** | ✅ |
| **Modify bounds.yaml** | 🚫 Never |
