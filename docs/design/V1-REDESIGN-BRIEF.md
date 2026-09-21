# Moyang Reader v1.0 Redesign Brief

## Status and authority

This brief records the approved input for the Figma design phase. It is not the final `DESIGN.md`; that document will be generated from the shipped implementation after production migration. The Figma file remains the visual source of truth during redesign.

## Product promise

Moyang Reader is a Windows x64, local-first reading workspace for people who spend long sessions with local documents. Ordinary files remain the source of truth. The redesign must make location, state, and the next safe action immediately clear without turning the reading canvas into a dashboard.

## Visual direction

The shared visual language is **contemporary public-library wayfinding**:

- a calm, neutral reading field surrounded by a more distinctive navigation shell;
- visible path, location, section, and status cues;
- strong alignment, restrained rules, shelf/zone codes, and clear grouping;
- Chinese-first system sans typography for application chrome;
- no book-page, leaf, sparkle, AI-gradient, glassmorphism, or rounded-card clichés.

The identity should feel civic, current, precise, and welcoming rather than governmental, nostalgic, luxurious, or playful.

## User-selectable appearance presets

All presets share identical semantic roles, component geometry, interaction placement, focus treatment, and accessibility behavior. A theme may change only semantic color values and the resulting surface hierarchy.

### Porcelain / 冷静瓷白

- Dominant surfaces: porcelain and cool white.
- Structure and text: soft graphite.
- Primary route: muted ultramarine.
- Secondary state: pale celadon.
- Locator accent: coral used on less than five percent of the interface.
- Character: bright, precise, quiet, contemporary.

### Paper / 温润纸色

- Dominant surfaces: oyster and paper white, without sepia treatment.
- Structure and text: deep aubergine and ink.
- Primary locator: dusty rose.
- Secondary state: muted sage.
- Character: warm, cultivated, editorial, never vintage or cosmetic.

### Ink / 夜间墨黑

- Dominant surfaces: charcoal navy and soft ink.
- Text: warm ivory rather than pure white.
- Secondary route: desaturated teal.
- Primary locator and progress: muted brass.
- Character: quiet night reading room, never neon, cyberpunk, terminal-like, or gaming-oriented.

Existing `system`, `light`, and `dark` settings must continue to load safely. The production storage mapping for the three presets must be additive and reversible; it cannot invalidate old settings or change the existing storage key.

## Information architecture

### Top bar

Three stable groups:

1. current document and location;
2. read, edit, and save primary actions;
3. search and panel controls.

Update, export, settings, and other low-frequency actions live in one consistent menu or overlay. Reading appearance is not hidden there; it remains one operation away from the reader.

### Left workspace

- File navigation is the permanent subject.
- Search and filters expand on demand.
- Reading history is independently collapsible.
- Library management and batch export move to the workspace menu.

### Reading canvas

- Default article text remains approximately 17px with comfortable line spacing.
- Borders and shadows recede behind content.
- Focus mode becomes a continuous full-height canvas with lightweight chapter progress.
- Zoom, content width, typeface category, and line spacing are directly accessible.

### Right context

Two first-level groups:

- Navigation: outline and bookmarks.
- Understanding: related items, properties, and annotations.

At compact widths the right context becomes a focus-managed drawer.

## Responsive frames

- 1240px: full three-column shell.
- 900px: compact shell with lower-priority top-bar actions folded.
- 720px: minimum desktop width; right context becomes a drawer and no horizontal overflow is permitted.
- Minimum validation viewport: 720×600.
- Windows scale validation: 100%, 125%, 150%, and 200% DPI.

## Foundation model

Figma variables must be created before components:

- semantic color roles with Porcelain, Paper, and Ink modes;
- spacing on a 4px base with 8px primary rhythm;
- typography roles for UI, metadata, labels, article, and code;
- radii kept restrained and purpose-specific;
- elevation limited to overlays and detached drawers;
- motion roles for reveal, state change, and route/location change;
- reduced-motion variants with no information loss.

Every semantic foreground/background pair requires WCAG AA verification. Success, warning, danger, selection, focus, and current location cannot share the same semantic color role.

## Component inventory

Build components only after variables and styles:

- Button and IconButton;
- Tabs and grouped context navigation;
- Tree Row and search result row;
- Document Tab;
- Search Field;
- Menu and context menu;
- Popover;
- Dialog;
- Drawer;
- Status and Toast;
- Reading Controls;
- Editor Toolbar;
- progress/location indicator;
- empty, loading, error, conflict, and disabled states.

All components require hover, pressed, focus-visible, disabled, selected, busy, and destructive states where applicable. Keyboard behavior and focus return are part of the component contract, not implementation notes.

## Core experiences

The Figma prototype must connect:

1. first launch;
2. open reading library;
3. long-form reading;
4. focus mode;
5. edit and save;
6. full-text workspace search;
7. external modification conflict;
8. draft recovery;
9. settings and theme selection;
10. export;
11. update.

Required keyframes cover 1240 light presets, 1240 Ink, 900 compact, 720 minimum, focus reading, complex workspace, editor, and critical overlays.

## Non-negotiable acceptance criteria

- Existing core tasks gain no required step.
- Primary desktop targets are at least 32×32px; regular control text is at least 12px.
- Chinese and English use the same complete key set.
- Keyboard navigation, focus return, forced colors, reduced motion, and screen-reader semantics remain explicit.
- No large runtime UI dependency is introduced.
- Initial production bundle growth stays within five percent of the recorded baseline.
- File safety, recovery, IPC, command IDs, document formats, and shortcuts remain unchanged.

## Figma file structure

Create one file named `Moyang Reader — v1.0 Redesign` with pages in this order:

1. Foundations
2. Components
3. Core Experiences
4. Prototype
5. QA
