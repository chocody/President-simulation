"use client";

import { useState } from "react";
import type { Difficulty, GameState } from "@ps/shared";
import type { GameInfo, InfoResponse } from "../lib/api-types";
import { DIFFICULTY_LABEL } from "../lib/labels";
import { ErrorNote, Frame } from "./common";
import { StatGrid } from "./StatGrid";
import { TraitPanel } from "./TraitPanel";

const LEVELS: Difficulty[] = ["easy", "normal", "hard"];

export function StartScreen({
  meta, busy, error, onStart,
}: { meta: InfoResponse | null; busy: boolean; error: string | null; onStart: (d: Difficulty) => void }) {
  const [difficulty, setDifficulty] = useState<Difficulty>("normal");
  const noCountry = meta !== null && meta.countries.length === 0;

  return (
    <Frame
      screen="start"
      devFixtures={meta?.devFixtures ?? false}
      footer={
        <button
          type="button"
          className="btn btn-primary w-full"
          disabled={busy || meta === null || noCountry}
          onClick={() => onStart(difficulty)}
          data-testid="start-button"
        >
          {busy ? "กำลังเตรียมเกม…" : "เริ่มเกม"}
        </button>
      }
    >
      <p className="label-caps">President Sim · เกมการศึกษา</p>
      <h1 className="mt-1 text-4xl font-extrabold leading-tight">เกมนั่งเก้าอี้ผู้นำ</h1>
      <p className="mt-3 text-muted">
        คุณจะนำประเทศหนึ่งประเทศเป็นเวลา 16 ไตรมาส ตัดสินใจรับมือเหตุการณ์ 6 ครั้ง
        โดยดูหลักฐานว่านโยบายแบบไหนเคยได้ผล แล้วรอผลการเลือกตั้งในไตรมาสสุดท้าย
      </p>

      {noCountry && (
        <p role="status" data-testid="no-country" className="dossier mt-5 border-seal px-4 py-3 font-bold text-seal-dark">
          ยังไม่มีข้อมูลประเทศจริง
          <span className="mt-1 block text-sm font-normal text-muted">
            เกมจะเริ่มได้เมื่อมีข้อมูลประเทศที่มีแหล่งที่มาครบถ้วนในโฟลเดอร์ data/countries
          </span>
        </p>
      )}

      <fieldset className="mt-6" disabled={busy}>
        <legend className="mb-2 text-lg font-extrabold">ระดับความยาก</legend>
        <div className="grid gap-2">
          {LEVELS.map((d) => (
            <label
              key={d}
              className={`dossier flex min-h-[56px] cursor-pointer items-center gap-3 px-3 py-2 ${difficulty === d ? "border-seal ring-2 ring-seal" : ""}`}
            >
              <input
                type="radio"
                name="difficulty"
                value={d}
                checked={difficulty === d}
                onChange={() => setDifficulty(d)}
                className="h-5 w-5 accent-[var(--color-seal)]"
              />
              <span>
                <span className="block font-bold">{DIFFICULTY_LABEL[d].name}</span>
                <span className="block text-sm text-muted">{DIFFICULTY_LABEL[d].hint}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="mt-4"><ErrorNote message={error} /></div>
    </Frame>
  );
}

/** "ใบรับตำแหน่ง": the appointment card shown right after the game is created. */
export function CharterScreen({
  state, info, busy = false, error = null, onAccept, onReroll,
}: { state: GameState; info: GameInfo; busy?: boolean; error?: string | null; onAccept: () => void; onReroll?: () => void }) {
  const c = info.country;
  return (
    <Frame
      screen="charter"
      devFixtures={info.devFixtures}
      footer={
        <>
          <ErrorNote message={error} />
          <div className="flex gap-2">
            {onReroll && (
              <button type="button" className="btn flex-1 whitespace-nowrap" onClick={onReroll} aria-label="สุ่มประเทศใหม่" disabled={busy} data-testid="reroll-country">
                {busy ? "กำลังสุ่ม…" : "🎲 สุ่มใหม่"}
              </button>
            )}
            <button type="button" className="btn btn-primary flex-[2]" onClick={onAccept} disabled={busy} data-testid="accept-charter">
              รับตำแหน่ง
            </button>
          </div>
        </>
      }
    >
      <section className="dossier border-2 border-ink p-5" aria-labelledby="charter-title" data-testid="charter">
        <p className="label-caps">ใบรับตำแหน่ง</p>
        <h1 id="charter-title" className="mt-1 text-3xl font-extrabold leading-tight">{c.nameTh}</h1>
        <p className="text-muted">{c.nameEn} · {c.region}</p>
        <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
          <span className="stamp">ผู้นำคนใหม่</span>
          <span>ประชากร {(c.population / 1_000_000).toFixed(1)} ล้านคน</span>
          <span>ระดับ{state.difficulty === "easy" ? "ง่าย" : state.difficulty === "hard" ? "ยาก" : "ปกติ"}</span>
        </div>
        <p className="mt-3 text-sm">
          ตัวเลขด้านล่างคือสถานะประเทศวันที่คุณรับตำแหน่ง · ไตรมาสที่ {state.quarter} จาก 16
        </p>
      </section>
      <StatGrid state={state} info={info} />
      <TraitPanel info={info} />
    </Frame>
  );
}
