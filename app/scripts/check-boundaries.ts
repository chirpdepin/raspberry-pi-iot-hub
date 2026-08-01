#!/usr/bin/env node
/**
 * check-boundaries.ts — makes the five contracts in app/electron.md enforceable.
 *
 * Contracts stated in a document are advisory. Contracts checked in CI are real.
 * This script is the difference, and it is written BEFORE the app code exists so
 * that the rules pre-date anything that could break them.
 *
 * Run:  npx tsx scripts/check-boundaries.ts
 *       npx tsx scripts/check-boundaries.ts --self-test
 *
 * --self-test plants a violation of every rule in a temporary tree and asserts
 * each one is caught. A checker nobody has seen fail is a checker nobody should
 * trust.
 */

import { readFileSync, readdirSync, statSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join, relative, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const APP_ROOT = join(HERE, '..');

interface Violation {
  rule: string;
  file: string;
  line: number;
  detail: string;
}

interface Rule {
  id: string;
  /** Human-readable statement of what this protects, shown when it fires. */
  why: string;
  /** Which files this rule inspects, relative to src/. */
  applies: (relPath: string) => boolean;
  check: (relPath: string, lines: string[]) => Violation[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const SOURCE_EXT = new Set(['.ts', '.tsx', '.js', '.jsx', '.mts', '.cts']);

/** Normalise to POSIX separators so the rules read the same on every platform. */
const norm = (p: string) => p.split(sep).join('/');

function walk(dir: string, out: string[] = []): string[] {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const entry of entries) {
    if (entry === 'node_modules' || entry === 'dist' || entry === 'out' || entry.startsWith('.')) {
      continue;
    }
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (SOURCE_EXT.has(extname(entry))) out.push(full);
  }
  return out;
}

/** Import specifiers from `import ... from 'x'`, `export ... from 'x'`, `import('x')`. */
function importsIn(lines: string[]): { spec: string; line: number }[] {
  const found: { spec: string; line: number }[] = [];
  const patterns = [
    /(?:^|\s)(?:import|export)\s[^;]*?from\s+['"]([^'"]+)['"]/,
    /(?:^|\s)import\s+['"]([^'"]+)['"]/,
    /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/,
    /\brequire\s*\(\s*['"]([^'"]+)['"]\s*\)/,
  ];
  lines.forEach((text, i) => {
    if (isComment(text)) return;
    for (const re of patterns) {
      const spec = text.match(re)?.[1];
      if (spec) found.push({ spec, line: i + 1 });
    }
  });
  return found;
}

function isComment(text: string): boolean {
  const t = text.trim();
  return t.startsWith('//') || t.startsWith('*') || t.startsWith('/*');
}

/** Strip string and template literals so patterns don't match inside them. */
function withoutStrings(text: string): string {
  return text.replace(/'[^']*'|"[^"]*"|`[^`]*`/g, "''");
}

const NODE_BUILTINS = new Set([
  'fs',
  'path',
  'os',
  'child_process',
  'net',
  'http',
  'https',
  'crypto',
  'stream',
  'util',
  'events',
  'url',
  'zlib',
  'dns',
  'tls',
  'worker_threads',
  'cluster',
]);

const isNodeBuiltin = (spec: string) => spec.startsWith('node:') || NODE_BUILTINS.has(spec.split('/')[0] ?? spec);

// ---------------------------------------------------------------------------
// Contract 1 — SOLID layering
// ---------------------------------------------------------------------------

/** Import group: 0 external, 1 internal alias, 2 relative. */
const importGroupOf = (spec: string): number => {
  if (spec.startsWith('.')) return 2;
  if (spec.startsWith('@renderer/') || spec.startsWith('@main/') || spec.startsWith('@shared/')) return 1;
  return 0;
};

const rules: Rule[] = [
  {
    id: 'domain-is-pure',
    why: 'domain/ is the one layer with no dependencies. Anything it imports becomes something every test must stand up.',
    applies: (p) => p.startsWith('main/domain/'),
    check: (p, lines) =>
      importsIn(lines)
        .filter(({ spec }) => {
          if (spec.startsWith('.')) {
            // Relative imports are fine only while they stay inside domain/.
            return spec.includes('../') && !norm(join(dirname(p), spec)).startsWith('main/domain/');
          }
          return true; // any bare package import at all
        })
        .map(({ spec, line }) => ({
          rule: 'domain-is-pure',
          file: p,
          line,
          detail: `domain/ must not import "${spec}"`,
        })),
  },
  {
    id: 'usecase-depends-on-ports',
    why: 'A use case that imports an adapter is bound to one implementation and can no longer be tested with fakes. This is the dependency rule the Go services follow.',
    applies: (p) => p.startsWith('main/usecase/'),
    check: (p, lines) =>
      importsIn(lines)
        .filter(({ spec }) => {
          if (spec.includes('adapters/') || spec === 'electron' || spec.startsWith('electron/')) return true;
          if (spec === 'dockerode' || spec === 'serialport') return true;
          if (isNodeBuiltin(spec)) return true;
          return false;
        })
        .map(({ spec, line }) => ({
          rule: 'usecase-depends-on-ports',
          file: p,
          line,
          detail: `use cases must depend on ports, not "${spec}" — declare a port in contract.ts`,
        })),
  },
  {
    id: 'usecase-has-test',
    why: 'The test IS the proof that the layering works. A use case with no test is a use case nobody has shown can run without Docker.',
    applies: () => false, // directory-level; handled separately
    check: () => [],
  },
  {
    id: 'renderer-has-no-node',
    why: 'The renderer runs with sandbox:true and contextIsolation:true. Reaching Node from it is both impossible at runtime and a security regression if it ever became possible.',
    applies: (p) => p.startsWith('renderer/'),
    check: (p, lines) => {
      const out: Violation[] = [];
      importsIn(lines).forEach(({ spec, line }) => {
        if (spec.includes('main/') || spec === 'dockerode' || spec === 'electron' || isNodeBuiltin(spec)) {
          out.push({
            rule: 'renderer-has-no-node',
            file: p,
            line,
            detail: `renderer must not import "${spec}" — go through the preload IPC contract`,
          });
        }
      });
      lines.forEach((text, i) => {
        if (!isComment(text) && /\brequire\s*\(/.test(withoutStrings(text))) {
          out.push({
            rule: 'renderer-has-no-node',
            file: p,
            line: i + 1,
            detail: 'require() in the renderer',
          });
        }
      });
      return out;
    },
  },

  // -----------------------------------------------------------------------
  // Contract 4 — single source of truth
  // -----------------------------------------------------------------------
  {
    id: 'no-hardcoded-color',
    why: 'Colors live in the ui-kit theme so a rebrand is one change. A hex committed into a component is a color that will be wrong after the next rebrand and will not be found by searching for the new one.',
    // The theme setup file is where colour literals are legitimate — it is the
    // one place that adapts ui-kit tokens. Everything else must read the theme.
    applies: (p) => p.startsWith('renderer/') && !p.includes('/theme/'),
    check: (p, lines) => {
      const out: Violation[] = [];
      lines.forEach((text, i) => {
        if (isComment(text)) return;
        const hex = text.match(/#[0-9a-fA-F]{3,8}\b/);
        if (hex && !/^\s*(import|\/\/)/.test(text)) {
          out.push({
            rule: 'no-hardcoded-color',
            file: p,
            line: i + 1,
            detail: `hardcoded color ${hex[0]} — use the theme palette`,
          });
        }
        const fn = text.match(/\brgba?\s*\(/);
        if (fn) {
          out.push({
            rule: 'no-hardcoded-color',
            file: p,
            line: i + 1,
            detail: 'hardcoded rgb()/rgba() — use the theme palette',
          });
        }
      });
      return out;
    },
  },
  {
    id: 'no-hardcoded-path',
    why: 'System paths come from PathsPort so the same code runs on Ubuntu Server today and Ubuntu Core later, where these become $SNAP_DATA.',
    // Tests are exempt: asserting that PathsPort produces "/etc/iot-hub/..." is
    // exactly how we prove the port is correct, and that assertion has to name
    // the concrete value.
    applies: (p) =>
      !p.startsWith('main/adapters/paths/') && !p.startsWith('main/config/') && !p.endsWith('.test.ts'),
    check: (p, lines) => {
      const out: Violation[] = [];
      lines.forEach((text, i) => {
        if (isComment(text)) return;
        const m = text.match(/['"](\/(?:etc|usr\/local|var\/lib|opt)\/[^'"]*)['"]/);
        if (m) {
          out.push({
            rule: 'no-hardcoded-path',
            file: p,
            line: i + 1,
            detail: `hardcoded system path "${m[1]}" — resolve it through PathsPort`,
          });
        }
      });
      return out;
    },
  },
  {
    id: 'no-inline-image-tag',
    why: 'A container image tag written in two places drifts. One definition in config/images.ts is what makes a version bump reviewable.',
    // Tests are exempt: asserting the tag a use case returns is how that
    // behaviour is proven, and the assertion has to name the value.
    applies: (p) => !p.startsWith('main/config/') && !p.endsWith('.test.ts'),
    check: (p, lines) => {
      const out: Violation[] = [];
      const known = /(eclipse-mosquitto|koenkk\/zigbee2mqtt|openthread\/otbr|xoseperez\/basicstation|lens-twin)\s*[:@]/;
      lines.forEach((text, i) => {
        if (isComment(text)) return;
        const m = text.match(known);
        if (m) {
          out.push({
            rule: 'no-inline-image-tag',
            file: p,
            line: i + 1,
            detail: `image reference "${m[1]}" outside config/images.ts`,
          });
        }
      });
      return out;
    },
  },
  // -----------------------------------------------------------------------
  // Contract 5 — Chirp frontend conventions
  //
  // These mirror chirp-frontend/CLAUDE.md so anyone moving between the web app
  // and this desktop app writes the same code. ESLint covers most of them; the
  // two below are checked here because they are cross-file properties ESLint
  // cannot see from a single module.
  // -----------------------------------------------------------------------
  {
    id: 'no-ui-kit-root-import',
    why: "The ui-kit root entry re-exports helpers/map-utils.ts, which reads import.meta.env and drags mapbox and turf into the bundle. Import from a subpath instead.",
    applies: (p) => p.startsWith('renderer/'),
    check: (p, lines) =>
      importsIn(lines)
        .filter(({ spec }) => spec === '@chirpwireless/ui-kit')
        .map(({ line }) => ({
          rule: 'no-ui-kit-root-import',
          file: p,
          line,
          detail: 'import from /primitives, /shell, /layouts, /theme, /icons or /locales instead',
        })),
  },
  {
    id: 'no-mui-primitive',
    why: 'These MUI primitives have ui-kit wrappers carrying Chirp branding. Importing MUI directly yields a component that silently ignores the theme and drifts from the rest of the product.',
    applies: (p) => p.startsWith('renderer/') && !p.endsWith('/style.ts') && !p.endsWith('/style.tsx'),
    check: (p, lines) => {
      const wrapped = new Set([
        'Button',
        'IconButton',
        'TextField',
        'Checkbox',
        'Switch',
        'Tabs',
        'Tab',
        'Tooltip',
        'Dialog',
        'Modal',
        'Table',
        'Autocomplete',
      ]);
      const out: Violation[] = [];
      lines.forEach((text, i) => {
        if (isComment(text)) return;
        const m = text.match(/import\s*\{([^}]*)\}\s*from\s*['"]@mui\/material['"]/);
        if (!m || !m[1]) return;
        const named = m[1].split(',').map((s) => s.trim().split(/\s+as\s+/)[0]?.trim() ?? '');
        for (const name of named) {
          if (wrapped.has(name)) {
            out.push({
              rule: 'no-mui-primitive',
              file: p,
              line: i + 1,
              detail: `"${name}" must come from @chirpwireless/ui-kit/primitives`,
            });
          }
        }
      });
      return out;
    },
  },
  {
    id: 'no-default-export',
    why: 'Named exports only. A default export can be renamed at every import site, which defeats grep and rename-refactors.',
    applies: (p) => p.startsWith('renderer/') || p.startsWith('main/') || p.startsWith('preload/'),
    check: (p, lines) => {
      const out: Violation[] = [];
      lines.forEach((text, i) => {
        if (isComment(text)) return;
        if (/^\s*export\s+default\b/.test(text)) {
          out.push({ rule: 'no-default-export', file: p, line: i + 1, detail: 'export default' });
        }
      });
      return out;
    },
  },
  {
    id: 'no-any',
    why: '`any` is a second source of truth for what a payload contains, and it silently disables every downstream check. Use a real type, or `unknown` with a guard.',
    applies: (p) => p.startsWith('renderer/') || p.startsWith('main/') || p.startsWith('preload/') || p.startsWith('shared/'),
    check: (p, lines) => {
      const out: Violation[] = [];
      lines.forEach((text, i) => {
        if (isComment(text)) return;
        if (/\bas\s+any\b/.test(text) || /:\s*any\b/.test(text) || /<any>/.test(text)) {
          out.push({ rule: 'no-any', file: p, line: i + 1, detail: 'any type' });
        }
      });
      return out;
    },
  },
  {
    id: 'import-order',
    why: "Imports are grouped external -> internal alias -> relative, with a blank line between groups. This is chirp-frontend's import/order rule, enforced here because typescript-eslint does not yet support TypeScript 7 and so cannot parse these files at all.",
    applies: (p) => p.startsWith('renderer/') || p.startsWith('main/') || p.startsWith('preload/'),
    check: (p, lines) => {
      const out: Violation[] = [];
      let previousGroup = -1;
      let previousLine = -1;

      for (const { spec, line } of importsIn(lines)) {
        const group = importGroupOf(spec);

        if (previousGroup !== -1 && group < previousGroup) {
          out.push({
            rule: 'import-order',
            file: p,
            line,
            detail: `"${spec}" belongs before the previous import group`,
          });
        }

        if (previousGroup !== -1 && group > previousGroup && line === previousLine + 1) {
          out.push({
            rule: 'import-order',
            file: p,
            line,
            detail: 'blank line required between import groups',
          });
        }

        previousGroup = group;
        previousLine = line;
      }

      return out;
    },
  },
];

// ---------------------------------------------------------------------------
// Directory-level rule: every use case has a test
// ---------------------------------------------------------------------------

function checkUseCaseTests(srcRoot: string): Violation[] {
  const out: Violation[] = [];
  const useCaseRoot = join(srcRoot, 'main', 'usecase');
  let dirs: string[];
  try {
    dirs = readdirSync(useCaseRoot).filter((d) => statSync(join(useCaseRoot, d)).isDirectory());
  } catch {
    return out; // no use cases yet — nothing to enforce
  }
  for (const d of dirs) {
    const files = readdirSync(join(useCaseRoot, d));
    if (!files.some((f) => f.endsWith('.test.ts') || f.endsWith('.test.tsx'))) {
      out.push({
        rule: 'usecase-has-test',
        file: `main/usecase/${d}/`,
        line: 0,
        detail: 'use case has no *.test.ts — it has not been shown to run without Docker',
      });
    }
  }
  return out;
}


/**
 * Every translation file must carry all five languages with identical key sets.
 *
 * A key present in `en` but missing elsewhere is invisible until someone runs
 * the app in that language, and then it renders as raw English inside otherwise
 * translated copy. This is a cross-file property, so it lives here rather than
 * in ESLint.
 */
const LANGUAGES = ['en', 'de', 'es', 'fr', 'pt'];

function checkTranslations(srcRoot: string): Violation[] {
  const out: Violation[] = [];
  const dir = join(srcRoot, 'renderer', 'src', 'locales', 'resources');
  let files: string[];
  try {
    files = readdirSync(dir).filter((f) => f.endsWith('.json'));
  } catch {
    return out;
  }

  for (const file of files) {
    const rel = `renderer/src/locales/resources/${file}`;
    let parsed: Record<string, Record<string, string>>;
    try {
      parsed = JSON.parse(readFileSync(join(dir, file), 'utf8'));
    } catch (error) {
      out.push({ rule: 'i18n-complete', file: rel, line: 0, detail: `invalid JSON: ${String(error)}` });
      continue;
    }

    for (const language of LANGUAGES) {
      if (!parsed[language]) {
        out.push({ rule: 'i18n-complete', file: rel, line: 0, detail: `missing language "${language}"` });
      }
    }

    const english = parsed['en'];
    if (!english) continue;

    for (const language of LANGUAGES) {
      const table = parsed[language];
      if (!table) continue;
      for (const key of Object.keys(english)) {
        if (!(key in table)) {
          out.push({ rule: 'i18n-complete', file: rel, line: 0, detail: `"${language}" missing key: ${key}` });
        }
      }
    }

    // Key = English text, so a dotted identifier means someone used the old style.
    for (const key of Object.keys(english)) {
      if (/^[a-z][a-zA-Z0-9]*(\.[a-zA-Z0-9]+)+$/.test(key)) {
        out.push({
          rule: 'i18n-complete',
          file: rel,
          line: 0,
          detail: `key looks like a dotted identifier, not English text: "${key}"`,
        });
      }
    }
  }

  return out;
}

// ---------------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------------

function run(srcRoot: string): Violation[] {
  const violations: Violation[] = [];
  for (const abs of walk(srcRoot)) {
    const rel = norm(relative(srcRoot, abs));
    const lines = readFileSync(abs, 'utf8').split('\n');
    for (const rule of rules) {
      if (rule.applies(rel)) violations.push(...rule.check(rel, lines));
    }
  }
  violations.push(...checkUseCaseTests(srcRoot));
  violations.push(...checkTranslations(srcRoot));
  return violations;
}

function report(violations: Violation[]): void {
  const byRule = new Map<string, Violation[]>();
  for (const v of violations) {
    const existing = byRule.get(v.rule);
    if (existing) existing.push(v);
    else byRule.set(v.rule, [v]);
  }
  for (const [ruleId, vs] of byRule) {
    const rule = rules.find((r) => r.id === ruleId);
    console.error(`\n✗ ${ruleId}`);
    if (rule) console.error(`  ${rule.why}`);
    else if (ruleId === 'usecase-has-test') {
      console.error('  The test IS the proof that the layering works.');
    }
    for (const v of vs) {
      console.error(`    ${v.file}${v.line ? `:${v.line}` : ''}  ${v.detail}`);
    }
  }
}

// ---------------------------------------------------------------------------
// Self-test — plant one violation per rule and assert each is caught.
// ---------------------------------------------------------------------------

function selfTest(): number {
  const tmp = join(APP_ROOT, '.boundary-selftest');
  rmSync(tmp, { recursive: true, force: true });

  const write = (rel: string, body: string) => {
    const full = join(tmp, rel);
    mkdirSync(dirname(full), { recursive: true });
    writeFileSync(full, body);
  };

  write('main/domain/camera.ts', "import Docker from 'dockerode';\nexport type Camera = { id: string };\n");
  write('main/usecase/camera-add/usecase.ts', "import { DockerRuntime } from '../../adapters/container/docker';\n");
  write('main/usecase/camera-add/usecase.test.ts', 'export {};\n');
  write('main/usecase/camera-remove/usecase.ts', 'export {};\n'); // deliberately no test
  write('renderer/pages/Cameras.tsx', "const c = '#FF4D14';\nconst d = require('fs');\n");
  write('main/adapters/store/config.ts', "const p = '/etc/iot-hub/radios.env';\n");
  write('main/usecase/zigbee-start/usecase.ts', "const img = 'koenkk/zigbee2mqtt:2.12.1';\n");
  write('main/usecase/zigbee-start/usecase.test.ts', 'export {};\n');
  write('renderer/src/pages/Root.tsx', "import { Kit } from '@chirpwireless/ui-kit';\nexport default Kit;\n");
  write('renderer/src/pages/Btn.tsx', "import { Button, Stack } from '@mui/material';\nvoid [Button, Stack];\n");
  write('main/adapters/chirp/client.ts', 'export const parse = (v: any) => v;\n');
  write('main/adapters/store/order.ts', "import { join } from 'node:path';\nimport { x } from './local';\nimport { Box } from '@mui/material';\nvoid [join, x, Box];\n");
  write(
    'renderer/src/locales/resources/common.json',
    JSON.stringify({ en: { Hello: 'Hello', 'nav.bad': 'Bad' }, de: {} }),
  );

  const found = run(tmp);
  const expected = [
    'domain-is-pure',
    'usecase-depends-on-ports',
    'usecase-has-test',
    'renderer-has-no-node',
    'no-hardcoded-color',
    'no-hardcoded-path',
    'no-inline-image-tag',
    'no-ui-kit-root-import',
    'no-mui-primitive',
    'no-default-export',
    'no-any',
    'i18n-complete',
    'import-order',
  ];

  let failures = 0;
  console.log('Self-test — every rule must catch its planted violation:\n');
  for (const id of expected) {
    const hit = found.some((v) => v.rule === id);
    console.log(`  ${hit ? '✓' : '✗'} ${id}`);
    if (!hit) failures++;
  }

  // And the clean tree must produce nothing.
  rmSync(tmp, { recursive: true, force: true });
  write('main/domain/camera.ts', 'export type Camera = { id: string };\n');
  write(
    'main/usecase/camera-add/usecase.ts',
    "import type { Ports } from './contract';\nexport const handle = (p: Ports) => p;\n"
  );
  write('main/usecase/camera-add/usecase.test.ts', 'export {};\n');
  write('renderer/pages/Cameras.tsx', 'export const C = () => null;\n');

  const clean = run(tmp);
  const cleanOk = clean.length === 0;
  console.log(`  ${cleanOk ? '✓' : '✗'} clean tree produces no violations`);
  if (!cleanOk) {
    failures++;
    report(clean);
  }

  rmSync(tmp, { recursive: true, force: true });

  console.log(
    failures === 0
      ? '\nSelf-test passed — the checker demonstrably fails on violations and passes on clean code.\n'
      : `\nSelf-test FAILED — ${failures} rule(s) did not behave as specified.\n`
  );
  return failures === 0 ? 0 : 1;
}

// ---------------------------------------------------------------------------

const main = (): number => {
  if (process.argv.includes('--self-test')) return selfTest();

  const violations = run(join(APP_ROOT, 'src'));
  if (violations.length === 0) {
    console.log('✓ boundaries clean — all five contracts hold');
    return 0;
  }
  console.error(`${violations.length} boundary violation(s):`);
  report(violations);
  console.error('\nSee app/electron.md for why each of these rules exists.\n');
  return 1;
};

process.exit(main());
