# Requirements: GSD Local LLM Fork

**Defined:** 2026-03-15
**Core Value:** Run GSD planning and execution workflows entirely on local hardware — allowing offline project work without cloud API access — while keeping cloud models available as a drop-in alternative per role.

## v1 Requirements

### Execution

- [x] **EXEC-01**: System detects installed Ollama models via `ollama list` and makes them available for role assignment
- [x] **EXEC-02**: User can assign a local Ollama model to any GSD role, persisted in `.planning/config.json` as `ollama:<model-name>` prefix
- [x] **EXEC-03**: GSD invokes a local model via `ollama run <model>` CLI pipe, captures stdout, and returns it as the agent response
- [x] **EXEC-04**: System shows a hard error with explicit cloud-fallback instruction when Ollama is unreachable
- [x] **EXEC-05**: System validates model exists at assignment time (not at runtime) and hard-errors if model is not installed
- [x] **EXEC-06**: Cloud-only project configs work unchanged — local model support is purely additive

### Command

- [x] **CMD-01**: `/gsd:set-model` command presents an interactive numbered picker of installed Ollama models for role assignment
- [x] **CMD-02**: Picker displays model size next to each model name (e.g., `qwen2.5-coder:32b (19GB)`)
- [x] **CMD-03**: User can view current role → model assignment table at any time via `/gsd:set-model` or a sub-option
- [x] **CMD-04**: After assignment, `/gsd:set-model` displays a config diff showing what changed (e.g., `gsd-planner: sonnet → qwen2.5-coder:32b`)

### Hardware Suggestions

- [ ] **HW-01**: When user explicitly requests hardware detection, system detects available VRAM and RAM
- [ ] **HW-02**: System suggests which installed models are feasible for each role based on detected hardware

## v2 Requirements

### Hardware

- **HW-03**: Automatic hardware detection at `/gsd:set-model` startup without explicit user request
- **HW-04**: Role-capability matching — encode which model size tier is recommended per role type (planning vs coding)

### UX Polish

- **UX-01**: Role grouping in picker UI (planning roles vs coding roles)
- **UX-02**: Per-phase model switching reminder when phase begins with local model assigned

## Out of Scope

| Feature | Reason |
|---------|--------|
| Automatic cloud fallback | Silent mode switching creates cost/privacy surprises — hard error with manual instruction instead |
| Ollama HTTP API integration | CLI pipe is simpler, no port management needed — explicitly decided in PROJECT.md |
| Streaming output display | GSD agents consume full responses; streaming adds complexity with no benefit |
| GUI / web interface | GSD is a CLI tool; web UI breaks workflow paradigm |
| Multi-provider support (LM Studio, llama.cpp) | Scope creep — validate Ollama pattern first, extend later |
| Auto-download models | Downloading GBs without confirmation is hostile UX |
| Replacing Claude Code as orchestrator | Claude Code handles tool use, file I/O, state — Ollama handles text generation only |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| EXEC-01 | Phase 1 | Complete |
| EXEC-02 | Phase 2 | Complete |
| EXEC-03 | Phase 1 | Complete |
| EXEC-04 | Phase 1 | Complete |
| EXEC-05 | Phase 1 | Complete |
| EXEC-06 | Phase 1 | Complete |
| CMD-01 | Phase 2 | Complete |
| CMD-02 | Phase 2 | Complete |
| CMD-03 | Phase 2 | Complete |
| CMD-04 | Phase 2 | Complete |
| HW-01 | Phase 3 | Pending |
| HW-02 | Phase 3 | Pending |

**Coverage:**
- v1 requirements: 12 total
- Mapped to phases: 12
- Unmapped: 0

---
*Requirements defined: 2026-03-15*
*Last updated: 2026-03-15 after roadmap creation*
