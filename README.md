# NLM & NCBI in Numbers

One static page about what the U.S. National Library of Medicine and NCBI hold, what NIH pays for, and the odd corners in between. Annotated charts, a treemap of NIH funding, a zoomable timeline and waffle charts, all hand-built SVG with no runtime dependencies.

Lenses at the top filter the page: `?lens=bioinfo`, `?lens=stats` or `?lens=funding`.

## Run it

| Command | Does |
| --- | --- |
| `npm run serve` | Serves the page at http://127.0.0.1:8080/ |
| `npm run lint` | ESLint, Stylelint and html-validate, each with a no-comments rule |
| `npm test` | Lint, unit tests, and Playwright end-to-end tests at desktop and mobile widths |
| `npm run snapshot` | Rebuilds `src/snapshot.js` from E-utilities, ClinicalTrials.gov, NIH RePORTER, GenBank and RefSeq (about 35 minutes) |
| `npm run snapshot -- types genbank` | Rebuilds only the named sections |

## Publish it

1. Merge this branch into `master`.
2. In the repository on GitHub: **Settings → Pages → Build and deployment → Source: GitHub Actions**.
3. The `Publish site` workflow deploys to `https://collide2954.github.io/nlm-stats/` on every push to `master` and after each weekly snapshot.

`.github/workflows/snapshot.yml` rebuilds the data every Sunday and commits it when numbers change.

## Where things live

- `src/facts.js`: timeline, projects, people, API limits, cadences and oddities, each tied to a source URL.
- `src/queries.js`: every query behind the counts.
- `src/findings.js`: the section headlines, computed from the data so they stay true after each update.
- `src/charts.js`: the SVG chart engine and animations.
