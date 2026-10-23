# Balance check with the real deck (2026-10-23)

Real countries + real cards with the Lead's manual pre-judged choices. Command:
`pnpm tsx scripts/simulate.ts --games 1000 --real-countries --real-deck`

```
President Sim engine simulation: real countries, real deck (pre-judged), difficulty normal.
=== always-a (1000 games) ===
win rate: 32.7%
endings: lost_election 67.3%, won_election 32.7%
mean popularity at the end: 48.3
=== always-b (1000 games) ===
win rate: 23.4%
endings: lost_election 76.6%, won_election 23.4%
mean popularity at the end: 47.1
=== always-c (1000 games) ===
win rate: 8.0%
endings: lost_election 92.0%, won_election 8.0%
mean popularity at the end: 43.0
=== random (1000 games) ===
win rate: 19.7%
endings: lost_election 80.3%, won_election 19.7%
mean popularity at the end: 46.2
=== best (1000 games) ===
win rate: 32.9%
endings: lost_election 67.1%, won_election 32.9%
mean popularity at the end: 48.7
```

Finding: too hard. Even the best-choice bot wins about 33% (target for a thoughtful player: 50–65%). Mean vote 48.5%.
11 of 12 cards are crises, so every term is a run of bad news. Parameter sweeps (feasibility +5, stronger mitigation, targetScale 2) moved the best bot only to 34–38%.
Next: add good-news/opportunity cards (the plan's 'opportunity' category) before tuning numbers.
