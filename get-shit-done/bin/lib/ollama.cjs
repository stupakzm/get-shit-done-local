/**
 * Ollama — Local LLM invocation commands
 *
 * Provides cmdOllamaList and cmdOllamaRun for the gsd-tools CLI.
 * Uses child_process to invoke the ollama binary directly; no HTTP API.
 */

'use strict';

const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { output, error, loadConfig } = require('./core.cjs');

// ─── ANSI strip regex ─────────────────────────────────────────────────────────

const ANSI_STRIP_RE = /(\x1B\[[0-9;]*[mGKHF]|\r)/g;

// ─── resolveOllamaBinary ──────────────────────────────────────────────────────

/**
 * Returns the path to the ollama binary.
 * Resolution order:
 *   1. config.ollama_path if truthy
 *   2. 'ollama' (relies on PATH — default)
 * Windows fallback to %LOCALAPPDATA%\Programs\Ollama\ollama.exe is handled
 * in the ENOENT catch handlers of cmdOllamaList / cmdOllamaRun so PATH is
 * always tried first.
 *
 * @param {string} cwd
 * @returns {string}
 */
function resolveOllamaBinary(cwd) {
  const config = loadConfig(cwd);
  if (config.ollama_path) {
    return config.ollama_path;
  }
  return 'ollama';
}

/**
 * On Windows, check the well-known local install path for ollama.exe.
 * Returns the path if it exists, otherwise null.
 *
 * @returns {string|null}
 */
function windowsFallbackBinary() {
  if (process.platform !== 'win32') return null;
  const localAppData = process.env.LOCALAPPDATA || '';
  if (!localAppData) return null;
  const candidate = path.join(localAppData, 'Programs', 'Ollama', 'ollama.exe');
  return fs.existsSync(candidate) ? candidate : null;
}

/**
 * Returns true if the error indicates the binary was not found on PATH.
 * On Unix this is ENOENT; on Windows execSync throws without ENOENT but
 * includes "is not recognized" in the message.
 *
 * @param {Error} err
 * @returns {boolean}
 */
function isBinaryNotFound(err) {
  if (err.code === 'ENOENT') return true;
  const msg = (err.stderr ? err.stderr.toString() : '') + (err.message || '');
  return msg.includes('is not recognized') || msg.includes('No such file');
}

// ─── cmdOllamaList ────────────────────────────────────────────────────────────

/**
 * List locally installed Ollama models.
 *
 * JSON output: { models: [{ name, id, size }] }
 * Raw output:  newline-separated "name (size)" lines
 *
 * @param {string} cwd
 * @param {boolean} raw
 */
function cmdOllamaList(cwd, raw) {
  let binary = resolveOllamaBinary(cwd);

  try {
    const stdout = execSync(`${binary} list`, {
      stdio: 'pipe',
      encoding: 'utf-8',
      timeout: 10000,
    });

    const lines = stdout.trim().split('\n').slice(1).filter(l => l.trim() !== '');
    const models = lines.map(line => {
      const parts = line.trim().split(/\s+/);
      const name = parts[0] || '';
      const id = parts[1] || '';
      const size = parts[2] && parts[3] ? `${parts[2]} ${parts[3]}` : (parts[2] || '');
      return { name, id, size };
    });

    const rawValue = models.map(m => `${m.name} (${m.size})`).join('\n');
    output({ models }, raw, rawValue);
  } catch (err) {
    if (isBinaryNotFound(err)) {
      // Try Windows fallback before giving up
      const fallback = windowsFallbackBinary();
      if (fallback) {
        binary = fallback;
        try {
          const stdout = execSync(`"${fallback}" list`, {
            stdio: 'pipe',
            encoding: 'utf-8',
            timeout: 10000,
          });

          const lines = stdout.trim().split('\n').slice(1).filter(l => l.trim() !== '');
          const models = lines.map(line => {
            const parts = line.trim().split(/\s+/);
            const name = parts[0] || '';
            const id = parts[1] || '';
            const size = parts[2] && parts[3] ? `${parts[2]} ${parts[3]}` : (parts[2] || '');
            return { name, id, size };
          });

          const rawValue = models.map(m => `${m.name} (${m.size})`).join('\n');
          output({ models }, raw, rawValue);
          return;
        } catch (fallbackErr) {
          if (isBinaryNotFound(fallbackErr)) {
            error('Ollama not found. Install from ollama.com or add to PATH.');
          }
          error('Ollama is not running or unreachable. Start with: ollama serve');
        }
      }
      error('Ollama not found. Install from ollama.com or add to PATH.');
    }
    error('Ollama is not running or unreachable. Start with: ollama serve');
  }
}

// ─── cmdOllamaRun ─────────────────────────────────────────────────────────────

/**
 * Run a prompt against a locally installed Ollama model.
 *
 * Raw output (always): ANSI-stripped plain text response
 *
 * @param {string} cwd
 * @param {string} modelName
 * @param {string} prompt
 * @param {boolean} raw  (reserved for future use — run always outputs plain text)
 */
function cmdOllamaRun(cwd, modelName, prompt, raw) {
  if (!modelName) {
    error('Usage: gsd-tools ollama run <model>');
  }
  if (prompt === null || prompt === undefined || prompt === '') {
    error('Prompt is required. Pass via --prompt-file or stdin.');
  }

  let binary = resolveOllamaBinary(cwd);

  // ── Pre-flight: verify model is installed ─────────────────────────────────
  try {
    const listOut = execSync(`${binary} list`, {
      stdio: 'pipe',
      encoding: 'utf-8',
      timeout: 10000,
    });

    const lines = listOut.trim().split('\n').slice(1).filter(l => l.trim() !== '');
    const installedNames = lines.map(l => l.trim().split(/\s+/)[0]).filter(Boolean);

    if (!installedNames.includes(modelName)) {
      error(`Model '${modelName}' is not installed. Install with: ollama pull ${modelName}`);
    }
  } catch (err) {
    if (isBinaryNotFound(err)) {
      const fallback = windowsFallbackBinary();
      if (fallback) {
        binary = fallback;
        // Re-run pre-flight with fallback binary
        try {
          const listOut = execSync(`"${fallback}" list`, {
            stdio: 'pipe',
            encoding: 'utf-8',
            timeout: 10000,
          });

          const lines = listOut.trim().split('\n').slice(1).filter(l => l.trim() !== '');
          const installedNames = lines.map(l => l.trim().split(/\s+/)[0]).filter(Boolean);

          if (!installedNames.includes(modelName)) {
            error(`Model '${modelName}' is not installed. Install with: ollama pull ${modelName}`);
          }
          // fallback binary works — continue to spawn below using fallback
        } catch (fallbackErr) {
          if (isBinaryNotFound(fallbackErr)) {
            error('Ollama not found. Install from ollama.com or add to PATH.');
          }
          error('Ollama is not running or unreachable. Start with: ollama serve');
        }
      } else {
        error('Ollama not found. Install from ollama.com or add to PATH.');
      }
    } else if (err.message && err.message.includes('not installed')) {
      // Re-throw structured errors from this function
      throw err;
    } else {
      error('Ollama is not running or unreachable. Start with: ollama serve');
    }
  }

  // ── Spawn and stream ──────────────────────────────────────────────────────
  const child = spawn(binary, ['run', modelName, '--nowordwrap'], {
    stdio: ['pipe', 'pipe', 'pipe'],
    shell: process.platform === 'win32',
  });

  const stdoutChunks = [];
  const stderrChunks = [];
  let timedOut = false;

  const timer = setTimeout(() => {
    timedOut = true;
    child.kill('SIGTERM');
  }, 600000);

  child.stdout.on('data', chunk => stdoutChunks.push(chunk));
  child.stderr.on('data', chunk => stderrChunks.push(chunk));

  child.on('error', err => {
    clearTimeout(timer);
    if (err.code === 'ENOENT') {
      error('Ollama not found. Install from ollama.com or add to PATH.');
    }
    error('Failed to start ollama: ' + err.message);
  });

  child.on('close', code => {
    clearTimeout(timer);
    if (timedOut) {
      error('Ollama run timed out after 600 seconds.');
    }
    if (code !== 0) {
      const stderr = Buffer.concat(stderrChunks).toString('utf-8');
      error(`Ollama exited with code ${code}: ${stderr}`);
    }
    const raw_text = Buffer.concat(stdoutChunks).toString('utf-8');
    const clean = raw_text.replace(ANSI_STRIP_RE, '');
    // Always output plain text for run command (primary use case: pipe LLM output)
    output({ response: clean }, true, clean);
  });

  // Write prompt to stdin after registering event handlers
  child.stdin.write(prompt, 'utf-8');
  child.stdin.end();
}

// ─── Exports ──────────────────────────────────────────────────────────────────

module.exports = { cmdOllamaList, cmdOllamaRun };
