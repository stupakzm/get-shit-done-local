---
phase: 02-routing-and-assignment
plan: "04"
subsystem: workflows
tags: [ollama, routing, workflows, model-dispatch, gsd-tools]

requires:
  - phase: 02-02
    provides: config-set-model-override command writing model_overrides to config.json

provides:
  - ollama: prefix routing guard in execute-phase.md (executor + verifier)
  - ollama: prefix routing guard in execute-plan.md (Pattern A executor)
  - ollama: prefix routing guards in plan-phase.md (researcher, planner, checker, revision)
  - ollama: prefix routing guards in verify-work.md (planner, checker, revision)
  - ollama: prefix routing guards in quick.md (researcher, planner, checker, revision, executor, verifier)
  - ollama: prefix routing guard in audit-milestone.md (integration_checker)
  - ollama: prefix routing guard in research-phase.md (researcher)
  - ollama: prefix routing guards in new-milestone.md (researcher, synthesizer, roadmapper)
  - ollama: prefix routing guards in new-project.md (researcher, synthesizer, roadmapper x2)

affects:
  - All GSD workflows that spawn Task() subagents

tech-stack:
  added: []
  patterns:
    - "ollama: prefix routing guard: if [[ model == ollama:* ]]; then pipe prompt to gsd-tools ollama run; else Task(model=...); fi"
    - "Ollama branch strips prefix: OLLAMA_MODEL_NAME=\"${model#ollama:}\""
    - "Prompt content captured as variable then piped via stdin to gsd-tools.cjs ollama run"

key-files:
  created: []
  modified:
    - get-shit-done/workflows/execute-phase.md
    - get-shit-done/workflows/execute-plan.md
    - get-shit-done/workflows/plan-phase.md
    - get-shit-done/workflows/verify-work.md
    - get-shit-done/workflows/quick.md
    - get-shit-done/workflows/audit-milestone.md
    - get-shit-done/workflows/research-phase.md
    - get-shit-done/workflows/new-milestone.md
    - get-shit-done/workflows/new-project.md

key-decisions:
  - "Guard added to every Task() that uses a model variable from init — no Task() passes ollama: prefix to Claude Code"
  - "new-project.md and new-milestone.md researcher guards applied as preamble pattern (all 4 researchers use same model variable)"
  - "audit-milestone.md guard uses $integration_checker_model (unquoted shell var) since model is resolved via CLI, not template substitution"

requirements-completed: [EXEC-02]

duration: 16min
completed: 2026-03-16
---

# Phase 02 Plan 04: ollama: workflow routing guards Summary

**ollama: prefix routing guards added to all 9 workflow files — prevents ollama:* model values from leaking into Task(model=...) calls that Claude Code cannot handle**

## Performance

- **Duration:** ~16 min
- **Started:** 2026-03-16T19:48:53Z
- **Completed:** 2026-03-16T20:04:20Z
- **Tasks:** 2
- **Files modified:** 9

## Accomplishments

- Every workflow that spawns `Task()` with a model from init now has an `if [[ model == ollama:* ]]` guard before the call
- Ollama-assigned roles pipe prompt content to `gsd-tools.cjs ollama run <model>` via stdin
- Cloud-assigned roles continue to `Task(model=...)` unchanged in the `else` branch
- Total: 25 ollama: guards across all 9 workflow files
- EXEC-02 success criterion #5 satisfied: `/gsd:execute-phase` routes to `gsd-tools ollama run` when executor_model has ollama: prefix

## Task Commits

Each task was committed atomically:

1. **Task 1: Add ollama: guards to execution workflows** - `8868104` (feat)
2. **Task 2: Add ollama: guards to planning and utility workflows** - `29ce265` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified

- `get-shit-done/workflows/execute-phase.md` — executor Task + verifier Task each wrapped with ollama: guard (2 guards)
- `get-shit-done/workflows/execute-plan.md` — Pattern A executor dispatch wrapped with ollama: guard (1 guard)
- `get-shit-done/workflows/plan-phase.md` — researcher, planner (plan), checker, planner (revision) Tasks each wrapped (4 guards)
- `get-shit-done/workflows/verify-work.md` — planner (gap), checker, planner (revision) Tasks each wrapped (3 guards)
- `get-shit-done/workflows/quick.md` — researcher, planner, checker, revision, executor, verifier Tasks each wrapped (6 guards)
- `get-shit-done/workflows/audit-milestone.md` — integration_checker Task wrapped (1 guard)
- `get-shit-done/workflows/research-phase.md` — researcher Task wrapped (1 guard)
- `get-shit-done/workflows/new-milestone.md` — researcher (4-parallel preamble), synthesizer, roadmapper Tasks each wrapped (3 guards)
- `get-shit-done/workflows/new-project.md` — researcher (4-parallel preamble), synthesizer, roadmapper (create), roadmapper (revision) Tasks each wrapped (4 guards)

## Decisions Made

- Guard condition uses `== ollama:*` (glob match in bash `[[ ]]`) — reliable without requiring regex engine
- Model name extraction uses `${model#ollama:}` prefix stripping — standard bash parameter expansion
- For new-project.md and new-milestone.md, researcher guard is documented as a preamble pattern applied before each of the 4 parallel Task() spawns — all four use the same `researcher_model` variable so the preamble avoids 4x duplicate guard blocks while preserving clarity
- audit-milestone.md integration_checker model is resolved via `resolve-model gsd-integration-checker --raw` CLI call (not template substitution), so the guard condition uses the bare shell variable `$integration_checker_model`

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None. The guard pattern is purely additive — existing Task() calls are preserved unchanged in the `else` branch.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- All 9 workflows now safely handle ollama: prefixed model assignments
- The routing layer is complete: `config-set-model-override` writes overrides (02-02), `resolve-model` reads them (02-03), and all workflow Task() calls respect the ollama: prefix (02-04)
- Phase 02 is complete — ready for Phase 03 or milestone transition

## Self-Check: PASSED

- SUMMARY.md exists at `.planning/phases/02-routing-and-assignment/02-04-SUMMARY.md`
- Task commit `8868104` present: `feat(02-04): add ollama: routing guards to execution workflows`
- Task commit `29ce265` present: `feat(02-04): add ollama: routing guards to planning and utility workflows`
- All 9 workflow files modified with ollama: guards (25 total guards)

---
*Phase: 02-routing-and-assignment*
*Completed: 2026-03-16*
