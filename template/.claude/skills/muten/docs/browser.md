# The browser, without JavaScript

What apps used to write a `.ts` or a `Custom` for, as muten. Each piece is generic: nothing here belongs to one app.

## Files: pick, drop, preview, shrink, send

```muten
state { photo = null : file  photos = [] : list<file>  caption = "" : text  saved = {} : Upload }

File bind(photo) accept("image/*") "Subir foto"          # a picker that also takes a file dropped on it
File bind(photos) accept("image/*,.pdf") "Varios"        # a list<file> takes several
when photo { Image "{preview(photo)}" alt("")  Text "{photo.name}" }
when photo.size > 5000000 { Text "Máximo 5 MB" }

action save() mutates saved { post "/media" body { photo: resize(photo, 1600), caption: caption } into saved }
action receipt() mutates saved { post "/receipts" body photo into saved }   # the file as it is, byte for byte
```

- `File` is a `<label>` styled by `class(…)`; it carries `data-over` while a file is dragged over it, and a drop takes
  only what `accept` allows.
- A file tells its `name`, `size` (bytes) and `type`. `preview(file)` is an address for an `Image` or a `Video`.
- `resize(file, side)` makes a photo no larger than `side` px on its longest side, as WebP (JPEG/PNG where the browser
  cannot write WebP), decoding it first.
- A `post … body` holding a file goes as a form (multipart); a file alone goes as it is; anything else as JSON.

## The address bar: `url`

```muten
Text "{url.s}"                                      # ?s=… ('' when absent), live with Back and Forward
when url.path == "/settings" { … }
action open(section: text) { url.set({ s: section }) }   # a new history step: Back undoes it; "" takes it out
```

## The clock and the scroll: more of `device`

`device.now` (ms, a second at a time), `device.scrollY`, `device.scrollDir` (`"up"` / `"down"`):

```muten
Text "{max(0, round((deadline - device.now) / 1000))} s"
Header class("bar" when device.scrollDir != "down") { … }        # a bar that hides going down
action jump() { scrollTo("#pay") }                                   # smooth, instant with reduced motion
```

## Keys and typing

- `on(escape: close)` - Esc anywhere on the page while the node is on screen (a modal, a sheet).
- `on(enter: send)` - Enter sends, Shift+Enter is a new line.
- `on(typed: search)` - once the person stops typing (300 ms), with the text: a search asks once per pause.

## Sound

`Audio "{msg.voice}" controls` is the browser's player (same keywords as `Video`); `play("/chime.mp3")` plays a short
sound from an action.

## Fields

- `Number bind(price) currency("COP") "Precio"` - a money field: grouped the way the page's language writes it
  (`<html lang>`), decimals only when the currency has them, the plain number in the state.
- `Range` says `--value` and `--fill` (the share of the track behind the thumb) to its CSS: a filled track and a bubble
  that follows the thumb are pure CSS (`background: linear-gradient(to right, var(--accent) var(--fill), …)`).

## Libraries loaded by a script tag

Some SDKs are not on npm: they load from their own site and leave a global (Google Identity, Meta, Calendly…).

```muten
use google from script "https://accounts.google.com/gsi/client"
entity Credential { credential text }
action signedIn(answer: Credential) { post "/auth/google" body { credential: answer.credential } }
effect {
  google.accounts.id.initialize({ client_id: "1234-abc.apps.googleusercontent.com", callback: signedIn })   # an action is a callback
  google.accounts.id.renderButton(element("#signin"), { theme: "outline" })       # element() reaches the page
}
Stack id("signin")
```

- The script is added the first time something of it is called; calls are awaited in actions.
- With `security { csp "default" }`, the page's policy lets exactly those origins run, open frames and bring styles.
