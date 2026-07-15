## ALPHA - STILL ON DEVELOPMENT
Muten is still under active development. We are currently in the alpha stage and are working on training models with Muten. Please keep in mind that improvements are being made gradually, and version 1.0 has not been released yet.

The official scaffolder for **[Muten](https://www.npmjs.com/package/@muten/core)**: an AI-first
frontend framework. One command bootstraps a complete, ready-to-run Muten app, so you never copy
boilerplate by hand.

```sh
npm create muten@latest
```

## Why this exists

Muten ships as **two** packages - the same split as `vue` ↔ `create-vue`:

- **[`@muten/core`](https://www.npmjs.com/package/@muten/core)**: the engine (compiler + runtime +
  the runner: `muten dev` / `muten bundle`). Your app installs it as a normal dependency and it stays up to date on its own.
- **`create-muten`** (this package) - a tiny CLI whose only job is to generate a new project already wired to
  the engine: `index.html`, a `theme.muten`, a first page, the AI reference under `.claude/`, and the right
  `package.json`.

You run `create-muten` **once** to scaffold; after that you just work inside your project.

## Quick start

Every package manager has a `create` shortcut. `create-muten` detects which one you used and makes it
the default for the rest of the prompts:

```sh
npm  create muten@latest        # npm
pnpm create muten               # pnpm
yarn create muten               # yarn
bun  create muten               # bun
```

Prefer no install step? Run it on demand with **npx**, optionally naming the folder:

```sh
npx create-muten my-app
```

Or install it **globally** and reuse the command anywhere:

```sh
npm i -g create-muten
create-muten my-app
```

Then start the app:

```sh
cd my-app
npm install        # only if you skipped the auto-install
npm run dev
```

## What it asks

In an interactive terminal it prompts for a few things (defaults in parentheses):

| Prompt | Options | Default |
|---|---|---|
| **Project name** | any valid folder name | `muten-app` |
| **Styling** | `CSS` / `SCSS` / `Tailwind CSS` / `DaisyUI` (brings Tailwind) | `CSS` |
| **Add DevTools?** | `Y` / `n` — in-app DevTools ([`@muten/devtools`](https://www.npmjs.com/package/@muten/devtools)), dev-only | `Y` |
| **Add Vercel deploy config?** | `Y` / `n` | `n` |
| **Desktop app (Tauri)?** | `Y` / `n` | `n` |
| **Android app (Capacitor)?** | `Y` / `n` — an installable `.apk` | `n` |
| **Package manager** | `npm` / `pnpm` / `yarn` / `bun` | the one that launched it |
| **Install deps and start dev now?** | `Y` / `n` | `Y` |

**Styling is one explicit choice**: each is opt-in, nothing is bundled by default: `CSS` (plain) or `SCSS`
ship no framework; `Tailwind CSS` adds `tailwindcss` + `@import "tailwindcss"` (the native runner compiles it
in-process — no Vite); `DaisyUI` adds its component classes on top (and brings Tailwind). You always style via `class("…")`.

**Targets are independent opt-ins**: web, desktop, mobile, any mix, or none - all from the same `.muten` source.
There is no per-target build: the app is one `muten bundle`, and each target is a shell around it.
- **Vercel** writes a `vercel.json` so muten's real-path routes don't 404 on a hard refresh (SPA fallback to `index.html`).
- **Tauri** adds `src-tauri/` (a native desktop app - ships the OS webview, *not* a browser):
  `npm run tauri:dev` / `npm run tauri:build`. Needs the [Rust toolchain](https://rustup.rs) (not auto-installed).
- **Android** adds `capacitor.config.json`, `npm run android` and a CI workflow. `npm run android` is the whole
  build - it checks the toolchain, generates `android/`, bundles, syncs and runs Gradle - and prints the `.apk`.
  Nothing to install: `.github/workflows/apk.yml` builds it on a runner that already has the Android SDK. Want it
  locally too? `muten android --install` fetches a JDK 21 + the SDK into `~/.muten` (no PATH, no admin;
  `rm -rf ~/.muten` uninstalls). **No `.apk` needed at all** for an installable app: `public/manifest.webmanifest`
  ships by default, so any muten app installs from the browser (Chrome ▸ Install) with an icon and no URL bar.

## Styling

There is ONE way to style: `class("…")`. When **Tailwind or DaisyUI** is added, `theme.muten` is centralized
to **match Tailwind's scale**, so its emitted CSS vars line up with the utilities you write in `class("…")`;
plain CSS/SCSS keeps the default scale and you read the same vars from `src/styles.css`. **DaisyUI** adds
component classes (`btn`, `card`, `modal`) usable in `class("…")` - pure classes; behavior is Muten state + `on()`.

**Component libraries** come as Muten plugins (npm packages with a registry). After scaffolding with `--tailwind`,
add one - e.g. `npm i @muten/shadcn`, then `muten add card dialog …` to copy the source into `src/parts/`, or
`plugins { shadcn {} }` in `muten.config` to import its parts as-is: the full [shadcn/ui](https://ui.shadcn.com)
set ported to Muten. See [`@muten/shadcn`](https://www.npmjs.com/package/@muten/shadcn).

**DevTools** are also a plugin — [`@muten/devtools`](https://www.npmjs.com/package/@muten/devtools), a dev-only
in-app overlay (component tree, editable state, Redux-style history + time-travel, profiler, element picker) with
**zero production cost**. Accept the *Add DevTools?* prompt (or pass `--devtools`) and `muten dev` auto-mounts it.
Add it to an existing app any time with `muten add devtools` — it installs the package and enables it in
`muten.config` (`plugins { devtools {} }`) for you.

If you accept the last prompt it runs `<pm> install` followed by `<pm> run dev`, your app is live in a
single step. Choosing SCSS also adds `sass` and switches the stylesheet to `.scss` automatically.

## Non-interactive (CI / scripts)

Pass the answers as arguments and it skips every prompt (this is also what runs when there is no TTY,
e.g. in CI):

```sh
create-muten my-app --scss --pm pnpm      # full control
create-muten my-app --css --no-install    # just scaffold, decide later
```

| Flag | Effect |
|---|---|
| `<name>` | the project folder (positional argument) |
| `--css` / `--scss` | pick the stylesheet (default: `css`) |
| `--tailwind` | add Tailwind CSS v4 on top of CSS (forces `--css`) |
| `--daisyui` | add DaisyUI component classes (implies `--tailwind`) |
| `--devtools` / `--no-devtools` | add (or skip) the in-app DevTools plugin `@muten/devtools` (default: added interactively) |
| `--vercel` | add `vercel.json` (SPA fallback so real-path routes work on Vercel) |
| `--tauri` | add `src-tauri/` - a native desktop app (needs the Rust toolchain) |
| `--android` | an installable `.apk`: `capacitor.config.json` + `npm run android` + a CI workflow. `npm run android` is the whole build (toolchain check → `android/` → bundle → sync → Gradle → the file); the workflow does the same with nothing installed locally; `muten android --install` fetches a JDK + the SDK into `~/.muten` if you want it on your machine |
| `--pm <npm\|pnpm\|yarn\|bun>` | package manager to use (default: detected) |
| `--no-install` | scaffold only - don't install or start the dev server |
| `--help` | print usage and exit |
| `--version` | print the version and exit |

## What you get

A minimal, conventional Muten app:

```
my-app/
├─ index.html              # entry - loads /src/app.muten through muten's runner
├─ muten.config            # the build, in muten (dev port; theme adapter with Tailwind/DaisyUI)
├─ theme.muten             # your design tokens: spacing, fonts, weights, breakpoints
├─ package.json            # depends on @muten/core (the runner is built in)
├─ .claude/                # the full muten reference your AI reads: AGENTS.md + a Claude skill
├─ public/                 # copied as-is: the logo, and manifest.webmanifest (makes the app installable)
└─ src/
   ├─ app.muten            # the ROOT: routes (+ an optional persistent shell)
   ├─ styles.css           # your look (.scss if you chose SCSS)
   └─ pages/
      └─ home/home.muten   # a page - the folder name is its route
```

Each target adds its own folder next to these, and nothing else changes: `--tauri` → `src-tauri/`,
`--android` → `capacitor.config.json` + `.github/workflows/apk.yml`, `--vercel` → `vercel.json`.

There is **no hand-written `main.js`**: muten's runner compiles `src/app.muten` into the app's entry,
so the whole app is `.muten` from the first line.

## What you can build

**Honest framing first.** muten isn't trying to beat React/Vue/Svelte at being general-purpose, they win there.
muten wins when an **AI builds and maintains the app**: the whole language fits in context, a compiler (`muten
check`) catches mistakes in milliseconds without a browser, edits stay tiny, and almost no JS ships. Best fit: the
declarative 80% - CRUD, dashboards, catalogs, content, internal tools. For the rest, you don't fight it - you
**couple in other tech** through bounded escapes. Reach for the **lowest tier that works**:

- **Pure muten**: CRUD / SaaS / catalog / dashboard / content: pages, routing (paths are **quoted strings**: `routes { "/" -> home  "/404" -> notfound }`; `Link "label" -> "/path"`; guard redirects `else "/login"`), `state`/`store` (with page->store action composition), `query` over REST, `Form` (text/number/email/bool/enum/date/password/textarea + validation), `DataTable`, `when`/`each`, SSG + SEO, and the bounded **list toolkit**: inline objects, `patch where`/`remove where` edits, `each...where` filter, aggregates (`sum`/`count`/`avg`/`min`/`max by`), `sort`/`sortDesc by` (literal field or a `text` state for a user-chosen column), `take(n)` pagination, `toggle`. `use` functions callable as **statements** inside `action`/`effect` (side effects: persist, scroll, analytics). `on(enter: action)` on inputs for Enter-to-submit without `Custom`. The declarative 80%, zero extra deps.
- **muten + the platform** *(no framework runtime)* - native HTML + `class()`, CSS libs (Tailwind / DaisyUI),
  **vanilla JS via `Custom`** (maps, rich-text editors, canvas/WebGL), `use fmt from "./lib.ts"` for any JS logic.
  muten ships zero framework runtime, so there is no React/Svelte escape; foreign UI comes in as a vanilla
  `Custom` component. **Check the primitives first** - `Chart`, `Icon`, `Video`, `Image`, `Select`, `Date`,
  `Range`, `Checkbox`, `Password`, `Number` and drag-and-drop (`draggable`/`droptarget`) are all native and
  oracle-checked. Escaping for one of those ships JS you didn't need and loses the compiler at that seam.

**Deploy, honestly:** `npm run dev` runs both tiers. For production:

- `muten build` (CLI SSG) ships zero-JS HTML per route - now **fully styled** (it inlines the theme + project `styles.css`) and **pre-rendered** (it SSRs your store/`query` data). A no-bundler static export still can't bundle `use` functions (it warns) or persist store state across full-page navigations. Great for crawlable static/content pages.
- **`muten bundle`** is the path for any **stateful** app. It bundles everything - `use` functions, `Custom` components, shared cross-page state - and is what most Muten apps ship with.

Most real apps use `muten bundle`.

Full reference (every primitive, the tiers, the roadmap): [`@muten/core`](https://www.npmjs.com/package/@muten/core).

> **Status: pre-1.0.** The core (language, compiler, CLI, the runner - `muten dev`/`bundle` with surgical
> HMR - and the VS Code extension) is solid; the ecosystem is young. Great for real apps, not yet for critical production.

## Known limitations

These are honest gaps found during stress-testing. They are tracked; none are design mistakes.

- **`muten build`** ships styled, SSR'd HTML, but a no-bundler static export can't bundle `use` functions or keep store state across full-page navigations (see Deploy above) - use `muten bundle` for a stateful app.
- `DataTable` renders raw cell values; no per-column formatting yet (use `each` + a `Part` for formatted cells).
- An `Icon` name is a static literal; a per-value icon is a `match` over static Icons, a data-URL icon is an `Image`.
- `Form` renders all entity fields (no conditional fields), enum fields cannot be `required`. Field types: `text`/`number`/`email`/`bool`/`enum`/`date`/`password`/`textarea` (an unknown type is flagged `unknown-field-type`; drop it to a `Custom`).
- `query x live` (WebSocket) requires the server to send an `id` per row for keyed diffing.
- `Custom` inputs get a snapshot of state at mount by default; for reactivity, `mount` returns an updater function that re-runs when the bound `@` state changes.

## Requirements

- **Node.js 18+**
- One of: **npm**, **pnpm**, **yarn**, **bun**

## Cross-platform

`create-muten` is a Node CLI (not a shell script), so the **exact same command** works on **Windows,
macOS and Linux**: npm generates the right launcher on each OS.

## Links

- Engine - [`@muten/core`](https://www.npmjs.com/package/@muten/core)
- Source - [github.com/mutenorg/create-muten](https://github.com/mutenorg/create-muten)
- License - MIT
