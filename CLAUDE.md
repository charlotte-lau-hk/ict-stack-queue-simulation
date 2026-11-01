# Stack & Queue Simulator

Interactive self-learning tool for S6 ICT (HKDSE) students. Students build (or get a
random) short pseudocode program of stack/queue operations and step through it,
watching the structures change as a graphical (logical) view or an array
implementation with variables.

Use cases: teacher demos on projector / smartboard; students explore alone on desktop
or tablet (not phone).

## Hard constraints

- **Single file**: everything ships in `index.html` (inline `<style>` and `<script>`).
- **No external dependencies** at runtime: no CDNs, web fonts, frameworks or network
  requests. Must work opened straight from disk (`file://`) and offline.
- Client-side only; no build step.

## Spec (agreed with the teacher)

### Tabs and structures
- Tabs: **Stack**, **Queue**, **Mixed** (stacks and queues together).
- Default 1 structure, add up to **3**. Names come from a set picked at random per
  demo: A/B/C, X/Y/Z or P/Q/R, used in order. In Mixed, stacks and queues use
  *different* sets so the name hints at the type; type chosen when adding.
- `MAX` (array capacity): one value for all structures, 4–8 (to limit space), default 5, set before
  start.
- Array index **always starts at 0**.
- Queue implementation: **circular** (default, from the lesson) or **linear with
  shift** (dequeue shifts items left with a loop), so students can compare. Set
  before start; it's the implementation, so it can't change during a demo (unlike
  the Graphical/Array view switch). Linear needs no `head` (front is index 0).
- Initial contents: random (empty or some items; random queue `head` so wrap-around
  happens). Values are integers 1–20, **no duplicate values within a demo** (moving
  an item with `Push(B, Pop(A))` is the same item, not a duplicate).

### Views (switchable mid-demo; no side-by-side)
- **Graphical**: stack as a vertical box, queue as a row (front → rear), as in
  `reference/` page 1.
- **Array**: `idx`/`val` table per structure card. Unused / stale cells grey `?`;
  popped values stay in the array, greyed. Return value in a yellow box.
- Variables per structure, suffixed with the name: `sizeA`, `headA`; derived values
  in a dashed box with the formula filled in live: `topA = sizeA − 1` (−1 when
  empty), `tailA = (headA + sizeA − 1) mod MAX`. Queue span shown with a bracket
  head → tail labelled with size; wrap-around shown with an arrow index MAX−1 → 0
  (no ring diagram).
- User variables `m`, `n`, `k`, `d` shown in a variables panel. They only ever hold
  integers (from Pop/Dequeue). Python semantics: no declaration, but reading one
  before assignment is a `runtime error`.
- Each structure card has live **`IsEmpty(A)`** and **`IsFull(A)`** status boxes
  (true/false, updating with the contents); click to expand their pseudocode
  (`return sizeA = 0`, `return sizeA = MAX`). They are *not* program statements.

### Program editor (click-only, no typing)
- Up to **10** lines. Click to add a line, click to choose the operation, structure
  and argument.
- Operations (pseudocode always in English): `Push(A, v)`, `Enqueue(A, v)`,
  `m ← Pop(A)`, `m ← Dequeue(A)`. Pop/Dequeue results must be assigned to
  `m`/`n`/`k`/`d`. No `Peek` (not in DSE), no IsEmpty/IsFull statements.
- Value argument `v`: an integer (dropdown 1–20, sensible default), a variable
  (`m`/`n`/`k`/`d`), or a nested `Pop`/`Dequeue` e.g. `Push(B, Pop(A))`. **No
  expressions** (`m + n` is out of scope).
- Errors stop execution with **`runtime error`** and a highlighted cause: push /
  enqueue when full and pop / dequeue when empty (with a hint like "check
  `IsFull(A)` first to avoid this error"), reading an unassigned variable.

### Execution
- Program **locked while running**; unlocked by Stop. Editing is allowed any time before Run.
- Buttons: **Run** (next line / next inner step only; no run-all), **Back** (one step),
  **Stop** (back to line 1 and unlock editing; Run starts again — covers "restart
  running" and "force stop"), **New ▾** menu: new demo with the same setup and an empty
  program, new demo with the same setup and a random program, or **Reset all** (default
  setup, empty program; asks to confirm; current tab only).
- Random programs are **always error-free** (each candidate line is run on the engine
  and rejected if it errors). While a generated program is untouched
  (`demo.generated`), any setup change regenerates it; editing a line makes it the
  student's own and only then can runtime errors happen.
- Line markers: blue ▶ = to be executed, amber ✓ = just executed (one line only; while
  stepping inside a line the amber marks the inner step), grey ✓ = executed earlier.
  Status box shows "Just ran …" and "Next …" rows.
- Each line is one function call. A line can be **expanded** (one at a time) to show
  its array-level steps; when expanded, Run steps through those inner steps one by
  one. Array-level steps (index 0):
  - Push: `A[sizeA] ← v`, `sizeA ← sizeA + 1`
  - Pop: `sizeA ← sizeA − 1`, `return A[sizeA]`
  - Enqueue (circular): `A[(headA + sizeA) mod MAX] ← v`, `sizeA ← sizeA + 1`
  - Dequeue (circular): `temp ← A[headA]`, `headA ← (headA + 1) mod MAX`,
    `sizeA ← sizeA − 1`, `return temp`
  - Enqueue (linear): `A[sizeA] ← v`, `sizeA ← sizeA + 1`
  - Dequeue (linear shift): `temp ← A[0]`, `for i ← 0 to sizeA − 2`,
    `A[i] ← A[i + 1]`, `sizeA ← sizeA − 1`, `return temp`
  - Linear dequeue: each loop pass is its own Run step with `i` shown, so the
    shifting cost is obvious.
- Changes are animated; animation speed control (slow / normal / fast).

### UI
- English default, Traditional Chinese (HK) option — UI text only; pseudocode stays
  English.
- Light theme default, dark option. Zoom control for projector. Large touch targets
  (smartboard / tablet).
- `localStorage`: settings, current program, up to **5** saved programs (load and
  try again). Share link encodes the demo (MAX, structures, initial state, program)
  in the URL hash.

## Layout

- `index.html` — the app (the only deliverable)
- `reference/` — the teacher's lesson diagrams (xlsx + pdf), **local only (gitignored, not
  published)**; match their notation
  (note: the sheet's last step `Push(S,7)` wrongly says `S[size] <- 1`)
- `tests/` + `package.json` + `playwright.config.js` — dev-only headless checks;
  not part of the app

## Dev

- `npm test` runs Playwright against `index.html` (smoke test also asserts no
  external requests). `@playwright/test` is pinned to 1.61.1 to match the shared
  `chromium-1228` build in `~/.cache/ms-playwright` — don't `playwright install`.

### Layout (teacher feedback, round 2)
- Title is always bilingual: "Stack & Queue Simulator 堆疊與隊列模擬器".
- Header (top right): theme and language first, then zoom.
- Speed button sits under Run/Back/Stop/New; Saved and Share link at the bottom of the
  program pane.
- Program pane is narrow (`clamp(21rem, 100vw − 36rem, 27rem)`); the structures pane gets
  the rest so 8 queue cells fit. Single column below 960px.
