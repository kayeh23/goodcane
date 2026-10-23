---
description: After all your changes, make a list of stages and commits to make. The user makes those commits manually, so do not execute git commit or push commands.
---

# GoodCane Manual Commit Staging Guide

Inspect changes made to the GoodCane project and generate staged manual git commands for the user.

**Hard rule:** Do not execute `git commit` or `git push` commands on behalf of the user. Only list them for manual execution.

## Procedure

1. Run `git status` to see all changed and untracked files.
2. Run `git diff` to review all code modifications.
3. Organize the changes into logical, conventional commit stages (e.g. `feat:`, `fix:`, `chore:`, `refactor:`, `docs:`).
4. Display the list of manual staging and commit steps in this format:

```bash
# [Description of change]
git add [file1] [file2]
git commit -m "[conventional commit message]"

# [Description of next change]
git add [file3]
git commit -m "[conventional commit message]"
```

5. List any temporary or scratch test files that must be removed manually:

```bash
rm [scratch-file]
```

6. Suggest a branch name for holding the changes following the sprint convention from `docs/24_HOUR_SPRINT_PLAN.md`:
   - Platform/Database/Kitchen: `feat/A-<feature-name>`
   - Trust/Auth/Customer: `feat/B-<feature-name>`
   - Channels/Payments/WhatsApp: `feat/C-<feature-name>`