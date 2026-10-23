# Balance check with the real deck (2026-10-23)

Real countries + real cards with the Lead's manual pre-judged choices.
`pnpm tsx scripts/simulate.ts --games 1000 --real-countries --real-deck`

## Round 1: 12 cards (11 crises)

Too hard: best-choice bot ~33%, random ~20%. Parameter sweeps moved best only to 34–38%.

## Round 2: 18 cards (+6 good-news cards with onArrival windfalls)

```
President Sim engine simulation: real countries, real deck (pre-judged), difficulty normal.
=== always-a (1000 games) ===
win rate: 39.8%
endings: lost_election 60.2%, won_election 39.8%
mean popularity at the end: 48.9
=== always-b (1000 games) ===
win rate: 48.0%
endings: lost_election 52.0%, won_election 48.0%
mean popularity at the end: 49.6
=== always-c (1000 games) ===
win rate: 22.0%
endings: lost_election 78.0%, won_election 22.0%
mean popularity at the end: 46.4
=== random (1000 games) ===
win rate: 35.3%
endings: lost_election 64.7%, won_election 35.3%
mean popularity at the end: 48.2
=== best (1000 games) ===
win rate: 56.6%
endings: won_election 56.6%, lost_election 43.4%
mean popularity at the end: 50.8
```

On target: a thoughtful player (best-choice bot) wins ~57% (target 50–65%); random play ~35% (target 35–55%).
No design parameter was changed for round 2; the fix was content (good news), not numbers.
Re-run after the API pre-judge replaces the manual one.
