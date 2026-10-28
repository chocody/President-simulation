"use client";

import { useEffect, useRef } from "react";
import type { CountryData, Source, StatKey } from "@ps/shared";
import { FIXTURE_BANNER_TH, FIXTURE_LABEL } from "../dev/fixture-country";
import { formatStat } from "../lib/format";
import { STAT_LABEL } from "../lib/labels";
import { describeStatSource } from "../lib/stat-source";

/** The shared modal shell of every "where does this number come from" dialog (stats and country traits). */
export function SourceShell({
  title, subtitle, onClose, children,
}: { title: string; subtitle: string; onClose: () => void; children: React.ReactNode }) {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/50" onClick={onClose} data-testid="source-backdrop">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="source-title"
        data-testid="source-dialog"
        className="dossier max-h-[85dvh] w-full max-w-md overflow-y-auto rounded-b-none p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="label-caps">แหล่งที่มาของตัวเลข</p>
        <h3 id="source-title" className="text-xl font-extrabold">{title}</h3>
        <p className="mb-3 text-muted">{subtitle}</p>
        {children}
        <button ref={closeRef} type="button" className="btn mt-5 w-full" onClick={onClose}>ปิด</button>
      </div>
    </div>
  );
}

/** Dataset facts shared by the stat and trait dialogs. */
export function DatasetRows({
  title, publisher, indicatorCode, year, raw, license, url, verified,
}: {
  title: string; publisher: string; indicatorCode: string | null; year: number | null; raw: number | null;
  license: string; url: string; verified: boolean;
}) {
  return (
    <dl className="space-y-2 text-sm">
      <Row k="ชุดข้อมูล" v={title} />
      <Row k="ผู้เผยแพร่" v={publisher} />
      {indicatorCode && <Row k="รหัสตัวชี้วัด" v={<code className="font-mono">{indicatorCode}</code>} />}
      <Row k="ปีของข้อมูล" v={year ?? "ไม่ระบุ"} />
      {raw !== null && <Row k="ค่าดิบ" v={raw} />}
      <Row k="สัญญาอนุญาต" v={license} />
      {url && <Row k="ลิงก์" v={<a className="break-all text-politics underline" href={url} target="_blank" rel="noreferrer">{url}</a>} />}
      {!verified && <p className="rounded bg-warn px-2 py-1 text-xs">ยังไม่มีผู้ตรวจสอบหน้าต้นทางด้วยตนเอง</p>}
    </dl>
  );
}

export function FixtureBlock() {
  return (
    <div data-testid="source-fixture" className="space-y-2 text-sm">
      <p className="stamp">{FIXTURE_LABEL}</p>
      <p>{FIXTURE_BANNER_TH} ค่านี้ถูกสมมุติขึ้นเพื่อทดสอบระบบ ไม่ได้มาจากชุดข้อมูลใด</p>
    </div>
  );
}

export function StatSourceDialog({
  stat, value, country, sources, onClose,
}: { stat: StatKey; value: number; country: CountryData; sources: Source[]; onClose: () => void }) {
  const info = describeStatSource(stat, country, sources);
  return (
    <SourceShell title={STAT_LABEL[stat]} subtitle={`ค่าตอนนี้ ${formatStat(stat, value)}`} onClose={onClose}>
      {info.kind === "dataset" && <DatasetRows {...info} />}

      {info.kind === "design" && (
        <div data-testid="source-design" className="space-y-2 text-sm">
          <p className="stamp">ค่าออกแบบ</p>
          <p>{info.rationale}</p>
        </div>
      )}

      {info.kind === "fixture" && <FixtureBlock />}
    </SourceShell>
  );
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[7.5rem_1fr] gap-2 border-b border-rule/70 pb-1">
      <dt className="text-muted">{k}</dt>
      <dd className="font-semibold">{v}</dd>
    </div>
  );
}
