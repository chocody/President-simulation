// Thai UI labels. Pure data, shared by the server (mock narration) and the client.
import type { z } from "zod";
import type { Card, CostSize as CostSizeSchema, Difficulty, EndReason, GroupKey, MeasureReport, StatKey, Target } from "@ps/shared";

export const STAT_LABEL: Record<StatKey, string> = {
  gdpGrowth: "การเติบโตของ GDP",
  inflation: "เงินเฟ้อ",
  unemployment: "การว่างงาน",
  budget: "งบประมาณที่ใช้ได้",
  debt: "หนี้สาธารณะ",
  health: "สาธารณสุข",
  education: "การศึกษา",
  crime: "อาชญากรรม",
  inequality: "ความเหลื่อมล้ำ",
  corruption: "การทุจริต",
  pressFreedom: "เสรีภาพสื่อ",
  stability: "เสถียรภาพทางการเมือง",
  parliament: "เสียงสนับสนุนในสภา",
  environment: "สิ่งแวดล้อม",
  foreignRelations: "ความสัมพันธ์ต่างประเทศ",
};

export const GROUP_LABEL: Record<GroupKey, string> = {
  farmers: "เกษตรกร",
  urban: "คนเมือง",
  business: "ภาคธุรกิจ",
  youth: "คนรุ่นใหม่",
  military: "ทหาร",
};

export const PILLAR_LABEL = {
  economy: "เศรษฐกิจ",
  society: "สังคม",
  politics: "การเมือง",
  other: "สิ่งแวดล้อมและต่างประเทศ",
} as const;

type CostSize = z.infer<typeof CostSizeSchema>;

export const COST_LABEL: Record<CostSize, string> = {
  none: "ไม่มีต้นทุน",
  XS: "เล็กมาก",
  S: "เล็ก",
  M: "ปานกลาง",
  L: "ใหญ่",
  XL: "ใหญ่มาก",
};

export const OUTCOME_LABEL: Record<MeasureReport["outcome"], string> = {
  blocked: "ถูกสภาตีตก",
  critical_failure: "ล้มเหลวอย่างรุนแรง",
  great_success: "สำเร็จอย่างยิ่ง",
  success: "สำเร็จ",
  partial: "สำเร็จบางส่วน",
  failure: "ล้มเหลว",
};

export const END_REASON_LABEL: Record<EndReason, string> = {
  won_election: "ชนะการเลือกตั้ง ได้อยู่ต่ออีกสมัย",
  lost_election: "แพ้การเลือกตั้ง",
  impeached: "ถูกถอดถอนออกจากตำแหน่ง",
  coup: "ถูกรัฐประหาร",
  uprising: "ถูกประชาชนลุกฮือขับไล่",
  resigned: "ลาออกจากตำแหน่ง",
};

export const CATEGORY_LABEL: Record<Card["category"], string> = {
  disaster: "ภัยพิบัติ",
  economy: "เศรษฐกิจ",
  society: "สังคม",
  health: "สาธารณสุข",
  politics: "การเมือง",
  foreign: "ต่างประเทศ",
  opportunity: "โอกาส",
};

export const DIFFICULTY_LABEL: Record<Difficulty, { name: string; hint: string }> = {
  easy: { name: "ง่าย", hint: "งบนโยบายมากขึ้น ทอยลูกเต๋าได้เปรียบ" },
  normal: { name: "ปกติ", hint: "สมดุลตามค่าออกแบบมาตรฐาน" },
  hard: { name: "ยาก", hint: "งบน้อย ทอยลูกเต๋าเสียเปรียบ" },
};

export function targetLabel(t: Target | string): string {
  if (t.startsWith("group:")) return `ความพอใจ${GROUP_LABEL[t.slice(6) as GroupKey] ?? t.slice(6)}`;
  return STAT_LABEL[t as StatKey] ?? t;
}
