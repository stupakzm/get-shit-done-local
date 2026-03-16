<purpose>
Assign a specific model (Ollama or cloud) to a GSD role, or view the current role-to-model table.
Invoked with no arguments (or --view) to view the current assignments and exit. Otherwise prompts
for role and model selection, shows a one-line diff after each change, and loops until user exits.
</purpose>

<required_reading>
Read all files referenced by the invoking prompt's execution_context before starting.
</required_reading>

<process>

<step name="load_context">
Run both commands to gather current state:

```bash
node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" ollama list
```

Parse the JSON result. The response shape is:
```json
{ "models": [{ "name": "qwen2.5-coder:7b", "id": "...", "size": "4.7 GB" }, ...] }
```
Set `ollamaModels` to `result.models` (the array). Display ALL models from the result — no filtering or
truncation. If the command fails or Ollama is unreachable, treat `ollamaModels` as an
empty array and note "Ollama unavailable" — cloud options are still shown in the picker.

```bash
cat .planning/config.json 2>/dev/null || echo "{}"
```

Parse the JSON result. Extract:
- `config.model_overrides` (default: `{}`)
- `config.model_profile` (default: `"balanced"`)
</step>

<step name="show_view_table">
Display the current role-to-model assignment table before any picker.

Use this ROLE_FRIENDLY_NAMES mapping (12 roles):

```
gsd-planner              → Planner
gsd-roadmapper           → Roadmapper
gsd-executor             → Executor
gsd-phase-researcher     → Phase Researcher
gsd-project-researcher   → Project Researcher
gsd-research-synthesizer → Research Synthesizer
gsd-debugger             → Debugger
gsd-codebase-mapper      → Codebase Mapper
gsd-verifier             → Verifier
gsd-plan-checker         → Plan Checker
gsd-integration-checker  → Integration Checker
gsd-nyquist-auditor      → Nyquist Auditor
```

Use this MODEL_PROFILES table (profile → model per agent key):

```
gsd-planner:              quality=opus,    balanced=opus,   budget=sonnet
gsd-roadmapper:           quality=opus,    balanced=sonnet, budget=sonnet
gsd-executor:             quality=opus,    balanced=sonnet, budget=sonnet
gsd-phase-researcher:     quality=opus,    balanced=sonnet, budget=haiku
gsd-project-researcher:   quality=opus,    balanced=sonnet, budget=haiku
gsd-research-synthesizer: quality=sonnet,  balanced=sonnet, budget=haiku
gsd-debugger:             quality=opus,    balanced=sonnet, budget=sonnet
gsd-codebase-mapper:      quality=sonnet,  balanced=haiku,  budget=haiku
gsd-verifier:             quality=sonnet,  balanced=sonnet, budget=haiku
gsd-plan-checker:         quality=sonnet,  balanced=sonnet, budget=haiku
gsd-integration-checker:  quality=sonnet,  balanced=sonnet, budget=haiku
gsd-nyquist-auditor:      quality=sonnet,  balanced=sonnet, budget=haiku
```

For each of the 12 agent keys, build a row:
- If `model_overrides[agentKey]` exists → Model = that value, Source = `assigned`
- Else → Model = `MODEL_PROFILES[agentKey][profile]`, Source = `profile:<profile>`

Display the table:

```
| Role                    | Model              | Source            |
|-------------------------|--------------------|-------------------|
| Planner                 | opus               | profile:balanced  |
| Roadmapper              | sonnet             | profile:balanced  |
| ...                     | ...                | ...               |
| Executor                | ollama:qwen2.5:7b  | assigned          |
```

If Ollama was unavailable, append a note below the table:
`Note: Ollama is unavailable — installed local models could not be retrieved.`
</step>

<step name="check_view_only">
If the workflow was invoked with no positional arguments AND no `--assign` flag, treat this as
view-only mode: display the table and exit with the message:

```
Run /gsd:set-model --assign to configure a role assignment.
```

Skip the role_picker_loop entirely.

If `--assign` was passed (or any role name was specified), continue to the role_picker_loop.
</step>

<step name="role_picker_loop">
This is the main assignment loop. Repeat until user selects Exit or says No to "Assign another role?".

Track whether any changes were made (start with `changesMade = false`).
Initialize `hwInfo = null` (will be set by hardware detection below).

---

**QUESTION 0 — Hardware Detection (MUST ask this FIRST, before role selection)**

Ask this question immediately when entering the loop. Do NOT skip it. Do NOT proceed to role
selection without asking it first.

```
AskUserQuestion(
  question="Run hardware detection? Detects VRAM/RAM so model picker can show which local models fit in VRAM.",
  options=[
    "Yes — detect hardware",
    "No / Skip"
  ]
)
```

If user selects "Yes":
```bash
node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" ollama hw-detect
```
Parse the JSON output into `hwInfo`:
```json
{ "vram": { "available": true/false, "mb": N, "gb": N, "source": "nvidia-smi" },
  "ram":  { "available": true, "bytes": N, "gb": N } }
```
Display:
```
Hardware detected:
  RAM:  {hwInfo.ram.gb} GB
  VRAM: {hwInfo.vram.gb} GB ({hwInfo.vram.source})
```
If vram.available is false: show `VRAM: unavailable`.
If command fails: set `hwInfo = null`, show `Hardware detection failed — no labels will be shown`.

If user selects "No / Skip": `hwInfo` stays null.

---

**3a. Role selection**

Output this exact block as plain text (do NOT use AskUserQuestion for the list — just print it):

```
Which role to configure?

  1.  Planner
  2.  Roadmapper
  3.  Executor
  4.  Phase Researcher
  5.  Project Researcher
  6.  Research Synthesizer
  7.  Debugger
  8.  Codebase Mapper
  9.  Verifier
  10. Plan Checker
  11. Integration Checker
  12. Nyquist Auditor
  0.  Exit
```

Then call:
```
AskUserQuestion(question="Enter number (0–12):")
```

If user enters 0 or "exit" → break loop.

Map the number to agentKey using ROLE_FRIENDLY_NAMES above (1=gsd-planner, 2=gsd-roadmapper, etc.).

**3b. Model selection**

First, compute the profile default for this role:
```
profileDefault = MODEL_PROFILES[agentKey][config.model_profile]
```
(e.g., for gsd-executor on balanced profile: profileDefault = "sonnet")

Build the list as plain text output (do NOT use AskUserQuestion for the list — just print it):

For each Ollama model (1..N), format the line as:
  `  N. {model.name} ({model.size}) {label}`

Where label:
- If hwInfo set AND hwInfo.vram.available:
  - Parse size to GB (match `/^([\d.]+)\s*(GB|MB)/i`; MB ÷ 1024)
  - size <= hwInfo.vram.gb → `[fits in VRAM]`
  - size > hwInfo.vram.gb → `[exceeds VRAM — will CPU-offload at 1-3 tok/s]`
  - **EXACT strings. WRONG: "light, fast", "mid", or any variation.**
- Otherwise: no label

After Ollama models append:
```
  {N+1}. sonnet
  {N+2}. haiku
  {N+3}. inherit
  {N+4}. Type custom model name
  0.    Back to profile default (currently: {profileDefault})
```

Example output for Executor (5 local models, 6 GB VRAM):
```
Select model for Executor:

  1. qwen2.5-coder:32b (19 GB) [exceeds VRAM — will CPU-offload at 1-3 tok/s]
  2. qwen2.5-coder:14b (9.0 GB) [exceeds VRAM — will CPU-offload at 1-3 tok/s]
  3. qwen2.5-coder:7b (4.7 GB) [fits in VRAM]
  4. llama3.2:latest (2.0 GB) [fits in VRAM]
  5. qwen2.5:7b-instruct-q4_K_M (4.7 GB) [fits in VRAM]
  6. sonnet
  7. haiku
  8. inherit
  9. Type custom model name
  0. Back to profile default (currently: sonnet)
```

Then call:
```
AskUserQuestion(question="Enter number:")
```

**3c. Determine value to write**

- User entered 1..N (Ollama model) → value = `ollama:{model.name}`
- User entered number for sonnet/haiku/inherit → value = that string as-is
- User entered number for "Type custom model name":
  - Call: `AskUserQuestion(question="Enter model name (e.g. ollama:qwen2.5-coder:32b or sonnet):")`
  - value = typed string verbatim. No auto-prefix.
- User entered 0 → value = `reset`

**3d. Write the assignment**

```bash
node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" config-set-model-override <agentKey> <value>
```

Parse the JSON output. The response format is:
```json
{ "updated": true, "key": "gsd-planner", "value": "ollama:qwen2.5:7b", "previousValue": "sonnet" }
```

Capture `previousValue` (use `"profile default"` if `previousValue` is undefined or null).

Set `changesMade = true`.

**3e. Display diff**

For a regular assignment:
```
<FriendlyName>: <previousValue> → <new-value>
```

For a reset (value was `reset`):
```
<FriendlyName>: <previousValue> → profile default
```

Example:
```
Planner: sonnet → ollama:qwen2.5:7b
Executor: profile default → haiku
Verifier: ollama:llama3.2:3b → profile default
```

**3f. Continue prompt**

```
AskUserQuestion(
  question="Assign another role?",
  options=["Yes", "No"]
)
```

If "Yes" → go back to step 3a.
If "No" → break loop.
</step>

<step name="done">
If `changesMade` is true, display:
```
Model assignments updated. Run /gsd:set-model again to view the current table.
```

If `changesMade` is false (user exited immediately at step 3a or view-only mode skipped the loop):
```
No changes made.
```
</step>

</process>

<success_criteria>
- [ ] Role-to-model table displayed before any picker
- [ ] Role picker shows 12 friendly names + Exit option
- [ ] Model picker shows Ollama models with sizes (if available) + cloud options + Reset
- [ ] Assignment written via config-set-model-override
- [ ] One-line diff displayed after each assignment
- [ ] "Assign another role?" loop continues until user says No or picks Exit
- [ ] Assignment persists in .planning/config.json as model_overrides entry
- [ ] User is offered hardware detection option before the role picker loop
- [ ] Ollama models in picker show feasibility labels when hwInfo.vram.available is true
</success_criteria>
