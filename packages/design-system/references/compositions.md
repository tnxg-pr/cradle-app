# Compositions

Cradle's *valuable* patterns — the ones apps/web builds real features with. Each one is a composition of primitives, not a new component. Read this instead of the primitive catalog when you're building something real.

For the individual primitives underneath, see [`components.md`](./components.md).

---

## Contents

1. [Inset floating card (app shell)](#1-inset-floating-card-app-shell) — the layout signature
2. [Two-pane drill-in sidebar](#2-two-pane-drill-in-sidebar) — cross-fade navigation
3. [Item + ItemGroup](#3-item--itemgroup) — the density-scoped list primitive
4. [InputGroup with addons](#4-inputgroup-with-addons) — inline input compositions
5. [Field trio](#5-field-trio) — label, control, hint, error
6. [Empty state](#6-empty-state) — the canonical "nothing here yet" template
7. [Sheet with header + scroll body + footer](#7-sheet-with-header--scroll-body--footer) — the persistent side panel
8. [Message bubble](#8-message-bubble) — chat entry with inset ring
9. [Context window well](#9-context-window-well) — inset highlight-and-shadow stack
10. [Category badge](#10-category-badge) — semantic accent chip
11. [Settings section](#11-settings-section) — Linear-style single-column form
12. [Master-detail split](#12-master-detail-split) — sub-navigation within a section
13. [Kanban card](#13-kanban-card) — draggable column card
14. [Status tag](#14-status-tag) — animated SVG state indicator
15. [Command palette entry](#15-command-palette-entry) — Cmd+K row
16. [Toolbar with button-group and icon buttons](#16-toolbar-with-button-group-and-icon-buttons)

---

## 1. Inset floating card (app shell)

The single most distinctive Cradle move: the whole app is wrapped in a sidebar-colored sea, and the content is a rounded card that floats on top with a small gutter.

```tsx
<div className="flex h-screen w-screen bg-[var(--color-sidebar)]">
  <aside className="w-[var(--layout-sidebar-width)] shrink-0">
    {/* chrome sidebar */}
  </aside>

  <div
    className="m-1 mr-2 flex flex-1 flex-col overflow-hidden
               rounded-[var(--radius-2xl)] bg-[var(--color-surface)]
               shadow-[var(--shadow-sm)]"
  >
    {/* content card */}
  </div>
</div>
```

**Why the asymmetric `mr-2`**: the right side often opens a second chrome pane (aside / browser / dev bar). The wider right gutter reads as "seam between two chrome regions" while the tight left gutter reads as "gap between chrome and content."

**Do**: use `shadow-sm` (surface texture). **Don't**: use `shadow-lg` (elevation).

---

## 2. Two-pane drill-in sidebar

Two sidebar panes cross-fade with a drill spring. Both panes are absolutely positioned so they animate over each other without pushing layout.

```tsx
import { AnimatePresence, motion } from 'framer-motion'

const drillTransition = { type: 'spring', stiffness: 600, damping: 40, mass: 0.8 }

<div className="relative flex-1 overflow-hidden">
  <AnimatePresence mode="popLayout">
    {pane === 'primary' ? (
      <motion.div
        key="primary"
        className="absolute inset-0"
        initial={{ opacity: 0, x: -20, filter: 'blur(4px)' }}
        animate={{ opacity: 1, x: 0, filter: 'blur(0px)' }}
        exit={{ opacity: 0, x: -20, filter: 'blur(4px)' }}
        transition={drillTransition}
      >
        <PrimaryPane />
      </motion.div>
    ) : (
      <motion.div
        key="settings"
        className="absolute inset-0"
        initial={{ opacity: 0, x: 20, filter: 'blur(4px)' }}
        animate={{ opacity: 1, x: 0, filter: 'blur(0px)' }}
        exit={{ opacity: 0, x: 20, filter: 'blur(4px)' }}
        transition={drillTransition}
      >
        <SettingsPane />
      </motion.div>
    )}
  </AnimatePresence>
</div>
```

Blur is small (4 px). Enough for the eye to read "receding" without becoming a full page transition.

---

## 3. Item + ItemGroup

The density-scoped list primitive. `ItemGroup` sets a size, `Item` inherits it via data attributes, and every descendant (`ItemMedia`, `ItemTitle`, `ItemDescription`, `ItemActions`) scales together.

```tsx
<ItemGroup size="sm">
  {rows.map(row => (
    <Item key={row.id} variant="muted" size="sm">
      <ItemMedia variant="icon">
        <FileTextIcon className="h-4 w-4" />
      </ItemMedia>
      <ItemContent>
        <ItemTitle>{row.title}</ItemTitle>
        <ItemDescription>{row.subtitle}</ItemDescription>
      </ItemContent>
      <ItemActions>
        <Button variant="ghost" size="icon-xs"><MoreHorizontal /></Button>
      </ItemActions>
    </Item>
  ))}
</ItemGroup>
```

**Sizes**: `default` (48 px row) · `sm` (40 px) · `xs` (32 px). Each cascades gap, padding, font size.

**Variants**: `default` (bare) · `outline` (bordered card) · `muted` (fill on hover). Use `muted` for list rows, `outline` for detached cards.

**Rule**: don't hand-roll list rows with raw `flex + gap + p`. `Item` gives you truncation, density scaling, and hover states for free.

---

## 4. InputGroup with addons

A `flex h-8 rounded-md border` shell that unifies an input with adjacent addons (icons, prefixes, buttons, block-level rows).

```tsx
<InputGroup>
  <InputGroupAddon align="inline-start">
    <SearchIcon className="h-3.5 w-3.5" />
  </InputGroupAddon>
  <InputGroupInput placeholder="Search issues..." />
  <InputGroupAddon align="inline-end">
    <InputGroupButton size="icon-xs" aria-label="Clear">
      <XIcon className="h-3 w-3" />
    </InputGroupButton>
  </InputGroupAddon>
</InputGroup>
```

Block-level rows sit **inside** the same shell, above or below the input row:

```tsx
<InputGroup>
  <InputGroupAddon align="block-start">
    <span className="text-[11px] text-[var(--text-tertiary)]">Filters</span>
  </InputGroupAddon>
  <InputGroupInput placeholder="Add filter..." />
</InputGroup>
```

Interior chips inside an addon use `rounded-[calc(var(--radius)-3px)]` so their radius fits inside the parent's.

---

## 5. Field trio

Label + control + hint / error. Use `Field` for one-off form rows outside a `Form`; use `FormField` when you're inside `react-hook-form`.

```tsx
<Field>
  <FieldLabel>API key</FieldLabel>
  <FieldControl>
    <Input type="password" placeholder="sk-..." />
  </FieldControl>
  <FieldHint>Stored encrypted in local keychain.</FieldHint>
  {error && <FieldError>{error}</FieldError>}
</Field>
```

**Do**: use `Fieldset` to group 2+ related fields with one shared legend.
**Don't**: build ad-hoc `<label>` + `<div>` + `<p>` structures — accessibility and spacing regress every time.

---

## 6. Empty state

The canonical "nothing here yet" template. Every empty state in Cradle uses this shape.

```tsx
<Empty>
  <EmptyMedia variant="icon">
    <InboxIcon className="h-4 w-4" />
  </EmptyMedia>
  <EmptyTitle>No conversations yet</EmptyTitle>
  <EmptyDescription>
    Start a chat with any agent to see it here.
  </EmptyDescription>
  <EmptyActions>
    <Button>New chat</Button>
  </EmptyActions>
</Empty>
```

- `Empty` root is `rounded-xl border-dashed p-6 text-center text-balance`.
- `EmptyMedia variant="icon"` is a `size-8 rounded-lg bg-[var(--color-fill)]` icon well.
- Title: label-md weight. Description: body-sm secondary.

**Anti-pattern**: putting a giant illustration and a paragraph of marketing copy. Empty states in Cradle are quiet, actionable, and don't consume the viewport.

---

## 7. Sheet with header + scroll body + footer

The persistent side panel. Body scrolls; header and footer stay put. Header carries the title + close; footer carries the primary action.

```tsx
<Sheet open={open} onOpenChange={setOpen}>
  <SheetContent side="right" className="flex w-[420px] flex-col">
    <SheetHeader className="border-b border-[var(--color-border-content)]">
      <SheetTitle>Session details</SheetTitle>
      <SheetDescription>Started 3 minutes ago</SheetDescription>
    </SheetHeader>

    <div className="flex-1 overflow-y-auto p-4">
      {/* long content — scrolls */}
    </div>

    <SheetFooter className="border-t border-[var(--color-border-content)]">
      <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
      <Button>Save</Button>
    </SheetFooter>
  </SheetContent>
</Sheet>
```

Choose Sheet over Dialog when the user might want to keep referring back to main content. Choose Dialog when the interaction is genuinely blocking.

---

## 8. Message bubble

Chat entry with the signature "inset ring, not shadow" treatment. Note the asymmetric corner: outgoing messages have a small bottom-right radius so they read as "attached to me."

```tsx
<div
  className="max-w-[75%] rounded-xl rounded-br-sm bg-[var(--color-surface)]
             px-3 py-2 text-[13px] leading-relaxed"
  style={{ boxShadow: 'inset 0 0 0 1px hsl(var(--border) / 0.45)' }}
>
  {content}
</div>

<div className="mt-1 text-[11px] text-[var(--text-secondary)]">
  {timestamp}
</div>
```

**Chat container width**: `max-w-[var(--layout-content-max-chat)]` (672 px). Wider than this and the message length becomes uncomfortable to scan.

---

## 9. Context window well

The "recessed content" pattern: an inset area with a top highlight and bottom shadow that reads as physically pressed into the surface. Used for chat scroll regions, code previews, embedded panels.

```tsx
<div
  className="rounded-xl bg-[var(--color-surface-inset)] p-2.5"
  style={{
    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.5), inset 0 -1px 0 rgba(0,0,0,0.04)',
  }}
>
  {/* content that should read as embedded */}
</div>
```

The top highlight is a bevel effect — `rgba(255,255,255,0.5)` on the top edge simulates light hitting the raised chrome above the well. The bottom shadow finishes the recess.

---

## 10. Category badge

Semantic accent chip. Every accent color pairs with `/10` bg + full-color text. Never solid fill.

```tsx
<span className="inline-flex items-center rounded-full bg-blue-500/10 px-2 py-0.5 text-[11px] font-medium text-blue-600">
  Workspace
</span>

<span className="inline-flex items-center rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-600">
  Doc
</span>

<span className="inline-flex items-center rounded-full bg-rose-500/10 px-2 py-0.5 text-[11px] font-medium text-rose-600">
  Agent
</span>
```

**Rule**: two badges next to each other means two categories. If they're the same category, use one badge.

---

## 11. Settings section

Linear-style single-column form. Wide title, tight description, grouped rows with a shared card surface.

```tsx
<div className="mx-auto flex max-w-2xl flex-col gap-7 pb-4">
  <header>
    <h1 className="text-[22px] font-semibold tracking-[-0.01em] text-balance">
      Model preferences
    </h1>
    <p className="mt-1 text-[13px] text-[var(--text-secondary)] text-pretty">
      Choose which model powers each agent.
    </p>
  </header>

  <SettingsGroup title="Default model">
    <SettingsRow label="Chat model" description="Used for general conversations.">
      <Select>{/* ... */}</Select>
    </SettingsRow>
    <SettingsRow label="Code model" description="Used inside code sessions.">
      <Select>{/* ... */}</Select>
    </SettingsRow>
  </SettingsGroup>
</div>
```

Title is `text-[22px]` — that's the "settings h1", not the display size. `text-balance` on the title, `text-pretty` on the description. Rows use `SettingsRow`, not raw flex.

---

## 12. Master-detail split

For settings sections with sub-navigation (integrations, agent profiles). List on the left, detail on the right, fixed 300 px split.

```tsx
<div className="flex h-full overflow-hidden">
  <nav className="w-[300px] shrink-0 border-r border-[var(--color-border-content)] overflow-y-auto">
    {items.map(item => (
      <button
        key={item.id}
        className={cn(
          'flex h-9 w-full items-center gap-2 px-3 text-[13px]',
          selected === item.id
            ? 'bg-[var(--color-fill)] text-[var(--text-primary)]'
            : 'text-[var(--text-tertiary)] hover:bg-[var(--color-fill)]/60',
        )}
      >
        {item.icon}
        <span className="truncate">{item.label}</span>
      </button>
    ))}
  </nav>

  <div className="flex-1 overflow-y-auto p-6">
    {/* detail pane */}
  </div>
</div>
```

Do not make the list resizable — a fixed 300 px maintains scannability. If the list needs more room, the section belongs at the top of the settings tree, not inside a master-detail.

---

## 13. Kanban card

Draggable card with a status tag, title, tiny metadata row, and optional git branch chip. Columns are `w-72` (288 px).

```tsx
<div className="group flex flex-col gap-1.5 rounded-lg border border-[var(--color-border-content)] bg-[var(--color-surface)] p-3">
  <div className="flex items-start gap-2">
    <StatusTag status="in_progress" />
    <p className="flex-1 text-[13px] font-medium leading-snug text-[var(--text-primary)]">
      {title}
    </p>
  </div>

  {description && (
    <p className="line-clamp-2 text-[12px] text-[var(--text-secondary)]">
      {description}
    </p>
  )}

  <div className="flex items-center gap-1.5 pt-0.5">
    {branch && (
      <span className="inline-flex items-center gap-1 rounded border border-[var(--color-border-content)] bg-[var(--color-surface)] px-1 py-0.5 text-[10px] font-mono text-[var(--text-tertiary)]">
        <GitBranchIcon className="h-2.5 w-2.5" />
        {branch}
      </span>
    )}
    <span className="text-[10px] tabular-nums text-[var(--text-tertiary)]">
      {relativeTime}
    </span>
  </div>
</div>
```

Metadata is `text-[10px] tabular-nums` — mono-width digits so timestamps in a column line up.

---

## 14. Status tag

The animated SVG state indicator. Six shapes: `triage` (ring), `backlog` (dashed ring), `started` (half-fill arc), `in_progress` (spinning quarter arc), `completed` (checkmark draw), `canceled` (circle-slash). All 12 × 12 px, all animate `strokeDashoffset` on state change.

```tsx
<StatusTag status="in_progress" />
```

The eye reads the shape faster than a color. Color pairs are the semantic accent for the category. Do not swap them.

---

## 15. Command palette entry

Cmd+K row: icon, label, and a right-aligned kbd hint.

```tsx
<CommandItem className="flex items-center gap-2 rounded-md px-2 py-1.5">
  <div className="grid size-6 place-items-center rounded bg-[var(--color-fill)]">
    <FileIcon className="h-3.5 w-3.5" />
  </div>
  <span className="flex-1 text-[13px]">Open file</span>
  <kbd className="rounded border border-[var(--color-border-content)] bg-[var(--color-surface)] px-1.5 py-0.5 text-[10px] font-mono text-[var(--text-tertiary)]">
    ⌘ P
  </kbd>
</CommandItem>
```

Rule: the icon well is size-6, the kbd hint uses `--font-mono` and displays the actual glyph (⌘ ⇧ ⌥ ⌃), not text names.

---

## 16. Toolbar with button-group and icon buttons

Adjacent buttons unified into a single group via `ButtonGroup` — no gap, radii flatten between siblings.

```tsx
<div className="flex items-center gap-1">
  <ButtonGroup>
    <Button variant="ghost" size="icon-sm"><BoldIcon /></Button>
    <Button variant="ghost" size="icon-sm"><ItalicIcon /></Button>
    <Button variant="ghost" size="icon-sm"><UnderlineIcon /></Button>
  </ButtonGroup>

  <Separator orientation="vertical" className="h-4" />

  <Button variant="ghost" size="icon-sm"><LinkIcon /></Button>
  <Button variant="ghost" size="icon-sm"><ImageIcon /></Button>
</div>
```

A `Separator` between logical groups reads as "different tool families." Don't use one between every button — space is enough.

---

## Composition rules

1. **Start from a composition, not a primitive.** If you're writing raw `div + flex + p` around an `<Input>`, stop and check whether InputGroup or Field already covers it.
2. **Density is a group-level decision.** Setting `size="sm"` on `ItemGroup` scales the whole list. Never hand-tune sizes per row.
3. **Never nest a composition inside itself.** An `Item` inside another `Item` is a code smell. Use `ItemGroup` recursion or a different layout.
4. **Chrome regions don't get content compositions.** Kanban cards don't belong in the sidebar. Sheet content doesn't belong in the footer.
5. **When in doubt, read `apps/web/src/features/{domain}/`.** The compositions here are lifted from real feature code. If your requirement doesn't fit, check whether the feature already solved it.
