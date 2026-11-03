import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  summarizeAwards,
  groupAwards,
  medianYears,
  detailFiscalYear,
  parseRefseqHeader,
} from '../../scripts/parsers.mjs';

const P = (over) => ({
  subproject_id: null,
  award_amount: 100,
  activity_code: 'R01',
  is_new: false,
  project_start_date: '2020-01-01T00:00:00',
  project_end_date: '2024-01-01T00:00:00',
  spending_categories_desc: 'Data Science; Genetics',
  organization: { org_name: 'UNIV A', org_state: 'MD' },
  ...over,
});

test('summarizeAwards skips subprojects and missing amounts', () => {
  const rows = [P(), P({ award_amount: 50 }), P({ subproject_id: '7', award_amount: 999 }), P({ award_amount: null })];
  assert.deepEqual(summarizeAwards(rows), { projects: 3, dollars: 150 });
});

test('groupAwards totals by key, splitting multi-valued keys, sorted by dollars', () => {
  const rows = [
    P({ activity_code: 'R01', award_amount: 10 }),
    P({ activity_code: 'T15', award_amount: 40 }),
    P({ activity_code: 'R01', award_amount: 20 }),
    P({ activity_code: 'R01', award_amount: 5, subproject_id: '1' }),
  ];
  assert.deepEqual(groupAwards(rows, (r) => r.activity_code), [
    { key: 'T15', projects: 1, dollars: 40 },
    { key: 'R01', projects: 2, dollars: 30 },
  ]);
  const cats = groupAwards([P({ award_amount: 10 }), P({ award_amount: 5, spending_categories_desc: 'Genetics' })],
    (r) => r.spending_categories_desc.split(';'));
  assert.deepEqual(cats, [
    { key: 'Genetics', projects: 2, dollars: 15 },
    { key: 'Data Science', projects: 1, dollars: 10 },
  ]);
});

test('medianYears reports the median project length', () => {
  const rows = [
    P({ project_start_date: '2020-01-01T00:00:00', project_end_date: '2021-01-01T00:00:00' }),
    P({ project_start_date: '2020-01-01T00:00:00', project_end_date: '2024-01-01T00:00:00' }),
    P({ project_start_date: '2020-01-01T00:00:00', project_end_date: '2025-01-01T00:00:00' }),
    P({ project_start_date: null, project_end_date: '2025-01-01T00:00:00' }),
  ];
  assert.equal(medianYears(rows), 4);
});

test('detailFiscalYear picks the latest fiscal year with settled data', () => {
  assert.equal(detailFiscalYear(new Date('2026-11-03T00:00:00Z')), 2025);
  assert.equal(detailFiscalYear(new Date('2027-02-01T00:00:00Z')), 2025);
  assert.equal(detailFiscalYear(new Date('2027-04-01T00:00:00Z')), 2026);
});

test('parseRefseqHeader reads release, date and size', () => {
  const text = `RefSeq-release237.txt

\t\tNCBI Reference Sequence (RefSeq) Database

\t\t\tRelease 237
\t\t\tAugust 31, 2026

\t\tDistribution Release Notes

Release Size:
   184752 organisms
   645505406 records
`;
  assert.deepEqual(parseRefseqHeader(text), { release: 237, date: 'August 31, 2026', organisms: 184752, records: 645505406 });
});
