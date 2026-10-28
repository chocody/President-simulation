import type { TurnReport } from "@ps/shared";
import { parseFrictionNote } from "@ps/engine";

const pts = (x: number): string => Math.abs(x).toFixed(1);

/**
 * One line per reform measure that institutional friction touched (the engine writes a note for each, see
 * formatFrictionNote). Empty when no reform was affected, so the result screen shows nothing then.
 */
export function frictionLines(report: TurnReport): { measure: number; harder: boolean; text: string }[] {
  const lines: { measure: number; harder: boolean; text: string }[] = [];
  for (const note of report.notes) {
    const f = parseFrictionNote(note);
    if (!f) continue;
    const harder = f.probability < 0 || f.vote < 0;
    const title = report.measures[f.measure]?.title ?? "มาตรการปฏิรูป";
    const vote = f.vote !== 0 ? `${harder ? "หักคะแนนโหวตในสภา" : "เพิ่มคะแนนโหวตในสภา"} ${pts(f.vote)} คะแนน และ` : "";
    const chance = `${harder ? "ลด" : "เพิ่ม"}โอกาสสำเร็จ ${pts(f.probability)} จุดเปอร์เซ็นต์`;
    const head = harder ? "ระบบอุปถัมภ์ทำให้ปฏิรูปยากขึ้น" : "ระบบอุปถัมภ์ที่อ่อนช่วยให้ปฏิรูปง่ายขึ้น";
    lines.push({
      measure: f.measure,
      harder,
      text:
        `${head}: “${title}” เป็นการปฏิรูป ค่าระบบอุปถัมภ์ของประเทศนี้อยู่ที่ ${f.patronage.toFixed(0)} จาก 100 ` +
        `(ค่าประมาณจากหลักนิติธรรม WGI) จึง${vote}${chance}`,
    });
  }
  return lines;
}
