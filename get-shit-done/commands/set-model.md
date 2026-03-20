---
name: gsd:set-model
description: Assign a specific model (Ollama or cloud) to a GSD role, or view current role-to-model assignments
argument-hint: "[--assign] [--detect-hw]"
allowed-tools:
  - Read
  - Bash
  - AskUserQuestion
---

<objective>
View or configure per-role model assignments for GSD agents. Supports Ollama local models and cloud models (opus/sonnet/haiku).

With no arguments: displays the current role-to-model table (view-only).
With --assign: enters interactive role picker to assign models to specific roles.
With --detect-hw: manage the cached RAM/VRAM values used by the model picker.
</objective>

<execution_context>
@~/.claude/get-shit-done/workflows/set-model.md
</execution_context>

<context>
Arguments: $ARGUMENTS
</context>

<process>
Follow the set-model workflow from @~/.claude/get-shit-done/workflows/set-model.md end-to-end.

The workflow handles:
1. Loading Ollama models and current config from .planning/config.json
2. Displaying the role-to-model assignment table (always shown first)
3. View-only exit if no --assign flag
4. Interactive role + model picker with hardware detection
5. Writing assignments via config-set-model-override
6. Showing one-line diffs after each change
</process>
