"use client";

import { useState } from "react";
import { GROUP_KEYS, PILLARS, STAT_RANGE, type GameState, type StatKey } from "@ps/shared";
import { goodness } from "@ps/engine";
import type { GameInfo } from "../lib/api-types";
import { formatDelta, formatStat } from "../lib/format";
import { GROUP_LABEL, PILLAR_LABEL, STAT_LABEL } from "../lib/labels";
import { Bar, SectionTitle } from "./common";
import { StatSourceDialog } from "./StatSourceDialog";

const PILLAR_COLOR = {
  economy: "var(--color-economy)",
  society: "var(--color-society)",
  politics: "var(--color-politics)",
  other: "var(--color-other)",
} as const;

/** The 15 stats in the engine's four pillars; the budget (spending room) sits with the economy. */
const SECTIONS: { key: keyof typeof PILLARS; stats: StatKey[] }[] = [
  { key: "economy", stats: [...PILLARS.economy, "budget"] },
  { key: "society", stats: PILLARS.society },
  { key: "politics", stats: PILLARS.politics },
  { key: "other", stats: PILLARS.other },
];

export function GroupBars({ state }: { state: GameState }) {
  return (
    <ul className="space-y-3" data-testid="group-bars">
      {GROUP_KEYS.map((g) => {
        const { satisfaction, share } = state.groups[g];
        return (
          <li key={g}>
            <div className="mb-1 flex items-baseline justify-between text-sm">
              <span className="font-bold">{GROUP_LABEL[g]}</span>
              <span className="text-muted">
                สัดส่วนผู้ลงคะแนน {(share * 100).toFixed(0)}% · พอใจ{" "}
                <b className="text-ink">{satisfaction.toFixed(0)}</b>
              </span>
            </div>
            <Bar value={satisfaction} color={satisfaction < 25 ? "var(--color-bad)" : "var(--color-ink)"} />
          </li>
        );
      })}
    </ul>
  );
}

export function StatGrid({ state, info }: { state: GameState; info: GameInfo }) {
  const [open, setOpen] = useState<StatKey | null>(null);
  return (
    <div data-testid="stat-grid">
      {SECTIONS.map(({ key, stats }) => (
        <section key={key} aria-labelledby={`pillar-${key}`}>
          <SectionTitle tone={PILLAR_COLOR[key]}>
            <span id={`pillar-${key}`}>{PILLAR_LABEL[key]}</span>
          </SectionTitle>
          <ul className="dossier divide-y divide-rule/70 overflow-hidden">
            {stats.map((k) => {
              const value = state.stats[k];
              const [lo, hi] = STAT_RANGE[k];
              const delta = k === "budget" ? null : value - state.baseline[k];
              const better = delta === null ? 0 : goodness(k, value) - goodness(k, state.baseline[k]);
              return (
                <li key={k}>
                  <button
                    type="button"
                    data-testid={`stat-${k}`}
                    className="flex min-h-[56px] w-full flex-col justify-center gap-1 px-3 py-2 text-left hover:bg-paper/60"
                    aria-haspopup="dialog"
                    aria-label={`${STAT_LABEL[k]} ${formatStat(k, value)} แตะเพื่อดูแหล่งที่มา`}
                    onClick={() => setOpen(k)}
                  >
                    <span className="flex items-baseline justify-between gap-2">
                      <span className="font-bold">{STAT_LABEL[k]}</span>
                      <span className="whitespace-nowrap">
                        <b>{formatStat(k, value)}</b>
                        {delta !== null && Math.abs(delta) >= 0.05 && (
                          <span className={`ml-2 text-xs font-bold ${better > 0 ? "text-good" : better < 0 ? "text-bad" : "text-muted"}`}>
                            {formatDelta(k, delta)}
                          </span>
                        )}
                      </span>
                    </span>
                    <Bar value={value - lo} max={hi - lo} color={PILLAR_COLOR[key]} />
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
      <p className="mt-2 text-xs text-muted">แตะที่ตัวเลขใดก็ได้เพื่อดูว่ามาจากไหน · ลูกศรเทียบกับค่าตอนเริ่มวาระ</p>
      {open && (
        <StatSourceDialog
          stat={open}
          value={state.stats[open]}
          country={info.country}
          sources={info.sources}
          onClose={() => setOpen(null)}
        />
      )}
    </div>
  );
}
