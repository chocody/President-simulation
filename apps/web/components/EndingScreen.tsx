"use client";

import type { GameState } from "@ps/shared";
import type { EndResponse, GameInfo, Grade, PillarKey } from "../lib/api-types";
import { END_REASON_LABEL, GROUP_LABEL, PILLAR_LABEL } from "../lib/labels";
import { Bar, Frame, SectionTitle } from "./common";

const PILLARS: PillarKey[] = ["economy", "society", "politics", "other"];
const GRADE_COLOR: Record<Grade, string> = {
  A: "var(--color-good)", B: "var(--color-economy)", C: "var(--color-society)", D: "var(--color-politics)", F: "var(--color-bad)",
};

export function EndingScreen({
  state, info, ending, onRestart,
}: { state: GameState; info: GameInfo; ending: EndResponse; onRestart: () => void }) {
  const won = ending.endReason === "won_election";
  return (
    <Frame
      screen="ending"
      devFixtures={info.devFixtures}
      footer={
        <button type="button" className="btn w-full" onClick={onRestart} data-testid="restart">
          เริ่มเกมใหม่
        </button>
      }
    >
      <p className="label-caps">ตอนจบ · {info.country.nameTh}</p>
      <h1 className="mt-1 text-3xl font-extrabold leading-tight" data-testid="end-reason">
        {ending.endReason ? END_REASON_LABEL[ending.endReason] : "จบวาระ"}
      </h1>
      <p className={`stamp mt-3 ${won ? "" : "opacity-80"}`}>ไตรมาสที่ {state.quarter} จาก 16</p>

      <section className="dossier mt-5 border-2 border-ink p-5" aria-label="นักประวัติศาสตร์">
        <p className="label-caps">คำตัดสินของนักประวัติศาสตร์</p>
        <p className="mt-2 text-xl font-extrabold leading-snug" data-testid="historian-line">{ending.historian.line}</p>
        <p className="mt-1 text-sm text-muted">แบบฉบับ: {ending.historian.archetype}</p>
      </section>

      <SectionTitle>คะแนนเสียงเลือกตั้ง</SectionTitle>
      {ending.voteShare !== null ? (
        <div className="dossier p-4" data-testid="vote-share">
          <p className="text-5xl font-extrabold leading-none">{ending.voteShare.toFixed(1)}%</p>
          <p className="mb-3 mt-1 text-sm text-muted">ต้องได้เกิน 50% จึงชนะ · แยกตามกลุ่ม (สัดส่วน × ความพอใจ)</p>
          <ul className="space-y-2">
            {ending.groups.map((g) => (
              <li key={g.group}>
                <div className="flex items-baseline justify-between text-sm">
                  <span className="font-bold">{GROUP_LABEL[g.group]}</span>
                  <span>
                    <b>{g.contribution.toFixed(1)}</b> จุด
                    <span className="text-muted"> ({(g.share * 100).toFixed(0)}% × {g.satisfaction.toFixed(0)})</span>
                  </span>
                </div>
                <Bar value={g.contribution} max={Math.max(...ending.groups.map((x) => x.contribution), 1)} color="var(--color-ink)" />
              </li>
            ))}
            {ending.otherPart !== null && (
              <li className="flex justify-between border-t border-rule pt-2 text-sm">
                <span className="font-bold">ผลจากเศรษฐกิจ 4 ไตรมาสสุดท้ายและความไม่แน่นอน</span>
                <b className={ending.otherPart >= 0 ? "text-good" : "text-bad"}>
                  {ending.otherPart >= 0 ? "+" : "−"}{Math.abs(ending.otherPart).toFixed(1)}
                </b>
              </li>
            )}
          </ul>
        </div>
      ) : (
        <p className="dossier p-4 text-sm" data-testid="no-vote">
          วาระจบก่อนถึงการเลือกตั้ง จึงไม่มีผลคะแนนเสียง คะแนนนิยมช่วงสุดท้ายอยู่ที่ {ending.popularity.toFixed(0)}
        </p>
      )}

      <SectionTitle>เกรดแต่ละด้าน</SectionTitle>
      <ul className="grid grid-cols-2 gap-3" data-testid="grades">
        {PILLARS.map((p) => {
          const g = ending.grades[p];
          return (
            <li key={p} className="dossier p-3 text-center" data-testid={`grade-${p}`}>
              <p className="text-sm font-bold">{PILLAR_LABEL[p]}</p>
              <p className="text-5xl font-extrabold leading-tight" style={{ color: GRADE_COLOR[g.grade] }}>{g.grade}</p>
              <p className="text-xs text-muted">
                เปลี่ยน {g.change >= 0 ? "+" : "−"}{Math.abs(g.change).toFixed(1)} คะแนนจากตอนเริ่ม
              </p>
            </li>
          );
        })}
      </ul>

      <SectionTitle>คะแนนมรดก</SectionTitle>
      <div className="dossier p-4">
        <p className="text-5xl font-extrabold leading-none" data-testid="legacy">{ending.legacy.toFixed(0)}<span className="text-xl text-muted"> / 100</span></p>
        <div className="mt-2"><Bar value={ending.legacy} color="var(--color-seal)" /></div>
        <p className="mt-2 text-xs text-muted">คิดจากการเปลี่ยนแปลงของสี่ด้านตั้งแต่เริ่มวาระ (75%) และคะแนนนิยม (25%)</p>
      </div>
    </Frame>
  );
}
