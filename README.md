# NLM & NCBI by the Numbers

One static page of exact counts, dates, funding and oddities from the U.S. National Library of Medicine, NCBI and NIH. No build step, no runtime dependencies.

Lenses at the top filter the page for bioinformatics, biostatistics, or funding and time. `?lens=bioinfo`, `?lens=stats` and `?lens=funding` link straight to one.

| Command | Does |
| --- | --- |
| `npm run serve` | Serves the page at http://127.0.0.1:8080/ |
| `npm run lint` | ESLint, Stylelint and html-validate, each with a no-comments rule |
| `npm test` | Lint, unit tests, and Playwright end-to-end tests at desktop and mobile widths |
| `npm run snapshot` | Rebuilds `src/snapshot.js` from E-utilities, ClinicalTrials.gov, NIH RePORTER, GenBank and RefSeq (about 15 minutes) |

- `.github/workflows/snapshot.yml` rebuilds the snapshot every Sunday and commits it when numbers change.
- `src/facts.js`: timeline, projects, people, API limits, cadences and oddities, each tied to a source URL.
- `src/queries.js`: every query behind the counts.
