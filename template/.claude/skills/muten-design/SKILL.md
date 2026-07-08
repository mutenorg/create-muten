---
name: muten-design
description: Make a Muten app look genuinely good — layout, color, typography, density, motion. Invoke when building or restyling any page/screen, or whenever the result looks flat, generic or "AI-made". You already know how to build; this is the taste. Copy the closest showcase, adapt it to the data, then elevate it.
---

# Designing a Muten app — the taste layer

You can already write Muten. This is how to make it look like a product someone shipped, not a skeleton.
**One rule above all: don't design from a blank page — copy the closest showcase/reference page, adapt it to
this app's data, then *elevate* it.** Calcar → acoplar → mejorar. Inventing layout from scratch is where flat,
generic pages come from.

## The design system is already in the app — USE it, don't reinvent
Every scaffolded app imports `@muten/shadcn` (globals + the **editorial** theme + motion). So the vocabulary
already exists — style with these **semantic tokens** via `class("…")`, never random hexes:

- **Surfaces:** `bg-background` (page) · `bg-card` / `bg-muted` (raised) · `bg-popover` (overlays) · `border-border` (`border`).
- **Text:** `text-foreground` (primary) · `text-muted-foreground` (secondary/meta) · `text-card-foreground`.
- **Accent:** `bg-primary text-primary-foreground` (the ONE brand action) · `bg-secondary` · `bg-accent` (hover/active).
- **Status (semantic, separate from accent):** `text-destructive` / `bg-destructive`; for good/warn use intentional Tailwind (`text-emerald-500`, `text-amber-500`) — pick, don't sprinkle.
- **Radius/shadow:** `rounded-lg` / `rounded-xl` on cards; `shadow-sm` sparingly. Consistent radius across the app.
- **Motion:** `animate-fade-in`, `animate-scale-in` (from motion.css) on mount/reveal — a light touch, not everywhere.

Recolor the whole app by editing `theme.muten`'s color tokens (they drive every shadcn token) — not per-element.

## Real components, not hand-rolled Stacks
For cards, avatars, badges, tabs, dialogs, selects → use the **shadcn parts** (`plugins { shadcn }`): `Card { CardHeader { CardTitle "…" } CardContent { … } }`, `Avatar(name: …)`, `Badge(label: …, variant: …)`, `Tabs`, `Combobox`. Hand-building these from raw `Stack`+classes is what reads as flat/AI-made. (The injected reference shows the exact call.)

## Layout — the bones
- **App shell:** a persistent `Header`/`Nav` (and `Sidebar`/rail for apps) on every page, `Page` for the body. Landmarks (`Header`/`Nav`/`Sidebar`/`Footer`) are flex-column by default; a horizontal region = `Stack class("flex flex-row items-center")`.
- **Density with intent:** dashboards/chat/admin = **dense** (`gap-2`, `p-3`, `text-sm`, tight rows). Marketing/landing = **airy** (`gap-8`, `py-16 md:py-24`, big type). Match the product; don't make a chat app breathe like a landing page.
- **Rhythm:** lay out siblings with `flex`/`grid` + `gap`, never per-element margins. One spacing scale, reused. Content column capped (`max-w-3xl`/`max-w-5xl` + `mx-auto`) for reading; full-bleed only for shells.
- **Hierarchy:** every screen has ONE focal point. Group with cards/sections; separate zones with `border` + `bg-muted`, not just gaps.

## Typography
- Titles carry weight: `Title "…" h1 class("text-3xl md:text-4xl font-semibold tracking-tight")`. The editorial theme pairs a serif display (Fraunces) with a clean body (Inter) — lean into that contrast for headings vs body.
- Body `text-sm`/`text-base` with `text-muted-foreground` for secondary. Uppercase labels get `text-xs uppercase tracking-widest text-muted-foreground`. Numbers that line up → `tabular-nums`.
- Never a wall of same-size text. Establish a scale (display / heading / body / meta) and stay on it.

## Make it feel REAL (this is what "scale in complexity" needs)
- **Real seed data, plenty of it:** 6–12 rows per list with believable names/values/timestamps — not "Item 1, Item 2". A list with 2 rows looks like a demo; 10 looks like an app.
- **Every state:** empty (`when list.length == 0 { … a real empty state … }`), active/selected (`class("bg-accent" when …)`), hover, loading (`when q.loading`), counts/badges. An app is its states.
- **Formatting via built-ins:** `money()`, `ago()`, `initial()`, `date()`/`time()` — never raw values or hand-rolled JS.
- **Interactions that work:** the composer appends, the tab switches the view, the filter filters, the toggle toggles. Wire the obvious actions.

## Copy is design
Name things the way a user recognizes them (a person manages *notifications*, not *webhook config*). Buttons say what happens ("Publish"). Errors say what's wrong + how to fix. Write real labels, never lorem.

## The 6-point pass before you call a page done
1. One clear focal point + real hierarchy (not a flat list of same-weight blocks).
2. Semantic tokens only — no random hexes; accent used once, with purpose.
3. Right density for the product; consistent spacing + radius.
4. Real, plentiful seed data; empty/active/hover states present.
5. shadcn parts for components; a light motion touch on reveal.
6. It doesn't look like the default template — you elevated the showcase, not just recolored it.

## Avoid the generic-AI look
Centered-everything, one acid accent on near-black, `rounded-lg` on every box, emoji as section markers, a giant hero on a tool that isn't a landing page, Inter-for-everything. Copy the showcase's *considered* choices instead; spend boldness in ONE place and keep the rest quiet.
