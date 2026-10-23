# World Bank API fixtures

TEST FIXTURE — shape copied from the API docs, values invented

These files exist only so `scripts/build-countries.ts` can be tested offline. Country names and regions
carry the label "(TEST FIXTURE)". Every number is `base + step × country index` plus a small yearly drift
(see `scripts/test/make-fixtures.ts`), so none of it is real data. Never copy a value from here into
`data/countries/` or anywhere a player could see it.

Layout (also what `--save-raw <dir>` writes): `<ISO3>/_country.json` for the country call and
`<ISO3>/<indicator code>.json` for each indicator call, in the `[meta, rows]` shape the API returns,
newest year first.

Deliberate gaps, each covered by a test in `scripts/test/build.test.ts`:

| Country | Gap | Expected result |
|---|---|---|
| THA | crime (`VC.IHR.PSRC.P5`) is null in 2023 | uses 2022 (latest non-null) |
| KEN | unemployment (`SL.UEM.TOTL.ZS`) is null in every year | skipped (required code) |
| MEX | debt (`GC.DOD.TOTL.GD.ZS`) stops in 2012 | skipped (older than 8 years) |
| IND | no `HD.HCI.OVRL` response | education = enrolment alone |
| DEU | armed forces (`MS.MIL.TOTL.TF.ZS`) null in every year | military share 0 |

Regenerate with `pnpm tsx scripts/test/make-fixtures.ts`.
