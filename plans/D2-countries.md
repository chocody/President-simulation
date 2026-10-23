# D2 — Real country data pipeline (lane D)

Owner: worker (Sonnet). Reviewer: Lead. Read `CLAUDE.md` first.
Goal: `scripts/build-countries.ts` turns World Bank API data into `data/countries/<ISO3>.json` (contract
`CountryData`) for `MVP_COUNTRIES`, using `DATA_MAPPING` from design-params. **The network to
api.worldbank.org is blocked in this environment today**: build and test everything offline; the real run
happens later when the owner opens the network.

## Files you own
`scripts/build-countries.ts`, `scripts/lib/worldbank.ts`, `scripts/lib/mapping.ts`, `scripts/test/**`.
You may **append** source entries to `data/sources/sources.yaml` for indicator codes used by `DATA_MAPPING`
that are not in it yet (HD.HCI.OVRL, SP.RUR.TOTL.ZS, the SP.POP bands, SP.POP.1564.TO.ZS) with
`license: CC BY 4.0`, `verifiedBy: null`, `note: "code not yet confirmed by a live API call"`. Edit nothing else.

## Behaviour
- World Bank API v2: `https://api.worldbank.org/v2/country/{iso3}/indicator/{code}?format=json&mrv=10&per_page=100`.
  Response is `[meta, rows]` with rows `{ date, value, countryiso3code, country: { value } }`. Country metadata:
  `https://api.worldbank.org/v2/country/{iso3}?format=json` (name, region). Population: `SP.POP.TOTL`.
- For each code take the **latest non-null** value and its year. Reject values older than
  `maxDataAgeYears` relative to the newest year in that response set.
- Apply `DATA_MAPPING` exactly (see its rationale). A country missing any required code is **skipped** with a
  clear reason; never fill gaps with guesses or regional averages. Optional: HCI (education falls back to
  enrollment alone), armed forces (military share 0 → log it).
- `budget`, `parliament`, `foreignRelations` use `UNSOURCED_DEFAULTS` / design values with provenance
  `{ sourceId: "design.unsourced", year: null, raw: null }`; budget uses `{ sourceId: "design.budget" }`.
- `baselineSrc` per stat: the source id of the main code (`wdi.<code>` or `wgi.<code>`), year and raw value.
  Composite stats (health, education, crime, environment) cite the first code and record the others in the
  build report.
- `nameTh`: a fixed Thai name map for the 10 MVP countries in `scripts/lib/mapping.ts`.
- Writes JSON files + `data/countries/_build-report.json` (per country: codes used, years, skipped reasons).
- Flags: `--dry` (no network, print planned requests), `--fixtures <dir>` (read saved API responses from disk),
  `--save-raw <dir>` (store raw responses for review). Exit non-zero if fewer than 6 countries pass.

## Tests (write first, Vitest, no network)
Fixture API responses go in `scripts/test/fixtures/wb/` and must be labelled in a README there:
`TEST FIXTURE — shape copied from the API docs, values invented`. Test: latest-non-null selection, age
cut-off, every mapping formula on hand-computed numbers, skip on missing required code, group shares sum to 1,
output parses with `CountryData`, every `baselineSrc.sourceId` exists in sources.yaml.

## Done when
`pnpm test`, `pnpm typecheck`, and `pnpm tsx scripts/build-countries.ts --dry` succeed. Report which WDI codes
you could not confirm exist (you cannot reach the API), and anything else not done.
