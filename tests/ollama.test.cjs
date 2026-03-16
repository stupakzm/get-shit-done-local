/**
 * GSD Tools Tests - ollama command group
 *
 * TDD RED phase: All stubs fail until ollama.cjs is implemented (Wave 1 Plans 02/03).
 * Requirements covered: EXEC-01, EXEC-03, EXEC-04, EXEC-05
 */

'use strict';

const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFileSync } = require('child_process');

const { runGsdTools, createTempProject, cleanup, TOOLS_PATH } = require('./helpers.cjs');

// ─── Mock binary helper ────────────────────────────────────────────────────────

/**
 * Create a mock `ollama` binary (or .cmd on Windows) in the given directory.
 * The script content controls what the mock does: exit code, stdout, stderr.
 *
 * @param {string} dir   - Directory to write the mock into
 * @param {string} script - Shell script body (after shebang on Unix / .cmd body on Windows)
 * @returns {string} tempBinDir - Directory containing the mock binary
 */
function createMockBin(dir, script) {
  const binDir = path.join(dir, 'mock-bin');
  fs.mkdirSync(binDir, { recursive: true });

  if (process.platform === 'win32') {
    // Windows: write a .cmd file
    const batPath = path.join(binDir, 'ollama.cmd');
    fs.writeFileSync(batPath, script);
  } else {
    // Unix: write a shell script with shebang
    const scriptPath = path.join(binDir, 'ollama');
    fs.writeFileSync(scriptPath, `#!/bin/sh\n${script}`);
    fs.chmodSync(scriptPath, 0o755);
  }

  return binDir;
}

/**
 * Run gsd-tools with a custom PATH that injects a mock ollama binary.
 *
 * @param {string[]} args
 * @param {string} cwd
 * @param {string} mockBinDir
 * @returns {{ success: boolean, output: string, error?: string }}
 */
function runGsdToolsWithMockBin(args, cwd, mockBinDir, envOverrides = {}) {
  const customPath = mockBinDir + path.delimiter + process.env.PATH;
  try {
    const result = execFileSync(process.execPath, [TOOLS_PATH, ...args], {
      cwd,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, PATH: customPath, ...envOverrides },
    });
    return { success: true, output: result.trim() };
  } catch (err) {
    return {
      success: false,
      output: err.stdout?.toString().trim() || '',
      error: err.stderr?.toString().trim() || err.message,
    };
  }
}

// ─── EXEC-01: ollama list ──────────────────────────────────────────────────────

describe('EXEC-01: ollama list', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('EXEC-01: list success — returns JSON with models array', () => {
    // Mock ollama that outputs list in expected format
    const mockScript = process.platform === 'win32'
      ? '@echo NAME                    \tID            \tSIZE  \tMODIFIED\r\n@echo llama3.2:latest          \tabc123        \t2.0 GB\t2 hours ago\r\n@exit /b 0'
      : 'echo "NAME                    \tID            \tSIZE  \tMODIFIED"\necho "llama3.2:latest          \tabc123        \t2.0 GB\t2 hours ago"\nexit 0';

    const mockBinDir = createMockBin(tmpDir, mockScript);
    const result = runGsdToolsWithMockBin(['ollama', 'list'], tmpDir, mockBinDir);

    assert.ok(result.success, `Expected success but got error: ${result.error || result.output}`);

    const parsed = JSON.parse(result.output);
    assert.ok(Array.isArray(parsed.models), 'output.models should be an array');
    assert.ok(parsed.models.length > 0, 'models array should be non-empty');
    assert.ok(typeof parsed.models[0].name === 'string', 'each model should have a name');
    assert.ok(typeof parsed.models[0].size === 'string', 'each model should have a size');
  });

  test('EXEC-01: list --raw — returns newline-separated "name (size)" lines', () => {
    const mockScript = process.platform === 'win32'
      ? '@echo NAME                    \tID            \tSIZE  \tMODIFIED\r\n@echo llama3.2:latest          \tabc123        \t2.0 GB\t2 hours ago\r\n@exit /b 0'
      : 'echo "NAME                    \tID            \tSIZE  \tMODIFIED"\necho "llama3.2:latest          \tabc123        \t2.0 GB\t2 hours ago"\nexit 0';

    const mockBinDir = createMockBin(tmpDir, mockScript);
    const result = runGsdToolsWithMockBin(['ollama', 'list', '--raw'], tmpDir, mockBinDir);

    assert.ok(result.success, `Expected success but got error: ${result.error || result.output}`);
    // Should be plain text lines, not JSON
    assert.ok(result.output.includes('('), 'raw output should contain "name (size)" format');
    assert.throws(() => JSON.parse(result.output), 'raw output should not be valid JSON');
  });

  test('EXEC-01: list error — daemon down: output contains "not running" and "ollama serve"', () => {
    // Mock ollama that exits with non-zero (daemon down)
    const mockScript = process.platform === 'win32'
      ? '@echo Error: could not connect to ollama app, is it running? 1>&2\r\n@exit /b 1'
      : 'echo "Error: could not connect to ollama app, is it running?" >&2\nexit 1';

    const mockBinDir = createMockBin(tmpDir, mockScript);
    const result = runGsdToolsWithMockBin(['ollama', 'list'], tmpDir, mockBinDir);

    assert.ok(!result.success, 'Expected failure when daemon is down');
    const combinedOutput = (result.output + ' ' + (result.error || '')).toLowerCase();
    assert.ok(combinedOutput.includes('not running'), 'output should contain "not running"');
    assert.ok(combinedOutput.includes('ollama serve'), 'output should contain "ollama serve"');
  });

  test('EXEC-01: list error — binary missing: output contains "not found" and "ollama.com"', () => {
    // Strip ollama from PATH entirely: set PATH to only an empty dir
    // Also override LOCALAPPDATA so the Windows fallback path doesn't resolve
    const emptyBinDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-empty-bin-'));
    try {
      const result = runGsdToolsWithMockBin(['ollama', 'list'], tmpDir, emptyBinDir, {
        PATH: emptyBinDir,
        LOCALAPPDATA: emptyBinDir,
      });

      assert.ok(!result.success, 'Expected failure when binary is missing');
      const combinedOutput = (result.output + ' ' + (result.error || '')).toLowerCase();
      assert.ok(combinedOutput.includes('not found'), 'output should contain "not found"');
      assert.ok(combinedOutput.includes('ollama.com'), 'output should contain "ollama.com"');
    } finally {
      fs.rmSync(emptyBinDir, { recursive: true, force: true });
    }
  });
});

// ─── EXEC-03: ollama run success ───────────────────────────────────────────────

describe('EXEC-03: ollama run', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('EXEC-03: run success — returns stripped text response with exit 0', () => {
    const promptFile = path.join(tmpDir, 'prompt.txt');
    fs.writeFileSync(promptFile, 'Say hello');

    // Mock ollama list (model exists) then run
    const mockScript = process.platform === 'win32'
      ? [
          '@if "%~1"=="list" (',
          '  @echo NAME                    \tID            \tSIZE  \tMODIFIED',
          '  @echo llama3.2:latest          \tabc123        \t2.0 GB\t2 hours ago',
          '  @exit /b 0',
          ')',
          '@if "%~1"=="run" (',
          '  @echo Hello! How can I help you today?',
          '  @exit /b 0',
          ')',
          '@exit /b 0',
        ].join('\r\n')
      : [
          'if [ "$1" = "list" ]; then',
          '  echo "NAME                    \tID            \tSIZE  \tMODIFIED"',
          '  echo "llama3.2:latest          \tabc123        \t2.0 GB\t2 hours ago"',
          '  exit 0',
          'fi',
          'if [ "$1" = "run" ]; then',
          '  echo "Hello! How can I help you today?"',
          '  exit 0',
          'fi',
          'exit 0',
        ].join('\n');

    const mockBinDir = createMockBin(tmpDir, mockScript);
    const result = runGsdToolsWithMockBin(
      ['ollama', 'run', 'llama3.2:latest', '--prompt-file', promptFile],
      tmpDir,
      mockBinDir
    );

    assert.ok(result.success, `Expected success but got error: ${result.error || result.output}`);
    assert.ok(result.output.length > 0, 'response should be non-empty');
    // Should be stripped plain text, not wrapped in JSON or markdown
    assert.ok(!result.output.startsWith('{'), 'response should not be JSON');
  });
});

// ─── EXEC-04: ollama run — daemon down ────────────────────────────────────────

describe('EXEC-04: ollama run — daemon down', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('EXEC-04: run error — daemon down: output contains "not running" and "ollama serve"', () => {
    const promptFile = path.join(tmpDir, 'prompt.txt');
    fs.writeFileSync(promptFile, 'Say hello');

    // Mock ollama that always fails (daemon down)
    const mockScript = process.platform === 'win32'
      ? '@echo Error: could not connect to ollama app, is it running? 1>&2\r\n@exit /b 1'
      : 'echo "Error: could not connect to ollama app, is it running?" >&2\nexit 1';

    const mockBinDir = createMockBin(tmpDir, mockScript);
    const result = runGsdToolsWithMockBin(
      ['ollama', 'run', 'llama3.2:latest', '--prompt-file', promptFile],
      tmpDir,
      mockBinDir
    );

    assert.ok(!result.success, 'Expected failure when daemon is down');
    const combinedOutput = (result.output + ' ' + (result.error || '')).toLowerCase();
    assert.ok(combinedOutput.includes('not running'), 'output should contain "not running"');
    assert.ok(combinedOutput.includes('ollama serve'), 'output should contain "ollama serve"');
  });
});

// ─── EXEC-05: ollama run — model not installed ────────────────────────────────

describe('EXEC-05: ollama run — model not installed', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('EXEC-05: run error — model not installed: error contains "not installed" and "ollama pull"', () => {
    const promptFile = path.join(tmpDir, 'prompt.txt');
    fs.writeFileSync(promptFile, 'Say hello');

    // Mock ollama list returns empty (model absent), run would never be reached
    const mockScript = process.platform === 'win32'
      ? [
          '@if "%~1"=="list" (',
          '  @echo NAME                    \tID            \tSIZE  \tMODIFIED',
          '  @exit /b 0',
          ')',
          '@exit /b 0',
        ].join('\r\n')
      : [
          'if [ "$1" = "list" ]; then',
          '  echo "NAME                    \tID            \tSIZE  \tMODIFIED"',
          '  exit 0',
          'fi',
          'exit 0',
        ].join('\n');

    const mockBinDir = createMockBin(tmpDir, mockScript);
    const result = runGsdToolsWithMockBin(
      ['ollama', 'run', 'nonexistent-model:latest', '--prompt-file', promptFile],
      tmpDir,
      mockBinDir
    );

    assert.ok(!result.success, 'Expected failure when model is not installed');
    const combinedOutput = (result.output + ' ' + (result.error || '')).toLowerCase();
    assert.ok(combinedOutput.includes('not installed'), 'output should contain "not installed"');
    assert.ok(combinedOutput.includes('ollama pull'), 'output should contain "ollama pull"');
  });
});

// ─── Mock nvidia-smi helper ────────────────────────────────────────────────────

/**
 * Create a mock `nvidia-smi` binary (or .cmd on Windows) in a `mock-bin` subdirectory
 * of the given directory. The mock outputs vramMb on stdout and exits 0.
 *
 * @param {string} dir    - Parent directory under which to create mock-bin/
 * @param {string} vramMb - Value(s) to echo as stdout (e.g. "6144" or "6144\n2048")
 * @returns {string} binDir - Directory containing the mock nvidia-smi binary
 */
function createMockNvidiaSmi(dir, vramMb) {
  const binDir = path.join(dir, 'mock-bin');
  fs.mkdirSync(binDir, { recursive: true });

  if (process.platform === 'win32') {
    // Windows: .cmd file — echo each line of vramMb value
    const lines = String(vramMb).split('\n');
    const echoLines = lines.map(l => `@echo ${l}`).join('\r\n');
    fs.writeFileSync(path.join(binDir, 'nvidia-smi.cmd'), `${echoLines}\r\n@exit /b 0`);
  } else {
    // Unix: executable shell script
    const p = path.join(binDir, 'nvidia-smi');
    fs.writeFileSync(p, `#!/bin/sh\nprintf '%s\\n' ${JSON.stringify(String(vramMb))}\nexit 0`);
    fs.chmodSync(p, 0o755);
  }

  return binDir;
}

// ─── HW-01: ollama hw-detect ───────────────────────────────────────────────────

describe('HW-01: ollama hw-detect', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('HW-01-a: hw-detect with nvidia-smi success — JSON has vram.available true, mb 6144, gb 6.0, source nvidia-smi; ram.gb is positive', () => {
    const mockNvidiaBinDir = createMockNvidiaSmi(tmpDir, '6144');

    const result = runGsdToolsWithMockBin(['ollama', 'hw-detect'], tmpDir, mockNvidiaBinDir);

    assert.ok(result.success, `Expected success but got: ${result.error || result.output}`);

    const parsed = JSON.parse(result.output);
    assert.strictEqual(parsed.vram.available, true, 'vram.available should be true');
    assert.strictEqual(parsed.vram.mb, 6144, 'vram.mb should be 6144');
    assert.strictEqual(parsed.vram.gb, 6.0, 'vram.gb should be 6.0');
    assert.strictEqual(parsed.vram.source, 'nvidia-smi', 'vram.source should be nvidia-smi');
    assert.ok(typeof parsed.ram.gb === 'number' && parsed.ram.gb > 0, 'ram.gb should be a positive number');
  });

  test('HW-01-b: hw-detect with nvidia-smi absent — command exits 0 (non-fatal), vram.available false, ram.available true', () => {
    // Create an empty bin dir with no nvidia-smi inside
    const emptyBinDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-empty-nvidia-'));
    try {
      const result = runGsdToolsWithMockBin(['ollama', 'hw-detect'], tmpDir, emptyBinDir, {
        PATH: emptyBinDir,
      });

      assert.ok(result.success === true, `Expected success (non-fatal) but command failed: ${result.error || result.output}`);

      const parsed = JSON.parse(result.output);
      assert.strictEqual(parsed.vram.available, false, 'vram.available should be false when nvidia-smi absent');
      assert.strictEqual(parsed.ram.available, true, 'ram.available should be true');
    } finally {
      fs.rmSync(emptyBinDir, { recursive: true, force: true });
    }
  });

  test('HW-01-c: hw-detect with multi-GPU nvidia-smi output — vram.mb equals max (6144), not sum or first-only', () => {
    // Mock nvidia-smi that returns two GPU lines
    const mockNvidiaBinDir = createMockNvidiaSmi(tmpDir, '6144\n2048');

    const result = runGsdToolsWithMockBin(['ollama', 'hw-detect'], tmpDir, mockNvidiaBinDir);

    assert.ok(result.success, `Expected success but got: ${result.error || result.output}`);

    const parsed = JSON.parse(result.output);
    assert.strictEqual(parsed.vram.mb, 6144, 'vram.mb should be the maximum GPU value (6144), not 2048 or 8192');
  });
});

// ─── HW-02: parseSizeGb helper ─────────────────────────────────────────────────

describe('HW-02: parseSizeGb helper', () => {
  // parseSizeGb is not yet exported — requiring it here causes RED failure as expected
  const { parseSizeGb } = require('../get-shit-done/bin/lib/ollama.cjs');

  test('HW-02-a: parseSizeGb("4.7 GB") returns 4.7', () => {
    assert.strictEqual(parseSizeGb('4.7 GB'), 4.7);
  });

  test('HW-02-b: parseSizeGb("2.0 GB") returns 2.0', () => {
    assert.strictEqual(parseSizeGb('2.0 GB'), 2.0);
  });

  test('HW-02-c: parseSizeGb("800 MB") returns approximately 0.78 (800/1024, within 0.01 tolerance)', () => {
    assert.ok(
      Math.abs(parseSizeGb('800 MB') - (800 / 1024)) < 0.01,
      'MB conversion within 0.01 GB'
    );
  });

  test('HW-02-d: parseSizeGb("unknown") returns null', () => {
    assert.strictEqual(parseSizeGb('unknown'), null);
  });
});
