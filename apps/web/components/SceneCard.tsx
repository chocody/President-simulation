"use client";

import type { GameState, Scene, TurnReport } from "@ps/shared";
import { sceneBadge } from "../lib/scenes";

const TONE = {
  good: { border: "border-good", text: "text-good", icon: "✓", label: "ดีต่อประเทศ" },
  bad: { border: "border-bad", text: "text-bad", icon: "!", label: "ไม่ดีต่อประเทศ" },
  neutral: { border: "border-society", text: "text-society", icon: "–", label: "ผลคละกัน" },
} as const;

/** One consequence scene: tone colour and icon, the situation, and a badge saying what caused it. */
export function SceneCard({ scene, report, policies, quarter }: {
  scene: Scene; report?: Pick<TurnReport, "measures">; policies?: GameState["policies"]; quarter?: number;
}) {
  const tone = TONE[scene.tone];
  const badge = sceneBadge(scene, { measures: report?.measures, policies });
  return (
    <li
      className={`${quarter === undefined ? "dossier " : "border-b border-rule/70 last:border-b-0 "}flex gap-3 border-l-4 p-3 ${tone.border}`}
      data-testid="scene-card"
      data-tone={scene.tone}
      data-kind={scene.kind}
    >
      <span
        aria-label={tone.label}
        role="img"
        className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 text-base font-extrabold ${tone.border} ${tone.text}`}
      >
        {tone.icon}
      </span>
      <div className="min-w-0">
        {quarter !== undefined && <p className="text-xs text-muted">ไตรมาสที่ {quarter}</p>}
        <p className="font-semibold leading-snug">{scene.textTh}</p>
        {badge && (
          <p className="mt-1.5">
            <span
              data-testid="scene-badge"
              className="inline-block max-w-full break-words rounded-full border border-rule bg-white px-2 py-0.5 text-xs font-bold text-muted"
            >
              {badge.label}
            </span>
          </p>
        )}
      </div>
    </li>
  );
}
