# Drever design system

This document defines Drever's brand foundation. The selected identity is
**Shifted Stage D**: a stable stage with one deliberate offset that represents
change without losing context.

The system is intentionally small. `@drever/brand` owns brand assets and
reference primitives with zero runtime dependencies. Documentation, product UI,
and presentation themes map those primitives into their own semantic roles.
The brand package is not a component library and is not a parent theme.

## Strategy

Drever should look composed before it looks decorated. A branded surface uses:

- one clear reading axis;
- a dominant paper or ink field;
- one meaningful shifted plane, crop, rule, or alignment break;
- coral for the current decision or action;
- indigo for navigation, connection, and continuity;
- motion only when it explains a change in state.

The shift is a scarce device. Do not offset every card, heading, or image. Keep
the surrounding geometry aligned so the shifted element has a reason to exist.
Avoid gradients, glass effects, ornamental grids, and repeated card mosaics.

## Ownership

`@drever/brand` contains only stable, reusable primitives:

- the Shifted Stage D mark, wordmark, lockup, and favicon;
- the core colors and documented derived values;
- the Instrument Sans font files and `@font-face` declarations;
- spacing, radius, stroke, and product-motion reference tokens;
- JSON-safe token metadata and CSS custom properties.

It must not contain React components, a reset stylesheet, layout components,
presentation motion recipes, or theme-specific selectors. Importing brand
tokens must not set `color-scheme`, change an element, or install runtime code.

## Logo system

The logo family has six production assets:

| Asset                           | Use                                                               |
| ------------------------------- | ----------------------------------------------------------------- |
| Full-color mark                 | App icon, avatar, and compact product chrome on light surfaces    |
| Dark-surface mark               | Compact brand placement on Ink or Night                           |
| `currentColor` mark             | Single-color production and contexts controlled by the foreground |
| Light- and dark-surface lockups | Website headers, repository artwork, and formal attribution       |
| Favicon                         | Pixel-adjusted browser icon; do not substitute a scaled lockup    |

Use the primary full-color lockup on Paper. Use the approved dark-surface
lockup on Ink or Night. The `currentColor` mark is the only asset intended for
single-color production. The path colors in full-color assets are fixed; never
recolor individual parts. Do not place a logo directly on uncontrolled
photography.

### Clear space

Let `H` be the rendered height of the mark. Keep at least `0.25H` of empty space
on every side of the mark or lockup. This exclusion area may contain background
color but no text, rule, crop edge, icon, or interactive control.

### Minimum size

- Mark: `20px` high in ordinary screen UI.
- Favicon: use the dedicated asset at `16px`, `32px`, or larger.
- Primary lockup: `112px` wide on screen.
- Mark in print: `6mm` high.
- Primary lockup in print: `28mm` wide.

Below these sizes, use the mark or plain text rather than compressing the
lockup.

### Placement

Align the logo to the same grid as nearby content. Do not optically center it by
breaking the clear-space rule. In a presentation, persistent branding belongs
in a restrained Stage foreground or on the opening and closing slides; it does
not need to appear inside every slide.

### Misuse

Do not:

- stretch, skew, rotate, crop, outline, or add a shadow to the logo;
- change the offset or separate the shifted stage from the D;
- recreate the mark with a letter, font, CSS shape, or AI approximation;
- place the full-color asset on a field that changes its color relationships;
- animate the complete logo as navigation feedback;
- put copy or controls inside its clear space;
- use it as a repeating pattern or decorative bullet;
- combine it with another symbol to create an unofficial lockup.

## Color

### Core palette

| Token                         | Value     | Primary role                                        |
| ----------------------------- | --------- | --------------------------------------------------- |
| `--drever-brand-color-ink`    | `#172033` | Primary text, structure, and dark fields            |
| `--drever-brand-color-paper`  | `#F8F8F4` | Primary light canvas and reversed text              |
| `--drever-brand-color-coral`  | `#FF704D` | Current action, active state, and decisive emphasis |
| `--drever-brand-color-indigo` | `#4B56E8` | Navigation, links, connection, and continuity       |

Paper and Ink should occupy most of a surface. Use Coral and Indigo as roles,
not as interchangeable decoration. A component normally uses one accent. Never
place Coral and Indigo text directly on each other.

### Derived UI roles

Derived values are deterministic mixtures of the core palette. Product and
documentation CSS should consume semantic aliases rather than repeating the
mixtures inside components.

| Role                        | Light value         | Dark value                     |
| --------------------------- | ------------------- | ------------------------------ |
| Canvas                      | Paper `#F8F8F4`     | Night `#0D1019`                |
| Text                        | Ink `#172033`       | Night Text `#F8F8F4`           |
| Muted text                  | Graphite `#667085`  | Night Muted `#AEB5C6`          |
| Subtle surface              | White `#FFFFFF`     | Night Surface `#181C2B`        |
| Border                      | Line `#D9DDE7`      | Night Line `#353A4F`           |
| Primary action              | Coral with Ink text | Coral with Ink text            |
| Link or navigational action | Indigo              | Coral or underlined Night Text |
| Focus ring                  | Indigo              | Coral                          |

Borders and subtle surfaces are non-text roles and must not be reused as text
colors. The subtle border is decorative; an interactive control must not
depend on that border alone to make its boundary or state perceivable.

### Known contrast pairs

| Pair            |  Contrast | Use                                             |
| --------------- | --------: | ----------------------------------------------- |
| Ink on Paper    | `15.28:1` | Text at any supported size                      |
| Indigo on Paper |  `5.19:1` | Normal text, links, icons, and focus indicators |
| Ink on Coral    |  `5.95:1` | Text and icons on primary actions               |
| Paper on Coral  |  `2.57:1` | Not valid for normal text or essential icons    |
| Indigo on Ink   |  `2.94:1` | Not valid for normal text or essential icons    |
| Coral on Indigo |  `2.02:1` | Do not use as a foreground/background pair      |

Color must not be the only indication of selection, validity, or progress. Add
text, shape, position, underline, or another persistent cue.

## Typography

Instrument Sans Variable is the brand typeface. It is self-hosted by
`@drever/brand`; do not load it from a third-party CDN or font-loader package.
Use the actual licensed family name in `@font-face` and include the upstream
license and font version in the package.

```css
font-family: var(--drever-brand-font-family-sans);
font-synthesis: none;
```

Use the variable weight axis deliberately. Body copy should normally be `450`;
labels and controls use `550` to `650`; display copy uses `620` to `700`. Do not
simulate missing weights or italics. Keep the system monospace stack for code in
the first release.

### Product and documentation scale

| Role      | Size / line height | Weight |   Tracking |
| --------- | ------------------ | -----: | ---------: |
| Display   | `64 / 64px`        |  `680` | `-0.045em` |
| Heading 1 | `48 / 52px`        |  `660` | `-0.035em` |
| Heading 2 | `36 / 41px`        |  `640` | `-0.030em` |
| Heading 3 | `26 / 32px`        |  `620` | `-0.020em` |
| Lead      | `20 / 30px`        |  `450` | `-0.010em` |
| Body      | `16 / 25px`        |  `450` |        `0` |
| Small     | `14 / 21px`        |  `500` |        `0` |
| Label     | `12 / 16px`        |  `650` |  `0.055em` |

Use Label tracking only for short Latin labels. Do not force uppercase or wide
tracking on CJK text. Keep prose between `45ch` and `75ch`, with `68ch` as the
default maximum. Use tabular numerals for timers, slide numbers, and aligned
measurements.

Presentation themes own their canvas type scale. They may use Instrument Sans,
but must not inherit these product sizes.

## Spacing

Use a `4px` base and the following named steps:

| Step |  Value | Typical use                           |
| ---- | -----: | ------------------------------------- |
| `1`  |  `4px` | Optical adjustment only               |
| `2`  |  `8px` | Tight inline relationship             |
| `3`  | `12px` | Icon-to-label and compact control gap |
| `4`  | `16px` | Default component inset               |
| `6`  | `24px` | Related component groups              |
| `8`  | `32px` | Section inset or compact layout gap   |
| `12` | `48px` | Major section separation              |
| `16` | `64px` | Page-level separation                 |
| `24` | `96px` | Hero and large-canvas spacing         |

Prefer logical properties. Align primary geometry to the `8px` rhythm and use
`4px` only for optical correction. Do not create a new spacing value to repair
an unclear hierarchy.

## Radius

| Token    |   Value | Use                                          |
| -------- | ------: | -------------------------------------------- |
| `zero`   |     `0` | Rules, data geometry, and edge-to-edge media |
| `small`  |   `8px` | Inputs, compact controls, and code tokens    |
| `medium` |  `14px` | Buttons, menus, dialogs, and ordinary panels |
| `large`  |  `20px` | Hero media and one dominant surface          |
| `xlarge` |  `32px` | Rare oversized canvas framing                |
| `full`   | `999px` | Avatars, status dots, and true pills only    |

Nested surfaces should step down one radius or share the same center. Do not
use rounded rectangles for every piece of content. Presentation themes retain
their own shape language; Editorial may remain nearly square while Studio may
use tighter technical radii.

## Icons

Brand marks and UI icons are separate systems. Product icons use:

- a `24 × 24` view box and a `2px` safe area;
- a `2px` `currentColor` stroke;
- round line caps and joins;
- no fill unless the filled area communicates state;
- dedicated `16px`, `20px`, or `24px` output sizes rather than arbitrary scale;
- a minimum `44 × 44px` interactive target for icon-only controls.

Keep geometry direct and recognizable. Do not mix outline weights, use emoji as
interface icons, or add decorative motion. Decorative icons are
`aria-hidden="true"`. An icon-only control requires an accessible name on the
control; a tooltip alone is not an accessible name.

Icons remain local to a product until at least two products require the same
set. If that boundary becomes real, publish a separate `@drever/icons` package;
do not add React to `@drever/brand`.

## Motion

Brand motion follows the Shifted Stage model: keep the stage stable and move the
state that changed. Use opacity and short translation before scale. Avoid blur
on text and controls.

| Token      | Duration | Use                                               |
| ---------- | -------: | ------------------------------------------------- |
| Instant    |  `120ms` | Hover, press, and small color changes             |
| Quick      |  `180ms` | Selection, disclosure, and compact feedback       |
| Standard   |  `320ms` | Menu, popover, and local spatial changes          |
| Expressive |  `520ms` | One deliberate storytelling or route-level change |

Use `cubic-bezier(0.22, 1, 0.36, 1)` for entrances and spatial movement. Use
standard `ease-out` for small fades. Translation should normally stay within
`12px`; scale should stay between `0.98` and `1`.

Use a named View Transition only when an object retains identity across states.
Keep the page or Stage background stationary. Do not bounce, spin, pulse
continuously, or animate the complete logo during navigation.

When reduced motion is requested, remove spatial transforms and decorative
delay. Apply the final state immediately; do not substitute another animation.
Presentation `MotionGroup` intents and theme choreography remain owned by
Drever core, client, and the selected presentation theme, not by brand tokens.

## Accessibility

Every branded surface must meet these rules:

- normal text reaches at least `4.5:1`; large text and essential graphics reach
  at least `3:1`;
- focus is a visible `2px` ring with a `2px` offset: Indigo on light surfaces,
  Coral on Ink surfaces, and Ink on Coral surfaces;
- focus, hover, active, selected, invalid, and disabled states remain distinct
  without relying on color alone;
- interactive targets are at least `44 × 44px` unless they are inline text;
- text remains usable at `200%` zoom and does not depend on fixed-height boxes;
- motion honors `prefers-reduced-motion` and never blocks access to content;
- the wordmark receives `alt="Drever"` only when nearby text does not already
  name Drever; otherwise use an empty alternative;
- ordinary information is live text, not text embedded in an image;
- focus indicators and controls remain visible in forced-colors mode.

Self-hosted fonts must have a system fallback. Documentation should preload
only the critical roman font file. PDF export waits for `document.fonts.ready`;
visual readiness tests should also assert that the expected face is available
before accepting reference geometry.

## Consumption boundaries

### Documentation and product UI

Documentation imports brand primitives, then maps them to local semantic
variables such as `--drever-ui-canvas`, `--drever-ui-text`, and
`--drever-ui-focus`. Documentation components consume only those semantic
variables. Dark mode is a documentation mapping; `@drever/brand` does not set
it globally.

Keep documentation components inside the documentation application. Do not
publish a shared UI package until another product needs the same component
contract.

### Official presentation themes

A presentation theme remains a complete, standalone art direction. It owns its
Markdown styling, layouts, canvas scale, semantic `--drever-theme-*` variables,
and motion profile.

Default may map closely to the Drever brand. Editorial and Studio may reuse the
font or selected primitives without adopting the brand palette or product type
scale. Themes must not extend one another, import another theme's CSS, or place
product UI rules inside a slide stylesheet.

Theme metadata should expose resolved literal values for people and AI. Theme
CSS may map those values to brand custom properties, but authoring context must
not receive unresolved `var(...)` strings. Preserve documented
`--drever-theme-*` aliases so project styles remain compatible.

## AI generation prompt

Use this prompt when generating a Drever-branded documentation or product
surface. It is not a substitute for a selected presentation theme.

```text
Apply the Drever Shifted Stage D design system.

Use Instrument Sans Variable. Use #F8F8F4 Paper and #172033 Ink for most of the
surface. Use #FF704D Coral only for the current action, active state, or one
decisive emphasis. Use #4B56E8 Indigo for links, navigation, connection, and
continuity. Never place Paper text on Coral, Indigo text on Ink, or Coral on
Indigo for essential content.

Create one clear reading axis and one deliberate shifted plane, crop, rule, or
alignment break. Keep surrounding geometry aligned. Do not turn every section
into a card. Avoid gradients, glass effects, ornamental grids, excessive
rounding, and decorative animation.

Use the 4px spacing scale, 8/14/20/32px radii, 24px two-stroke icons, visible
focus rings, 44px interaction targets, and the documented type scale. Keep
prose near 68ch. Use a maximum 12px motion offset and honor reduced motion.

Use the supplied logo asset without redrawing, recoloring, or changing its
offset. Preserve 25% of the mark height as clear space. Use the lockup at 112px
or wider and the mark at 20px or larger, except for the dedicated favicon.

If the output is a presentation theme, keep its canvas typography, layouts,
semantic theme variables, and motion choreography theme-owned. Reuse brand
primitives only where they strengthen that theme's own art direction.
```
