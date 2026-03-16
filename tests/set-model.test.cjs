/**
 * GSD Tools Tests - config-set-model-override command group
 *
 * TDD RED phase: All stubs fail until gsd-tools.cjs implements config-set-model-override.
 * Requirements covered: EXEC-02, CMD-03, CMD-04
 */

'use strict';

const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const { runGsdTools, createTempProject, cleanup } = require('./helpers.cjs');

// ─── helpers ──────────────────────────────────────────────────────────────────

function readConfig(tmpDir) {
  const configPath = path.join(tmpDir, '.planning', 'config.json');
  return JSON.parse(fs.readFileSync(configPath, 'utf-8'));
}

function writeConfig(tmpDir, obj) {
  const configPath = path.join(tmpDir, '.planning', 'config.json');
  fs.mkdirSync(path.dirname(configPath), { recursive: true });
  fs.writeFileSync(configPath, JSON.stringify(obj, null, 2), 'utf-8');
}

// ─── config-set-model-override (EXEC-02) ──────────────────────────────────────

describe('config-set-model-override command (EXEC-02)', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
    // Start with a base config
    writeConfig(tmpDir, {
      model_profile: 'balanced',
      model_overrides: {},
    });
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('writes model_overrides.<role> to config.json', () => {
    // Test 1 (EXEC-02): config-set-model-override gsd-planner ollama:qwen2.5:7b
    // writes model_overrides.gsd-planner = "ollama:qwen2.5:7b"
    const result = runGsdTools(
      ['config-set-model-override', 'gsd-planner', 'ollama:qwen2.5:7b'],
      tmpDir
    );
    assert.ok(result.success, `Command should succeed: ${result.error}`);

    const config = readConfig(tmpDir);
    assert.strictEqual(
      config.model_overrides['gsd-planner'],
      'ollama:qwen2.5:7b',
      'model_overrides.gsd-planner should be set to ollama:qwen2.5:7b'
    );
  });

  test('deletes model_overrides.<role> from config.json when value is "reset"', () => {
    // Test 2 (EXEC-02): config-set-model-override gsd-executor reset
    // deletes model_overrides.gsd-executor key from config.json entirely
    writeConfig(tmpDir, {
      model_profile: 'balanced',
      model_overrides: {
        'gsd-executor': 'ollama:qwen2.5:7b',
        'gsd-planner': 'sonnet',
      },
    });

    const result = runGsdTools(
      ['config-set-model-override', 'gsd-executor', 'reset'],
      tmpDir
    );
    assert.ok(result.success, `Command should succeed: ${result.error}`);

    const config = readConfig(tmpDir);
    assert.ok(
      !('gsd-executor' in (config.model_overrides || {})),
      'gsd-executor key should be deleted from model_overrides'
    );
    // Other overrides should be preserved
    assert.strictEqual(config.model_overrides['gsd-planner'], 'sonnet');
  });
});

// ─── resolve-model passthrough after override (EXEC-02) ───────────────────────

describe('resolve-model reflects config-set-model-override assignments (EXEC-02)', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
    writeConfig(tmpDir, {
      model_profile: 'balanced',
      model_overrides: {},
    });
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('resolve-model returns the overridden ollama model after override is set', () => {
    // Test 3 (EXEC-02): After override, resolve-model gsd-planner returns ollama:qwen2.5:7b
    const setResult = runGsdTools(
      ['config-set-model-override', 'gsd-planner', 'ollama:qwen2.5:7b'],
      tmpDir
    );
    assert.ok(setResult.success, `config-set-model-override should succeed: ${setResult.error}`);

    const resolveResult = runGsdTools(['resolve-model', 'gsd-planner'], tmpDir);
    assert.ok(resolveResult.success, `resolve-model should succeed: ${resolveResult.error}`);

    const parsed = JSON.parse(resolveResult.output);
    assert.strictEqual(
      parsed.model,
      'ollama:qwen2.5:7b',
      'resolve-model should return the ollama override'
    );
    assert.ok(
      !parsed.model.startsWith('ollama:') === false,
      'resolved model should start with ollama:'
    );
  });

  test('resolve-model returns profile default (not ollama:*) after reset', () => {
    // Test 4 (EXEC-02): After reset, resolve-model gsd-planner returns the profile default
    // First set an override
    runGsdTools(['config-set-model-override', 'gsd-planner', 'ollama:qwen2.5:7b'], tmpDir);
    // Then reset
    const resetResult = runGsdTools(
      ['config-set-model-override', 'gsd-planner', 'reset'],
      tmpDir
    );
    assert.ok(resetResult.success, `reset should succeed: ${resetResult.error}`);

    const resolveResult = runGsdTools(['resolve-model', 'gsd-planner'], tmpDir);
    assert.ok(resolveResult.success, `resolve-model should succeed: ${resolveResult.error}`);

    const parsed = JSON.parse(resolveResult.output);
    assert.ok(
      !parsed.model.startsWith('ollama:'),
      `resolved model should not start with ollama: after reset, got: ${parsed.model}`
    );
  });
});

// ─── config-get model_overrides (CMD-03) ──────────────────────────────────────

describe('config-get model_overrides (CMD-03)', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
    writeConfig(tmpDir, {
      model_profile: 'balanced',
      model_overrides: {},
    });
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('config-get model_overrides returns current overrides object (or empty object)', () => {
    // Test 5 (CMD-03): config-get model_overrides returns the current overrides object
    const result = runGsdTools(['config-get', 'model_overrides'], tmpDir);
    assert.ok(result.success, `config-get model_overrides should succeed: ${result.error}`);

    const parsed = JSON.parse(result.output);
    assert.ok(
      parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed),
      `model_overrides should be an object, got: ${JSON.stringify(parsed)}`
    );
  });
});

// ─── previousValue diff in --raw output (CMD-04) ─────────────────────────────

describe('config-set-model-override --raw output includes previousValue (CMD-04)', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
    writeConfig(tmpDir, {
      model_profile: 'balanced',
      model_overrides: {
        'gsd-planner': 'ollama:qwen2.5:7b',
      },
    });
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('--raw flag returns JSON with previousValue reflecting prior assignment', () => {
    // Test 6 (CMD-04): config-set-model-override gsd-planner sonnet --raw
    // returns JSON with previousValue field reflecting the prior assignment
    const result = runGsdTools(
      ['config-set-model-override', 'gsd-planner', 'sonnet'],
      tmpDir
    );
    assert.ok(result.success, `Command should succeed: ${result.error}`);

    const parsed = JSON.parse(result.output);
    assert.ok(
      'previousValue' in parsed,
      `Output JSON should have a previousValue field, got: ${JSON.stringify(parsed)}`
    );
    assert.strictEqual(
      parsed.previousValue,
      'ollama:qwen2.5:7b',
      'previousValue should reflect the prior assignment'
    );
  });
});
