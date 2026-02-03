# `openclaw cron`

Manage cron jobs for the Gateway scheduler.
Related:

- Cron jobs: [Cron jobs](/automation/cron-jobs)

Tip: run `openclaw cron --help` for the full command surface.

## Common edits

Update delivery settings without changing the message:

```
openclaw cron edit <job-id> --deliver --channel telegram --to "123456789"

```

Disable delivery for an isolated job:

```
openclaw cron edit <job-id> --no-deliver

```