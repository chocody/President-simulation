import { describe, it, expect } from "vitest";
import { narrate } from "../src/routes/narrator";
import { historian, type PillarGrades } from "../src/routes/historian";
import { card, country, mockClient, reply, report, state } from "./helpers";

const lines: string[] = [];
const mk = (client: ReturnType<typeof mockClient>) => ({ client, log: (l: string) => lines.push(l), now: () => 0 });

describe("narrator", () => {
  const out = { narration: "เรื่องเล่า", headlines: ["ก", "ข", "ค"], chronicleLine: "ไตรมาส 3: ..." };
  const input = { country, state, report, card, answerTitle: "ตรึงราคา" };

  it("returns narration, 3 headlines and a chronicle line", async () => {
    const r = await narrate(input, mk(mockClient(reply(out))));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.headlines).toHaveLength(3);
  });

  it("uses effort low, the same model, cache breakpoints, and embeds the engine report", async () => {
    const client = mockClient(reply(out));
    await narrate(input, mk(client));
    const p = client.calls[0]!;
    expect(p.model).toBe("claude-opus-5-5");
    expect(p.output_config.effort).toBe("low");
    expect(p.fallbacks).toBe("default");
    for (const b of p.system) expect(b.cache_control).toEqual({ type: "ephemeral" });
    expect(p.messages[0].content).toContain(JSON.stringify(report.immediate));
    expect(p.messages[0].content).toContain("ตรึงราคา");
    expect(p).not.toHaveProperty("temperature");
  });

  it("maps refusal and wrong headline count", async () => {
    expect(await narrate(input, mk(mockClient(reply(out, { stop_reason: "refusal" }))))).toMatchObject({ ok: false, reason: "refused" });
    expect(await narrate(input, mk(mockClient(reply({ ...out, headlines: ["ก"] }))))).toMatchObject({ ok: false, reason: "invalid" });
  });
});

describe("historian", () => {
  const grades: PillarGrades = {
    economy: { change: 4, grade: "B" }, society: { change: -1, grade: "C" },
    politics: { change: 0, grade: "C" }, other: { change: 2, grade: "C" },
  };
  const out = {
    archetype: "ผู้ประนีประนอม",
    line: "ประวัติศาสตร์จะจดจำคุณว่า ผู้นำที่เลือกทางสายกลางท่ามกลางแรงกดดัน",
    gradeNotes: { economy: "ดีขึ้น", society: "ทรงตัว", politics: "ทรงตัว", other: "ดีขึ้นเล็กน้อย" },
  };
  const input = { country, state, grades, legacy: 55 };

  it("returns archetype, line and grade notes with effort medium", async () => {
    const client = mockClient(reply(out));
    const r = await historian(input, mk(client));
    expect(r.ok).toBe(true);
    expect(client.calls[0]!.output_config.effort).toBe("medium");
  });

  it("rejects a line that does not start with the required phrase", async () => {
    const r = await historian(input, mk(mockClient(reply({ ...out, line: "คุณเป็นผู้นำที่ดี" }))));
    expect(r).toMatchObject({ ok: false, reason: "invalid" });
  });

  it("maps refusal", async () => {
    const r = await historian(input, mk(mockClient(reply(out, { stop_reason: "refusal" }))));
    expect(r).toMatchObject({ ok: false, reason: "refused" });
  });
});
