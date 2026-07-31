#!/usr/bin/env node
/**
 * check-boundaries.ts — makes the four contracts in app/electron.md enforceable.
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
            const m = text.match(re);
            if (m) found.push({ spec: m[1], line: i + 1 });
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
    'fs', 'path', 'os', 'child_process', 'net', 'http', 'https', 'crypto', 'stream',
    'util', 'events', 'url', 'zlib', 'dns', 'tls', 'worker_threads', 'cluster',
]);

const isNodeBuiltin = (spec: string) =>
    spec.startsWith('node:') || NODE_BUILTINS.has(spec.split('/')[0]);

// ---------------------------------------------------------------------------
// Contract 1 — SOLID layering
// ---------------------------------------------------------------------------

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
        applies: (p) => p.startsWith('renderer/') && !p.includes('renderer/theme/'),
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
        applies: (p) => !p.startsWith('main/adapters/paths/') && !p.startsWith('main/config/'),
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
        applies: (p) => !p.startsWith('main/config/'),
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
    return violations;
}

function report(violations: Violation[]): void {
    const byRule = new Map<string, Violation[]>();
    for (const v of violations) {
        if (!byRule.has(v.rule)) byRule.set(v.rule, []);
        byRule.get(v.rule)!.push(v);
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

    const found = run(tmp);
    const expected = [
        'domain-is-pure',
        'usecase-depends-on-ports',
        'usecase-has-test',
        'renderer-has-no-node',
        'no-hardcoded-color',
        'no-hardcoded-path',
        'no-inline-image-tag',
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
    write('main/usecase/camera-add/usecase.ts', "import type { Ports } from './contract';\nexport const handle = (p: Ports) => p;\n");
    write('main/usecase/camera-add/usecase.test.ts', 'export {};\n');
    write('renderer/pages/Cameras.tsx', "export const C = () => null;\n");

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
            : `\nSelf-test FAILED — ${failures} rule(s) did not behave as specified.\n`,
    );
    return failures === 0 ? 0 : 1;
}

// ---------------------------------------------------------------------------

const main = (): number => {
    if (process.argv.includes('--self-test')) return selfTest();

    const violations = run(join(APP_ROOT, 'src'));
    if (violations.length === 0) {
        console.log('✓ boundaries clean — all four contracts hold');
        return 0;
    }
    console.error(`${violations.length} boundary violation(s):`);
    report(violations);
    console.error('\nSee app/electron.md for why each of these rules exists.\n');
    return 1;
};

process.exit(main());
