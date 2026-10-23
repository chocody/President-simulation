# Human review checklist

Open each link, confirm the page states the finding, then set `verifiedBy` (your name) on the source in
`data/sources/research-sources.yaml` and on each evidence item in `data/evidence/evidence.yaml`.

## 1. Research sources (38) — ⚠ = flagged by the worker

- [ ] **paper.egger-2022** [General Equilibrium Effects of Cash Transfers: Experimental Evidence from Kenya](https://www.nber.org/system/files/working_papers/w26600/w26600.pdf)
  - `ev.cash-transfer.001` gdpGrowth up (rct): A randomized trial of one-off cash transfers to poor rural households found the money circulated through the local economy, raising local income by more than the amount transferred (multiplier about 2.5).
  - `ev.cash-transfer.002` inflation none (rct): In the same trial, large cash transfers to villages caused little local price inflation.
- [ ] **paper.olken-2007** [Monitoring Corruption: Evidence from a Field Experiment in Indonesia](https://www.nber.org/papers/w11753)
  - `ev.audit.001` corruption down (rct): A randomized study of village road projects found that a higher chance of a government audit cut missing expenditures by about 8 percentage points, though some corruption shifted to harder-to-detect channels such as nepotism.
- [ ] **paper.cengiz-2019** [The Effect of Minimum Wages on Low-Wage Jobs](https://academic.oup.com/qje/article-abstract/134/3/1405/5484905)
  - `ev.minimum-wage.001` unemployment none (quasi): A study of many state-level minimum wage increases found the total number of low-wage jobs was essentially unchanged over five years, while low-wage earnings rose.
- [ ] **review.braga-hotspots** [The Effects of Hot Spots Policing on Crime: An Updated Systematic Review and Meta-Analysis](https://www.ojp.gov/ncjrs/virtual-library/abstracts/effects-hot-spots-policing-crime-updated-systematic-review-and-meta)
  - `ev.policing.001` crime down (review): A systematic review found that focusing police in the small places where crime concentrates produces small but meaningful crime reductions, with benefits spreading to nearby areas rather than displacing crime.
- [ ] **paper.heller-2014** [Summer jobs reduce violence among disadvantaged youth](https://www.phila.gov/bestpractices/PDF/Science-2014-Heller-1219-23.pdf)
  - `ev.policing.002` crime down (rct): A randomized trial of summer jobs for youths in high-violence neighbourhoods cut violent-crime arrests by about 43% over 16 months, with no difference in drug or property arrests.
- [ ] **eval.jpal-mask-bangladesh** [The Impact of Mask Distribution and Promotion on Mask Uptake and Covid-19 in Bangladesh](https://povertyactionlab.org/node/7800225)
  - `ev.epidemic.001` health up (rct): A village-level randomized trial found that free masks combined with promotion and community role models roughly tripled mask use and reduced symptomatic infections.
- [ ] **review.cochrane-respiratory-2023** [Physical interventions to interrupt or reduce the spread of respiratory viruses](https://cochranelibrary.com/cdsr/doi/10.1002/14651858.CD006207.pub6)
  - `ev.epidemic.002` health up (review): A review of many randomized trials found hand hygiene reduced acute respiratory infections by about 14%, while evidence on masks was inconclusive.
- [ ] **paper.goolsbee-syverson-2021** [Fear, Lockdown, and Diversion: Comparing Drivers of Pandemic Economic Decline 2020](https://www.nber.org/digest/aug20/consumers-fear-virus-outweighs-lockdowns-impact-business)
  - `ev.epidemic.003` gdpGrowth down (quasi): Phone-location data on many businesses showed most of the early-pandemic fall in customer traffic came from people's own fear of infection; legal orders explained only a small part, and lifting them brought a modest recovery.
- [ ] **report.cdc-hospital-strain** [Impact of Hospital Strain on Excess Deaths During the COVID-19 Pandemic - United States, July 2020-July 2021](https://www.cdc.gov/mmwr/volumes/70/wr/mm7046a5.htm?cb=12963)
  - `ev.hospital.001` health down (observational): An analysis of pandemic data found more excess deaths when hospitals were strained by high occupancy and staffing pressure (observational and model-based, not an experiment).
- [ ] **review.lagarde-user-fees** [The impact of user fees on access to health services in low- and middle-income countries](https://www.cochrane.org/evidence/CD009094_impact-user-fees-access-health-services-low-and-middle-income-countries)
  - `ev.hospital.002` health mixed (review): A Cochrane review found that dropping or cutting patient fees raises use of some services, but effects on preventive services and quality are unclear and the certainty of the evidence is very low.
- [ ] **book.imf-energy-subsidy-2013** [Energy Subsidy Reform: Lessons and Implications](https://www.imf.org/en/publications/books/issues/2016/12/31/energy-subsidy-reform-lessons-and-implications-40410)
  - `ev.fuel-subsidy.001` budget down (review): An IMF compilation of country cases concludes that broad energy subsidies worsen fiscal deficits and crowd out other priority spending.
  - `ev.fuel-subsidy.002` inequality up (review): The same work finds that most of the benefit of broad energy subsidies goes to higher-income households, reinforcing inequality.
- [ ] **paper.karlan-2012** [Agricultural Decisions after Relaxing Credit and Risk Constraints](https://www.nber.org/papers/w18463.pdf)
  - `ev.drought.001` group:farmers up (rct): A randomized trial with smallholder farmers found rainfall index insurance increased farm investment and riskier, higher-return production choices.
- [ ] **paper.knippenberg-hoddinott-2017** [Shocks, social protection, and resilience: Evidence from Ethiopia](https://essp.ifpri.info/2017/09/07/shocks-social-protection-and-resilience-evidence-from-ethiopia-2/)
  - `ev.drought.002` group:farmers up (quasi): A study of a rural safety-net programme found its payments cut the initial drought impact on household food security by about 57% and erased the adverse effect within two years.
- [ ] **paper.kocornik-mina-2020** [Flooded Cities](https://www.aeaweb.org/doi/10.1257/app.20170066)
  - `ev.flood.001` gdpGrowth mixed (observational): Satellite night-light and flood-map data for cities worldwide show a small dip in economic activity in the flood year and a near-full recovery the next year, with low-lying areas rebounding about as fast as higher ground.
- [ ] **paper.muralidharan-2023** [General Equilibrium Effects of (Improving) Public Employment Programs: Experimental Evidence from India](https://econpapers.repec.org/paper/nbrnberwo/23838.htm)
  - `ev.public-works.001` inequality down (rct): A randomized rollout of an improved public employment programme raised household earnings by about 14% and cut poverty by about 26%, mostly through higher private-sector earnings.
- [ ] **paper.amiti-2019** [The Impact of the 2018 Trade War on U.S. Prices and Welfare](https://cep.lse.ac.uk/_NEW/PUBLICATIONS/abstract.asp?index=6160)
  - `ev.tariff.001` inflation up (quasi): A study of a recent tariff war found tariffs were passed through almost completely to domestic prices, so domestic consumers bore the cost.
- [ ] **paper.fajgelbaum-2020** [The Return to Protectionism](https://egc.yale.edu/research/return-protectionism)
  - `ev.tariff.002` gdpGrowth down (quasi): Another study of import and retaliatory tariffs found buyers of imports lost about 0.27% of GDP; after tariff revenue and producer gains the net loss was much smaller, and the burden fell hardest on retaliation-hit export sectors.
- [ ] **paper.imf-tax-incentives** [Empirical Evidence on the Effects of Tax Incentives](https://www.imf.org/en/publications/wp/issues/2016/12/31/empirical-evidenceon-the-effects-of-tax-incentives-23053) ⚠ ไม่มีผู้เขียน/ปี
  - `ev.fdi.001` gdpGrowth none (observational): A cross-country analysis found lower corporate tax rates and longer tax holidays attract foreign direct investment but do not raise total fixed investment or growth.
- [ ] **paper.alfaro-2004** [FDI and Economic Growth: The Role of Local Financial Markets](https://www.econ.umd.edu/publication/fdi-and-economic-growth-role-local-financial-markets)
  - `ev.fdi.002` gdpGrowth mixed (observational): Cross-country data from 1975-1995 show FDI alone has an ambiguous effect on growth, while countries with well-developed local financial markets gain significantly from it.
- [ ] **eval.jpal-ferraz-finan** [Politicians, Publicly-Released Audits of Corruption, and Electoral Outcomes in Brazil](https://www.povertyactionlab.org/evaluation/politicians-publicly-released-audits-corruption-and-electoral-outcomes-brazil)
  - `ev.disclosure.001` parliament down (quasi): When randomly selected municipal audits were made public, mayors found to be corrupt had a lower chance of re-election, especially where local radio existed (mapped here to the exposed incumbent's political support).
- [ ] **paper.card-kluve-weber-2018** [What Works? A Meta Analysis of Recent Active Labor Market Program Evaluations](https://www.nber.org/papers/w21431)
  - `ev.youth-jobs.001` unemployment down (review): A meta-analysis of over 200 job-search and training programme evaluations found effects near zero in the short run that turn positive after two to three years; skills-focused programmes did better, and effects were larger in recessions.
- [ ] **paper.blattman-annan-2016** [Can Employment Reduce Lawlessness and Rebellion? A Field Experiment with High-Risk Men in a Fragile State](https://nber.org/papers/w21289)
  - `ev.employment-crime.001` crime down (rct): A randomized trial with high-risk men found an agricultural package of training plus capital shifted time away from illicit work, while training alone without capital had small effects.
- [ ] **paper.banerjee-2010** [Improving immunisation coverage in rural India: randomised evaluation of reliable immunisation camps with and without incentives](https://dspace.mit.edu/handle/1721.1/57503) ⚠ ชื่อเรื่องเป็นคำบรรยาย ไม่ใช่ชื่อจริง
  - `ev.immunization.001` health up (rct): A randomized trial in rural villages found reliable monthly immunisation camps raised full immunisation from about 6% to 18%, and adding small incentives such as lentils raised it to about 39%.
- [ ] **paper.gopinath-2010** [Currency Choice and Exchange Rate Pass-through](https://www.nber.org/papers/w13432)
  - `ev.currency.001` inflation up (observational): Import transaction data show how far exchange-rate moves reach import prices depends on the currency of pricing: goods priced in non-dollar currencies pass through almost fully (data are from a large importer, not a currency-crisis economy).
- [ ] **paper.jones-marinescu-2022** [The Labor Market Impacts of Universal and Permanent Cash Transfers: Evidence from the Alaska Permanent Fund](https://www.nber.org/papers/w24312)
  - `ev.dividend.001` unemployment none (quasi): A permanent dividend paid to every resident from resource income did not reduce overall employment, but part-time work rose; the authors point to local spending supporting the economy.
- [ ] **review.windfall-managing** [Natural resource wealth: the challenge of managing a windfall](https://research.monash.edu/en/publications/natural-resource-wealth-the-challenge-of-managing-a-windfall/) ⚠ ผู้เขียนอาจผิด
  - `ev.windfall.001` budget up (review): A review argues that countries were hurt by volatile resource revenues and often saved too little or failed to make high-return investments, which supports rules for saving and managing a windfall.
- [ ] **paper.ferdi-windfall** [Optimal fiscal management of resource windfalls](https://ferdi.fr/dl/df-pJdgE1fpWAXhzjgJXxKmFNJ8/ferdi-b130-optimal-fiscal-management-of-resource-windfalls.pdf) ⚠ ไม่เห็นชื่อผู้เขียน ตั้งชื่อจาก URL
  - `ev.windfall.002` gdpGrowth up (review): A working paper notes that putting a whole windfall into safe assets can carry a high opportunity cost, since public infrastructure investment can have high returns.
- [ ] **paper.allcott-keniston-2018** [Dutch Disease or Agglomeration? The Local Economic Effects of Natural Resource Booms in Modern America](https://www.nber.org/papers/w20508.pdf)
  - `ev.dutch.001` gdpGrowth mixed (quasi): During local resource booms wages rose and some tradable manufacturing subsectors shrank, yet overall manufacturing grew, so the effect on the wider economy is mixed.
- [ ] **paper.atkin-2017** [Exporting and Firm Performance: Evidence from a Randomized Trial](https://www.nber.org/papers/w20690.pdf)
  - `ev.export.001` group:business up (rct): A randomized trial that gave one group of producers access to foreign buyers raised their profits by roughly 16-26% (figure differs by draft) and improved product quality, which the authors read as learning by exporting.
- [ ] **paper.hyman-kovak-leive-2024** [Wage Insurance for Displaced Workers](https://www.nber.org/system/files/working_papers/w32464/w32464.pdf)
  - `ev.taa.001` unemployment down (quasi): Wage insurance for workers displaced by trade raised short-run employment and long-run cumulative earnings, mainly by shortening spells without work.
- [ ] **review.nunkoo-2020** [Tourism and Economic Growth: A Meta-regression Analysis](https://pure.uj.ac.za/en/publications/tourism-and-economic-growth-a-meta-regression-analysis/)
  - `ev.tourism.001` gdpGrowth up (review): A meta-analysis of many studies mostly supports tourism-led growth, but results vary with data and method and publication bias was detected.
- [ ] **paper.faber-gaubert-2019** [Tourism and Economic Development: Evidence from Mexico's Coastline](https://www.nber.org/papers/w22300)
  - `ev.tourism.002` gdpGrowth up (quasi): Coastal tourism brought large local gains including spillovers to local manufacturing, but these were largely offset nationally; national gains came mainly from market integration.
- [ ] **paper.asher-novosad-2020** [Rural Roads and Local Economic Development](https://www.aeaweb.org/doi/10.1257/aer.20180268)
  - `ev.roads.001` group:farmers none (quasi): Four years after a new feeder road the main effect was workers leaving agriculture, with no major change in farm outcomes, income or assets and only a small rise in village firm jobs.
- [ ] **paper.dinkelman-2011** [The Effects of Rural Electrification on Employment: New Evidence from South Africa](https://ideas.repec.org/a/aea/aecrev/v101y2011i7p3078-3108.html)
  - `ev.electrification.001` unemployment down (quasi): Extending electricity to rural communities significantly raised female employment within five years; men also worked more, but by less.
- [ ] **paper.bloom-griffith-vanreenen-2002** [Do R&D tax credits work? Evidence from a panel of countries 1979-1997](https://researchonline.lse.ac.uk/id/eprint/1353)
  - `ev.rnd.001` gdpGrowth up (observational): Data from several countries show tax cuts that lower the cost of R&D raise R&D a little in the short run and much more in the long run (the outcome measured is R&D, not growth directly).
- [ ] **review.bloom-toolkit-2019** [A Toolkit of Policies to Promote Innovation](https://www.aeaweb.org/doi/10.1257/jep.33.3.163)
  - `ev.rnd.002` gdpGrowth up (review): A review concludes that R&D tax credits and direct funding work best in the short run, while raising the supply of skilled people (for example STEM places) is likely more effective over the longer run.
- [ ] **paper.aghion-2005** [Competition and Innovation: An Inverted U Relationship](https://img.nber.org/papers/w9269)
  - `ev.competition.001` gdpGrowth mixed (quasi): The link between competition and innovation is hump-shaped: moderate competition pushes evenly matched firms to innovate, while very strong competition weakens the incentive of laggards.
- [ ] **paper.burke-2019** [Sell Low and Buy High: Arbitrage and Local Price Effects in Kenyan Markets](https://www.nber.org/papers/w24476)
  - `ev.storage.001` group:farmers up (rct): A randomized trial of timely credit let smallholders hold grain until prices rose, earning a return of about 29%, and large-scale storage lifted prices just after harvest.

## 2. Choices without evidence (engine keeps them at level 1)

- `economy.currency.crash.a` ใช้ทุนสำรองพยุงค่าเงินและควบคุมราคาสินค้า
- `economy.oil.spike.b` ปล่อยราคาลอยตัวตามตลาด
- `economy.tourism.surge.c` จำกัดจำนวนผู้เข้าชมและลงทุนระบบน้ำ ขยะ และขนส่ง
- `foreign.tariff.raised.b` เจรจาและกระจายตลาดส่งออก
- `foreign.tariff.raised.c` ช่วยเหลือชั่วคราวเฉพาะผู้ส่งออกที่ได้รับผลกระทบ
- `foreign.trade.export-boom.c` ปล่อยให้ตลาดปรับตัวเองและลดภาษีวัตถุดิบนำเข้า
- `health.hospitals.overwhelmed.a` เพิ่มเตียงและจ้างบุคลากรชั่วคราวเร่งด่วน
- `health.vaccination.decline.c` บังคับฉีดวัคซีนเป็นเงื่อนไขเข้าโรงเรียน
- `opportunity.fdi.offer.c` ปฏิเสธและสนับสนุนผู้ประกอบการในประเทศ
- `politics.cabinet.scandal.b` ปรับคณะรัฐมนตรีเงียบ ๆ
- `society.crime.surge.c` เพิ่มโทษและตั้งด่านตรวจทั่วเมือง
- `society.harvest.bumper.a` รัฐรับซื้อผลผลิตส่วนเกินในราคาขั้นต่ำเข้าสต็อก
- `society.strike.general.c` ประกาศบริการจำเป็นและสั่งให้กลับเข้าทำงาน

## 3. Pre-judged choices (54)

Read `data/prejudged/*.json`; if a result looks wrong, edit `scripts/prejudge-manual/lead-2026-10-23.py`. When fine, set `reviewedBy` on the choice in `data/cards/`.

## 4. Design values shown to players

- Debt for 7 countries uses the design value 60% of GDP (WDI has no recent central-government debt). Decide: keep, or use IMF WEO (commercial use needs IMF permission).
- Parliament support 55%, foreign relations 50, group satisfaction 50 are design values (no real source yet).
- Homicide data for THA and VNM is from 2011 (shown with its year).

## 5. Dataset sources (data/sources/sources.yaml)

Open the indicator pages and confirm the license, then set `verifiedBy`. `check-sources.ts --production` passes only when every cited source is verified.
