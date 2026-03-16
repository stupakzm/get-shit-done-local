# Roadmap: GSD Local LLM Fork

## Overview

This roadmap delivers Ollama local LLM support for GSD in three phases. Phase 1 builds the execution foundation — the subprocess wrapper, config schema extension, prompt adapter, and output parser — which everything else depends on. Phase 2 wires that foundation into GSD's workflow routing and delivers the `/gsd:set-model` command so users can assign and manage local models without editing config files manually. Phase 3 adds hardware-aware suggestions that prevent users from silently assigning models that exceed their VRAM.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Execution Foundation** - Subprocess wrapper, config extension, prompt adapter, and output parsing — all the plumbing required before any model can be invoked (completed 2026-03-16)
- [ ] **Phase 2: Routing and Assignment** - Workflow routing patch and `/gsd:set-model` command — users can assign local models and GSD routes to them
- [ ] **Phase 3: Hardware Suggestions** - VRAM/RAM detection and model feasibility warnings in the assignment UX

## Phase Details

### Phase 1: Execution Foundation
**Goal**: Local models can be invoked correctly via the CLI pipe, with hard errors on all failure modes and no impact on existing cloud-only projects
**Depends on**: Nothing (first phase)
**Requirements**: EXEC-01, EXEC-03, EXEC-04, EXEC-05, EXEC-06
**Success Criteria** (what must be TRUE):
  1. Running `gsd-tools.cjs ollama list` returns installed Ollama models with sizes, or a hard error if Ollama is unreachable
  2. Running `gsd-tools.cjs ollama run <model>` with a prompt via stdin returns the model's response with ANSI escape codes stripped
  3. When Ollama is not running, the system emits a clear error message with an explicit instruction to start the daemon — no cryptic shell error
  4. When a model name that is not installed is invoked, the system emits a hard error with an instruction to `ollama pull` — no silent hang
  5. An existing cloud-only `.planning/config.json` with no `ollama:` values passes through the new config layer unchanged
**Plans**: 3 plans

Plans:
- [ ] 01-01-PLAN.md — Create ollama.test.cjs scaffold with failing stubs (Wave 0)
- [ ] 01-02-PLAN.md — Implement ollama.cjs (list + run) and wire gsd-tools.cjs dispatch
- [ ] 01-03-PLAN.md — Extend loadConfig() with ollama_path and update VALID_CONFIG_KEYS

### Phase 2: Routing and Assignment
**Goal**: Users can assign any installed Ollama model to any GSD role via `/gsd:set-model`, and GSD workflows route to that model automatically
**Depends on**: Phase 1
**Requirements**: EXEC-02, CMD-01, CMD-02, CMD-03, CMD-04
**Success Criteria** (what must be TRUE):
  1. Running `/gsd:set-model` presents a numbered list of installed models with sizes and prompts the user to select a role
  2. After assignment, `.planning/config.json` contains the selected model as `ollama:<model-name>` under the correct role key
  3. After assignment, `/gsd:set-model` displays a diff showing the previous and new model for the changed role
  4. Running `/gsd:set-model` (or a sub-option) shows the current role-to-model assignment table without making changes
  5. A GSD workflow that invokes an agent role assigned to a local model routes to `ollama run` rather than a Claude Code Task
**Plans**: TBD

### Phase 3: Hardware Suggestions
**Goal**: Users see VRAM and RAM feasibility information before assigning a model, preventing silent slow-generation from VRAM overflow
**Depends on**: Phase 2
**Requirements**: HW-01, HW-02
**Success Criteria** (what must be TRUE):
  1. When the user requests hardware detection during `/gsd:set-model`, the system reports detected VRAM and RAM
  2. Installed models that exceed detected VRAM are flagged with a warning (e.g., "exceeds VRAM — will CPU-offload at 1-3 tok/s") before the user confirms assignment
  3. Hardware detection failure (unsupported GPU, detection tool missing) is non-fatal — assignment proceeds with a note that hardware info is unavailable
**Plans**: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Execution Foundation | 3/3 | Complete    | 2026-03-16 |
| 2. Routing and Assignment | 2/4 | In Progress|  |
| 3. Hardware Suggestions | 0/TBD | Not started | - |
