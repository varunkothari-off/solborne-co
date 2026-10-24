# Reused payment-story illustrations

Verified 24 October 2026. These are existing **Storyset / Freepik Company, Cuate style** illustrations, downloaded from the public URLs published by their official pages. No account, subscription or payment was used. No illustration or animation was drawn/generated for these scenes.

## Sources and selection

| Local file under `cloudflare-site/public/assets/payment-story/` | Original | Why selected | Official page | Public original SVG |
|---|---|---|---|---|
| `burden.svg` | Overwhelmed | A person carrying paperwork, a calendar, calculator and clock makes the owner's administrative burden legible. | [Overwhelmed / Cuate](https://storyset.com/illustration/overwhelmed/cuate) | [Official SVG](https://stories.freepiklabs.com/storage/70243/Overwhelmed_Mesa-de-trabajo-1.svg) |
| `followup.svg` | Payment information | A payment interface establishes the routine payment step. The form is an illustration, not a working checkout or proof of Solborne functionality. | [Payment information / Cuate](https://storyset.com/illustration/payment-information/cuate) | [Official SVG](https://stories.freepiklabs.com/storage/30141/Payment-information_Mesa-de-trabajo-1.svg) |
| `owner.svg` | Business solution | Two people resolving a shared puzzle represent collaboration and judgement. Supporting copy must explain the owner's personal intervention. | [Business solution / Cuate](https://storyset.com/illustration/business-solution/cuate) | [Official SVG](https://stories.freepiklabs.com/storage/58267/Business-solution_Mesa-de-trabajo-1.svg) |

The shared Cuate style keeps the story visually consistent. These communicate concepts; they do not depict an operating Solborne dashboard. Document collection and quotations are outside this payment story.

## Licence and required attribution

The official asset pages identify the **Freepik License**, with free personal/commercial use and modifications subject to attribution. The controlling [Storyset Terms of Use](https://storyset.com/terms) were accessible and reviewed, particularly section 6; the page displays February 2022 as its revision date. The [official FAQ](https://storyset.com/faqs) confirms attribution is required for free use and downloaded SVGs may be edited.

Keep a visible link wherever these scenes appear:

```html
<a href="https://storyset.com/" target="_blank" rel="noopener noreferrer">Illustrations by Storyset</a>
```

The licence grants limited, nonexclusive use and modification. Do not claim endorsement, use these as Solborne's trademark, or redistribute/resell them as a stock collection or reusable illustration library. This inclusion is for Solborne's own website storytelling. It does not grant a licence for client templates or automatic distribution to other businesses. Retain this manifest with the sources; the site's general source licence does not replace Storyset's terms.

## Modifications and checks

- Only the stock accent colour `#FFC727` was replaced with Solborne gold `#b79450`. Artist geometry, skin colours, neutral colours, text and dimensions were retained. No custom animation, looping CSS, SVG animation or added drawing.
- Original viewBoxes: burden/followup `0 0 500 500`; owner `0 0 750 500`. Use `object-fit: contain` and centre the image; do not stretch the wider owner illustration.
- Parsed all three as SVG/XML; no script, event-handler attributes, foreignObject, animation elements or external references found.
- Rendered the three local files together in headless Chrome and visually inspected the resulting screenshot. All illustrations rendered with the modified gold accent.

| File | Bytes | SHA-256 |
|---|---:|---|
| `burden.svg` | 393161 | `a43f17b51608204d31585e4b61913d03c253c960b3bb6b0beec7ac5818e6c716` |
| `followup.svg` | 211271 | `27bf77faf474b82af8d70a3c4daf88fce56f46343162cee7a049d43ae43ae9d4` |
| `owner.svg` | 209429 | `57c94a56d05ee2b427b619f21192074bd0923ccede47132a21d32afd30b33d19` |
