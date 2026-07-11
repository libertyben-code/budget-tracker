# Budget Tracker — How We Work Together

This file lives at `docs/WORKFLOW.md`. To start a Claude session: **"read docs/WORKFLOW.md and start a session"**.

---

## Starting a session

1. Mention this file and the current branch/feature you want to work on
2. Reference `docs/Bugs.md` — bugs to fix take priority over new features
3. Reference `docs/BACKLOG.md` for the pending `[ ]` items backlog
4. State what you want to accomplish — Claude will ask clarifying questions if needed before starting
5. **Claude creates a feature branch before touching any code** — no exceptions (see Branch strategy below)

---

## Ending a session

Claude follows this checklist at the end of every working session, in order:

1. **Ask the user to test** — "Can you test the build?"
2. **Wait for approval** — do not proceed until the user confirms ("ok", "good", etc.) or requests fixes
3. **Update all docs** once approved:
   - `docs/BACKLOG.md` — delete completed items (move to `docs/DONE.md` with `— OK`)
   - `README.md` — any user-visible change
   - `docs/MAINTAINER.md` — any architecture / gotcha change
   - `docs/WORKFLOW.md` — add dated dev log entry for the session
4. **Commit everything** on the feature branch (code + docs in one commit, or docs as a follow-up commit)
5. **Ask the user to merge** — "Ready to merge `feature/xxx` → `main`?"
6. **After merge confirmed**: bump version, commit the bump, `git push`
7. **Write release notes** — add entry to `CHANGELOG.md` for the new version (see [Changelog format](#changelog-format--release-notes) below), commit + push
8. **Push the release tag** — `git tag vX.Y.Z && git push origin vX.Y.Z`

---

## Branch strategy

> **Rule #1 — enforced at session start**: Claude runs `git checkout -b feature/xxx` as the very first action of every session, before any file edit. If this step is skipped, no code changes are made until it is done.

| Rule | Detail |
|---|---|
| **Never commit to `main` directly** | Always branch first — no exceptions |
| Branch naming | `feature/short-description` (e.g. `feature/dashboard-filters`) |
| One branch per feature set | Group related changes; don't mix unrelated features |
| Merge only when complete | Feature done + docs updated + user smoke test passed |

```bash
# Start of session — always first
git checkout -b feature/my-feature

# End of session — after user approval
git checkout main
git merge feature/my-feature --no-ff
git push
```

---

## Version management

### Rules

| Rule | Detail |
|---|---|
| **Never bump per branch** | Branches are dev-in-progress; version reflects what is released |
| **Bump at merge to `main`** | One bump per merge, committed right after the merge commit |
| Commit message | `chore: bump version to X.Y.Z` |

### Increment guide

| Change type | Bump | Example |
|---|---|---|
| Bug fix, UI tweak, wording | `PATCH` | 1.0.0 → 1.0.1 |
| New feature | `MINOR` | 1.0.x → 1.1.0 |
| Major architectural change | `MAJOR` | 1.x → 2.0.0 |

---

## Changelog format & release notes

Every release entry in `CHANGELOG.md` must follow this format:

```markdown
## X.Y.Z — YYYY-MM-DD

### What's new / Fixes & improvements

- **Feature name**: description.

---
```

**Rules:**

- The heading `## X.Y.Z — YYYY-MM-DD` must match the released version exactly
- The closing `---` marks the end of the section
- Add the entry **before** pushing the tag

---

## Commit discipline

- **One commit per logical change** — not one per file, not one per session
- Format: `type(scope): description` (conventional commits)
  - `feat(ui): add dark mode toggle`
  - `fix(auth): correct token expiry handling`
  - `docs: update README for new export feature`
  - `chore: bump version to 1.1.0`
- Always `git push` immediately after each commit — no local-only commits
- Always add `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>` at the end

---

## Before committing — approval flow

**The mandatory flow for any code change:**

1. Claude implements the change and states which files changed and why
2. **User tests the build** and approves or requests changes
3. Claude commits only after explicit user approval ("ok", "good", "commit it", etc.)

**Exceptions (Claude may commit directly after stating intent, no build test needed):**

- Typo / formatting fixes in docs
- Doc-only commits (README, MAINTAINER, WORKFLOW)

**If a tool call is rejected:**
- Do NOT retry the exact same call
- Read the rejection reason — it usually contains the fix
- Adjust approach and confirm before retrying

---

## Documentation — end of session AND before merging

| File | When to update |
|---|---|
| `README.md` | Any user-visible change |
| `docs/MAINTAINER.md` | Any architecture / gotcha change |
| `docs/BACKLOG.md` / `docs/DONE.md` | Move completed items from BACKLOG → DONE immediately |
| `docs/WORKFLOW.md` | When the collaboration process itself changes |

---

## BACKLOG.md is the living backlog

`BACKLOG.md` contains only pending `[ ]` items. `DONE.md` is the archive.

```
# In BACKLOG.md:
- [ ] pending item

# When done — remove from BACKLOG.md, append to DONE.md:
- [x] done item — OK
```

New items are added by the user after testing. Move to `DONE.md` on the commit that closes the item, not before.

---

## Coding style

- **No comments** unless the WHY is non-obvious (a bug workaround, a hidden constraint, a surprise behavior)
- **No docstrings** — well-named identifiers are self-documenting
- **No backwards-compat shims** — change the code directly
- **No defensive error handling** for impossible/internal cases — only at system boundaries (user input, external APIs)
- **Prefer editing existing files** over creating new ones
- **No premature abstractions** — three similar lines is better than a helper for two uses

---

## Known technical constraints

<!-- Add dated entries as you discover surprises, bugs with non-obvious fixes, or hidden constraints. -->
<!-- Format: ### YYYY-MM-DD — Short title -->
<!-- Body: describe the constraint, the rule it implies, and a code example if useful. -->

---

## Dated development log

<!-- Add an entry at the end of every session. -->
<!-- Format: ### YYYY-MM-DD — Short description (branch name if applicable) -->
<!-- Body: bullet points of what was done. -->

### 2026-07-11 — Adopt WORKFLOW docs (branch: feature/adopt-workflow-docs)

- Copied the `docs/` template into the repo and filled in project-specific content:
  - `MAINTAINER.md` — stack, repo layout, dev setup, architecture, Firestore structure, and a smoke test checklist, sourced from `README.md` and the existing codebase.
  - `Bugs.md`, `BACKLOG.md`, `FEEDBACK.md` — reset to empty, project-specific section headers (Transactions, Categorization, Dashboard, Savings, Joint Split, Auth/UI), ready for real items.
  - `DONE.md` — seeded with the CategoryRulesPanel/CategoryManagerPanel/DashboardCharts component extraction (already completed per git history).
  - `WORKFLOW.md` — project title, corrected co-author model string.
- Fixed `README.md`'s "Next Refactor Candidates" list, which was stale: 3 of 4 listed items were already extracted into components; only the batch edit modal extraction remains (moved to `BACKLOG.md` under Evolutions).
