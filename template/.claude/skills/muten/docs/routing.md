# Pages & routing

`src/app.muten` is the **root** - the single file an agent (or a person) reads first. It maps URLs to pages
and, optionally, wraps them in a persistent shell. Routing is client-side (History API, no reload), and every
route also pre-renders to static HTML at build.

## Routes

```muten
# src/app.muten
routes {
  "/"        -> home          # src/pages/home/home.muten
  "/about"   -> about
  "/404"     -> notfound      # catches any unmatched path
}
```

- Paths are **quoted strings**. The **first route is the default**.
- The page name (`home`) must match the folder under `src/pages/` (`src/pages/home/home.muten`).
- A route named `"/404"` is the catch-all for unmatched paths; without one, the first route is shown.
- Navigate with `Link "Label" -> "/path"` - client-side, no reload. Focus moves to the page's `<main>` on
  navigation (see [Accessibility](accessibility.md)).

## Route params

A `:segment` captures a URL value. The page declares it with `param <name>` and uses it as a **read-only
string** in interpolation, `when`, or expressions (it can't be mutated):

```muten
# app.muten
routes { "/product/:id" -> product }
```
```muten
# src/pages/product/product.muten
screen product
param id
Page { Title "Product {id}" }
```

Navigating `/product/1` → `/product/2` re-mounts the page with the new `id` (re-fetch the new item).

> **Naming the param.** `id` is fine for a page that only displays it, as above. But if the page also
> **filters a list** by that value (`each store.items as p where p.slug == id`), name the param something else
> (`pid`/`productId`) - every entity has an implicit `id` field, and inside a `where`/`by` predicate the param
> `id` would shadow the row's own `id`, making `where id == id` always false. See
> [Detail page by route param](patterns.md#detail-page-by-route-param).

## Guards

A guard reads a **store boolean**; if it's false on navigation, the user is redirected. When the boolean flips
(login/logout), the active route re-renders automatically:

```muten
routes {
  "/cart"  -> cart  guard auth.loggedIn else "/login"     # members only
  "/login" -> login guard not auth.loggedIn else "/"       # guests only
}
```

(`auth.loggedIn` is a member of an `auth.store` - see [Stores](stores.md).)

## The shell (persistent chrome)

Wrap every route in a `shell { … slot … }` for a navbar/footer that persists across navigation. `slot` is
where the active page mounts. The **shell has no local state** - use a [store](stores.md) for things like a
mobile menu:

```muten
shell {
  Header class("flex flex-row justify-between items-center nav") {
    Link "Home" -> "/"
    Button "☰" -> ui.toggleMenu
  }
  when ui.menuOpen { Stack class("mobile-menu") { Link "About" -> "/about" } }
  slot
  Footer { Span "© 2026" }
}
routes { "/" -> home  "/about" -> about }
```

The shell also emits a keyboard **skip-link** to the content automatically (see [Accessibility](accessibility.md)).

## Layouts (chrome for a group of routes)

When only SOME routes share chrome - an app's sidebar after login, but not the public pages - declare a `layout`
and mount routes `in` it. The router mounts the layout **once** and keeps it while the user moves between its routes:
only the page inside its `slot` is swapped, so the sidebar is never rebuilt (no flicker, no lost scroll, no
re-running effects). A route outside the layout drops it; coming back mounts it again.

```muten
layout app {
  Sidebar()          # a layout may call parts (a shell cannot)
  slot               # exactly one: where the route's page mounts
}
routes {
  "/"          -> home                                            # no layout: the page mounts directly
  "/dashboard" -> dashboard in app guard auth.loggedIn else "/login"
  "/settings"  -> settings  in app guard auth.loggedIn else "/login"
}
```

- Don't call the sidebar part from each page: that rebuilds it on every navigation. Put it in the layout.
- `shell` still wraps everything (layouts mount inside its `slot`). Use `shell` for chrome on EVERY route, a
  `layout` for chrome on a group of them.
- The layout renders as `div.mu-layout` holding your chrome and a `div.muten-outlet` (the page's slot). Style
  `.mu-layout` as the frame (e.g. a grid: sidebar + content), or give `.mu-layout, .mu-layout > .muten-outlet`
  `display: contents` when your chrome is `position: fixed` and the page should keep filling the shell as before.
- `muten check` flags a route `in` an undeclared layout, a layout without exactly one `slot`, and an unused layout.

## Back buttons that never leave the app

The router stamps every entry it pushes with how many steps into the app it is: `history.state.muDepth` (0 on the
page the visitor landed on, +1 per navigation; a guard redirect keeps the depth). A back button reads it: above 0,
`history.back()` stays inside the app; at 0 (the page was opened from a link, an email or a reload) go to the app's
default screen instead, never to a dead button or out of the app:

```ts
// ~/lib/url.ts
export function backOrHome(): boolean {
  const state: { muDepth?: number } | null = history.state;
  if (state && (state.muDepth ?? 0) > 0) { history.back(); return true; }
  history.pushState({ muDepth: 1 }, '', '/home'); dispatchEvent(new PopStateEvent('popstate')); return true;
}
```

A helper that pushes its own entries should stamp them the same way (`{ muDepth: current + 1 }`).

## Active link - automatic

The router marks the current nav link for you: any internal `<a>` whose `href` equals the current path gets
`aria-current="page"` and the class `is-active` - on shell nav links and plain page links alike. Style it in
CSS (`.is-active { … }` or `a[aria-current="page"] { … }`); there is no `class(active when …)` to write and no
route/location ref to read.

## In-page anchors - a one-page nav that works

A landing/marketing page navigates **within itself**, not between routes. Give the section a stable id and link to
it with `#`; the browser scrolls natively (the router deliberately lets `#` hrefs pass through untouched).

```muten
Nav {
  Link "Features" -> "#features"
  Link "Pricing"  -> "#pricing"
}
Section id("features") { Title "What you get" h2 }
Section id("pricing")  { Title "Plans" h2 }
```

The oracle **proves every link lands**: a `-> "#features"` with no `id("features")` on the page is `unknown-anchor`,
and a `-> "/pricing"` with no such route in `app.muten` is `unknown-route`. So a dead navbar cannot ship.

Do **not** point a section link at `-> "/"` — it reloads the page you are already on. `id()` is not allowed on `Page`
(it already owns `mu-main`, the skip-link target); put it on the `Section`/`Stack` you want to scroll to.

## `<head>` metadata

A page declares `meta { title "…" description "…" lang "…" }` → `<title>` + `<meta>` tags, applied on
navigation and baked into the static HTML. See [SEO](seo.md) for the full SEO story (sitemap, canonical,
JSON-LD - all automatic).

## The app graph - `app.map.json`

`muten map` (or any build) emits `app.map.json`: a compact index of routes + their models, state, and sources.
It's the root an agent reads to understand the whole app without grepping a component tree.

## See also
- [SEO](seo.md) - meta, sitemap, canonical from your routes.
- [Stores](stores.md) - the global booleans guards read.
- [Deployment](deployment.md) - SPA fallback (serve `index.html` for any path).
