"use client";

import type { GameState, SceneRecord } from "@ps/shared";
import type { GameInfo, PublicNewsItem } from "../lib/api-types";
import { newsFromState } from "../lib/news";
import { followupScenes } from "../lib/scenes";
import { ErrorNote, Frame, SectionTitle, Timeline } from "./common";
import { NewsTicker } from "./NewsTicker";
import { GroupBars, StatGrid } from "./StatGrid";
import { TraitPanel } from "./TraitPanel";

/** Splits the news into the last advance (`latest`, falling back to the newest quarter) and everything before it. */
function splitNews(state: GameState, info: GameInfo, news: PublicNewsItem[] | undefined): { latest: PublicNewsItem[]; older: PublicNewsItem[] } {
  const all = newsFromState(state, info);
  const key = (n: PublicNewsItem) => `${n.quarter}:${n.id}`;
  const newest = all.reduce((m, n) => Math.max(m, n.quarter), 0);
  const latest = news ?? all.filter((n) => n.quarter === newest);
  const latestKeys = new Set(latest.map(key));
  return { latest: [...latest].reverse(), older: all.filter((n) => !latestKeys.has(key(n))).reverse() };
}

/** Follow-up and court scenes split like the news: the last advance (`latest`, else the newest quarter) and the rest. */
function splitScenes(state: GameState, scenes: SceneRecord[] | undefined): { latest: SceneRecord[]; older: SceneRecord[] } {
  const all = followupScenes(state);
  const key = (s: SceneRecord) => `${s.quarter}:${s.templateId}:${s.cause}`;
  const newest = all.reduce((m, s) => Math.max(m, s.quarter), 0);
  const latest = scenes ?? all.filter((s) => s.quarter === newest);
  const latestKeys = new Set(latest.map(key));
  return { latest: [...latest].reverse(), older: all.filter((s) => !latestKeys.has(key(s))) };
}

export function MainScreen({
  state, info, log, news, scenes, busy, error, onAdvance,
}: {
  state: GameState; info: GameInfo; log: string[]; news?: PublicNewsItem[]; scenes?: SceneRecord[];
  busy: boolean; error: string | null; onAdvance: () => void;
}) {
  const { latest, older } = splitNews(state, info, news);
  const sceneSplit = splitScenes(state, scenes);
  return (
    <Frame
      screen="main"
      devFixtures={info.devFixtures}
      footer={
        <>
          <ErrorNote message={error} />
          <button type="button" className="btn btn-primary w-full" disabled={busy} onClick={onAdvance} data-testid="advance">
            {busy ? "กำลังเดินเวลา…" : "เดินเวลาต่อ"}
          </button>
        </>
      }
    >
      <p className="label-caps">{info.country.nameEn}</p>
      <h1 className="text-2xl font-extrabold">{info.country.nameTh}</h1>
      <p className="mb-3 text-muted" data-testid="quarter">ไตรมาสที่ {state.quarter} จาก 16</p>
      <Timeline quarter={state.quarter} />
      <p className="mt-1 text-xs text-muted">จุดคือไตรมาสที่อาจมีเหตุการณ์ให้ตัดสินใจ · ไตรมาส 16 คือการเลือกตั้ง</p>

      <section className="dossier mt-5 flex items-end justify-between p-4" aria-label="คะแนนนิยม">
        <div>
          <p className="label-caps">คะแนนนิยมรวม</p>
          <p className="text-5xl font-extrabold leading-none" data-testid="popularity">{state.popularity.toFixed(0)}</p>
        </div>
        <p className="max-w-[10rem] text-right text-xs text-muted">
          ถ่วงตามสัดส่วนของแต่ละกลุ่มผู้ลงคะแนน เป็นฐานของคะแนนเสียงในวันเลือกตั้ง
        </p>
      </section>

      <SectionTitle>กลุ่มผู้ลงคะแนน</SectionTitle>
      <div className="dossier p-4"><GroupBars state={state} /></div>

      <NewsTicker state={state} info={info} latest={latest} older={older} latestScenes={sceneSplit.latest} olderScenes={sceneSplit.older} />

      <StatGrid state={state} info={info} />

      <TraitPanel info={info} />

      {log.length > 0 && (
        <details className="mt-6 text-sm">
          <summary className="cursor-pointer font-bold">บันทึกของระบบช่วงที่ผ่านมา ({log.length})</summary>
          <ul className="mt-2 space-y-1 font-mono text-xs text-muted">
            {log.map((l, i) => <li key={i}>{l}</li>)}
          </ul>
        </details>
      )}
    </Frame>
  );
}
