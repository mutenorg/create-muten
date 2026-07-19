#!/usr/bin/env node
// create-muten — scaffold a new Muten app, with modern interactive prompts (@clack/prompts).
//
//   npm create muten@latest [name]              (or: npx create-muten)
//   create-muten [name] [--css|--scss] [--tailwind] [--daisyui] [--devtools] [--vercel] [--tauri] [--android] [--pm npm|pnpm|yarn|bun] [--no-install]
//
// Stylesheet (CSS or SCSS) is the base; Tailwind is an optional add-on ON TOP of CSS (it's a styling
// library, not a stylesheet replacement). Interactive in a TTY; flags / non-TTY make it scriptable.
import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync, renameSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { intro, outro, text, select, confirm, isCancel, cancel, note } from '@clack/prompts';
import color from 'picocolors';

const SELF = dirname(fileURLToPath(import.meta.url));
const TEMPLATE = join(SELF, 'template');
const TAURI_TEMPLATE = join(SELF, 'template-tauri'); // src-tauri/ overlay, copied only when --tauri
const PKG = JSON.parse(readFileSync(join(SELF, 'package.json'), 'utf8'));
const PMS = ['npm', 'pnpm', 'yarn', 'bun'];

// the starter reset — written by the CLI so the template stays pure .muten (no default styles file).
const RESET = `/* Your look. Muten ships STRUCTURE (primitives); the LOOK lives here, applied with class("…"). */
* { box-sizing: border-box; }
/* In-page anchors (\`Link -> "#features"\` → \`Section id("features")\`) glide instead of jumping. Honour the OS
   setting: a user who asked for less motion gets the instant jump. Nothing else in muten needs JS for this. */
html { scroll-behavior: smooth; }
@media (prefers-reduced-motion: reduce) { html { scroll-behavior: auto; } }
body { margin: 0; font: 15px/1.55 system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif; color: #111; }
h1, h2, h3, h4, h5, h6, p { margin: 0; }
h1 { font-size: 32px; font-weight: 700; letter-spacing: -.02em; }
/* Every muten container is a column by default (override to row/grid with class("…")). Without this the
   landmark primitives (Nav/Sidebar/Header/Footer) inherit block flow and render their children horizontally —
   the #1 "my sidebar is sideways" surprise. Button/Link default to an inline row (icon + label, centered). */
.mu-stack, .mu-page, .mu-header, .mu-nav, .mu-sidebar, .mu-footer, .mu-section, .mu-article, .mu-list { display: flex; flex-direction: column; min-height: 0; }
.mu-list { margin: 0; padding: 0; list-style: none; }
.mu-button, .mu-link { display: inline-flex; align-items: center; justify-content: center; gap: 6px; }
/* the shell's slot wrapper fills the space left by a sidebar/header (else a flex-row shell collapses the page). */
.muten-outlet { flex: 1 1 auto; min-width: 0; display: flex; flex-direction: column; }
  .muten-outlet > * { flex: 1 0 auto; min-height: 0; }
/* sticky footer, automatic: the shell fills the viewport and its content grows, so a short page still pushes
   Footer to the bottom — no min-h-screen/grow needed on the shell root. */
.mu-shell { display: flex; flex-direction: column; min-height: 100vh; }
  .mu-shell > * { flex: 1 0 auto; min-height: 0; }
img { max-width: 100%; display: block; }
a { color: inherit; text-decoration: none; }
/* a11y: skip-link (muten emits it in the shell) — off-screen until keyboard-focused */
.mu-skip-link { position: absolute; left: -9999px; top: 8px; padding: 8px 16px; background: #111; color: #fff; border-radius: 6px; z-index: 1000; }
.mu-skip-link:focus { left: 8px; }
/* <main> is the skip-link / on-navigation focus target (tabindex=-1): a reading-position anchor, not an
   interactive control, so it gets no focus ring when clicked/focused. */
#mu-main:focus { outline: none; }
`;
// CSS + Tailwind v4: one @import; the native runner compiles it in-process (Tailwind v4). Preflight does the reset, so this stays
// minimal — only `.mu-stack` (Muten's Stack primitive; `mu-` so it never collides with DaisyUI's own
// `.stack`). You style via class("…").
const tailwindStyles = (daisyui) => `@import "tailwindcss";${daisyui ? '\n@plugin "daisyui";' : ''}

/* Muten's Stack primitive. In @layer base so Tailwind utilities ALWAYS win the cascade: a
   class("flex-row")/class("grid") on a Stack overrides this deterministically (no cascade race). */
@layer base {${daisyui ? `
  /* DaisyUI puts the theme on <html>, but nothing fills the body — without this it's transparent and dark
     cards float on black. bg-base-200 (page) sits a shade under the card's bg-base-100. */
  body { @apply bg-base-200 text-base-content; }` : ''}
  .mu-stack, .mu-page, .mu-header, .mu-nav, .mu-sidebar, .mu-footer, .mu-section, .mu-article, .mu-list { display: flex; flex-direction: column; min-height: 0; }
  .mu-list { margin: 0; padding: 0; list-style: none; }
  .mu-button, .mu-link { display: inline-flex; align-items: center; justify-content: center; gap: 6px; }
  .muten-outlet { flex: 1 1 auto; min-width: 0; display: flex; flex-direction: column; }
  .muten-outlet > * { flex: 1 0 auto; min-height: 0; }
  /* sticky footer, automatic: shell fills the viewport, its content grows, short pages still pin Footer down. */
  .mu-shell { display: flex; flex-direction: column; min-height: 100vh; }
  .mu-shell > * { flex: 1 0 auto; min-height: 0; }
  /* a11y skip link the runtime injects — visually hidden until keyboard-focused. */
  .mu-skip-link { position: absolute; left: -9999px; top: 8px; padding: 8px 16px; border-radius: 6px; z-index: 1000; }
  .mu-skip-link:focus { left: 8px; }
  #mu-main:focus { outline: none; } /* the <main> focus target (tabindex=-1) is a reading anchor, not a control: no click ring. */
}
`;
// Starter welcome page styles (used by the scaffolded home.muten). Self-contained plain CSS — looks good
// with or without Tailwind; delete it (and the page) when you build your own.
const WELCOME_CSS = `
/* — starter welcome page (src/pages/home/home.muten) — delete when you build your own. Classes are
   mw-* prefixed so the starter never collides with a CSS framework's components (e.g. DaisyUI .hero/.card). */
.mw-welcome { background: #fafafa; color: #18181b; padding: 64px 24px; }
.mw-wrap { max-width: 720px; margin: 0 auto; display: flex; flex-direction: column; gap: 52px; }
.mw-hero { text-align: center; }
.mw-logo { width: 64px; height: 64px; border-radius: 16px; margin: 0 auto; box-shadow: 0 6px 20px rgba(255,94,0,.28); }
.mw-brand { font-size: clamp(40px, 8vw, 58px); font-weight: 800; letter-spacing: -.04em; line-height: 1; margin-top: 22px; background: linear-gradient(135deg, #ff5e00, #ff9a00); -webkit-background-clip: text; background-clip: text; color: transparent; }
.mw-tagline { font-size: 18px; font-weight: 600; color: #27272a; margin-top: 10px; }
.mw-lead { max-width: 580px; margin: 14px auto 0; color: #52525b; font-size: 16px; line-height: 1.65; }
.mw-stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; }
.mw-stat { border: 1px solid #e4e4e7; border-radius: 14px; padding: 22px 16px; text-align: center; background: #fff; }
.mw-stat-n { font-size: 26px; font-weight: 800; letter-spacing: -.02em; color: #ff5e00; }
.mw-stat-l { color: #71717a; font-size: 12px; line-height: 1.45; margin-top: 6px; }
.mw-section { display: flex; flex-direction: column; gap: 14px; }
.mw-h2 { font-size: 22px; font-weight: 700; letter-spacing: -.02em; }
.mw-note { color: #71717a; font-size: 13px; line-height: 1.55; }
.mw-cards { display: grid; grid-template-columns: repeat(2, 1fr); gap: 14px; }
.mw-card { border: 1px solid #e4e4e7; border-radius: 14px; padding: 18px; background: #fff; }
.mw-card-title { font-size: 14px; font-weight: 600; margin-bottom: 5px; }
.mw-card-text { color: #71717a; font-size: 13px; line-height: 1.5; }
@media (max-width: 560px) { .mw-stats, .mw-cards { grid-template-columns: 1fr; } }
`;
// `Form` auto-renders its fields with mu-* classes (class() on a Form styles the <form>, not the inputs).
// Ship a baseline skin so forms look right out of the box; override freely. Uses theme vars (with fallbacks)
// so it adapts to theme.muten / your framework. (Removes the #1 styling friction: unstyled auto-forms.)
const FORM_CSS = `
/* — muten auto-Form baseline (override or delete) — */
.mu-form { display: flex; flex-direction: column; gap: 14px; }
.mu-form-title { display: none; }
.mu-field-group { display: flex; flex-direction: column; gap: 4px; }
.mu-label { font-size: 13px; font-weight: 600; color: var(--color-text, #18181b); }
.mu-field { width: 100%; padding: 9px 12px; font-size: 14px; border-radius: var(--radius-md, 8px); font-family: inherit;
  border: 1px solid var(--color-border, #d4d4d8); background: var(--color-bg, #ffffff); color: var(--color-text, #18181b); }
.mu-field:focus { outline: 2px solid var(--color-primary, #4f46e5); outline-offset: -1px; }
.mu-field-area { min-height: 90px; line-height: 1.5; resize: vertical; }
.mu-field-check { width: 16px; height: 16px; accent-color: var(--color-primary, #4f46e5); }
.mu-field-error { color: var(--color-danger, #dc2626); font-size: 12px; }
.mu-submit { padding: 9px 14px; border: none; border-radius: var(--radius-md, 8px); cursor: pointer; font-weight: 600; font-size: 14px;
  background: var(--color-primary, #4f46e5); color: var(--color-onprimary, #ffffff); }
.mu-submit:hover { filter: brightness(1.08); }
`;
// Chart baseline (Chart primitive + Svg marks). A clean, shadcn-flavoured default so charts look good with ZERO
// CSS. Every value reads a token: theme.muten can drive the whole look via a `chart {}` section (`--chart-*`) or
// its `colors {}` (`--color-*`), with hardcoded fallbacks so it works out of the box. Override any rule freely.
const CHART_CSS = `
/* — muten chart baseline (override, or theme via theme.muten \`chart {}\` / \`colors {}\`) — */
.mu-chart-wrap { margin: 0; display: flex; flex-direction: column; gap: 8px; }
.mu-chart { width: 100%; height: auto; display: block; }
.mu-chart-title { font-size: 14px; font-weight: 600; color: var(--color-text, #18181b); }
.mu-chart-bar, .mu-chart-dot { fill: var(--c, var(--chart-fill, var(--color-primary, #6366f1))); }
.mu-chart-bar { rx: var(--chart-bar-radius, 4px); }
.mu-chart-line { fill: none; stroke: var(--c, var(--chart-fill, var(--color-primary, #6366f1))); stroke-width: 2.25; stroke-linecap: round; stroke-linejoin: round; }
.mu-chart-area { stroke: none; } /* fill comes from the inline accent→transparent gradient __chart draws */
.mu-chart-slice { fill: var(--c, var(--chart-fill, var(--color-primary, #6366f1))); stroke: var(--color-bg, #ffffff); stroke-width: 2; }
.mu-chart-grid { stroke: var(--color-border, #e5e7eb); stroke-dasharray: var(--chart-grid-dash, 3 4); opacity: 0.6; }
.mu-chart-tick, .mu-chart-xlabel { fill: var(--color-muted, #9ca3af); font-size: 10px; font-variant-numeric: tabular-nums; }
.mu-chart-total { fill: var(--color-text, #18181b); font-size: 15px; font-weight: 650; font-variant-numeric: tabular-nums; }
.mu-chart-s0 { --c: var(--color-chart-1, #6366f1); } .mu-chart-s1 { --c: var(--color-chart-2, #8b5cf6); }
.mu-chart-s2 { --c: var(--color-chart-3, #10b981); } .mu-chart-s3 { --c: var(--color-chart-4, #f59e0b); }
.mu-chart-s4 { --c: var(--color-chart-5, #ef4444); } .mu-chart-s5 { --c: var(--color-chart-6, #06b6d4); }
.mu-chart-legend { list-style: none; margin: 0; padding: 0; display: flex; flex-wrap: wrap; gap: 4px 14px; font-size: 12px; color: var(--color-muted, #9ca3af); }
.mu-chart-legend-item { display: inline-flex; align-items: center; gap: 6px; }
.mu-chart-swatch { width: 10px; height: 10px; border-radius: 2px; background: var(--c, var(--chart-fill, var(--color-primary, #6366f1))); }
`;
// Drag & drop baseline (draggable/droptarget). muten's DnD is pointer-based with a floating clone; ALL visuals
// are these CSS classes — restyle freely. Nested drop zones are handled by the runtime (innermost wins).
const DND_CSS = `
/* — muten drag & drop (override freely; behavior via CSS vars, nothing hardcoded) — */
.mu-dnd-item { cursor: grab; --mu-dnd-activation: 5; --mu-dnd-z: 9999; } /* px to move before a drag starts (clicks stay clicks) + overlay z-index */
.mu-dnd-item:active { cursor: grabbing; }
.mu-dnd-ghost { opacity: 0.4; }                                             /* the source, dimmed while dragging */
.mu-dnd-overlay { cursor: grabbing; rotate: 2deg; opacity: 0.96; box-shadow: 0 10px 30px rgba(0,0,0,0.35); }
.mu-dnd-over { outline: 2px dashed var(--color-primary, #6366f1); outline-offset: -2px; }
`;
// muten.config (muten syntax) composed from the chosen options. The styling block is the theme ADAPTER for
// the chosen library: muten emits theme.muten in that format. Selectors drop the trailing ` {` and use single
// quotes (muten strings can't hold `{`/`"`); muten.config wraps them back into blocks. css-only is zero-config
// (no file — muten emits :root vars). There is no muten.config for css-only: `muten dev`/`muten bundle` is the
// runner (embedded esbuild) and needs no config; a muten.config is only written for Tailwind/DaisyUI.
const mutenConfigText = ({ styling, classes, plugins = [] }) => {
  const key = (k) => /^[a-z][a-z0-9]*$/i.test(k) ? k : `"${k}"`;            // quote hyphenated/non-ident keys
  const sel = (open) => open.replace(/\s*\{\s*$/, '').replace(/"/g, "'");   // "@theme {" -> "@theme"; double -> single quotes
  const L = [
    '# muten.config — the build, in muten. `plugins {}` enables connectable plugins (@muten/<name>); the styling',
    '# block maps theme.muten -> CSS variables for your library. The only .js/.ts in a muten app are the escapes.',
    '',
  ];
  if (plugins.length) { L.push('plugins {'); for (const p of plugins) L.push(`  ${p} {}`); L.push('}', ''); }
  if (styling) {
    L.push('styling {',
      `  prefix { ${Object.entries(styling.prefix).map(([s, p]) => `${s} "${p}"`).join('  ')} }`,
      '  blocks {');
    styling.blocks.forEach((b, i) => {
      const name = (b.attrs && b.attrs.name) || ['base', 'light', 'extra'][i] || `b${i}`;
      const attrs = b.attrs ? ` attrs { ${Object.entries(b.attrs).map(([k, v]) => `${key(k)} "${v}"`).join('  ')} }` : '';
      L.push(`    ${name} { selector "${sel(b.open)}"${attrs} sections [${b.sections.join(', ')}] }`);
    });
    L.push('  }');
    if (classes) { L.push('  classes {'); for (const [slot, v] of Object.entries(classes)) L.push(`    ${key(slot)} "${v}"`); L.push('  }'); }
    L.push('}');
  }
  return L.join('\n').replace(/\n+$/, '') + '\n';
};
// theme.muten is AGNOSTIC values; a `styling` ADAPTER (data, in muten.config) tells muten how to emit them
// for the chosen library. The scaffolder seeds a skeleton + the matching adapter per backend (the ENGINE
// itself knows no library). Plain css/scss gets an EMPTY theme.muten (just the object) — fill it and muten
// emits :root vars.

// DaisyUI skeleton: DaisyUI's theme slots, pre-filled with a clean light starter. Edit freely; Daisy
// inherits any slot you omit. Emitted via the daisy adapter as `@plugin "daisyui/theme" { … }`.
const DAISY_THEME = `# Your theme (DaisyUI slots) — the SINGLE source for BOTH schemes. \`colors {}\` is the shared brand; the
# scheme-specific surfaces (base-*, neutral) live in \`dark {}\` / \`light {}\`. muten emits TWO DaisyUI themes via
# the adapter; flip <html data-theme="light"> to switch. Edit freely; Daisy inherits any slot you omit.
theme {
  colors {
    primary "#4f46e5"  "primary-content" "#ffffff"
    secondary "#0ea5e9"  "secondary-content" "#ffffff"
    accent "#14b8a6"  "accent-content" "#ffffff"
    info "#0ea5e9"  success "#16a34a"  warning "#f59e0b"  error "#dc2626"
  }
  dark {
    neutral "#1f2937"  "neutral-content" "#e5e7eb"
    "base-100" "#1a1a1f"  "base-200" "#141418"  "base-300" "#26262e"  "base-content" "#e5e7eb"
  }
  light {
    neutral "#e5e7eb"  "neutral-content" "#1f2937"
    "base-100" "#ffffff"  "base-200" "#f3f4f6"  "base-300" "#e5e7eb"  "base-content" "#1f2937"
  }
  radius { box "0.5rem"  field "0.375rem"  selector "0.5rem" }
  scheme { mode "dark" }
}
`;
// Tailwind skeleton: brand colors + the token scale. Emitted via the tailwind adapter into `@theme { … }`.
const TAILWIND_THEME = `# Your theme — the SINGLE source for BOTH color schemes. \`colors {}\` is shared (brand); \`dark {}\` and
# \`light {}\` hold the per-scheme tokens. muten emits the dark set into Tailwind's @theme (the default) and the
# light set under [data-theme="light"]. Flip <html data-theme="light"> to switch; everything re-themes from here.
# Use as bg-bg / bg-surface / text-fg / border-border in class(), or var(--color-…) in your CSS.
theme {
  colors { primary "#4f46e5"  secondary "#0ea5e9"  accent "#14b8a6" }
  dark   { bg "#0b0b0f"  surface "#16161d"  border "#26262e"  fg "#fafafa"  muted "#a1a1aa" }
  light  { bg "#ffffff"  surface "#f7f7f8"  border "#e6e6e9"  fg "#18181b"  muted "#52525b" }
  scheme { mode "dark" }
}
# Tailwind owns spacing/sizing/radius (p-6, gap-4, rounded-lg, max-w-md). Don't add space/font/radius named
# sm/md/lg/xl here — they emit --spacing-md etc. and collide with Tailwind's max-w-md / rounded-md.
`;
// Base (no framework): empty theme.muten — the bare object. Fill it and muten emits :root CSS vars.
const EMPTY_THEME = `# Your theme. Empty for now. Add sections (e.g. \`colors { primary "#4f46e5" }\`) and muten
# emits them as :root CSS custom properties your stylesheet uses via var(--color-primary).
theme {
}
`;
// Styling ADAPTERS (pure data): how muten renders theme.muten for each library. Live in YOUR muten.config
// (editable) — the engine ships none. A new library = a new adapter here, no muten change.
const DAISY_ADAPTER = {
  // shared brand + each scheme -> its own DaisyUI theme block (dark is the default). Toggle <html data-theme>.
  prefix: { colors: '--color-', dark: '--color-', light: '--color-', radius: '--radius-' },
  blocks: [
    { open: '@plugin "daisyui/theme" {', close: '}', attrs: { name: 'dark', default: 'true', 'color-scheme': 'dark' }, sections: ['colors', 'dark', 'radius'] },
    { open: '@plugin "daisyui/theme" {', close: '}', attrs: { name: 'light', 'color-scheme': 'light' }, sections: ['colors', 'light', 'radius'] },
  ],
};
// CLASS MAP (pure data): muten's auto-generated <Form> parts — the input/label/submit class() can't reach —
// emit THESE DaisyUI classes instead of the default mu-*. No bridge CSS; the engine stays agnostic.
const DAISY_CLASSES = {
  form: 'flex flex-col gap-3', 'form-title': 'hidden', 'field-group': 'flex flex-col gap-1',
  label: 'text-sm font-semibold', field: 'input w-full', 'field-select': 'select w-full',
  'field-area': 'textarea w-full', 'field-check': 'checkbox', 'field-error': 'text-error text-xs',
  submit: 'btn btn-primary w-full',
};
const TAILWIND_ADAPTER = {
  // COLORS only (Tailwind owns spacing/sizing). shared + `dark` -> @theme defaults; `light` -> [data-theme="light"].
  prefix: { colors: '--color-', dark: '--color-', light: '--color-' },
  blocks: [
    { open: '@theme {', close: '}', sections: ['colors', 'dark'] },
    { open: '[data-theme="light"] {', close: '}', sections: ['light'] },
  ],
};
const TAILWIND_NOTE = `
## Styling: Tailwind CSS v4 (installed)
This app has Tailwind ON TOP of CSS. There is ONE way to style: \`class("…")\`. Write everything — layout AND
look — with Tailwind utilities, e.g. \`class("flex flex-row items-center gap-4 p-6 rounded-lg bg-zinc-900 text-white")\`.
A \`Stack\` is a flex column by default; for a horizontal row use \`class("flex flex-row")\`.
You can still add your own rules in \`src/styles.css\` below the \`@import "tailwindcss";\`.
`;
// DaisyUI = component CLASSES on top of Tailwind (no React). The "shadcn for Muten": pre-styled components
// you drop into class("…"); behavior (open/close) you build with Muten state + class(when) + on(…).
const DAISY_NOTE = `
## DaisyUI (installed)
DaisyUI adds **component classes** on top of Tailwind — use them in \`class("…")\`: \`class("btn btn-primary")\`,
\`class("card bg-base-100 shadow-xl")\`, \`class("badge")\`, \`class("alert")\`. Pure classes, no React.
\`@plugin "daisyui";\` is already in \`src/styles.css\`. Interactive behavior (toggle a modal/dropdown) you build
with Muten: \`state\` + \`class(active when isOpen)\` + \`on(click: …)\`.
`;
// @muten/devtools = the in-app DevTools plugin (dev-only overlay). Auto-mounted by `muten dev`; production omits it.
const DEVTOOLS_NOTE = `
## DevTools (@muten/devtools, installed)
In-app DevTools, **dev-only** (zero production cost — \`muten bundle\`/\`build\` never include it). \`muten dev\`
auto-mounts the overlay (bottom-right; open with the launcher or \`Ctrl+Shift+D\`). Enabled via
\`plugins { devtools {} }\` in muten.config.
- **Tree** — the component tree with source refs, an element picker (click the app to inspect), and per-node
  props / reacts-to (which state drives it) / live values.
- **State** — every state grouped by scope, **editable** inline, plus a Redux-style **History** with granular
  diffs, real action names, and **time-travel**.
- **Perf** — ms-to-react (DOM + state), record a session, and highlight what changes in the app, live.
`;
// Tauri = the SAME web build wrapped in a native OS-webview window (no browser bundled). Desktop target.
const TAURI_NOTE = (pm) => `
## Desktop app (Tauri)
This app also ships as a native desktop app via Tauri (\`src-tauri/\`). The SAME \`.muten\` frontend runs in
an OS-webview window — build the UI exactly like the web app (routing works as-is: the webview runs the SPA,
no server, no URL bar, no fallback needed).
- \`${pm} run tauri:dev\` — run the desktop app (opens the native window; hot-reloads the frontend).
- \`${pm} run tauri:build\` — standalone native installer in \`src-tauri/target/release/bundle/\` (frontend embedded, no server).
- (\`${pm} run tauri\` alone does nothing — the Tauri CLI needs a subcommand like \`dev\`/\`build\`.)
- Needs the **Rust toolchain** on the machine (https://rustup.rs) — Tauri compiles a small native shell. Not auto-installed.
- Custom icon: \`${pm} run tauri icon path/to/logo.png\` regenerates \`src-tauri/icons/\`.
`;

// The .apk WITHOUT the Android SDK on your machine: GitHub's ubuntu runner already ships it, so CI builds the
// file and you download it from the run. That is EAS Build minus the company — and it is why nothing here ever
// needs to auto-install a toolchain: the machine that has one is free.
const APK_WORKFLOW = (pm) => `# Builds the installable .apk in CI. Nothing to install locally: GitHub's ubuntu runner
# already ships the Android SDK. Push (or run this by hand) -> download "app-debug-apk" from the run's Artifacts.
# To build on your own machine instead: \`${pm} run android\` — it says what's missing if anything is.
name: apk

on:
  push:
    branches: [main]
  workflow_dispatch:

jobs:
  apk:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '22'
${pm === 'bun' ? '      - uses: oven-sh/setup-bun@v2\n' : '      - run: corepack enable\n'}      - uses: actions/setup-java@v4
        with:
          distribution: temurin
          java-version: '21'   # the generated Gradle supports up to 21 — a NEWER JDK fails before compiling
      - run: ${pm} install
      # one command: it finds the runner's JDK + SDK, regenerates the gitignored android/, bundles, syncs,
      # and runs Gradle. Same command you run locally, so CI can't drift from your machine.
      - run: ${pm} run android
      - uses: actions/upload-artifact@v4
        with:
          name: app-debug-apk
          path: android/app/build/outputs/apk/debug/app-debug.apk
`;

// Android = the SAME web build (dist/) bundled into an .apk as local assets, loaded by a system-WebView Activity.
// Capacitor OWNS the android/ project + the yearly targetSdk treadmill — muten just hands it dist/. Offline by
// construction: nothing is fetched, so no hosting and no service worker.
const ANDROID_NOTE = (pm) => `
## Android app (.apk)
This app also ships as an installable Android app. The SAME \`.muten\` frontend runs from local assets inside a
system-WebView — build the UI exactly like the web app (the SPA routes as-is; no server, no URL bar).
**Don't want the Android SDK on your machine?** You don't need it. \`.github/workflows/apk.yml\` builds the .apk in
CI — GitHub's runner already ships the SDK. Push, then download \`app-debug-apk\` from the run's Artifacts. Nothing
below applies unless you want a LOCAL build (which you do want for an emulator, or to iterate without pushing).

### Building it locally
- \`${pm} run android\` — **the .apk.** One command, the whole chain: checks the toolchain, generates \`android/\` if
  missing, bundles, syncs, runs Gradle, prints the file. Re-run it after any change; it is the only one you need.
- It needs a **JDK 17-21 + the Android SDK**. If they're missing it says so and stops — run
  \`npx muten android --install\` and it fetches both into \`~/.muten\` (no PATH, no registry, no admin;
  \`rm -rf ~/.muten\` uninstalls) and points this project at them, so nothing needs env vars. ~800MB, once.
- A TOO-NEW JDK fails exactly as hard as a missing one, and Gradle's own error for it ("Unsupported class file
  major version 69") tells you nothing — \`npx muten android\` says it in words instead.
- The .apk lands in \`android/app/build/outputs/apk/debug/\`. It is debug-signed, so it installs on any phone:
  \`adb install -r <that file>\`, or copy it across and open it.
- \`npx cap open android\` opens the project in Android Studio, if you want the IDE or an emulator.

### Live reload
- \`${pm} run android:live\` — deploys to a connected device/emulator with the WebView pointed at \`${pm} run dev\`,
  so edits hot-reload INSIDE the native app. The URL is set from the CLI and never written to
  \`capacitor.config.json\`, so a shipped .apk can't end up pointing at your laptop.
- **You probably don't need it.** \`${pm} run dev\` prints a \`/_qr\` page: scan it and the same app runs on your
  phone's browser with the same hot reload, with no SDK, no cable and no Gradle. Reach for \`android:live\` only
  when you need something the browser doesn't have — a native plugin like camera or push.

### Native abilities (@muten/mobile)
Mobile features are NOT in the muten core (the language stays "web or android?"-agnostic); they come from the
\`@muten/mobile\` plugin, wired here for you (\`plugins { mobile {} }\` in \`muten.config\`). Use them from an escape
(\`~/lib/*.ts\`) with a \`use\` import — never reach for raw Capacitor:
\`\`\`ts
import { notify, vibrate, share, isNative, startWatch } from "@muten/mobile";
notify("Title", "Body", "/route");   // native status-bar notification; tapping it opens the app at /route
vibrate();                            // haptic tap (web: navigator.vibrate)
share("text", "https://url");         // native share sheet
\`\`\`
\`startWatch({ url, rules })\` runs a background foreground-service watcher that notifies even when the app is
closed. Everything falls back gracefully on the web, so the same code runs everywhere. Heavy sensors
(camera/QR/geo/biometrics) stay a \`Custom\` escape — the bar for a native ability is high, like \`Custom\` itself.

### Shipping it
- \`appId\` in \`capacitor.config.json\` is a placeholder (\`com.muten.*\`) — change it to a domain you own BEFORE
  publishing; it is the permanent identity of the app on Play and can never be changed after the first upload.
- Play Store: upload an **.aab**, not the .apk (\`./gradlew bundleRelease\` from \`android/\`). A personal account also
  needs 12 testers for 14 continuous days before production access — that clock is wall time, so start it early.
- The app's icon/name for the launcher come from \`android/app/src/main/res/\` — regenerate them from your logo with
  a tool like \`@capacitor/assets\`; \`public/manifest.webmanifest\` only covers the installable-web-app path.
`;

// Deploy on Vercel: muten routes are real paths (History API), so an unmatched path must fall back to
// index.html (else a hard refresh of /about 404s). Static assets are served first; only routes rewrite.
const VERCEL_JSON = `{
  "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
}
`;

// Which PM launched us? npm/pnpm/yarn/bun set npm_config_user_agent — the idiomatic default.
const detectPM = () => { const ua = process.env.npm_config_user_agent || ''; return PMS.find((p) => ua.startsWith(p + '/')) || 'npm'; };
const validName = (n) => /^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(n);
const keep = (v) => { if (isCancel(v)) { cancel('Cancelled.'); process.exit(0); } return v; };

// The muten mark + wordmark, in the brand orange (#FF5E00) — shown before the prompts. Truecolor ANSI
// (modern terminals); degrades to plain text where unsupported.
const logo = () => {
  const o = '\x1b[38;2;255;94;0m', tile = '\x1b[48;2;255;94;0m\x1b[1m\x1b[97m', b = '\x1b[1m', d = '\x1b[2m', r = '\x1b[0m';
  console.log(`\n  ${tile} M ${r}  ${b}${o}muten${r}`);
  console.log(`  ${d}     the AI-first frontend framework${r}\n`);
};

async function main() {
  const argv = process.argv.slice(2);
  const has = (f) => argv.includes(f);
  const val = (f) => { const i = argv.indexOf(f); return i >= 0 ? argv[i + 1] : undefined; };
  if (has('-v') || has('--version')) { console.log(PKG.version); return; }
  if (has('-h') || has('--help')) { console.log('Usage:\n  create-muten [name] [--css|--scss] [--tailwind] [--daisyui] [--devtools] [--vercel] [--tauri] [--android] [--pm npm|pnpm|yarn|bun] [--no-install]'); return; }

  let name = argv.filter((a, i) => !a.startsWith('-') && argv[i - 1] !== '--pm')[0];
  let style = has('--scss') ? 'scss' : has('--css') ? 'css' : undefined;     // the base stylesheet
  let tailwind = has('--tailwind') ? true : undefined;                        // optional add-on (CSS only)
  let daisyui = has('--daisyui') ? true : undefined;                          // component classes on Tailwind
  let vercel = has('--vercel') ? true : undefined;                            // a vercel.json with the SPA fallback rewrite
  let tauri = has('--tauri') ? true : undefined;                              // src-tauri/ → native desktop app
  let android = has('--android') ? true : undefined;                          // capacitor.config.json → installable .apk
  let devtools = has('--devtools') ? true : has('--no-devtools') ? false : undefined; // @muten/devtools plugin (dev-only overlay)
  let pm = val('--pm');
  let install = has('--no-install') ? false : undefined;
  if (name && !validName(name)) { console.error(`Invalid name: "${name}" (letters, digits, . _ -)`); process.exit(1); }
  if (pm && !PMS.includes(pm)) { console.error(`Unknown package manager: "${pm}" (${PMS.join(', ')})`); process.exit(1); }
  const dpm = detectPM();

  // Styled prompts only with a real TTY (piped/CI input would hang); otherwise use flags + defaults.
  if (process.stdin.isTTY) {
    logo();
    intro(color.dim(`create-muten v${PKG.version}`));
    if (!name) name = keep(await text({ message: 'Project name', placeholder: 'muten-app', defaultValue: 'muten-app', validate: (v) => (v && !validName(v)) ? 'Use letters, digits, . _ - (start alphanumeric).' : undefined }));
    if (!style && tailwind === undefined) { // ONE explicit styling choice — each is opt-in, "CSS" = nothing extra
      const styling = keep(await select({ message: 'Styling', options: [
        { value: 'css', label: 'CSS', hint: 'plain — no framework, zero deps' },
        { value: 'scss', label: 'SCSS', hint: 'adds sass' },
        { value: 'tailwind', label: 'Tailwind CSS', hint: 'utility classes on top of CSS' },
        { value: 'daisyui', label: 'DaisyUI', hint: 'component classes (btn, card, modal) — brings Tailwind with it' },
      ] }));
      style = styling === 'scss' ? 'scss' : 'css';
      tailwind = styling === 'tailwind' || styling === 'daisyui';
      daisyui = styling === 'daisyui';
    }
    if (devtools === undefined) devtools = keep(await confirm({ message: 'Add DevTools? (@muten/devtools — in-app tree, editable state, time-travel; dev-only, zero prod cost)', initialValue: true }));
    if (vercel === undefined) vercel = keep(await confirm({ message: 'Add Vercel deploy config? (vercel.json — fixes real-path routing on Vercel)', initialValue: false }));
    if (tauri === undefined) tauri = keep(await confirm({ message: 'Desktop app? (Tauri — native window, ships the OS webview, needs Rust)', initialValue: false }));
    if (android === undefined) android = keep(await confirm({ message: 'Android app? (Capacitor — an installable .apk; builds in CI, or `muten android --install` gets the toolchain)', initialValue: false }));
  }
  name = name || 'muten-app';
  style = style || 'css';
  if (daisyui) tailwind = true;                 // DaisyUI is a Tailwind plugin
  if (tailwind === undefined) tailwind = false;
  if (daisyui === undefined) daisyui = false;
  if (vercel === undefined) vercel = false;
  if (tauri === undefined) tauri = false;
  if (android === undefined) android = false;
  if (devtools === undefined) devtools = false; // non-TTY default: opt-in via --devtools
  if (tailwind) style = 'css';                  // Tailwind v4 is CSS-native (not SCSS)
  pm = pm || dpm;
  if (install === undefined) install = false;

  const target = resolve(name);
  if (existsSync(target)) { (process.stdin.isTTY ? cancel : console.error)(`"${name}" already exists.`); process.exit(1); }

  // The base template is the pure "muten" app (the welcome page); tailwind/daisyui only swap the stylesheet.
  cpSync(TEMPLATE, target, { recursive: true });
  const ignore = join(target, '_gitignore');
  if (existsSync(ignore)) renameSync(ignore, join(target, '.gitignore'));
  if (vercel) writeFileSync(join(target, 'vercel.json'), VERCEL_JSON); // SPA fallback so real-path routes work on Vercel

  const pkgPath = join(target, 'package.json');
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
  pkg.name = name;
  const addDev = (deps) => { pkg.devDependencies = { ...(pkg.devDependencies || {}), ...deps }; };
  const addDep = (deps) => { pkg.dependencies = { ...(pkg.dependencies || {}), ...deps }; };
  const appendAgents = (text) => { const f = join(target, '.claude', 'AGENTS.md'); if (existsSync(f)) writeFileSync(f, readFileSync(f, 'utf8') + text); };

  if (tailwind) {
    writeFileSync(join(target, 'src', 'styles.css'), tailwindStyles(daisyui) + WELCOME_CSS + FORM_CSS + CHART_CSS + DND_CSS);
    writeFileSync(join(target, 'theme.muten'), daisyui ? DAISY_THEME : TAILWIND_THEME); // seed the theme skeleton for the chosen library
    addDev({ tailwindcss: '^4.0.0', '@tailwindcss/node': '^4.0.0', '@tailwindcss/oxide': '^4.0.0' }); // the native runner drives Tailwind v4 in-process (@tailwindcss/node + oxide), not the Vite plugin
    if (daisyui) addDev({ daisyui: '^5.0.0' });
    appendAgents(TAILWIND_NOTE + (daisyui ? DAISY_NOTE : ''));           // tell the AI what styling is available
  } else {
    writeFileSync(join(target, 'src', style === 'scss' ? 'styles.scss' : 'styles.css'), RESET + WELCOME_CSS + FORM_CSS + CHART_CSS + DND_CSS);
    writeFileSync(join(target, 'theme.muten'), EMPTY_THEME);             // no framework -> empty theme.muten (you fill it; muten emits :root vars)
  }
  const styling = daisyui ? DAISY_ADAPTER : tailwind ? TAILWIND_ADAPTER : null; // the theme adapter wired into muten.config
  const classes = daisyui ? DAISY_CLASSES : null;                               // the Form class map (DaisyUI only — it has component classes; Tailwind-only keeps mu-* + your own rules)
  const plugins = devtools ? ['devtools'] : [];                                 // connectable plugins enabled in muten.config `plugins {}`
  if (devtools) { addDev({ '@muten/devtools': '^0.0.3' }); appendAgents(DEVTOOLS_NOTE); } // dev-only overlay, auto-mounted by `muten dev`
  addDev({ '@iconify-json/lucide': '^1.2.0' }); // default icon set for `Icon "lucide:…"` (build-inlined). Add more sets with `npm i -D @iconify-json/<set>`.
  if (style === 'scss') addDev({ sass: '^1.101.0' });
  if (tauri) {                                  // native desktop wrapper around the same web build (dist)
    cpSync(join(TAURI_TEMPLATE, 'src-tauri'), join(target, 'src-tauri'), { recursive: true });
    writeFileSync(join(target, 'src-tauri', '.gitignore'), '/target\n/gen/schemas\n'); // npm strips real .gitignore from packages
    const confPath = join(target, 'src-tauri', 'tauri.conf.json');
    const conf = JSON.parse(readFileSync(confPath, 'utf8'));
    conf.productName = name;
    conf.identifier = `com.muten.${name.replace(/[^a-z0-9]/gi, '').toLowerCase() || 'app'}`; // reverse-DNS, no dashes/underscores
    conf.app.windows[0].title = name;
    conf.build.beforeDevCommand = `${pm} run dev`;
    conf.build.beforeBuildCommand = `${pm} run build`;
    writeFileSync(confPath, JSON.stringify(conf, null, 2) + '\n');
    addDev({ '@tauri-apps/cli': '^2.0.0' });
    // `tauri` alone errors (it needs a subcommand) → ship explicit run scripts so `tauri dev`/`build` are obvious.
    pkg.scripts = { ...pkg.scripts, tauri: 'tauri', 'tauri:dev': 'tauri dev', 'tauri:build': 'tauri build' };
    appendAgents(TAURI_NOTE(pm));
  }
  if (android) {                                // Android wrapper around the same web build (dist) -> an .apk
    writeFileSync(join(target, 'capacitor.config.json'), JSON.stringify({
      appId: `com.muten.${name.replace(/[^a-z0-9]/gi, '').toLowerCase() || 'app'}`, // reverse-DNS placeholder; own the domain before publishing
      appName: name,
      webDir: 'dist',                           // what `muten bundle` writes — the SPA, so the .store survives navigation
    }, null, 2) + '\n');
    // devDeps, not deps: nothing from Capacitor is imported by the .muten app or reaches its bundle — the .apk is
    // built from dist/, so the app keeps shipping zero runtime dependencies.
    addDev({ '@capacitor/cli': '^8.4.2', '@capacitor/core': '^8.4.2', '@capacitor/android': '^8.4.2' });
    // @muten/mobile: native notifications (incl. a background foreground-service watcher), tap-to-open deep-links,
    // haptics + share — used via `use … from "@muten/mobile"`. Its android/ Capacitor module is auto-discovered by
    // `cap sync`; the optional @capacitor/* peers below make notify()/vibrate()/share() work natively out of the box.
    addDev({ '@muten/mobile': '^0.0.2', '@capacitor/local-notifications': '^8.0.0', '@capacitor/haptics': '^8.0.0' });
    plugins.push('mobile'); // -> muten.config `plugins { mobile {} }` (registry-less: the loader skips it, the `use` seam does the work)
    // TWO scripts, deliberately. `muten android --build` already chains toolchain-check → cap add → bundle → sync
    // → gradlew, so init/sync/check/open as separate scripts only made you learn an order the tool knows. The
    // toolchain install stays unscripted on purpose: it runs once per machine ever, and the doctor prints the
    // exact line at the moment you need it — better than a script you must first know exists.
    pkg.scripts = {
      ...pkg.scripts,
      'android': 'muten android --build',
      // `--live-reload` sets the URL from the CLI and does NOT persist it into capacitor.config.json — so a
      // shipped .apk can never end up pointing at somebody's 192.168.*. Port matches `muten dev`'s default.
      'android:live': 'cap run android --live-reload --port 5173',
    };
    mkdirSync(join(target, '.github', 'workflows'), { recursive: true });
    writeFileSync(join(target, '.github', 'workflows', 'apk.yml'), APK_WORKFLOW(pm)); // the .apk with no local toolchain
    // android/ is regenerated by `cap add android`, like dist/ by the build: disposable, so it stays out of the
    // diff and out of the AI's way. CI rebuilds it from scratch every run, which also proves it stays disposable.
    const gitignore = join(target, '.gitignore');
    if (existsSync(gitignore)) writeFileSync(gitignore, `${readFileSync(gitignore, 'utf8')}android/\n`);
    appendAgents(ANDROID_NOTE(pm));
  }
  if (styling || plugins.length) writeFileSync(join(target, 'muten.config'), mutenConfigText({ styling, classes, plugins })); // the build config, in muten (plugins + theme adapter); css-only with no plugins is zero-config
  writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');

  const desc = `muten, ${style}${tailwind ? ' + Tailwind' : ''}${daisyui ? ' + DaisyUI' : ''}${devtools ? ' + DevTools' : ''}${vercel ? ' + Vercel' : ''}${tauri ? ' + Tauri' : ''}${android ? ' + Android' : ''}`;
  if (!install) {
    if (process.stdin.isTTY) { note(`cd ${name}\n${pm} install\n${pm} run dev`, 'Next steps'); outro(color.green(`Created ${name}  (${desc})`)); }
    else console.log(`\n  Created ${name} (${desc}, ${pm})\n  cd ${name} && ${pm} install && ${pm} run dev\n`);
    return;
  }

  if (process.stdin.isTTY) outro(color.green(`Created ${name} (${desc}) — installing with ${pm}…`));
  // PMs are .cmd shims on Windows → spawn needs shell:true to find them.
  const run = (a) => spawnSync(pm, a, { cwd: target, stdio: 'inherit', shell: process.platform === 'win32' });
  if (run(['install']).status === 0) run(['run', 'dev']);
}

main();
