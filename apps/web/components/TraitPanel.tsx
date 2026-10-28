"use client";

import { useState } from "react";
import { TRAIT_KEYS, type TraitKey } from "@ps/shared";
import type { GameInfo } from "../lib/api-types";
import { TRAIT_LABEL } from "../lib/labels";
import { describeTraitSource } from "../lib/trait-source";
import { Bar, SectionTitle } from "./common";
import { DatasetRows, FixtureBlock, SourceShell } from "./StatSourceDialog";

/** True when the country file carries any trait (older files have none, and then the panel is not shown). */
export function hasTraits(info: GameInfo): boolean {
  return Object.keys(info.country.traits ?? {}).length > 0;
}

function TraitSourceDialog({ trait, info, onClose }: { trait: TraitKey; info: GameInfo; onClose: () => void }) {
  const d = describeTraitSource(trait, info.country, info.sources);
  const value = info.country.traits?.[trait];
  return (
    <SourceShell
      title={TRAIT_LABEL[trait]}
      subtitle={value === undefined ? "ไม่มีข้อมูล" : `ค่าในเกม ${value.toFixed(0)} จาก 100`}
      onClose={onClose}
    >
      {d.kind === "dataset" && (
        <div className="space-y-3">
          <p className="text-sm font-bold" data-testid="trait-sentence">{d.sentence}</p>
          {d.proxy && (
            <p data-testid="trait-proxy" className="rounded border border-society bg-warn px-3 py-2 text-sm">
              <b>ค่าประมาณ (proxy):</b> {d.proxyNote}
            </p>
          )}
          <DatasetRows {...d} />
        </div>
      )}
      {d.kind === "fixture" && (
        <div className="space-y-3">
          {trait === "patronage" && (
            <p data-testid="trait-proxy" className="rounded border border-society bg-warn px-3 py-2 text-sm">
              <b>ค่าประมาณ (proxy):</b> ในข้อมูลจริง ค่านี้ประมาณจากดัชนีหลักนิติธรรม WGI ไม่ได้วัดระบบอุปถัมภ์โดยตรง
            </p>
          )}
          <FixtureBlock />
        </div>
      )}
      {d.kind === "missing" && <p data-testid="trait-missing" className="text-sm">{d.reason}</p>}
    </SourceShell>
  );
}

/** "ลักษณะประเทศ": each trait as a labelled bar; tap for the source, in the same dialog as the stats. */
export function TraitPanel({ info }: { info: GameInfo }) {
  const [open, setOpen] = useState<TraitKey | null>(null);
  if (!hasTraits(info)) return null;
  return (
    <section data-testid="trait-panel" aria-labelledby="traits-title">
      <SectionTitle><span id="traits-title">ลักษณะประเทศ</span></SectionTitle>
      <p className="mb-2 text-sm text-muted">
        ลักษณะเหล่านี้ทำให้เหตุการณ์บางแบบเกิดบ่อยขึ้นในประเทศนี้ และทำให้การปฏิรูปยากหรือง่ายขึ้น (ค่า 0–100 จากตัวชี้วัดจริง)
      </p>
      <ul className="dossier divide-y divide-rule/70 overflow-hidden">
        {TRAIT_KEYS.map((k) => {
          const v = info.country.traits?.[k];
          return (
            <li key={k}>
              <button
                type="button"
                data-testid={`trait-${k}`}
                className="flex min-h-[56px] w-full flex-col justify-center gap-1 px-3 py-2 text-left hover:bg-paper/60"
                aria-haspopup="dialog"
                aria-label={`${TRAIT_LABEL[k]} ${v === undefined ? "ไม่มีข้อมูล" : v.toFixed(0)} แตะเพื่อดูแหล่งที่มา`}
                onClick={() => setOpen(k)}
              >
                <span className="flex items-baseline justify-between gap-2">
                  <span className="font-bold">{TRAIT_LABEL[k]}</span>
                  <span className="whitespace-nowrap">
                    {v === undefined ? <span className="text-xs text-muted">ไม่มีข้อมูล</span> : <b>{v.toFixed(0)}</b>}
                  </span>
                </span>
                <Bar value={v ?? 0} color={v === undefined ? "var(--color-rule)" : "var(--color-politics)"} />
              </button>
            </li>
          );
        })}
      </ul>
      <p className="mt-2 text-xs text-muted">แตะที่ลักษณะใดก็ได้เพื่อดูแหล่งที่มา · ระบบอุปถัมภ์เป็นค่าประมาณจากหลักนิติธรรม ไม่ได้วัดโดยตรง</p>
      {open && <TraitSourceDialog trait={open} info={info} onClose={() => setOpen(null)} />}
    </section>
  );
}
