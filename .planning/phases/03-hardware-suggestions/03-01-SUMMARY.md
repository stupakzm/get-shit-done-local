---
phase: 03-hardware-suggestions
plan: 01
subsystem: testing
tags: [tdd, node-test, nvidia-smi, hardware-detection, mock-binary]

# Dependency graph
requires:
  - phase: 02-routing-and-assignment
    provides: ollama.cjs with cmdOllamaList/cmdOllamaRun and mock binary injection pattern from ollama.test.cjs
provides:
  - Failing test stubs for HW-01 (ollama hw-detect via nvidia-smi) locking the contract for Wave 2 implementation
  - Failing test stubs for HW-02 (parseSizeGb helper) locking the parsing contract for Wave 2 implementation
  - createMockNvidiaSmi helper for injecting mock nvidia-smi binary via PATH in test environment
affects: 03-02

# Tech tracking
tech-stack:
  added: []
  patterns: [createMockNvidiaSmi mock binary injection via PATH (mirrors createMockBin pattern)]

key-files:
  created: []
  modified: [tests/ollama.test.cjs]

key-decisions:
  - "HW-01-c multi-GPU test asserts max value (6144 not 2048 or sum) — contracts implementation to use max heuristic, not first-line-only or sum"
  - "HW-01-b uses empty bin dir with PATH override to ensure nvidia-smi absence without touching real system PATH — mirrors EXEC-01 binary-missing pattern"
  - "HW-02 require placed at describe-block scope so the missing-export error causes all 4 subtests to fail in RED — correct RED signal without test-level try/catch noise"

patterns-established:
  - "Pattern: createMockNvidiaSmi(dir, vramMb) — multi-line vramMb string (e.g. '6144\\n2048') supported via printf on Unix, multi-@echo on Windows"

requirements-completed: [HW-01, HW-02]

# Metrics
duration: 3min
completed: 2026-03-16
---

# Phase 3 Plan 01: Hardware Suggestions - Failing Test Stubs Summary

**Failing TDD stubs for ollama hw-detect (3 tests) and parseSizeGb (4 tests) locking the HW-01/HW-02 acceptance contract before Wave 2 implementation**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-03-16T21:34:59Z
- **Completed:** 2026-03-16T21:37:29Z
- **Tasks:** 2
- **Files modified:** 1

## Accomplishments

- Added `createMockNvidiaSmi(dir, vramMb)` helper supporting single-GPU and multi-GPU (multi-line) output on both Windows (.cmd) and Unix (shell script)
- Added HW-01 describe block with 3 failing tests covering nvidia-smi success path, absent path (non-fatal exit 0), and multi-GPU max-value selection
- Added HW-02 describe block with 4 failing tests covering GB parsing, MB-to-GB conversion (within 0.01 tolerance), and null for unparseable input
- All 7 prior EXEC-01 through EXEC-05 tests remain green

## Task Commits

Each task was committed atomically:

1. **Task 1 + Task 2: Add createMockNvidiaSmi helper, HW-01 describe block, HW-02 describe block** - `f90fe13` (test)

_Note: Both TDD RED tasks committed together per plan's single commit instruction in Task 2 done criteria_

## Files Created/Modified

- `tests/ollama.test.cjs` - Added createMockNvidiaSmi helper (lines ~297-325), HW-01 describe (lines ~327-382), HW-02 describe (lines ~384-408)

## Decisions Made

- Multi-line vramMb in `createMockNvidiaSmi` uses `printf '%s\n'` on Unix rather than `echo` to handle the embedded newline in `"6144\n2048"` correctly as two separate output lines
- HW-02 `require` placed at describe scope (not inside each test) so a single missing-export error causes all 4 subtests to fail — cleaner RED signal
- HW-01-c contracts `vram.mb === 6144` (max of 6144 and 2048) which mandates the max heuristic in Wave 2 implementation

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- 03-01 complete: 7 failing stubs define the full acceptance contract for Phase 3 hardware detection
- Ready for 03-02: implement `cmdHwDetect` in ollama.cjs and export `parseSizeGb` to turn all 7 stubs green

---
*Phase: 03-hardware-suggestions*
*Completed: 2026-03-16*
