# Parts - reusable composition

A `part` is a reusable fragment of UI. It is **inlined at build time**, not a runtime component - there is no
component instance, no extra runtime, no prop-diffing. Think of it as a typed macro: the part disappears and
its tree is substituted in place, with the call's arguments filled in.

## Defining a part

Parts live in `src/parts/<name>.muten` and have a **single root**. Params are typed; you pass **objects**
(`$x.field`) and **action callbacks** (`-> $onPick(...)`):

```muten
# src/parts/feature.muten
part Feature(item: Feature, onPick: action) {
  Stack class("card flex flex-col gap-2") {
    Title "{$item.title}" h3
    Text  "{$item.body}"
    Button "Choose" -> $onPick($item.id)
  }
}
```

- Object params are read as `$item.field` inside the part.
- Action params are called as `-> $onPick(arg)`.
- A scalar param (`text`/`number`) also takes a **literal or a ref**: `Stat(label: "Users", value: userCount)`
  - a quoted literal stays literal, a bare name is a ref.

## Using a part

Call it like a primitive, passing the args by name:

```muten
each features as f {
  Feature(item: f, onPick: select)
}
```

```muten
part Stat(label: text, value: number) {
  Stack class("stat") { Span "{$value}" class("stat-n")  Span "{$label}" class("stat-l") }
}
# use it:
Stat(label: "Active users", value: activeCount)
```

## `slot` - wrap arbitrary content

A part can hold a single `slot`: the marker where the **caller's children inline**. This is how you write a
reusable *frame* - a card, panel, modal, section - that wraps content it doesn't know in advance:

```muten
# src/parts/panel.muten
part Panel(title: text) {
  Stack class("rounded-xl border border-line bg-panel") {
    Span "{$title}" class("font-semibold px-4 h-11 flex-row items-center border-b border-line")
    Stack class("p-4") { slot }          # ← the caller's children land here
  }
}
```
```muten
# the page provides the body; it can be anything:
Panel(title: "Revenue") {
  Stat(label: "MRR", value: mrr)
  BarChart(@points)
}
```

This is the **container / presentational** split: the page is the *container* (it owns the state, actions and
data); the part is *presentational* (pure UI). The slot content is authored in the page, so it reads the **page's**
scope - its state, its `each` item, its actions:

```muten
each users as u {
  Row { Avatar(src: u.pic)  Span "{u.name}"  Button "Ban" -> ban(u.id) }   # u, ban resolve in the page
}
```

Rules (kept deliberately small):
- **One `slot` per part** (two is a compile error). A single outlet covers cards/panels/modals/sections.
- **No children passed → the slot renders nothing** (a frame can be used empty).
- The slot is **unscoped**: the part doesn't expose its params to the content, and the content doesn't call into
  the part - communication goes through the container (its state/actions), which both sides already see. For
  per-item context use `each` (above); for a widget that needs its own internal scope (a canvas, a map) use a
  [`Custom`](escapes.md). muten has no scoped slots / render-props on purpose - that's the runtime-component model
  it avoids.

Like everything else a part does, the slot **inlines at build**: `Panel { … }` becomes the wrapper tree with the
children spliced in, zero runtime, identical bundle.

## When to use a part vs a `Custom`

| Need | Reach for |
|---|---|
| Repeat a chunk of **Muten** UI (a card, a stat, a nav item) | a **`part`** |
| A widget Muten can't express natively (a map, a rich-text editor - NOT a chart, that's the native `Chart`) | a [`Custom`](escapes.md) |

A part is pure Muten - it stays inside the language and the oracle. Use it to DRY a repeated row (one template,
N calls) instead of copy-pasting; it's fewer tokens for the same bundle (the part inlines, so the output is
identical to writing it out).

## See also
- [Escapes](escapes.md) - `Custom` for non-Muten widgets, `use` for logic.
- [Lists](lists.md) - `each` + a part is the idiom for a styled, repeated list.
