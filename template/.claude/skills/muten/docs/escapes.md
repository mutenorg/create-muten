# Escapes - `Custom` and `use`

Muten the *language* stays small on purpose. A Muten *app* reaches the rest of the web platform through two
**bounded, checked escapes** - and the compiler still validates the border (the props and calls crossing it),
so reaching out never costs you the oracle.

Reach for the **lowest rung that works**:

1. **`class("…")`** - styling and CSS libraries (not an escape, just the styling path). See [Styling](styling.md).
2. **`get name(…)`** - your own small logic, written in muten (labels, keys, formats). Not an escape at all.
3. **`use element | widget | react`** - a component **from npm**, used like a part, with no `.js` in the project.
4. **`use`** - a **logic function** from npm or a file (date math, a 3rd-party SDK) called in an expression.
5. **`Custom`** - a vanilla-JS widget you write yourself: a **map**, a **rich-text editor**, a **canvas/WebGL** scene.
   **NOT** charts, sliders, or date pickers - those are native (`Chart`, `Range`, `Date`, `Svg`, `draggable`).

## Your own logic: `get` with parameters

```
get initials(name) = upper(initial(name))
get label(n, unit) = n + " " + (n == 1 ? unit : unit + "s")
Text "{initials(user.name)} · {label(cart.count, "item")}"
```
A `get` that takes parameters is a function written in muten's expression grammar: checked like any expression,
and calling it with the wrong number of values is an error. Put the ones several pages share in a `.store`
(`src/format.store`: `get price(cents) = money(cents / 100, "COP")`) and call them `format.price(x)` from any page.

## Components from npm: `use element | widget | react`

```
use element Rating "star-rating" from "star-rating-pkg"    # a Web Component: its tag, then the package that defines it
use widget Map from "some-map"                              # a module exporting mount(el, props, on) -> update
use react Calendar from "react-day-picker"                  # a React component, mounted as an island

Rating(value: stars, max: 5) on(rate-change: setStars)    # event names may have dashes
Map(pins: shops) on(pick: select)
Calendar(selected: day) on(select: pickDay)
```
- Props are expressions (reactive: the component gets the new value when they change); `on(event: action)` wires
  its events (a Web Component's CustomEvent `detail`, or the value a React `onX` callback is called with).
- Nothing to write in JS: the package comes from `node_modules`, bundled into the pages that use it.
- `use react` ships React (about 45 KB gz) **only on the pages that use it**. Prefer a Web Component or a native
  primitive when one exists; reach for React when the library you need only exists there.
- A `Custom` whose file has its own `import`s is bundled as a module too (`export function mount`).

### SDKs that draw into an element (maps, charts, card fields)

They are made with `new` or a factory, get an element by its id, and take lists and objects - all written as their
docs show:

```muten
use L from "leaflet"
use Chart from "chart.js/auto"
use loadStripe from "@stripe/stripe-js"

state { stripe = query loadStripe("pk_live_…") }
get elements = stripe ? stripe.elements({ mode: "payment", amount: 1099, currency: "usd" }) : null

effect {
  L.map("map").setView([4.6, -74.08], 12).addLayer(L.tileLayer("https://tile.openstreetmap.org/{{z}}/{{x}}/{{y}}.png"))
  new Chart("sales", { type: "bar", data: { labels: ["lun", "mar"], datasets: [{ data: [10, 30], backgroundColor: theme.colors.primary }] } })
  if elements { elements.create("payment").mount("#pay") }
}
Stack id("map") class("h-72")
Canvas id("sales") class("h-64")
Stack id("pay")
```

- `effect {}` runs once the page is on screen, so the ids exist.
- `[a, b]` is a list, `{ k: v }` an object; `new X(…)` makes a class a package exports.
- `{{z}}` is a literal `{z}` in a text (URL templates); a single `{…}` is muten's interpolation.
- With TypeScript installed (`npm i -D typescript`), `check` asks it about every call into a package: a method or a
  property the package lacks, or a wrong number of values, is an error with the closest name (`package-type`).

### React libraries, composed as their docs compose them

```muten
use react LineChart, Line, XAxis, YAxis from "recharts"     # several parts of one library
use react Dialog from "@radix-ui/react-dialog"               # a namespace: Dialog.Root, Dialog.Trigger…
use react Command from "cmdk"
use react motion from "motion/react"
use react Toaster from "sonner"
use toast from "sonner"                                      # its function, called from an action

LineChart(width: 400, height: 200, data: sales) { XAxis(dataKey: "day")  YAxis()  Line(dataKey: "total") }

Dialog.Root {
  Dialog.Trigger { Text "Abrir" }
  Dialog.Portal { Dialog.Content {
    Dialog.Title { Text "Tu plan" }
    Text "Van {n}"                                           # a plain Text is the component's text, live
    Button "Sumar" -> more                                   # a muten node works inside, as always
  } }
}

Command { Command.Input(placeholder: "Buscar…")  Command.List {
  each items as it { Command.Item(value: it.name) { Text "{it.name}" } }   # a list of React children, keyed by id
} }

motion.div(initial: { opacity: 0 }, animate: { opacity: shown ? 1 : 0 }) { Text "Hola" }   # object props, live
Toaster(position: "top-center")
```

- The outermost component is an island: rendered again when anything it reads changes, unmounted with the page.
- Inside: the library's components are React elements; a plain `Text` is text; `each` / `when` are a map and a
  condition; any other muten node is built by muten and mounted where it sits, still reactive.
- In a row of an `each` inside a React component, use the library's components and a plain `Text`: a muten node there
  is built once (`check` says `react-list-node`).
- `class("…")` is its `className`, `on(click: x)` its `onClick`. A library may name a part like a primitive
  (`use react Button from "@mui/material"`): in that file `Button` is the library's.
- Props take any expression: `bg: on ? "brand" : "gray.300"`, `sx: { alignItems: "center" }`; a package's own values
  are plain names (`createSystem(defaultConfig, …)`).
- **React Native libraries** (gluestack, Tamagui, NativeBase) run on the web once `react-native-web` is installed: every
  `react-native` import becomes it and the `.web.*` files win. No config.
- Tested in Chrome: lucide-react, Sonner, react-day-picker, Recharts, Radix, MUI, Mantine, Chakra, gluestack, cmdk, Motion, Vaul.

---

---

## `Custom` - a host-JS widget

Write vanilla JS in `src/components/<Name>.js` and mount it with `Custom`. It receives `inputs` (values you
pass) and wires DOM events back to your actions via `on`:

```muten
Custom Map inputs(markers: @places) on(markerClick: select)
```

```js
// src/components/Map.js   (a genuine Custom: pan/zoom/tiles is NOT expressible in the DSL)
function mount(el, inputs, on) {        // THREE positional args
  const map = makeMap(el, inputs.markers);   // read a value: inputs.markers
  map.onMarker = (m) => on.markerClick(m);    // call a handler: on.markerClick(payload)
  return (next) => map.setMarkers(next.markers);  // OPTIONAL: return an updater → muten re-calls it when a bound @state changes
}
```

Rules that matter:

- The signature is **`mount(el, inputs, on)`** - three positional args (not `mount(el, { inputs, on })`).
- Define it as a plain **`function mount(...)`**, **not** `export function` - the file is inlined, so an
  `export` is a syntax error and leaves the screen blank.
- **Pass state with `@`:** `inputs(data: @sales)` passes the array; bare `inputs(data: sales)` passes the
  literal string `"sales"`. To feed a query's rows, make a `get` first - `get rows = orders.data` - then
  `inputs(data: @rows)`.
- **Reactive inputs:** initial values are read at mount. For **live** values, `return` a function from `mount` -
  muten re-calls it with the fresh `inputs` whenever a bound `@state` changes. Return nothing and the inputs
  stay a mount-time snapshot (fine for a widget that owns its own data).

`Custom` is the only way to use non-Muten **UI** code. It's for genuine widgets - not for things Muten already
does (see below).

### A `Custom` is a LEAF - ONE widget, not a sub-app (read this before you write JS)

The #1 way an agent accidentally **rewrites Muten in vanilla JS** is the *gravity well*: you open one `Custom`
for a genuine escape (an iframe, a map), and then build the buttons, the list, the layout, the dropdown, the
toast, the socket — all in that same `.js` file, because you're "already in JS". **Stop.** A `Custom` wraps
**one** non-Muten thing and nothing more. If, inside a `Custom`, you find yourself doing ANY of these, delete it
and use the native form — Muten does all of them, and doing them in JS ships more code, loses the oracle, and
makes the app unreadable to the next agent:

| Inside a Custom you wrote… | That's Muten's job — use | 
|---|---|
| `document.createElement('button')` + `addEventListener('click', …)` | a native **`Button "…" -> action`** |
| `new EventSource(…)` / `new WebSocket(…)` (live data from your backend) | **`state { x = query feed live : list<T> }`** — Muten opens & reconciles the socket (§ real-time below) |
| inline `<svg>…</svg>` / an icon lib | **`Icon "lucide:name"`** (Iconify, inlined at build, tree-shaken) |
| a dropdown / modal / tabs / accordion / toast (show-hide floating UI) | a page `state` + **`when cond { … }`** + **`class(open when …)`** (§ patterns.md) |
| building card/badge/dialog/button styling by hand | the **`@muten/shadcn` plugin** parts — it *is* your component set (`muten add shadcn`) |
| `.map`/`.filter`/`.forEach` to render a list | **`each list as x { … }`** |

If your `Custom` contains buttons, list rendering, a socket, icons, or a modal, it is **too big** — those are
declarative Muten. Keep the Custom down to the one thing the platform can't express (the canvas, the map tiles,
the iframe, the contenteditable) and move everything around it back into `.muten`.

**Real-time is native — never hand-roll a socket.** A backend that pushes updates → `query x live` (WebSocket,
auto-reconnect, keyed reconciliation, batched). You never write `new WebSocket`/`new EventSource` yourself:

```muten
state   { feed = query feed live : list<Event> }
sources { feed: { url: "ws://localhost:5480/ws/feed" } }
# each feed as e { Text "{e.text}" }   ← only changed rows touch the DOM
```

**Drag and drop inside a `Custom` is native too — never hand-roll pointer drags or HTML5 DnD.** The engine behind
`draggable`/`droptarget` is public as `@muten/core/dnd`, for a widget that needs *where* something lands (a
timeline, a canvas, a board with free placement). Load it with a dynamic import (a `Custom` is inlined: no top-level
`import`):

```js
function mount(el, inputs, on) {
  import('@muten/core/dnd').then(({ draggable, droppable, startDrag }) => {
    // a source: a 1:1 copy hangs from where it was taken (overlay: false → you move the item yourself)
    draggable(card, { id: 'k1', distance: 5, onEnd: (info) => { /* info.over, info.point, info.delta */ } });
    // a zone: told while something is over it and where (info.local = the pointer inside the zone)
    droppable(lane, { accept: (info) => info.id !== '', onOver: (info) => preview(info.local), onDrop: (info) => land(info) });
    // from your own pointerdown (select first, drag after 4 px): startDrag(e, el, { overlay: false, distance: 4, onMove })
  });
}
```

Every handler gets `{ id, data, point, start, delta, grab, rect, over, local }`. Options: `distance` / `delay` +
`tolerance` (touch: hold, then drag), `axis: 'x' | 'y'`, `handle`, `zIndex`; Esc cancels (`onCancel`), and the drag
scrolls its scroll box near the edges on both axes.

---

## `use` - a host-JS logic function

`use` named exports from a `.ts`/`.js` file and call them in any expression. The `.ts` is a typed facade over
any npm package; Muten sees only the function names, so the oracle still checks your calls.

```muten
use fmt, slug from "~/lib/format.ts"        # named exports ONLY
Text "{fmt(order.total)}"
Link "{slug(post.title)}" -> "/blog/{post.id}"
```

- **Paths: prefer `~/`** (absolute, from `src/`). `~/lib/format.ts` resolves the same from every file - no
  counting `../`. (`./`/`../` relative still works.)
- **An npm package directly**: `use slugify from "slugify"` - no facade file needed. Muten reads the package's
  types (`.d.ts`): what each function returns (so `each` over its result is checked field by field) and how many
  values it takes (a wrong count is `fn-arity`).
- **Async is fine.** A function that returns a Promise, called in an action, is awaited (the action gets
  `.pending`/`.error`). To *show* its result, make it a query: `hits = query lookup(q)` (see [Data](data.md)).
- Import zod / date-fns / nanoid / anything *inside* a `.ts` when you want tidy named functions of your own.

A `use` function can also be **called as a statement** inside an `action` or `effect` - a side effect Muten
can't express (scroll, focus, analytics):

```muten
use scrollBottom, track from "~/lib/fx.ts"
action send(text: text) mutates messages {
  messages.push({ role: "user", content: text })
  scrollBottom()        # a side effect - no muten state mutated, so no `mutates` entry
  track("sent")
}
```

An undeclared call is an `unknown-function` error - the border is checked like any other reference.

---

## SDKs from npm - written as their docs show them

A package's own API comes in as it is documented: methods, chains, default exports. Only on what a `use` brought in
(or a `get` / `query` made from it): muten's own values still have no methods.

```muten
use createClient from "@supabase/supabase-js"
use posthog from "posthog-js"                  # a default export: the single name falls back to it
use z from "zod"
use dayjs from "dayjs"

get db = createClient("https://x.supabase.co", "anon-key")     # created once, used everywhere below
state {
  orders = query db.from("orders").select("*").order("total") : list<Order>
  email  = "" : text
}
get valid = z.string().email().safeParse(email).success
effect { posthog.init("phc_…", { api_host: "https://us.i.posthog.com" }) }
action add(total: number) { db.from("orders").insert({ total: total }) }   # awaited: add.pending / add.error
action buy() { posthog.capture("buy", { plan: "pro" }) }

each orders as order { Text "{dayjs(order.at).format("D MMM")}" }
```

- A query understands what the big SDKs answer with: a list, `{ data, error }` (Supabase and most REST clients; an
  `error` becomes `.error`) and Firestore snapshots (`getDocs` → rows with `id`, `onSnapshot` → the doc).
- A query of a function with no type holds what the package gave back as it is (`stripe = query loadStripe(key)`);
  write the type (`: list<Order>`) when you iterate it, so its fields are checked.
- **Realtime, as each service documents it** - `live <subscription>` with `change` where its callback goes. The list
  loads with the query, then each change is applied (Supabase INSERT/UPDATE/DELETE by `id`, a whole list replaces,
  one row is added or replaced); leaving the page unsubscribes:

```muten
orders = query db.from("orders").select("*")
  live db.channel("orders").on("postgres_changes", { event: "*", schema: "public", table: "orders" }, change).subscribe()
  : list<Order>
messages = [] : list<Msg> live socket.on("message", change)          # Socket.IO, Pusher, Ably…
user = query onAuthStateChanged(auth) live                           # a callback-last function: just `live`
```
- **A server SDK never goes in a page.** `stripe`, `openai`, `@anthropic-ai/sdk`, `twilio`, `resend`, `firebase-admin`,
  database drivers, and any package that needs Node's `http`/`fs` with no browser build, are a `check` error
  (`server-package`): the page ships its import, and the secret key with it, to every visitor. The app calls your API
  (`post "/checkout" body { plan: plan } into session`), the API calls the SDK. For payments in the app, the browser
  SDK (`@stripe/stripe-js`, `@mercadopago/sdk-js`) and a redirect to the session your API created:

```muten
entity Session { url text }
state { session = {} : Session }
action checkout() mutates session {
  post "/checkout" body { plan: "pro" } into session   # your API: stripe.checkout.sessions.create(…) → { url }
  visit(session.url)                                   # off to Stripe's page; it comes back to success_url
}
Button "Pagar" -> checkout
when checkout.pending { Text "Abriendo el pago…" }
```

## Don't escape for what Muten already does

The most common mistake is escaping to JS for something the language has a first-class form for. Before you
reach for `use` or `Custom`, check it isn't a built-in:

| You're tempted to write (in JS) | Use instead | |
|---|---|---|
| `new WebSocket` / `new EventSource` (live backend data) | **`query x live`** — Muten owns the socket | [Data § live](data.md) |
| inline `<svg>` / an icon package | **`Icon "lucide:name"`** (native, tree-shaken) | [Primitives § Icon](reference/primitives.md) |
| a dropdown / modal / tabs / toast (in JS) | page **`state` + `when` + `class(open when …)`** | [Patterns](../patterns.md) |
| hand-rolled buttons/cards/badges in a `Custom` | native primitives, or the **`@muten/shadcn`** plugin | [Plugins](plugins.md) |
| `document.createElement` to build UI | a native primitive (`Button`, `Stack`, `each`, …) | this file, top |
| `localStorage.getItem/setItem` | **`persist`** on the state | [State § persist](state.md#persist--localstorage-declaratively) |
| `items.some(x => x.id === id)` | **`contains`** on a `list<number>` of ids, or `count where … > 0` | [Lists § membership](lists.md#membership--is-it-in-the-list) |
| `list.filter(...)` / `.find(...)` | **`where`** (`each … where`, `count where`) | [Lists](lists.md) |
| `list.reduce(...)` for a total/count | **`sum by` / `count` / `avg`** | [Lists § aggregates](lists.md#aggregates) |
| a date/number **format** | a built-in (`money`, `fixed`, `date`, `ago`…) or a `get name(…)` | [SKILL §1](../SKILL.md) |
| slugify / digits / split / join / clipboard / a `?ref=` | built-ins: `slugify` `digits` `split` `joined` `copy` `urlParam` | [SKILL §1](../SKILL.md) |

A `use` function is for **genuine foreign logic** - date math, a formatting lib, a third-party SDK. It is
**not** for reimplementing a built-in. Escaping when you didn't need to ships more JS, loses the oracle's
checks on that logic, and makes the app harder for the next agent to read. The whole point of the bounded
language is that the declarative path exists - find it before you escape.

## See also
- [Styling](styling.md) - `class()` for CSS libraries (rung 1).
- [Accessibility](accessibility.md) - `aria(...)` keeps accessible widgets in Muten instead of a `Custom`.
- [Lists](lists.md) / [State](state.md) - the built-ins people escape past by mistake.
