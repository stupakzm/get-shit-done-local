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
Run all three commands to gather current state:

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

```bash
cat "$HOME/.claude/get-shit-done/hw-cache.json" 2>/dev/null || echo "null"
```

Parse the result into `hwCached`. If the result is `null` or the file is missing, set `hwCached = null`.
Valid cache shape: `{ "vram": { "available": bool, "mb": N, "gb": N, "source": str }, "ram": { "available": true, "bytes": N, "gb": N } }`

Initialize `hwInfo = hwCached` (may be null — will be set or skipped during role_picker_loop).
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
Check the arguments:

- If `--detect-hw` was passed → skip to the `detect_hw_mode` step immediately.
- If `--assign` was passed → continue to the `role_picker_loop` step.
- If no arguments (or `--view`) → display the table and exit with the message:
  ```
  Run /gsd:set-model --assign to configure a role assignment.
  Run /gsd:set-model --detect-hw to update cached hardware info.
  ```
  Skip the role_picker_loop entirely.
</step>

<step name="detect_hw_mode">
This step handles the `--detect-hw` flag. It manages the hardware cache independently of the assignment flow.

First display the current cached values:
- If `hwCached` is not null:
  ```
  Current cached hardware:
    RAM:  {hwCached.ram.gb} GB
    VRAM: {hwCached.vram.gb} GB ({hwCached.vram.source})   ← if vram.available
          or: VRAM: unavailable                              ← if !vram.available
  ```
- If `hwCached` is null:
  ```
  Current cached hardware: not set
  ```

Then call:
```
AskUserQuestion(question="What would you like to do?", options=["Detect / update RAM & VRAM", "See current (shown above)", "Cancel"])
```

- **"Detect / update RAM & VRAM":**
  Run:
  ```bash
  node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" ollama hw-detect
  ```
  Parse JSON into `hwInfo`. Display:
  ```
  Hardware detected:
    RAM:  {hwInfo.ram.gb} GB
    VRAM: {hwInfo.vram.gb} GB ({hwInfo.vram.source})   ← if vram.available
          or: VRAM: unavailable                          ← if !vram.available
  ```
  Save to cache:
  ```bash
  node -e "const fs=require('fs'),os=require('os'),p=os.homedir()+'/.claude/get-shit-done/hw-cache.json'; fs.mkdirSync(require('path').dirname(p),{recursive:true}); fs.writeFileSync(p, JSON.stringify(<hwInfo_json>, null, 2));"
  ```
  (Replace `<hwInfo_json>` with the actual parsed JSON object serialized as a JS literal.)
  Display: `Hardware cache updated.`

- **"See current (shown above)":** No action — values already displayed above. Display: `No changes made.`

- **"Cancel":** Display: `Cancelled.`

Exit after this step (do not enter role_picker_loop).
</step>

<step name="role_picker_loop">
This is the main assignment loop. Repeat until user selects Exit or says No to "Assign another role?".

Track whether any changes were made (start with `changesMade = false`).
Initialize `hwInfo = null` (will be set by hardware detection below).

---

**QUESTION 0 — Hardware Info**

Check `hwInfo` (loaded from cache in load_context):

- **If `hwInfo` is not null (cache hit):** Show the cached values and skip asking — do NOT prompt the user:
  ```
  Hardware (cached):
    RAM:  {hwInfo.ram.gb} GB
    VRAM: {hwInfo.vram.gb} GB ({hwInfo.vram.source})   ← if vram.available
          or: VRAM: unavailable                          ← if !vram.available
  ```
  Proceed directly to role selection. Do NOT ask if they want to detect.

- **If `hwInfo` is null (no cache):** Ask once:
  ```
  AskUserQuestion(question="No hardware cache found — detect RAM/VRAM so the model picker can show which local models fit?", options=["Yes, detect now", "No / Skip"])
  ```
  If user selects "Yes, detect now":
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

  Save to cache immediately after successful detection:
  ```bash
  node -e "const fs=require('fs'),os=require('os'),p=os.homedir()+'/.claude/get-shit-done/hw-cache.json'; fs.mkdirSync(require('path').dirname(p),{recursive:true}); fs.writeFileSync(p, JSON.stringify(<hwInfo_json>, null, 2));"
  ```
  (Replace `<hwInfo_json>` with the actual parsed JSON object.)

  If user selects "No / Skip": `hwInfo` stays null.

---

**3a. Role selection**

Output this exact block as plain text. CRITICAL: copy the numbers exactly as written — do NOT renumber, do NOT auto-increment. Exit is 0, not 13.

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
```

Output the prompt line and wait for the user's next chat message:
```
Enter number (1–12), 0 to exit:
```

If user enters 0 or "exit" → break loop.

Map the number to agentKey:
- 1 → gsd-planner
- 2 → gsd-roadmapper
- 3 → gsd-executor
- 4 → gsd-phase-researcher
- 5 → gsd-project-researcher
- 6 → gsd-research-synthesizer
- 7 → gsd-debugger
- 8 → gsd-codebase-mapper
- 9 → gsd-verifier
- 10 → gsd-plan-checker
- 11 → gsd-integration-checker
- 12 → gsd-nyquist-auditor

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

After Ollama models append — use EXACT numbers as shown, no renumbering:
```
  {N+1}. sonnet
  {N+2}. haiku
  {N+3}. inherit
  {N+4}. Type custom model name
  {N+5}. Exit / Cancel (back to role picker)
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
  10. Exit / Cancel (back to role picker)
  0. Back to profile default (currently: sonnet)
```

Output the prompt line as plain text and wait for the user's next chat message:
```
Enter number:
```

Do NOT call AskUserQuestion here. Just print the prompt and wait. The user's reply in chat is their selection.

**3c. Determine value to write**

- User entered 1..N (Ollama model) → value = `ollama:{model.name}`
- User entered number for sonnet/haiku/inherit → value = that string as-is
- User entered number for "Type custom model name":
  - Call: `AskUserQuestion(question="Enter model name (e.g. ollama:qwen2.5-coder:32b or sonnet):")`
  - value = typed string verbatim. No auto-prefix.
- User entered number for "Exit / Cancel" → go back to step 3a immediately, no assignment written
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

Call:
```
AskUserQuestion(question="Assign another role?", options=["Assign another role", "Done / Exit"])
```

If user selects "Assign another role" → go back to step 3a (skip hardware detection, keep existing hwInfo).
If user selects "Done / Exit" → break loop.
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
- [ ] Model picker shows Ollama models with sizes (if available) + cloud options + Reset + Exit/Cancel
- [ ] Assignment written via config-set-model-override
- [ ] One-line diff displayed after each assignment
- [ ] "Assign another role?" loop continues until user says No or picks Exit
- [ ] Assignment persists in .planning/config.json as model_overrides entry
- [ ] Hardware cache loaded at start; if cached, skip asking and show cached values
- [ ] Hardware detection asked only when cache is missing; result saved to hw-cache.json
- [ ] --detect-hw flag shows 3-option menu: detect/update, see current, cancel
- [ ] Role picker uses AskUserQuestion options — Exit option works correctly
- [ ] Ollama models in picker show feasibility labels when hwInfo.vram.available is true
</success_criteria>
