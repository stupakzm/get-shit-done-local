---
phase: 03-hardware-suggestions
plan: "03"
subsystem: workflow
tags: [ollama, hardware-detection, vram, model-picker, set-model]

# Dependency graph
requires:
  - phase: 03-hardware-suggestions/03-02
    provides: "ollama hw-detect command returning VRAM and RAM JSON"
provides:
  - "set-model workflow with mandatory hardware detection step using AskUserQuestion"
  - "VRAM feasibility labels on Ollama models in the model picker"
  - "Custom model name input option in model picker"
  - "All 12 roles always shown; all cloud options always shown"
affects:
  - set-model workflow users

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "AskUserQuestion for mandatory interactive steps — prevents agents from skipping steps silently"
    - "CRITICAL/MANDATORY annotations enforce exact string formats and completeness requirements"

key-files:
  created: []
  modified:
    - get-shit-done/workflows/set-model.md

key-decisions:
  - "AskUserQuestion required for detect_hardware — prose descriptions are skippable, structured questions are not"
  - "EXACT label strings enforced via CRITICAL annotation: [fits in VRAM] and [exceeds VRAM — will CPU-offload at 1-3 tok/s]"
  - "Custom model name value written as-is — no ollama: prefix added automatically"
  - "ollama list (no --raw) returns JSON with result.models array — --raw returns plain text"

patterns-established:
  - "MANDATORY note before steps that must not be skipped by executing agents"
  - "CRITICAL note for exact string formats that must not be paraphrased"

requirements-completed: [HW-01, HW-02]

# Metrics
duration: 25min
completed: 2026-03-16
---

# Phase 03 Plan 03: set-model VRAM Feasibility Labels Summary

**VRAM feasibility labels added to set-model workflow with mandatory hardware detection via AskUserQuestion, plus custom model name input and complete cloud/role list enforcement**

## Performance

- **Duration:** 25 min
- **Started:** 2026-03-16T22:00:00Z
- **Completed:** 2026-03-16T22:25:00Z
- **Tasks:** 2 (Task 1 in prior session, Task 2 — bug fixes — in this session)
- **Files modified:** 1

## Accomplishments
- Fixed `ollama list --raw` to `ollama list` — was returning plain text instead of JSON with result.models array
- Made detect_hardware step unmissable: uses AskUserQuestion with numbered options and MANDATORY annotation
- Enforced exact feasibility label strings with CRITICAL note preventing paraphrasing
- All 12 roles always shown in role picker with MANDATORY annotation
- Cloud options (sonnet, haiku, inherit) always shown for every role — never filtered out
- Added "Type custom model name" option that writes value as-is without auto-prefixing
- All ollama models shown without filtering or truncation

## Task Commits

Each task was committed atomically:

1. **Task 1: Patch set-model.md with detect_hardware step and feasibility annotations** - `72845c7` (feat)
2. **Task 2: Fix all bugs from human verification** - `6429796` (fix)

**Plan metadata:** TBD (docs commit)

## Files Created/Modified
- `get-shit-done/workflows/set-model.md` - Hardware detection step, feasibility labels, all bug fixes applied

## Decisions Made
- `ollama list` (no `--raw`) returns JSON; `--raw` returns human-readable plain text — this was the root cause of only 2/5 models appearing
- AskUserQuestion is mandatory for interactive steps — prose descriptions allow agents to make assumptions and skip
- Custom model name typed by user is used verbatim — user specifies full value like `ollama:qwen2.5-coder:32b` or `sonnet`
- MANDATORY and CRITICAL annotations in workflow files are the mechanism for enforcing completeness requirements

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed wrong ollama list command (`--raw` flag removed)**
- **Found during:** Task 2 (human verification checkpoint)
- **Issue:** `ollama list --raw` returns plain text, not JSON — caused only 2/5 models to appear
- **Fix:** Changed to `ollama list` and documented the JSON shape `{ "models": [...] }` with `result.models` parsing
- **Files modified:** get-shit-done/workflows/set-model.md
- **Verification:** No `--raw` in file confirmed
- **Committed in:** 6429796

**2. [Rule 1 - Bug] detect_hardware step skipped by executing agent**
- **Found during:** Task 2 (human verification checkpoint)
- **Issue:** Step was prose-described, not enforced — agent went straight to role picker
- **Fix:** Added MANDATORY annotation + converted to AskUserQuestion with numbered options
- **Files modified:** get-shit-done/workflows/set-model.md
- **Verification:** AskUserQuestion and MANDATORY annotation present in step
- **Committed in:** 6429796

**3. [Rule 1 - Bug] Wrong feasibility label format (agent used "light, fast" / "mid")**
- **Found during:** Task 2 (human verification checkpoint)
- **Issue:** Agent paraphrased labels instead of using exact strings
- **Fix:** Added CRITICAL annotation listing exactly correct vs wrong formats
- **Files modified:** get-shit-done/workflows/set-model.md
- **Committed in:** 6429796

**4. [Rule 2 - Missing Critical] sonnet/haiku/inherit filtered for some roles**
- **Found during:** Task 2 (human verification checkpoint)
- **Issue:** Cloud options disappeared when changing a role that was already using sonnet
- **Fix:** Added MANDATORY annotation: cloud options always appear for every role
- **Committed in:** 6429796

**5. [Rule 2 - Missing Critical] Not all 12 roles shown on first run**
- **Found during:** Task 2 (human verification checkpoint)
- **Issue:** Only 3 roles shown on first invocation, 12 on subsequent runs
- **Fix:** Added MANDATORY annotation to always show all 12 roles from ROLE_FRIENDLY_NAMES
- **Committed in:** 6429796

**6. [Rule 2 - Missing] Added "Type custom model name" option**
- **Found during:** Task 2 (human verification — user requested)
- **Issue:** No way to enter a model name not in the listed options
- **Fix:** Added "Type custom model name" option with prompt; value written as-is
- **Committed in:** 6429796

---

**Total deviations:** 6 auto-fixed (4 bugs, 2 missing critical features)
**Impact on plan:** All fixes necessary for correct and complete behavior per user's real-world test. No scope creep.

## Issues Encountered
- Human verification revealed 6 distinct bugs, all in the workflow instruction text (not code). Fixed entirely by editing set-model.md.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Phase 03 is complete — all hardware suggestion features implemented and human-verified
- set-model workflow is ready for daily use with VRAM-aware model selection
- HW-01 and HW-02 requirements fulfilled

---
*Phase: 03-hardware-suggestions*
*Completed: 2026-03-16*
