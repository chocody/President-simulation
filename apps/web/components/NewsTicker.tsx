"use client";

import type { GameState } from "@ps/shared";
import type { GameInfo, PublicNewsItem } from "../lib/api-types";
import { NEWS_CATEGORY_LABEL } from "../lib/labels";
import { newsChip } from "../lib/news";
import { SectionTitle } from "./common";

const TONE = {
  good: "border-good text-good",
  bad: "border-bad text-bad",
  flat: "border-rule text-muted",
} as const;

function NewsRow({ item, state }: { item: PublicNewsItem; state: GameState }) {
  return (
    <li className="px-3 py-2" data-testid="news-item">
      <p className="text-xs text-muted">ไตรมาสที่ {item.quarter} · {NEWS_CATEGORY_LABEL[item.category]}</p>
      <p className="font-semibold leading-snug">{item.textTh}</p>
      <ul className="mt-1 flex flex-wrap gap-1.5" aria-label="ผลของข่าวนี้">
        {item.effects.map((e, i) => {
          const chip = newsChip(e.target, e.delta, state.stats);
          return (
            <li
              key={i}
              data-testid="news-chip"
              data-tone={chip.tone}
              className={`rounded-full border bg-white px-2 py-0.5 text-xs font-bold ${TONE[chip.tone]}`}
            >
              {chip.text}
            </li>
          );
        })}
      </ul>
    </li>
  );
}

/** The news ticker: what happened while time moved on, then older items folded away. */
export function NewsTicker({
  state, info, latest, older,
}: { state: GameState; info: GameInfo; latest: PublicNewsItem[]; older: PublicNewsItem[] }) {
  if ((info.minorEvents ?? []).length === 0 && latest.length === 0 && older.length === 0) return null;
  return (
    <section data-testid="news-ticker" aria-labelledby="news-title">
      <SectionTitle><span id="news-title">ข่าวสั้นช่วงที่ผ่านมา</span></SectionTitle>
      {latest.length > 0 ? (
        <ul className="dossier divide-y divide-rule/70 overflow-hidden" data-testid="news-latest">
          {latest.map((n, i) => <NewsRow key={`${n.id}-${n.quarter}-${i}`} item={n} state={state} />)}
        </ul>
      ) : (
        <p className="dossier p-4 text-sm text-muted" data-testid="news-empty">ยังไม่มีข่าวใหม่ เดินเวลาต่อเพื่อติดตามเหตุการณ์เล็ก ๆ ในประเทศ</p>
      )}
      {older.length > 0 && (
        <details className="mt-2 text-sm" data-testid="news-older">
          <summary className="cursor-pointer font-bold">ข่าวก่อนหน้า ({older.length})</summary>
          <ul className="dossier mt-2 divide-y divide-rule/70 overflow-hidden">
            {older.map((n, i) => <NewsRow key={`${n.id}-${n.quarter}-${i}`} item={n} state={state} />)}
          </ul>
        </details>
      )}
      <p className="mt-2 text-xs text-muted">
        ชิป + / − คือการเปลี่ยนของตัวชี้วัด สีเขียวดีต่อประเทศ สีแดงไม่ดี · ข่าวเหล่านี้เป็นเหตุการณ์เล็กที่เกิดขึ้นทุกไตรมาส ไม่ต้องตัดสินใจ
      </p>
    </section>
  );
}
