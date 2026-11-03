# NLM & NCBI by the Numbers

One static page of exact counts, dates and oddities from the U.S. National Library of Medicine and NCBI. No build step, no runtime dependencies.

| Command | Does |
| --- | --- |
| `npm run serve` | Serves the page at http://127.0.0.1:8080/ |
| `npm test` | Unit tests and Playwright end-to-end tests (desktop and mobile widths) |
| `npm run snapshot` | Rebuilds `src/snapshot.js` from E-utilities, the ClinicalTrials.gov API and GenBank release notes |

- `src/facts.js`: timeline, projects, people and oddities, each tied to a source URL.
- `src/queries.js`: every E-utilities query behind the counts.
- "Refresh live" on the page re-reads every Entrez count and the ClinicalTrials.gov total from the browser.
