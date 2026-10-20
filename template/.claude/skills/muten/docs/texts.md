# Texts in several languages - `src/lang` and `t()`

An app that speaks more than one language keeps its texts as **data**, one file per language, and the pages
name them by key. No `.ts` table, no passing the language around.

```
src/lang/es.lang
src/lang/en.lang
```

```
# src/lang/es.lang - one text per line: key "text"
login.email   "Correo"
plan.left     "Te quedan {0} de {1}"
cart.items    "{0} producto | {0} productos"
plan.free     "Gratis"
plan.pro      "Pro"
```

- `{0}`, `{1}` are the values the call passes, in order.
- `singular | plural` picks by the **first** value: 1 → the left side, anything else → the right.
- A file is named by its language **code** (`es`, `en`, `pt-BR`): that code is what `lang.use()` and `<html lang>` carry.

## In a page

```muten
Text "{t("login.email")}"
Text "{t("plan.left", used, cap)}"
Text "{t("cart.items", cart.count)}"
Text "{t("plan.{tier}")}"                 # a key built at run time: plan.free / plan.pro
```

`t` is there by itself once `src/lang/` exists (no `use`). The language comes from the built-in **`lang`** store:

```muten
Text "{lang.current}"                     # "es"
each lang.list as code { Button "{code}" -> pick(code) }
action pick(code: text) { lang.use(code) }  # changes every text on screen, remembers it, sets <html lang>
```

`lang.current` starts as what the reader chose last time, else the browser's language, else `index.html`'s
`<html lang>`, else the first file.

### A page in another language than the app

A store page speaks its owner's language, not the visitor's app setting:

```muten
screen shop
lang from shop.lang                       # every t() on this page uses this language
```

## What check says

`muten check` (and the editor, as you type) reads the files against the pages:

| Code | What it means |
|---|---|
| `t-unknown-key` | no language has that key (with the closest that exists), or a run-time key no key fits |
| `t-values` | `"Hola, {0}"` needs a value the call doesn't pass (or passes ones that never show) |
| `lang-missing` | a language lacks keys another has: its reader would see the bare key |
| `lang-values` | the same key fills `{0}` in one language and nothing in another |
| `lang-syntax` | a line that is not `key "text"`, or a key written twice |
| `lang-code` | a file not named by a language code |

## What ships

Each page carries **only the texts it names**, in every language (a run-time key brings the keys that fit it). A
page with three texts ships three, not the whole app's table. A missing text falls back to another language,
then to the key itself, so a screen never goes blank.

## Moving from a `.ts` table

An app that already does `use t from "~/lib/i18n.ts"` keeps working: a `use t` of its own wins over the built-in.
Move the table into `src/lang/<code>.lang` and drop the `use` (and the language argument) page by page.

## See also
- [State](state.md) - `device.lang` is the browser's language, read-only; `lang` is the app's, and it changes.
