---
name: release
description: Generic release assistant — analyzes repo release rules, caches them in .omc/RELEASE_RULE.md, then guides the release
level: 3
---

# Release Skill

Thin, repo-aware release assistant. First run inspects project and CI to derive release rules, stores them in `.omc/RELEASE_RULE.md` for future use, then walks through release using those rules.

## Usage

```
/oh-my-caveman:release [version]
```

- `version` optional. Omitted: skill will ask. Accepts `patch`, `minor`, `major`, or explicit semver like `2.4.0`.
- Add `--refresh` to force re-analysis even when cached rule file exists.

## Execution Flow

### Step 0 — Load or Build Release Rules

Check whether `.omc/RELEASE_RULE.md` exists.

**Does NOT exist (or `--refresh` passed):** Run full repo analysis below and write file.

**Does exist:** Read file. Do quick delta check — scan `.github/workflows/` (or equivalent CI dirs: `.circleci/`, `.travis.yml`, `Jenkinsfile`, `bitbucket-pipelines.yml`, `gitlab-ci.yml`) for modifications newer than `last-analyzed` timestamp in rule file. If relevant workflow files changed, re-run analysis for those sections and update file. Report what changed.

---

### Step 1 — Repo Analysis (first run or --refresh)

Inspect repo and answer following. Write answers into `.omc/RELEASE_RULE.md`.

#### 1a. Version Sources

- Locate all files containing version string matching current version in `package.json` / `pyproject.toml` / `Cargo.toml` / `build.gradle` / `VERSION` file / etc.
- List each file and field or regex pattern used to find version.
- Detect whether release automation script exists (e.g. `scripts/release.*`, `Makefile release` target, `bump2version`, `release-it`, `semantic-release`, `changesets`, `goreleaser`).

#### 1b. Registry / Distribution

- npm (`package.json` with `publishConfig` or `npm publish` in CI), PyPI (`pyproject.toml` + `twine`/`flit`), Cargo (`Cargo.toml`), Docker (`Dockerfile` + push step), GitHub Packages, other.
- CI step that publishes automatically on tag push? Which workflow file and job?

#### 1c. Release Trigger

- Identify what starts release: tag push (`v*`), manual dispatch (`workflow_dispatch`), merge to main/master, release branch merge, commit message pattern.

#### 1d. Test Gate

- Identify test command and where it runs in CI.
- Tests required before publish? Note any bypass flags.

#### 1e. Release Notes / Changelog

- Does `CHANGELOG.md` or `CHANGELOG.rst` exist?
- Convention used: Keep a Changelog, Conventional Commits, GitHub auto-generated, none?
- Release body file committed pre-tag (e.g. `.github/release-body.md`)?

#### 1f. First-Time User Check

- Release workflow in `.github/workflows/` (or equivalent)? If not, flag and offer to scaffold.
- `.gitignore` entry preventing build artifacts from being committed? If not, flag.
- Git tags in use? Run `git tag --list`. No tags: flag and explain best practice.

---

### Step 2 — Write `.omc/RELEASE_RULE.md`

Create or overwrite file with this structure:

```markdown
# Release Rules
<!-- last-analyzed: YYYY-MM-DDTHH:MM:SSZ -->

## Version Sources
<!-- list of files + patterns -->

## Release Trigger
<!-- what kicks off the release -->

## Test Gate
<!-- command + CI job name -->

## Registry / Distribution
<!-- npm, PyPI, Docker, etc. + CI job that publishes -->

## Release Notes Strategy
<!-- convention + files -->

## CI Workflow Files
<!-- paths to relevant workflow files -->

## First-Time Setup Gaps
<!-- any missing pieces found during analysis, or "none" -->
```

---

### Step 3 — Determine Version

User provided version argument: use it. Otherwise:

1. Show current version (from primary version file).
2. Show what `patch`, `minor`, and `major` would produce.
3. Ask user which to use.

Validate chosen version is valid semver string.

---

### Step 4 — Pre-Release Checklist

Present checklist derived from release rules. Minimum:

- [ ] All changes for this release committed and pushed
- [ ] CI green on target branch
- [ ] Tests pass locally (run test gate command)
- [ ] Version bump applied to all version source files
- [ ] Release notes / changelog prepared (see Step 5)

Ask user to confirm before proceeding, or run each step if they say "go ahead".

---

### Step 5 — Release Notes Guidance

Help user write good release notes. Apply whichever convention repo uses. Default guidance when no convention detected:

**What makes good release note:**
- Lead with **what changed for users**, not internal implementation details.
- Group by type: `New Features`, `Bug Fixes`, `Breaking Changes`, `Deprecations`, `Internal / Chores`.
- Each item: one sentence, link to PR or issue, credit author if external.
- **Breaking changes** go first and must include migration path.
- Omit changes users never see (refactors, CI tweaks, test-only changes) unless they affect build reproducibility.

**Example entry format:**
```
### Bug Fixes
- Fix session drop on token expiry (#123) — @contributor
```

Repo uses Conventional Commits: generate draft changelog from `git log <prev-tag>..HEAD --no-merges --format="%s"` grouped by commit type. Show to user and let them edit.

---

### Step 6 — Execute Release

Using rules discovered, walk through:

1. **Bump version** — apply to each version source file.
2. **Run tests** — execute test gate command.
3. **Commit** — `git add <version files> CHANGELOG.md` and commit with `chore(release): bump version to vX.Y.Z`.
4. **Tag** — `git tag -a vX.Y.Z -m "vX.Y.Z"` (annotated tags preferred over lightweight).
5. **Push** — `git push origin <branch> && git push origin vX.Y.Z`.
6. **CI takes over** — if release trigger is tag push, remind user CI handles rest (publish, GitHub release creation). Show expected CI workflow file.
7. **Manual publish** — if no CI automation, list manual publish command (e.g. `npm publish --access public`, `twine upload dist/*`).

---

### Step 7 — First-Time Setup Suggestions

Gaps found in Step 1f — offer concrete help:

**No release workflow:**
> Repo doesn't have release CI workflow. GitHub Actions workflow triggered on `v*` tag push is most common best practice. It can:
> - Run tests
> - Publish to npm/PyPI/etc.
> - Create GitHub Release with release notes
>
> Want me to scaffold `.github/workflows/release.yml` for your stack?

**No git tags:**
> Appears to be first release. Git tags let GitHub, npm, and other tools understand version history. First tag created in Step 6.

**Build artifacts not gitignored:**
> Build artifacts present in git history or not gitignored. Inflates repo size and creates merge conflicts. Want me to add them to `.gitignore`?

---

### Step 8 — Verify

After push:
- Check CI status: `gh run list --workflow=<release workflow> --limit=3` (if `gh` available).
- Check registry (npm, PyPI) for new version after a few minutes.
- Confirm GitHub Release created: `gh release view vX.Y.Z`.

Report success or flag failures.

---

## Notes

- Skill does **not** hardcode any project-specific version files or commands. Everything derived from repo inspection.
- `.omc/RELEASE_RULE.md` is local cache. Commit to repo to share derived rules with team, or add to `.gitignore` to keep local.
- For complex monorepos or multi-package workspaces, skill detects workspace patterns (npm workspaces, pnpm workspaces, Cargo workspace) and adapts.
