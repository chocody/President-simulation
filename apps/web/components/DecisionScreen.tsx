"use client";

import { useState } from "react";
import type { Answer, GameState } from "@ps/shared";
import type { GameInfo, PublicCard } from "../lib/api-types";
import { CATEGORY_LABEL, COST_LABEL, GROUP_LABEL } from "../lib/labels";
import { canSubmit, FREE_TEXT_MAX, FREE_TEXT_MIN, type Selection } from "../lib/selection";
import { ErrorNote, Frame } from "./common";

export function DecisionScreen({
  state, info, card, busy, error, onSubmit,
}: {
  state: GameState; info: GameInfo; card: PublicCard; busy: boolean; error: string | null;
  onSubmit: (a: Answer) => void;
}) {
  const [sel, setSel] = useState<Selection>({ kind: "none" });
  const freeOpen = sel.kind === "free";
  const text = sel.kind === "free" ? sel.text : "";
  const trimmedLen = text.trim().length;
  const ok = canSubmit(sel);

  const submit = () => {
    if (!ok) return;
    if (sel.kind === "preset") onSubmit({ kind: "preset", choiceId: sel.choiceId });
    else if (sel.kind === "free") onSubmit({ kind: "free", text: sel.text.trim() });
  };

  return (
    <Frame
      screen="decision"
      devFixtures={info.devFixtures}
      footer={
        <>
          <ErrorNote message={error} />
          <button type="button" className="btn btn-primary w-full" disabled={!ok || busy} onClick={submit} data-testid="submit-answer">
            {busy ? "กำลังตัดสิน…" : "ยืนยันคำตอบ"}
          </button>
        </>
      }
    >
      <p className="label-caps">
        จุดตัดสินใจ · ไตรมาสที่ {state.quarter} · {CATEGORY_LABEL[card.category]}
        {card.severity === "major" ? " · เหตุการณ์ใหญ่" : ""}
      </p>
      <h1 className="mt-1 text-3xl font-extrabold leading-tight" data-testid="card-title">{card.titleTh}</h1>
      <p className="dossier mt-3 p-4 text-[0.95rem] leading-relaxed">{card.situationTh}</p>

      <h2 className="mb-2 mt-6 text-lg font-extrabold">คุณจะทำอย่างไร</h2>
      <div role="group" aria-label="ตัวเลือก" className="grid gap-3">
        {card.choices.map((c) => {
          const picked = sel.kind === "preset" && sel.choiceId === c.id;
          return (
            <button
              key={c.id}
              type="button"
              data-testid={`choice-${c.id}`}
              aria-pressed={picked}
              disabled={busy}
              onClick={() => setSel({ kind: "preset", choiceId: c.id })}
              className={`dossier min-h-[64px] w-full p-4 text-left ${picked ? "border-seal ring-2 ring-seal" : "hover:bg-white"}`}
            >
              <span className="flex items-start justify-between gap-3">
                <span className="text-base font-extrabold leading-snug">{c.titleTh}</span>
                <span
                  className="whitespace-nowrap rounded border border-ink px-1.5 py-0.5 text-xs font-bold"
                  title="ขนาดต้นทุนโดยประมาณ (ไม่แสดงเป็นตัวเลข)"
                >
                  ต้นทุน {COST_LABEL[c.costHint]}
                </span>
              </span>
              <span className="mt-1 block text-sm text-muted">{c.descTh}</span>
              <span className="mt-2 flex flex-wrap items-center gap-1.5 text-xs">
                <span className="text-muted">ผู้ได้รับผลกระทบ:</span>
                {c.affectedGroups.map((g) => (
                  <span key={g} className="rounded-full bg-rule/60 px-2 py-0.5 font-bold">{GROUP_LABEL[g]}</span>
                ))}
                {c.evidenceIds.length > 0 && (
                  <span className="ml-auto text-muted">หลักฐานอ้างอิง {c.evidenceIds.length} ชิ้น</span>
                )}
              </span>
            </button>
          );
        })}

        <div className={`dossier p-4 ${freeOpen ? "border-seal ring-2 ring-seal" : ""}`}>
          <button
            type="button"
            data-testid="choice-free"
            aria-expanded={freeOpen}
            aria-controls="free-text-panel"
            disabled={busy}
            onClick={() => setSel(freeOpen ? { kind: "none" } : { kind: "free", text: "" })}
            className="flex min-h-[48px] w-full items-center justify-between text-left"
          >
            <span>
              <span className="block text-base font-extrabold">พิมพ์คำตอบเอง</span>
              <span className="block text-sm text-muted">เสนอแนวทางของคุณเอง ยิ่งเจาะจงยิ่งมีโอกาสสำเร็จ</span>
            </span>
            <span aria-hidden className="text-xl">{freeOpen ? "−" : "+"}</span>
          </button>
          {freeOpen && (
            <div id="free-text-panel" className="mt-3">
              <label htmlFor="free-text" className="sr-only">คำตอบของคุณ</label>
              <textarea
                id="free-text"
                data-testid="free-text"
                rows={6}
                maxLength={FREE_TEXT_MAX + 200}
                value={text}
                disabled={busy}
                onChange={(e) => setSel({ kind: "free", text: e.target.value })}
                placeholder="เช่น จะทำอะไร ใช้เงินจากไหน ใครได้ประโยชน์ ใครเสียประโยชน์ ใช้เวลาเท่าไร"
                className="w-full rounded border border-ink bg-white p-3"
                aria-describedby="free-counter"
              />
              <p
                id="free-counter"
                data-testid="free-counter"
                className={`mt-1 text-sm ${trimmedLen > FREE_TEXT_MAX ? "font-bold text-bad" : trimmedLen < FREE_TEXT_MIN ? "text-muted" : "text-good"}`}
              >
                {trimmedLen} / {FREE_TEXT_MAX} ตัวอักษร (อย่างน้อย {FREE_TEXT_MIN})
              </p>
            </div>
          )}
        </div>
      </div>
    </Frame>
  );
}
