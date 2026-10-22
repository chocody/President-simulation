"use client";

import type { ReactNode } from "react";
import { PACING } from "@ps/shared";
import { FIXTURE_BANNER_TH, FIXTURE_LABEL } from "../dev/fixture-country";

export function DevBanner() {
  return (
    <div
      role="note"
      data-testid="dev-banner"
      className="border-b-2 border-seal bg-warn px-4 py-2 text-center text-sm font-bold text-seal-dark"
    >
      {FIXTURE_BANNER_TH}
      <span className="label-caps ml-2 normal-case">{FIXTURE_LABEL}</span>
    </div>
  );
}

/** Page frame: optional dev banner on top, 360px-first column, optional sticky action bar. */
export function Frame({
  screen, devFixtures, children, footer,
}: { screen: string; devFixtures: boolean; children: ReactNode; footer?: ReactNode }) {
  return (
    <div data-screen={screen} className="mx-auto flex min-h-dvh w-full max-w-md flex-col">
      {devFixtures && <DevBanner />}
      <main className="flex-1 px-4 pb-28 pt-5">{children}</main>
      {footer && (
        <div className="sticky bottom-0 z-10 border-t border-rule bg-paper/95 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur">
          {footer}
        </div>
      )}
    </div>
  );
}

export function ErrorNote({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p role="alert" data-testid="error" className="mb-3 rounded border border-bad bg-white px-3 py-2 text-sm text-bad">
      {message}
    </p>
  );
}

export function SectionTitle({ children, tone }: { children: ReactNode; tone?: string }) {
  return (
    <h2 className="mb-2 mt-6 flex items-center gap-2 text-lg font-extrabold">
      {tone && <span aria-hidden className="inline-block h-4 w-1.5 rounded-sm" style={{ background: tone }} />}
      {children}
    </h2>
  );
}

/** 16 quarters; decision quarters get a dot, the last is the election. */
export function Timeline({ quarter }: { quarter: number }) {
  const decisions: number[] = PACING.value.decisionQuarters;
  return (
    <ol
      aria-label={`ไตรมาสที่ ${quarter} จาก ${PACING.value.quarters}`}
      className="grid grid-cols-8 gap-1"
      data-testid="timeline"
    >
      {Array.from({ length: PACING.value.quarters }, (_, i) => i + 1).map((q) => {
        const isNow = q === quarter;
        const past = q < quarter;
        const election = q === PACING.value.quarters;
        return (
          <li
            key={q}
            aria-current={isNow ? "step" : undefined}
            className={[
              "relative flex h-9 flex-col items-center justify-center rounded border text-xs font-bold",
              isNow ? "border-seal bg-seal text-white" : past ? "border-rule bg-ink/90 text-white" : "border-rule bg-card text-muted",
            ].join(" ")}
          >
            {q}
            {(decisions.includes(q) || election) && (
              <span
                aria-hidden
                className={`absolute bottom-0.5 h-1 w-1 rounded-full ${isNow || past ? "bg-white" : election ? "bg-seal" : "bg-ink"}`}
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}

export function Bar({ value, max = 100, color }: { value: number; max?: number; color: string }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-rule/60" aria-hidden>
      <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
    </div>
  );
}
