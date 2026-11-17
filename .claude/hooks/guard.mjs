#!/usr/bin/env node
// Project guard: a Claude Code PreToolUse hook that enforces .claude/guardrails.json.
//
//   never -> the tool call is blocked (exit 2; the reason goes back to the model)
//   ask   -> the user is asked to confirm (permissionDecision "ask")
//   else  -> silent, so the normal permission flow applies
//
// File tools (Write/Edit/MultiEdit/NotebookEdit) are matched exactly by path.
// Shell tools (Bash/PowerShell) are matched by command regex, plus a best-effort
// "ask" when a command mentions a never-path. A shell command can always be
// phrased to dodge a pattern, so treat the shell side as a tripwire, not a wall.
//
// Installed at <project>/.claude/hooks/guard.mjs; the project root is two levels up.
// Try a rule without the harness:  node .claude/hooks/guard.mjs --check Write secrets/key.txt

import { readFileSync } from 'node:fs';
import { dirname, resolve, relative, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';
import { homedir } from 'node:os';

const HERE = dirname(fileURLToPath(import.meta.url));
const PROJECT = resolve(HERE, '..', '..');
const CONFIG = resolve(PROJECT, '.claude', 'guardrails.json');
const FILE_TOOLS = new Set(['Write', 'Edit', 'MultiEdit', 'NotebookEdit']);
const SHELL_TOOLS = new Set(['Bash', 'PowerShell']);
// The guard's own files: editing them always asks, so rules can't be loosened quietly.
const SELF = ['.claude/guardrails.json', '.claude/hooks/', '.claude/settings.json', '.claude/settings.local.json'];

const slash = (p) => p.replace(/\\/g, '/');

function fixDrive(p) {
  // Git Bash style /c/dev/x -> c:/dev/x
  if (process.platform === 'win32' && /^\/[a-zA-Z]\//.test(p)) return `${p[1]}:${p.slice(2)}`;
  return p;
}

function expandPattern(pat) {
  let p = slash(String(pat).trim());
  if (p.startsWith('~/')) p = slash(homedir()) + p.slice(1);
  p = fixDrive(p);
  const absolute = /^[a-zA-Z]:\//.test(p) || p.startsWith('/');
  if (!absolute) p = p.replace(/^\.\//, '');
  if (p.endsWith('/')) p += '**';
  if (!absolute && !p.includes('/')) p = '**/' + p; // bare name: any depth
  return { p, absolute };
}

function globToRegex(glob) {
  let re = '';
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i];
    if (c === '*' && glob[i + 1] === '*') {
      if (glob[i + 2] === '/') { re += '(?:.*/)?'; i += 2; } else { re += '.*'; i += 1; }
    } else if (c === '*') re += '[^/]*';
    else if (c === '?') re += '[^/]';
    else re += c.replace(/[.+^${}()|[\]\\]/g, '\\$&');
  }
  return new RegExp(`^${re}$`, 'i');
}

// A path and every folder above it, so a rule naming a folder covers what is inside.
function withAncestors(p) {
  const parts = p.split('/').filter(Boolean);
  const out = [];
  for (let i = parts.length; i > 0; i--) out.push(parts.slice(0, i).join('/'));
  return out;
}

function matchPath(absPath, patterns) {
  const abs = slash(absPath);
  const rel = slash(relative(PROJECT, absPath));
  const inside = rel && !rel.startsWith('..') && !isAbsolute(rel);
  for (const pat of patterns || []) {
    const { p, absolute } = expandPattern(pat);
    const rx = globToRegex(p);
    if (absolute) {
      const lead = abs.startsWith('/') ? '/' : '';
      if (withAncestors(abs).some((c) => rx.test(lead + c))) return pat;
    } else if (inside && withAncestors(rel).some((c) => rx.test(c))) return pat;
  }
  return null;
}

function matchCommand(command, regexes) {
  for (const src of regexes || []) {
    if (new RegExp(src, 'i').test(command)) return src;
  }
  return null;
}

// The fixed text at the start of a path rule, e.g. "secrets/" or ".env".
function literalOf(pat) {
  const lit = slash(String(pat)).replace(/^~\//, '').replace(/^\.\//, '').split(/[*?]/)[0];
  return lit.length >= 4 ? lit.toLowerCase() : null;
}

function loadConfig() {
  let raw;
  try {
    raw = readFileSync(CONFIG, 'utf8').replace(/^\uFEFF/, '');
  } catch {
    return { cfg: { never: {}, ask: {} }, error: null }; // no rules file: only self-protection
  }
  try {
    const cfg = JSON.parse(raw);
    for (const bucket of ['never', 'ask']) {
      cfg[bucket] ??= {};
      for (const src of cfg[bucket].commands || []) new RegExp(src, 'i'); // validate now
    }
    return { cfg, error: null };
  } catch (e) {
    return { cfg: null, error: `.claude/guardrails.json is invalid (${e.message})` };
  }
}

function decide(tool, input, cwd) {
  if (!FILE_TOOLS.has(tool) && !SHELL_TOOLS.has(tool)) return { decision: 'allow' };
  const { cfg, error } = loadConfig();
  if (error) {
    // Broken rules must not silently mean "no rules"; asking still lets the user approve a fix.
    return { decision: 'ask', reason: `${error}. The guard cannot check this action, so confirm it yourself.` };
  }

  if (FILE_TOOLS.has(tool)) {
    const target = input?.file_path ?? input?.notebook_path ?? input?.path;
    if (!target) return { decision: 'allow' };
    const abs = resolve(cwd || PROJECT, fixDrive(String(target)));
    let hit = matchPath(abs, cfg.never.paths);
    if (hit) return { decision: 'deny', reason: `"${target}" is covered by the never-do rule "${hit}"` };
    hit = matchPath(abs, cfg.ask.paths);
    if (hit) return { decision: 'ask', reason: `"${target}" is covered by the ask-first rule "${hit}"` };
    hit = matchPath(abs, SELF);
    if (hit) return { decision: 'ask', reason: `"${target}" is part of the guard itself; changing it changes what is enforced` };
    return { decision: 'allow' };
  }

  const command = String(input?.command ?? '');
  if (!command) return { decision: 'allow' };
  let hit = matchCommand(command, cfg.never.commands);
  if (hit) return { decision: 'deny', reason: `the command matches the never-do rule /${hit}/` };
  hit = matchCommand(command, cfg.ask.commands);
  if (hit) return { decision: 'ask', reason: `the command matches the ask-first rule /${hit}/` };
  const flat = slash(command).toLowerCase();
  for (const pat of cfg.never.paths || []) {
    const lit = literalOf(pat);
    if (lit && flat.includes(lit)) {
      return { decision: 'ask', reason: `the command mentions "${lit}", which the never-do rule "${pat}" protects from edits` };
    }
  }
  return { decision: 'allow' };
}

// ---- entry points ----------------------------------------------------------

const args = process.argv.slice(2);
if (args[0] === '--check') {
  const tool = args[1];
  const value = args.slice(2).join(' ');
  if (!tool || !value) {
    console.log('usage: node guard.mjs --check <Write|Edit|Bash|PowerShell> <path or command>');
    process.exit(1);
  }
  const input = SHELL_TOOLS.has(tool) ? { command: value } : { file_path: value };
  const r = decide(tool, input, process.cwd());
  console.log(`${r.decision.toUpperCase()}${r.reason ? ': ' + r.reason : ''}`);
  process.exit(0);
}

let event;
try {
  event = JSON.parse(readFileSync(0, 'utf8'));
} catch (e) {
  console.error(`guard.mjs: could not read the hook input (${e.message}); this action was NOT checked.`);
  process.exit(1); // non-blocking error, but visible
}

const result = decide(event.tool_name, event.tool_input, event.cwd);
if (result.decision === 'deny') {
  console.error(
    `Blocked by the project guard: ${result.reason}. This is a hard rule the user set in ` +
    `.claude/guardrails.json. Do not attempt it another way; tell the user what you wanted to do and why.`
  );
  process.exit(2);
}
if (result.decision === 'ask') {
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'ask',
      permissionDecisionReason: `Project guard: ${result.reason}.`,
    },
  }));
}
process.exit(0);
