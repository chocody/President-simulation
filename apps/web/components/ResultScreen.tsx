"use client";

import type { GroupKey, MeasureReport, StatKey } from "@ps/shared";
import { goodness } from "@ps/engine";
import type { DecideResult, GameInfo } from "../lib/api-types";
import { formatDelta } from "../lib/format";
import { frictionLines } from "../lib/friction";
import { GROUP_LABEL, OUTCOME_LABEL, STAT_LABEL } from "../lib/labels";
import { Frame, SectionTitle } from "./common";
import { SceneCard } from "./SceneCard";

const OUTCOME_TONE: Record<MeasureReport["outcome"], string> = {
  blocked: "text-bad",
  critical_failure: "text-bad",
  failure: "text-bad",
  partial: "text-society",
  success: "text-good",
  great_success: "text-good",
};

function Measure({ m }: { m: MeasureReport }) {
  const par = m.parliament;
  return (
    <li className="dossier p-4" data-testid="measure">
      <h3 className="font-extrabold leading-snug">{m.title}</h3>
      <p className={`mt-1 text-lg font-extrabold ${OUTCOME_TONE[m.outcome]}`} data-testid="outcome">
        {OUTCOME_LABEL[m.outcome]}
      </p>
      <dl className="mt-2 space-y-1 text-sm">
        <div className="flex justify-between gap-3">
          <dt className="text-muted">การลงมติในสภา</dt>
          <dd className="text-right font-semibold">
            {par.required
              ? `ได้ ${par.vote?.toFixed(1) ?? "-"} คะแนน (ต้องเกิน 50) · ${par.passed ? "ผ่าน" : "ไม่ผ่าน"}`
              : "ไม่ต้องผ่านสภา"}
          </dd>
        </div>
        {m.roll !== null ? (
          <div className="flex justify-between gap-3">
            <dt className="text-muted">ทอยลูกเต๋า</dt>
            <dd className="text-right font-semibold">
              ทอยได้ {m.roll} · โอกาสสำเร็จ {m.probability.toFixed(0)}% ({m.roll <= m.probability ? "ทอยได้ไม่เกิน P" : "ทอยได้เกิน P"})
            </dd>
          </div>
        ) : (
          <div className="flex justify-between gap-3">
            <dt className="text-muted">ทอยลูกเต๋า</dt>
            <dd className="text-right font-semibold">ไม่ได้ทอย (ถูกสภาตีตกก่อน)</dd>
          </div>
        )}
        <div className="flex justify-between gap-3">
          <dt className="text-muted">ผลที่ได้ (ตัวคูณ)</dt>
          <dd className="font-semibold">×{m.multiplier}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-muted">ต้นทุน</dt>
          <dd className="font-semibold">{m.costPctGdp.toFixed(2)}% ของ GDP</dd>
        </div>
        {m.courtRisk > 0 && (
          <div className="flex justify-between gap-3">
            <dt className="text-muted">ความเสี่ยงศาลระงับ</dt>
            <dd className="font-semibold">{(m.courtRisk * 100).toFixed(0)}%</dd>
          </div>
        )}
        {m.protest.happened && m.protest.group && (
          <div className="flex justify-between gap-3">
            <dt className="text-muted">การประท้วง</dt>
            <dd className="font-semibold text-bad">{GROUP_LABEL[m.protest.group]}ออกมาประท้วง</dd>
          </div>
        )}
      </dl>
    </li>
  );
}

function ChangeRow({ label, delta, good, kind }: { label: string; delta: number; good: boolean; kind: StatKey | "group" }) {
  return (
    <li className="flex items-baseline justify-between gap-3 border-b border-rule/70 py-1.5 last:border-0">
      <span>{label}</span>
      <b className={good ? "text-good" : "text-bad"}>{formatDelta(kind, delta)}</b>
    </li>
  );
}

export function ResultScreen({
  info, result, onContinue,
}: { info: GameInfo; result: DecideResult; onContinue: () => void }) {
  const { report } = result;
  const entries = Object.entries(report.immediate).filter(([, v]) => Math.abs(v) >= 0.005);
  const statChanges = entries
    .filter(([k]) => !k.startsWith("group:"))
    .map(([k, v]) => {
      const key = k as StatKey;
      const after = result.state.stats[key];
      const good = goodness(key, after) - goodness(key, after - v) >= 0;
      return { key, v, good };
    });
  const groupChanges = entries
    .filter(([k]) => k.startsWith("group:"))
    .map(([k, v]) => ({ group: k.slice(6) as GroupKey, v }));
  const downgraded = report.measures.reduce((a, m) => a + m.downgradedForEvidence, 0);
  const friction = frictionLines(report);
  const scenes = (result.scenes ?? []).filter((s) => s.kind !== "upcoming");
  const upcoming = (result.scenes ?? []).filter((s) => s.kind === "upcoming");

  return (
    <Frame
      screen="result"
      devFixtures={info.devFixtures}
      footer={
        <button type="button" className="btn btn-primary w-full" onClick={onContinue} data-testid="continue">
          กลับไปหน้าหลัก
        </button>
      }
    >
      <p className="label-caps">ผลลัพธ์ · ไตรมาสที่ {report.quarter}</p>
      <h1 className="mt-1 text-2xl font-extrabold leading-snug">คำตอบของคุณ: {result.answerTitle}</h1>

      <section data-testid="scenes" aria-labelledby="scenes-title">
        <SectionTitle><span id="scenes-title">เกิดอะไรขึ้น</span></SectionTitle>
        {scenes.length > 0 ? (
          <ul className="space-y-2">
            {scenes.map((s, i) => <SceneCard key={`${s.templateId}-${i}`} scene={s} report={report} />)}
          </ul>
        ) : (
          <p className="dossier p-4 text-sm text-muted" data-testid="scenes-empty">ไตรมาสนี้ไม่มีเหตุการณ์เด่นที่จับตาได้ ดูตัวเลขละเอียดด้านล่าง</p>
        )}
      </section>

      {upcoming.length > 0 && (
        <section data-testid="upcoming" aria-labelledby="upcoming-title">
          <SectionTitle><span id="upcoming-title">สิ่งที่จะตามมา</span></SectionTitle>
          <p className="mb-2 text-sm text-muted">ผลของการตัดสินใจนี้ที่จะเริ่มเห็นในไตรมาสต่อ ๆ ไป ถ้าไม่มีอะไรเปลี่ยน (เช่น ศาลสั่งระงับ)</p>
          <ul className="space-y-2">
            {upcoming.map((s, i) => <SceneCard key={`${s.templateId}-up-${i}`} scene={s} report={report} />)}
          </ul>
        </section>
      )}

      <section className="dossier mt-4 p-4" aria-label="เรื่องเล่า">
        {result.narration.split("\n").map((p, i) => (
          <p key={i} className={i > 0 ? "mt-2" : ""} data-testid={i === 0 ? "narration" : undefined}>{p}</p>
        ))}
        {result.headlines.length > 0 && (
          <ul className="mt-3 space-y-1 border-t border-rule pt-2 text-sm font-bold">
            {result.headlines.map((h, i) => <li key={i}>“{h}”</li>)}
          </ul>
        )}
      </section>

      {result.interpretation && (
        <p className="mt-2 text-xs text-muted">ผู้ตัดสินตีความคำตอบว่า: {result.interpretation}</p>
      )}

      {downgraded > 0 && (
        <p role="note" data-testid="downgrade-note" className="mt-3 rounded border border-society bg-warn px-3 py-2 text-sm">
          ผลบางอย่างถูกลดเหลือระดับ 1 ({downgraded} รายการ) เพราะไม่มีหลักฐานรองรับพอ
          — ผลระดับ 2–3 ต้องอ้างหลักฐานที่ตรงกับตัวชี้วัดและทิศทางเดียวกัน
        </p>
      )}

      {friction.map((f) => (
        <p
          key={f.measure}
          role="note"
          data-testid="friction-note"
          className={`mt-3 rounded border bg-warn px-3 py-2 text-sm ${f.harder ? "border-bad" : "border-good"}`}
        >
          {f.text}
        </p>
      ))}

      <details className="dossier mt-6" data-testid="numbers-details">
        <summary className="cursor-pointer px-4 py-3 text-lg font-extrabold" data-testid="numbers-toggle">ดูตัวเลขละเอียด</summary>
        <div className="px-4 pb-4">
      <SectionTitle>มาตรการ</SectionTitle>
      {report.measures.length > 0 ? (
        <ul className="space-y-3">{report.measures.map((m, i) => <Measure key={i} m={m} />)}</ul>
      ) : (
        <p className="dossier p-4 text-sm text-muted">คำตอบนี้ไม่ได้นำไปสู่มาตรการที่ดำเนินการได้</p>
      )}
      <p className="mt-2 text-xs text-muted">
        เหตุการณ์ยังส่งผลต่อประเทศราว {(report.eventShareApplied * 100).toFixed(0)}% ของที่คาดไว้ ·
        ผลของมาตรการที่เหลือจะทยอยออกในไตรมาสถัดไป ({report.scheduledCount} รายการ)
      </p>

      <SectionTitle>ตัวชี้วัดที่เปลี่ยนทันที</SectionTitle>
      {statChanges.length > 0 ? (
        <ul className="dossier px-4 py-2" data-testid="stat-changes">
          {statChanges.map((c) => (
            <ChangeRow key={c.key} label={STAT_LABEL[c.key]} delta={c.v} good={c.good} kind={c.key} />
          ))}
        </ul>
      ) : <p className="text-sm text-muted">ยังไม่มีตัวชี้วัดเปลี่ยนทันที</p>}

      <SectionTitle>ความพอใจของกลุ่ม</SectionTitle>
      {groupChanges.length > 0 ? (
        <ul className="dossier px-4 py-2" data-testid="group-changes">
          {groupChanges.map((c) => (
            <ChangeRow key={c.group} label={GROUP_LABEL[c.group]} delta={c.v} good={c.v >= 0} kind="group" />
          ))}
        </ul>
      ) : <p className="text-sm text-muted">ไม่มีกลุ่มใดเปลี่ยนทันที</p>}
        </div>
      </details>
    </Frame>
  );
}
