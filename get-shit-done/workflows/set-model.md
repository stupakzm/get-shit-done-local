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
If the workflow was invoked with no positional arguments (no role name specified after `/gsd:set-model`),
treat this as view-only mode: display the table and exit with the message:

```
Run /gsd:set-model <role> or /gsd:set-model --assign to configure a role assignment.
```

Skip the role_picker_loop entirely.

Otherwise, continue to the role_picker_loop.
</step>

<step name="detect_hardware">
**MANDATORY: This step MUST execute before role_picker_loop. Do not skip it.**

Use AskUserQuestion to present the hardware detection option. This is a required interactive step:

```
AskUserQuestion(
  question="Would you like to run hardware detection before selecting models? This detects your VRAM and RAM so the model picker can show which models will fit in VRAM.",
  options=[
    "1. Yes — detect hardware now",
    "2. No / Skip — proceed without feasibility labels"
  ]
)
```

If user selects 1 (Yes):
```bash
node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" ollama hw-detect
```
Parse the JSON output into `hwInfo`. The shape is:
```json
{ "vram": { "available": true/false, "mb": N, "gb": N, "source": "nvidia-smi" },
  "ram":  { "available": true, "bytes": N, "gb": N } }
```
Display the detected hardware:
```
Hardware detected:
  RAM:  {hwInfo.ram.gb} GB
  VRAM: {hwInfo.vram.gb} GB ({hwInfo.vram.source})   [if vram.available]
  VRAM: unavailable (no supported GPU detection tool found)  [if !vram.available]
```
If the command fails for any reason, set `hwInfo = null` and display:
```
Hardware detection failed — model picker will proceed without feasibility labels.
```

If user selects 2 (No / Skip): set `hwInfo = null`.

After this step completes (either path), proceed immediately to role_picker_loop.
</step>

<step name="role_picker_loop">
This is the main assignment loop. Repeat until user selects Exit or says No to "Assign another role?".

Track whether any changes were made (start with `changesMade = false`).

**3a. Role selection**

**MANDATORY: Always show all 12 roles. Never omit any role from the list.**

```
AskUserQuestion(
  question="Which role would you like to configure?",
  options=[
    "1. Planner",
    "2. Roadmapper",
    "3. Executor",
    "4. Phase Researcher",
    "5. Project Researcher",
    "6. Research Synthesizer",
    "7. Debugger",
    "8. Codebase Mapper",
    "9. Verifier",
    "10. Plan Checker",
    "11. Integration Checker",
    "12. Nyquist Auditor",
    "0. Exit without changes"
  ]
)
```

The full list of 12 roles comes from ROLE_FRIENDLY_NAMES — always include all 12 regardless of what model is currently assigned to each role.

If user picks 0 / "Exit without changes" → break loop.

Resolve the selected friendly name back to an `agentKey` using the ROLE_FRIENDLY_NAMES mapping above.

**3b. Model selection**

Build the model list dynamically. Number the options sequentially starting from 1:
- Lines 1..N: `N. <model-name> (<size>)` for each Ollama model from the ollama list result
  - Use the `name` field exactly as returned (e.g. `qwen2.5:7b`)
  - Include size in parentheses (e.g. `4.7GB`)
  - If `hwInfo` is set and `hwInfo.vram.available` is true:
    - Parse the model size to GB: match `/^([\d.]+)\s*(GB|MB)/i`; GB units are direct, MB units divide by 1024
    - If modelSizeGb > hwInfo.vram.gb → append ` [exceeds VRAM — will CPU-offload at 1-3 tok/s]`
    - If modelSizeGb <= hwInfo.vram.gb → append ` [fits in VRAM]`
    - **CRITICAL: Use the EXACT label strings above. No other format is acceptable.**
      - CORRECT: `[fits in VRAM]`
      - CORRECT: `[exceeds VRAM — will CPU-offload at 1-3 tok/s]`
      - WRONG: "light, fast", "mid", "fits", "exceeds", or any other variation
  - If `hwInfo` is null or `hwInfo.vram.available` is false: no annotation on any model.
  - Cloud models (sonnet, haiku, inherit): never annotated regardless of hwInfo.
- After Ollama models, add the fixed cloud options in this order:
  - `sonnet`
  - `haiku`
  - `inherit`
  - **MANDATORY: These cloud options (sonnet, haiku, inherit) MUST always appear for every role, regardless of what model is currently assigned to that role. Never filter them out.**
- After the cloud options, add the custom model option: `Type custom model name`
- Finally, always add as option 0: `0. Reset to profile default`

If Ollama is unavailable (empty ollamaModels), the list shows cloud options + custom option + Reset.

```
AskUserQuestion(
  question="Select model for [FriendlyName]:",
  options=[
    "1. qwen2.5:7b (4.7GB) [fits in VRAM]",
    "2. llama3.2:3b (2.0GB) [fits in VRAM]",
    "3. some-large-model:70b (38GB) [exceeds VRAM — will CPU-offload at 1-3 tok/s]",
    "4. sonnet",
    "5. haiku",
    "6. inherit",
    "7. Type custom model name",
    "0. Reset to profile default"
  ]
)
```

**3c. Determine value to write**

- If user picked an Ollama model (options 1..N where N = ollamaModels.length) → value = `ollama:<model-name>` (e.g. `ollama:qwen2.5:7b`)
- If user picked a cloud option (`sonnet`, `haiku`, `inherit`) → value = that plain ID as-is
- If user picked "Type custom model name":
  - Prompt the user to type the model name:
    ```
    Enter model name (e.g. ollama:qwen2.5-coder:32b or sonnet):
    ```
  - Use the typed value exactly as-is. Do NOT automatically add an `ollama:` prefix.
  - The user is responsible for specifying the full value (e.g. `ollama:qwen2.5-coder:32b`, `sonnet`, or any other valid model string).
  - value = whatever the user typed
- If user picked 0 (Reset) → value = `reset`

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
