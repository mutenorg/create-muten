# Styling

Muten ships **structure**, never a skin. There is **one way to style** - the `class("…")` modifier - and it
carries both layout and look. The engine is **agnostic**: it knows no CSS framework. You bring the appearance
(Tailwind utilities, or your own CSS backed by design values from `theme.muten`), and Muten emits raw class
names that any of them understands.

## `class("…")` - the one path

```muten
Stack class("flex flex-col gap-4 p-6")          # column with gap + padding
Header class("flex flex-row justify-between items-center")
Stack class("grid grid-cols-3 gap-4")           # a 3-col grid
Text  "Total" class("text-xl font-bold")
```

- A `Stack` is **flex-column by default**; a horizontal row is `class("flex flex-row")` (there is no `Row`
  primitive). Layout is CSS - Muten doesn't reinvent grid/flex.
- Responsive: prefix with breakpoints - `class("grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4")`.
- Static appearance (colors, borders, shadows) has **no inline-style hatch** - it all goes through `class()` +
  your CSS. The one exception is a value that **changes at runtime** (a progress width, a dynamic transform):
  use [`style()`](#dynamic-values--style) below.

### Reactive classes

`class()` also **toggles** by a condition (computed once per change):

```muten
Stack class("panel" active when isOpen)              # toggles `active`
Button class("ring-2 ring-primary" when invalid)     # multi-class: each token toggles
```

A **hyphenated or multi-class** name must be **quoted** in a reactive toggle (`class("is-open" when x)`) - a
bare `is-open` parses as a subtraction and errors. Stack several toggles on one node freely.

### A class from a value - `class("prefix-{x}")`

To pick a class **from a state/enum value**, interpolate it into the token - it's applied reactively (the old
token is swapped for the new when the value changes):

```muten
each members as m {
  Stack class("status-dot") class("status-{m.status}")   # → status-online / status-idle / status-dnd / …
}
```
```css
.status-online { background: var(--success); }
.status-idle   { background: #f0b232; }
```

Use this for an **enum-driven class** instead of one toggle per value - `class("online" when m.status == "online")
class("idle" when m.status == "idle") …` is the verbose anti-pattern (DRY: one interpolated token replaces N
toggles). The interpolated reference is **oracle-checked** (a typo'd/renamed state is caught). The *class names*
themselves are still your CSS (muten can't know `.status-online` exists - that's your stylesheet's job).

## Dynamic values - `style()`

`class("prefix-{x}")` interpolates a value into a class **name** (great for an enum → `status-online`), but it
can't produce a **continuous** value like `width: 40%` (you'd need a class per percent). For a CSS value
**driven by state** - a progress bar's width, a data-driven size, a transform - use `style()`:

```muten
state { pct = 40 : number }
Stack class("bar") style(w: "{pct}%")        # sets CSS variable --w to "40%", reactively
```
```css
.bar { width: var(--w); transition: width .2s; }
```

- Each key becomes a **CSS custom property** `--key` - muten prepends `--`, so `style()` can **only** set
  variables, never an arbitrary property. It never competes with `class()` / Tailwind.
- The value is an interpolated string (`"{pct}%"`, `"translateX({x}px)"`, `"{rows}rem"`); it updates
  **reactively** when it reads state. A literal value (`style(c: "red")`) is set once.
- Your CSS consumes it with `var(--key)`. The *look* stays in CSS; only the *changing value* lives in muten.
- Use `class()` for everything static; reach for `style()` **only** when a value changes at runtime.

## Hover: never move it, never fade it on a list

Two hover styles compile clean, look right in a screenshot, and make the UI blink under a real pointer:

- **Moving the element** (`hover:-translate-y-1`, `transform: translateY(-4px)`): a pointer resting on its bottom edge
  makes it rise off the pointer, drop back under it and rise again, forever. Scaling up is safe; moving is not.
- **Fading the colour of a row, a menu item, a nav link or a button** (`transition-colors`, `transition: background
  150ms`): sweeping a list leaves trails and every row dims in the gap between two of them; the menu reads as blinking.
  Make that hover instant, as shadcn does.

The `muten-design` skill has the fix for a card that must lift.

## Two backings - pick one per app

**Tailwind** (the default scaffold) - write utilities directly:

```muten
Stack class("flex flex-col gap-4 p-6 rounded-lg bg-zinc-900 text-white")
```

**Library-free** - write real CSS in `src/styles.css` using the CSS variables `theme.muten` emits, then apply a
semantic class:

```css
.card { padding: var(--space-lg); border-radius: var(--radius-md); background: var(--color-surface); }
```
```muten
Stack class("card")
```

The scaffold ships base classes like `.mu-stack` (the `Stack` primitive's flex-column) and the auto-Form skin
(`.mu-field`, `.mu-label`, …) - override them freely.

## `theme.muten` - design values → CSS variables

`theme.muten` is the agnostic **source of design values**. Muten emits each entry as a `:root` custom property
your CSS / `class()` consumes:

```muten
theme {
  space       { xs "4px"  sm "8px"  md "16px"  lg "24px"  xl "32px" }   # → --space-md: 16px
  font        { sm "13px"  md "15px"  lg "20px"  xl "28px" }             # → --font-lg
  weight      { medium "500"  bold "700" }
  leading     { tight "1.2"  normal "1.5" }
  breakpoints { sm "640px"  md "768px"  lg "1024px" }
  colors      { primary "#6366f1"  "base-100" "#1a1d23" }               # hyphenated keys QUOTED → --color-base-100
  radius      { box "0.75rem" }
}
```

No reset or rules go in `theme.muten` - only values. The reset and look live in `src/styles.css`.

### With a CSS framework - the agnostic adapter

`theme.muten` holds your **values**; a **styling adapter** (pure data in `muten.config`, wired by the
scaffolder per library) tells Muten how to emit them for Tailwind/DaisyUI. The **engine knows no library** -
you bring the styling, Muten emits your theme into its format. Plain css/scss gets generic `:root` vars (no
`muten.config` - only Tailwind/DaisyUI scaffolds get one). Validation of class names is your library's job
(its IntelliSense / build) - Muten stays agnostic.

The adapter is written in muten in `muten.config` under a `styling { … }` block: a `prefix { … }` map (section →
CSS-var prefix) and `blocks { name { selector "…" sections [ … ] } }` (each `name` wraps the listed theme
sections into one CSS block under that `selector`). Selectors drop the trailing `{` and use single quotes
(muten strings can't hold `{`/`"`) - e.g. `selector "@theme"` or `selector "[data-theme='light']"`. DaisyUI
also gets a `classes { … }` block that maps the auto-`Form` slots to its component classes.

### Connecting a component library - `theme <library> { … }`

`theme.muten` can name the library that dresses the app. That one file then brings its stylesheets in, picks its
preset and extras, and overrides its tokens - nothing to import in `styles.css`, no adapter in `muten.config`:

```muten
theme shadcn {
  preset noir                  # the library's themes/noir.css
  with nova, kit               # its extra stylesheets (nova.css, kit.css)
  mode light                   # or dark: the class and data-theme it needs on <html>
  primary "#6B46F2"            # any token the library declares, by its own name (--primary)
  radius "0.75rem"
  dark { primary "#8B6CF6" }   # the same tokens for dark mode, on the library's dark selector
  colors { brand "#ff0" }      # your own scales still work (--color-brand)
}
```

The library is found by convention in `node_modules` (`theme shadcn` → `@muten/shadcn`, then `shadcn`): its
`globals.css`, `themes/*.css` presets, the other root stylesheets as extras, its custom properties as tokens.
Its parts are enabled too. `check` says when the library isn't installed, a preset/extra/token doesn't exist (with
the closest one), a value isn't a value, or Tailwind is missing.

### A React library's theme, from theme.muten

MUI, Chakra and gluestack theme themselves with a JavaScript object, and compute shades from real colors (a `var()`
is no use to them). Their provider reads theme.muten's values, so the whole app has one look:

```muten
use react ThemeProvider from "@mui/material"
use createTheme from "@mui/material"
get look = createTheme({ palette: { primary: { main: theme.colors.primary } }, shape: { borderRadius: theme.radius.md } })
ThemeProvider(theme: look) { … }

use createSystem, defaultConfig, defineConfig from "@chakra-ui/react"
get system = createSystem(defaultConfig, defineConfig({ theme: { tokens: { colors: { brand: { value: theme.colors.primary } } } } }))
ChakraProvider(value: system) { … }
```

Better still, declare the provider **once in theme.muten**; every component of that library, on every page, is
wrapped in it, and the pages only use the components:

```muten
# theme.muten
use createTheme from "@mui/material"
theme { colors { primary "#6B46F2" }  radius { md "12px" } }
provider ThemeProvider(theme: createTheme({ palette: { primary: { main: theme.colors.primary } } })) from "@mui/material"
provider ChakraProvider(value: createSystem(defaultConfig, defineConfig({ … }))) from "@chakra-ui/react"
```

`theme.colors.primary` is the value theme.muten has, fixed at build (with a library connected, its tokens by name:
`theme.primary`); a name it lacks is a `check` error with the closest one. Change the color in theme.muten and every
library follows. shadcn needs none of this: `theme shadcn { primary "…" }` sets its CSS variables directly.

## Why one path

`class()` being the only styling route is deliberate: it keeps appearance in CSS (where it belongs and where
tooling is mature) and keeps the Muten tree about structure + logic. It's also why accessibility is **not** a
styling concern - see [Accessibility](accessibility.md).

## See also
- [Accessibility](accessibility.md) - a11y is expressed in code (`aria`), not in `class()`.
- [Mental model](mental-model.md) - structure (primitives) vs look (`class`).
