---
phase: 03-hardware-suggestions
plan: 02
subsystem: hardware-detection
tags: [nvidia-smi, wmi, vram, ram, ollama, node, hardware]

# Dependency graph
requires:
  - phase: 03-hardware-suggestions/03-01
    provides: Failing HW-01 and HW-02 test stubs locking cmdHwDetect and parseSizeGb acceptance contract
  - phase: 02-routing-and-assignment
    provides: ollama.cjs with cmdOllamaList/cmdOllamaRun and isBinaryNotFound helper
provides:
  - cmdHwDetect(cwd, raw) in ollama.cjs — non-fatal VRAM/RAM detection via nvidia-smi with WMI fallback
  - parseSizeGb(sizeStr) helper for parsing Ollama list size strings (GB/MB) to float GB
  - ollama hw-detect subcommand wired in gsd-tools.cjs dispatcher
affects: 03-03

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "cmdHwDetect uses max heuristic for multi-GPU VRAM (Math.max across all GPU lines)"
    - "WMI PowerShell fallback consolidated into tryWmiFallback() closure to avoid duplication"
    - "Non-fatal hardware detection: any nvidia-smi failure (ENOENT, non-zero exit, timeout) falls through to WMI"

key-files:
  created: []
  modified:
    - get-shit-done/bin/lib/ollama.cjs
    - get-shit-done/bin/gsd-tools.cjs

key-decisions:
  - "Simplified WMI fallback: any nvidia-smi failure (not just isBinaryNotFound) triggers WMI — removes special-case branching and avoids code duplication"
  - "parseSizeGb uses /^([\\d.]+)\\s*(GB|MB)/i regex — case-insensitive, null for no match"

patterns-established:
  - "Pattern: Non-fatal hardware probe — always output structured result, never call error(); fallback chain nvidia-smi -> WMI -> vram.available: false"

requirements-completed: [HW-01, HW-02]

# Metrics
duration: 2min
completed: 2026-03-16
---

# Phase 3 Plan 02: Hardware Suggestions - Hardware Detection Implementation Summary

**nvidia-smi VRAM detection with PowerShell WMI fallback and parseSizeGb helper, wired as `ollama hw-detect` subcommand — all 14 ollama tests green**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-03-16T21:41:17Z
- **Completed:** 2026-03-16T21:43:08Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- Implemented `parseSizeGb(sizeStr)` with GB/MB regex parsing, null for non-matching input
- Implemented `cmdHwDetect(cwd, raw)` with nvidia-smi primary path, PowerShell WMI fallback for non-NVIDIA machines, and multi-GPU max-value heuristic
- Wired `ollama hw-detect` in gsd-tools.cjs dispatcher; updated error message to include new subcommand
- Smoke test on target machine confirmed: `vram.mb: 6144, vram.source: 'nvidia-smi', ram.gb: 31.7`
- All 7 HW-01/HW-02 stubs now GREEN; all 7 prior EXEC tests still green (14/14 total)

## Task Commits

Each task was committed atomically:

1. **Task 1 + Task 2: Add cmdHwDetect and parseSizeGb, wire hw-detect dispatcher** - `068de7e` (feat)

_Note: Both tasks committed together since Task 2 is a trivial 3-line dispatcher addition that only makes sense alongside the Task 1 implementation_

**Plan metadata:** (docs commit follows)

## Files Created/Modified

- `get-shit-done/bin/lib/ollama.cjs` - Added parseSizeGb helper, cmdHwDetect function, updated exports
- `get-shit-done/bin/gsd-tools.cjs` - Added hw-detect branch in ollama case dispatcher

## Decisions Made

- Simplified the WMI fallback: the plan had separate `isBinaryNotFound` vs non-ENOENT branches calling the same WMI code twice. Extracted into a single `tryWmiFallback()` closure and call it for any nvidia-smi failure — cleaner, no duplication, same behavior.
- parseSizeGb uses case-insensitive regex match; returns float directly for GB, divides by 1024 for MB.

## Deviations from Plan

None - plan executed exactly as written. The WMI deduplication was an internal simplification that the plan explicitly anticipated ("NOTE: The above try/catch nesting ... can be simplified").

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- 03-02 complete: `cmdHwDetect` and `parseSizeGb` available from ollama.cjs, `ollama hw-detect` subcommand live
- Ready for 03-03: set-model.md workflow can call `ollama.cmdHwDetect(cwd, raw)` and `parseSizeGb` for hardware-aware model recommendations

## Self-Check: PASSED

- get-shit-done/bin/lib/ollama.cjs: FOUND
- get-shit-done/bin/gsd-tools.cjs: FOUND
- .planning/phases/03-hardware-suggestions/03-02-SUMMARY.md: FOUND
- Commit 068de7e: FOUND

---
*Phase: 03-hardware-suggestions*
*Completed: 2026-03-16*
