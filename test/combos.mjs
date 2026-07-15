// The scaffolder is a pile of flag conditionals, and a flag combo breaks silently: the app still scaffolds, it
// just quietly lacks a script or ships a workflow GitHub refuses to run. So every combo that touches a native
// target gets scaffolded for real and inspected — including the NEGATIVE case, because a flag leaking into an app
// that didn't ask for it is the failure nobody looks for.
//
// The apk workflow is parsed as real YAML, not grepped: malformed YAML doesn't error anywhere, it just means CI
// never runs and the "you don't need the Android SDK" promise is a lie.
//
//   node test/combos.mjs        (or: npm test)
import { spawnSync } from 'node:child_process';
import { readFileSync, existsSync, rmSync, mkdirSync, mkdtempSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import yaml from 'js-yaml';

const SELF = dirname(fileURLToPath(import.meta.url));
const CLI = join(SELF, '..', 'index.js');
const ROOT = mkdtempSync(join(tmpdir(), 'muten-combos-'));

let fails = 0;
const check = (label, ok, extra = '') => {
  console.log(`  ${ok ? '✓' : 'x'} ${label}${ok ? '' : '   ← ' + extra}`);
  if (!ok) fails++;
};

const COMBOS = [
  { name: 'a1', args: ['--android'] },
  { name: 'a2', args: ['--android', '--tauri'] },                              // two native wrappers at once
  { name: 'a3', args: ['--android', '--tailwind'] },
  { name: 'a4', args: ['--android', '--daisyui', '--devtools', '--vercel'] },  // everything on
  { name: 'a5', args: ['--android', '--pm', 'pnpm'] },
  { name: 'a6', args: ['--android', '--pm', 'bun'] },                          // the only pm that branches the CI
  { name: 'a7', args: ['--android', '--pm', 'yarn'] },
  { name: 'n1', args: [] },                                                    // nothing android may leak in
];
// Exactly these two. `muten android --build` chains the rest, so a script per step is an order to memorise that
// the tool already knows — the RETIRED list keeps them from creeping back one convenience at a time.
const ANDROID_SCRIPTS = ['android', 'android:live'];
const RETIRED_SCRIPTS = ['android:check', 'android:install', 'android:init', 'android:build', 'android:open'];

for (const combo of COMBOS) {
  console.log(`\ncreate-muten ${combo.args.join(' ') || '(sin flags)'}`);
  const run = spawnSync(process.execPath, [CLI, combo.name, ...combo.args, '--no-install'], { cwd: ROOT, encoding: 'utf8' });
  const app = join(ROOT, combo.name);
  if (run.status !== 0) { check('scaffolds', false, `exit ${run.status}: ${(run.stderr || '').slice(0, 120)}`); continue; }

  const pkg = JSON.parse(readFileSync(join(app, 'package.json'), 'utf8'));
  const workflow = join(app, '.github', 'workflows', 'apk.yml');
  const gitignore = readFileSync(join(app, '.gitignore'), 'utf8');

  if (!combo.args.includes('--android')) {
    check('no workflow', !existsSync(workflow));
    check('no capacitor.config.json', !existsSync(join(app, 'capacitor.config.json')));
    check('no android:* scripts', !Object.keys(pkg.scripts).some((s) => s.startsWith('android')));
    check('android/ not ignored', !gitignore.includes('android/'));
    continue;
  }

  const pm = combo.args.includes('--pm') ? combo.args[combo.args.indexOf('--pm') + 1] : 'npm';
  check('capacitor.config.json', existsSync(join(app, 'capacitor.config.json')));
  check('webDir is dist (what `muten bundle` writes)', JSON.parse(readFileSync(join(app, 'capacitor.config.json'), 'utf8')).webDir === 'dist');
  check('android/ ignored (cap regenerates it)', gitignore.includes('android/'));
  check(`scripts: ${ANDROID_SCRIPTS.join(' ')}`, ANDROID_SCRIPTS.every((s) => pkg.scripts[s]));
  check('and no others', !RETIRED_SCRIPTS.some((s) => pkg.scripts[s]), RETIRED_SCRIPTS.filter((s) => pkg.scripts[s]).join(', '));

  let doc;
  try { doc = yaml.load(readFileSync(workflow, 'utf8')); check('apk.yml parses as YAML', true); }
  catch (e) { check('apk.yml parses as YAML', false, String(e.message).slice(0, 90)); continue; }

  const steps = doc?.jobs?.apk?.steps ?? [];
  check('runs on ubuntu (it already has the SDK)', doc?.jobs?.apk?.['runs-on'] === 'ubuntu-latest');
  check('triggers on push + by hand', !!doc?.on?.push && doc?.on?.workflow_dispatch !== undefined);
  check('pins JDK 21 (a newer one fails before compiling)', steps.some((s) => s.with?.['java-version'] === '21'));
  check('uploads the .apk', steps.some((s) => String(s.uses).includes('upload-artifact') && String(s.with?.path).endsWith('app-debug.apk')));
  check(`installs with ${pm}`, steps.some((s) => s.run === `${pm} install`));
  check('builds the .apk with the same command you run locally', steps.some((s) => s.run === `${pm} run android`));
  // The one that matters: a workflow calling a script that no longer exists is still VALID YAML and still reads
  // fine — it only fails on a runner, after a push, minutes later. Cross-check the text against reality.
  const invoked = steps.flatMap((s) => [...String(s.run ?? '').matchAll(/(?:npm|pnpm|yarn|bun) run ([\w:-]+)/g)].map((m) => m[1]));
  const ghosts = invoked.filter((s) => !pkg.scripts[s]);
  check(`every \`run\` in the workflow exists (${invoked.join(', ') || 'none'})`, !ghosts.length, `missing: ${ghosts.join(', ')}`);
  check(pm === 'bun' ? 'bun gets setup-bun' : 'non-bun gets corepack',
    pm === 'bun' ? steps.some((s) => String(s.uses).includes('setup-bun')) : steps.some((s) => s.run === 'corepack enable'));

  if (combo.args.includes('--tauri')) {
    check('tauri + android scripts coexist', !!pkg.scripts['tauri:build'] && !!pkg.scripts['android']);
    check('tauri + android configs coexist', existsSync(join(app, 'src-tauri', 'tauri.conf.json')) && existsSync(join(app, 'capacitor.config.json')));
    const agents = readFileSync(join(app, '.claude', 'AGENTS.md'), 'utf8');
    check('AGENTS.md carries BOTH notes', agents.includes('## Desktop app (Tauri)') && agents.includes('## Android app (.apk)'));
  }
}

rmSync(ROOT, { recursive: true, force: true });
console.log(fails ? `\n${fails} FAILED` : '\nALL OK');
process.exit(fails ? 1 : 0);
