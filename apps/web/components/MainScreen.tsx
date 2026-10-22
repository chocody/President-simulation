"use client";

import type { GameState } from "@ps/shared";
import type { GameInfo } from "../lib/api-types";
import { ErrorNote, Frame, SectionTitle, Timeline } from "./common";
import { GroupBars, StatGrid } from "./StatGrid";

export function MainScreen({
  state, info, log, busy, error, onAdvance,
}: { state: GameState; info: GameInfo; log: string[]; busy: boolean; error: string | null; onAdvance: () => void }) {
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

      <StatGrid state={state} info={info} />

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
