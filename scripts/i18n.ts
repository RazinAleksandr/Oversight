/**
 * Localization key extractor + checker (see docs/I18N.md).
 *
 *   npx tsx scripts/i18n.ts sync [--only <file-id>[,<file-id>]]   regenerate key skeletons, keeping translations
 *   npx tsx scripts/i18n.ts check [--only ...]                      report missing / placeholder mismatches
 *   npx tsx scripts/i18n.ts list                                    list dictionary file ids
 *   npx tsx scripts/i18n.ts dump <id> [--missing] [--from=N --to=M]  numbered keys with context, for translators
 *   npx tsx scripts/i18n.ts fill <id> <file>                        apply "[n] translation" lines to the dictionary
 *
 * Dictionary files live in src/i18n/ru/:
 *   content/<id>.ts  — display strings found in data modules (src/content/**, src/engine/data/*, src/engine/labels.ts).
 *                      These objects are localized in place at boot; strings inside content functions
 *                      (requires-reasons, h.log/h.news/h.meter/h.text) are translated at their engine sinks via tr().
 *   engine.ts        — keys of t()/tp()/tr() calls in src/engine/** (non-data files).
 *   ui.ts            — keys of t()/tp()/tr() calls in src/ui/**, src/art/**, src/fx/**, src/main.tsx, src/boot.tsx.
 */
import ts from 'typescript';
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { pathToFileURL } from 'node:url';

const ROOT = join(dirname(new URL(import.meta.url).pathname), '..');
const OUT = join(ROOT, 'src/i18n/ru');

/** Property names whose string values are identifiers / data, never display text. */
const NON_DISPLAY = new Set([
  'id', 'event', 'source', 'urgency', 'tags', 'eras', 'era', 'countries', 'stances', 'icon', 'color', 'color2',
  'modelStem', 'archetype', 'confidence', 'tone', 'stamp', 'advisor', 'spawn', 'status', 'enact', 'repeal',
  'kind', 'type', 'stance', 'sector', 'sectors', 'trigger', 'companyId', 'modelId', 'rivalId', 'leadLab',
  'tab', 'key', 'flag', 'program', 'policy', 'meter', 'target', 'sfx', 'portraitSeed', 'action', 'situationType',
]);
/** Per-file extra non-display keys (brand names stay in Latin script). */
const FILE_NON_DISPLAY: Record<string, string[]> = {
  'content-companies': ['name'],
};
const I18N_FUNCS = new Set(['t', 'tr', 'tp']);

const walkFiles = (dir: string, out: string[] = []): string[] => {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) walkFiles(p, out);
    else if (/\.(ts|tsx)$/.test(f) && !f.endsWith('.d.ts')) out.push(p);
  }
  return out;
};

const rel = (p: string) => relative(ROOT, p).replace(/\\/g, '/');
const fileId = (p: string) => rel(p).replace(/^src\//, '').replace(/\.(ts|tsx)$/, '').replace(/\//g, '-');

function isDataFile(p: string): boolean {
  const r = rel(p);
  return r.startsWith('src/content/') || r.startsWith('src/engine/data/') || r === 'src/engine/labels.ts';
}

function looksLikeDisplay(s: string): boolean {
  if (!s.trim()) return false;
  if (/^[a-z][a-zA-Z0-9_]*$/.test(s)) return false; // identifier-ish ids, flags
  if (/^#[0-9a-fA-F]{3,8}$/.test(s)) return false; // colors
  if (/^[\d\s.,:%+\-–—/()]*$/.test(s)) return false; // numbers / punctuation only
  if (/^[a-z0-9_.\-/]+\.(ts|tsx|css|png|svg|json)$/.test(s)) return false;
  return true;
}

function propName(n: ts.PropertyName): string | undefined {
  if (ts.isIdentifier(n) || ts.isStringLiteral(n) || ts.isNumericLiteral(n)) return n.text;
  return undefined;
}

/** Local names bound to t/tr/tp imported from the i18n module (art has its own local `t` helpers). */
function i18nImports(sf: ts.SourceFile): Map<string, string> {
  const names = new Map<string, string>();
  for (const st of sf.statements) {
    if (!ts.isImportDeclaration(st) || !ts.isStringLiteral(st.moduleSpecifier)) continue;
    if (!/(^|\/)i18n(\/index)?$/.test(st.moduleSpecifier.text)) continue;
    const nb = st.importClause?.namedBindings;
    if (nb && ts.isNamedImports(nb)) {
      for (const el of nb.elements) {
        const orig = (el.propertyName ?? el.name).text;
        if (I18N_FUNCS.has(orig)) names.set(el.name.text, orig);
      }
    }
  }
  return names;
}

interface Extracted {
  keys: string[];
  warnings: string[];
  /** key → "objectId · property" hint for translators (first occurrence). */
  context?: Record<string, string>;
}

/** Nearest enclosing object literal's `id` (or name/title) and the property holding the string. */
function contextOf(node: ts.Node): string {
  let prop = '';
  let owner = '';
  let cur: ts.Node | undefined = node.parent;
  let fn = '';
  while (cur && !(prop && owner)) {
    if (!prop && ts.isPropertyAssignment(cur)) prop = propName(cur.name) ?? '';
    if (!fn && ts.isCallExpression(cur)) fn = cur.expression.getText().split('.').pop() ?? '';
    if (!owner && ts.isObjectLiteralExpression(cur)) {
      for (const pr of cur.properties) {
        if (ts.isPropertyAssignment(pr) && ['id'].includes(propName(pr.name) ?? '') && ts.isStringLiteral(pr.initializer)) owner = pr.initializer.text;
      }
    }
    if (!prop && ts.isReturnStatement(cur)) prop = 'return';
    cur = cur.parent;
  }
  return [owner, prop || (fn ? `${fn}()` : '')].filter(Boolean).join(' · ');
}

/** Display strings in a data module (+ t() keys inside it, which are skipped here). */
function extractData(path: string): Extracted {
  const src = readFileSync(path, 'utf8');
  const sf = ts.createSourceFile(path, src, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const id = fileId(path);
  const nonDisplay = new Set([...NON_DISPLAY, ...(FILE_NON_DISPLAY[id] ?? [])]);
  const keys: string[] = [];
  const warnings: string[] = [];
  const context: Record<string, string> = {};
  const i18n = i18nImports(sf);
  const add = (s: string, node: ts.Node) => {
    if (looksLikeDisplay(s) && !keys.includes(s)) {
      keys.push(s);
      context[s] = contextOf(node);
    }
  };
  const visit = (node: ts.Node): void => {
    if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node) || ts.isTypeNode(node)) return;
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && i18n.has(node.expression.text)) return; // code keys
    if (ts.isTemplateExpression(node)) {
      const line = sf.getLineAndCharacterOfPosition(node.getStart()).line + 1;
      const text = node.getText();
      if (/[A-Z][a-z]+ [a-z]+/.test(text)) warnings.push(`${rel(path)}:${line} template literal with substitutions: ${text.slice(0, 90)}`);
    }
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
      const p = node.parent;
      if (p && ts.isPropertyAssignment(p) && p.name === node) return; // key position
      if (p && ts.isPropertyAssignment(p)) {
        const name = propName(p.name);
        if (name && nonDisplay.has(name)) return;
      }
      if (p && (ts.isElementAccessExpression(p) || ts.isLiteralTypeNode(p))) return;
      if (p && ts.isBinaryExpression(p) && [ts.SyntaxKind.EqualsEqualsEqualsToken, ts.SyntaxKind.ExclamationEqualsEqualsToken].includes(p.operatorToken.kind)) return;
      if (p && ts.isCaseClause(p)) return;
      add(node.text, node);
      return;
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return { keys, warnings, context };
}

/** Keys of t()/tr()/tp() calls in code files. */
function extractCalls(path: string): Extracted {
  const src = readFileSync(path, 'utf8');
  const sf = ts.createSourceFile(path, src, ts.ScriptTarget.Latest, true, path.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const keys: string[] = [];
  const warnings: string[] = [];
  const i18n = i18nImports(sf);
  const lit = (e: ts.Expression | undefined): string | undefined =>
    e && (ts.isStringLiteral(e) || ts.isNoSubstitutionTemplateLiteral(e)) ? e.text : undefined;
  const visit = (node: ts.Node): void => {
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && i18n.has(node.expression.text)) {
      const fn = i18n.get(node.expression.text)!;
      const line = sf.getLineAndCharacterOfPosition(node.getStart()).line + 1;
      if (fn === 'tp') {
        const one = lit(node.arguments[1]);
        const other = lit(node.arguments[2]);
        if (one !== undefined && other !== undefined) {
          const k = `${one}|${other}`;
          if (!keys.includes(k)) keys.push(k);
        } else warnings.push(`${rel(path)}:${line} tp() with non-literal forms`);
      } else {
        const k = lit(node.arguments[0]);
        if (k !== undefined) {
          if (k && !keys.includes(k)) keys.push(k);
        } else if (fn === 't') warnings.push(`${rel(path)}:${line} t() with non-literal key: ${node.arguments[0]?.getText().slice(0, 60)}`);
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return { keys, warnings };
}

interface DictFile {
  id: string; // e.g. 'content-events-labs', 'engine', 'ui'
  out: string; // output path
  sources: string[];
  kind: 'data' | 'code';
}

function plan(): DictFile[] {
  const files: DictFile[] = [];
  const all = walkFiles(join(ROOT, 'src')).filter((p) => !rel(p).startsWith('src/i18n/'));
  for (const p of all.filter(isDataFile)) {
    if (rel(p).endsWith('events/index.ts')) continue;
    const id = fileId(p);
    files.push({ id, out: join(OUT, 'content', `${id}.ts`), sources: [p], kind: 'data' });
  }
  const engineCode = all.filter((p) => rel(p).startsWith('src/engine/'));
  files.push({ id: 'engine', out: join(OUT, 'engine.ts'), sources: engineCode, kind: 'code' });
  const uiCode = all.filter((p) => /^src\/(ui|art|fx|audio)\//.test(rel(p)) || /^src\/[^/]+\.tsx?$/.test(rel(p)));
  files.push({ id: 'ui', out: join(OUT, 'ui.ts'), sources: uiCode, kind: 'code' });
  // Data files may also contain t() calls (e.g. labels.ts functions): those keys go to engine.ts.
  return files;
}

function extract(f: DictFile): Extracted {
  const keys: string[] = [];
  const warnings: string[] = [];
  const context: Record<string, string> = {};
  for (const p of f.sources) {
    const r = f.kind === 'data' ? extractData(p) : extractCalls(p);
    for (const k of r.keys) if (!keys.includes(k)) keys.push(k);
    warnings.push(...r.warnings);
    if (f.kind === 'code') for (const k of r.keys) context[k] ??= rel(p).replace(/^src\//, '');
    else Object.assign(context, r.context ?? {});
  }
  if (f.id === 'engine') {
    // t() calls inside data files belong to the engine dictionary.
    for (const p of plan().filter((x) => x.kind === 'data' && x.id.startsWith('engine-')).flatMap((x) => x.sources)) {
      for (const k of extractCalls(p).keys) if (!keys.includes(k)) keys.push(k);
    }
  }
  return { keys, warnings, context };
}

async function loadExisting(path: string): Promise<{ dict: Record<string, string>; forms: Record<string, unknown> }> {
  if (!existsSync(path)) return { dict: {}, forms: {} };
  const mod = await import(pathToFileURL(path).href + `?t=${Date.now()}`);
  return { dict: { ...(mod.default ?? {}) }, forms: { ...(mod.forms ?? {}) } };
}

/** Content tokens a translation may swap for each other (Russian avoids adjective forms of names). */
const COUNTRY_T = ['country', 'countryShort', 'countryAdj', 'capital'];
const RIVAL_T = ['rival', 'rivalAdj', 'rivalLeaderTitle', 'rivalLab'];
const LEADER_T = ['leader', 'leaderShort', 'leaderTitle'];
const TOKEN_EQUIV: Record<string, string[]> = Object.fromEntries([
  ...COUNTRY_T.map((x) => [x, COUNTRY_T]),
  ...RIVAL_T.map((x) => [x, RIVAL_T]),
  ...LEADER_T.map((x) => [x, LEADER_T]),
]);

const placeholders = (s: string): string[] =>
  [...new Set([...s.matchAll(/\{(\w+)(?::\w+)?\}/g)].map((m) => m[1]))].sort();

function sameSet(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((x, i) => x === b[i]);
}

function serialize(f: DictFile, keys: string[], dict: Record<string, string>, forms: Record<string, unknown>): string {
  const srcList = f.kind === 'data' ? rel(f.sources[0]) : f.id === 'engine' ? 'src/engine/** (t/tp/tr calls)' : 'src/ui, src/art, src/fx (t/tp/tr calls)';
  const depth = f.kind === 'data' ? '../../index' : '../index';
  let out = `/* Russian strings for ${srcList}.\n * Keys are generated by \`npm run i18n:sync\` — never edit a key; fill in the value. See docs/I18N.md. */\n`;
  out += `import type { FormsTable } from '${depth}';\n\n`;
  out += `export const forms: FormsTable = ${JSON.stringify(forms, null, 2)};\n\n`;
  out += `const dict: Record<string, string> = {\n`;
  for (const k of keys) out += `  ${JSON.stringify(k)}: ${JSON.stringify(dict[k] ?? '')},\n`;
  out += `};\nexport default dict;\n`;
  return out;
}

function writeIndex(files: DictFile[]): void {
  const content = files.filter((f) => f.kind === 'data');
  let out = `/* Russian language pack (generated by scripts/i18n.ts — do not edit). */\nimport type { FormsTable, LangPack } from '../index';\n`;
  out += `import engine, { forms as engineForms } from './engine';\nimport ui, { forms as uiForms } from './ui';\n`;
  content.forEach((f, i) => (out += `import c${i}, { forms as f${i} } from './content/${f.id}';\n`));
  out += `\nconst content: Record<string, string> = Object.assign({}, ${content.map((_, i) => `c${i}`).join(', ')});\n`;
  out += `const forms: FormsTable = Object.assign({}, engineForms, uiForms, ${content.map((_, i) => `f${i}`).join(', ')});\n`;
  out += `const pack: LangPack = { dict: { ...engine, ...ui }, content, forms };\nexport default pack;\n`;
  writeFileSync(join(OUT, 'index.ts'), out);
}

async function main(): Promise<void> {
  const [cmd = 'check', ...rest] = process.argv.slice(2);
  const onlyIdx = rest.indexOf('--only');
  const only = onlyIdx >= 0 ? new Set(rest[onlyIdx + 1].split(',')) : undefined;
  const files = plan();
  if (cmd === 'list') {
    for (const f of files) {
      const { keys } = extract(f);
      const chars = keys.reduce((n, k) => n + k.length, 0);
      console.log(`${f.id.padEnd(34)} ${String(keys.length).padStart(5)} keys ${String(chars).padStart(7)} chars`);
    }
    return;
  }
  if (cmd === 'dump' || cmd === 'fill') {
    const id = rest[0];
    const f = files.find((x) => x.id === id);
    if (!f) throw new Error(`unknown dictionary id: ${id}`);
    const { keys, context } = extract(f);
    const existing = await loadExisting(f.out);
    const esc = (x: string) => x.replace(/\\/g, '\\\\').replace(/\n/g, '\\n');
    if (cmd === 'dump') {
      const onlyMissing = rest.includes('--missing');
      const from = Number(rest.find((x) => x.startsWith('--from='))?.slice(7) ?? 0);
      const to = Number(rest.find((x) => x.startsWith('--to='))?.slice(5) ?? keys.length);
      keys.forEach((k, i) => {
        if (i < from || i >= to) return;
        if (onlyMissing && existing.dict[k]) return;
        const ctx = context?.[k] ? `(${context[k]}) ` : '';
        const cur = existing.dict[k] ? `\n    = ${esc(existing.dict[k])}` : '';
        console.log(`[${i}] ${ctx}${esc(k)}${cur}`);
      });
      return;
    }
    // fill <id> <file>: lines "[n] translation" (\n escapes newlines); later lines win.
    const text = readFileSync(rest[1], 'utf8');
    const dict = { ...existing.dict };
    let n = 0;
    const problems: string[] = [];
    for (const line of text.split(/\r?\n/)) {
      const m = /^\s*\[(\d+)\]\s?(.*)$/.exec(line);
      if (!m) continue;
      const i = Number(m[1]);
      const v = m[2].replace(/\\n/g, '\n').replace(/\\\\/g, '\\').trim();
      const k = keys[i];
      if (k === undefined) {
        problems.push(`[${i}] no such index`);
        continue;
      }
      if (!v) continue;
      const allowed = new Set(placeholders(k).flatMap((x) => (f.kind === 'data' ? TOKEN_EQUIV[x] ?? [x] : [x])));
      const unknown = placeholders(v).filter((x) => !allowed.has(x));
      if (unknown.length) problems.push(`[${i}] unknown placeholder(s) ${unknown.join(',')}: ${v.slice(0, 80)}`);
      dict[k] = v;
      n++;
    }
    writeFileSync(f.out, serialize(f, keys, dict, existing.forms));
    const left = keys.filter((k) => !dict[k]).length;
    console.log(`${id}: filled ${n}, ${left} still missing of ${keys.length}`);
    for (const p of problems) console.log(`   problem: ${p}`);
    return;
  }
  mkdirSync(join(OUT, 'content'), { recursive: true });
  let missingTotal = 0;
  let badTotal = 0;
  for (const f of files) {
    if (only && !only.has(f.id)) continue;
    const { keys, warnings } = extract(f);
    const existing = await loadExisting(f.out);
    if (cmd === 'sync') {
      const stale = Object.keys(existing.dict).filter((k) => !keys.includes(k) && existing.dict[k]);
      writeFileSync(f.out, serialize(f, keys, existing.dict, existing.forms));
      const done = keys.filter((k) => existing.dict[k]).length;
      console.log(`${f.id}: ${keys.length} keys, ${done} translated${stale.length ? `, ${stale.length} stale dropped` : ''}`);
      for (const s of stale.slice(0, 5)) console.log(`   stale: ${s.slice(0, 100)}`);
      for (const w of warnings) console.log(`   warn: ${w}`);
    } else {
      const missing = keys.filter((k) => !existing.dict[k]);
      const bad = keys.filter((k) => {
        const v = existing.dict[k];
        if (!v) return false;
        const kp = k.split('|');
        const vp = v.split('|');
        if (kp.length === 2 && f.kind === 'code' && vp.length >= 2) return !vp.every((x) => sameSet(placeholders(x), placeholders(kp[1])) || sameSet(placeholders(x), placeholders(kp[0])));
        if (f.kind === 'code') return !sameSet(placeholders(k), placeholders(v));
        // Content templates: rephrasing may drop a token, but must never introduce an unknown one.
        const allowed = new Set(placeholders(k).flatMap((x) => TOKEN_EQUIV[x] ?? [x]));
        return placeholders(v).some((x) => !allowed.has(x));
      });
      missingTotal += missing.length;
      badTotal += bad.length;
      if (missing.length || bad.length) {
        console.log(`${f.id}: ${missing.length} missing, ${bad.length} placeholder mismatches (of ${keys.length})`);
        for (const k of bad.slice(0, 8)) console.log(`   mismatch: ${k.slice(0, 80)}  →  ${existing.dict[k].slice(0, 80)}`);
        for (const k of missing.slice(0, 3)) console.log(`   missing: ${k.slice(0, 100)}`);
      }
    }
  }
  if (cmd === 'sync' && !only) writeIndex(files);
  if (cmd === 'sync' && only && !existsSync(join(OUT, 'index.ts'))) writeIndex(files);
  if (cmd === 'check') {
    console.log(missingTotal || badTotal ? `TOTAL: ${missingTotal} missing, ${badTotal} mismatches` : 'all translated ✓');
    if (missingTotal || badTotal) process.exitCode = 1;
  }
}

await main();
