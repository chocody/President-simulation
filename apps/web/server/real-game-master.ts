// Real game master: adapts the lane-A routes (@ps/ai-gm) to the web app's GameMaster interface.
import { createClient, historian, judge, narrate, type GmClient, type PillarGrades } from "@ps/ai-gm";
import type { Card, CountryData, Evidence, GameState, Judgment, TurnReport } from "@ps/shared";
import type { GameMaster, NarrateInput } from "./game-master";

export class GameMasterError extends Error {
  constructor(public readonly reason: string, message: string) { super(message); }
}

type CountryLookup = (iso3: string) => CountryData | undefined;

export class RealGameMaster implements GameMaster {
  constructor(private readonly client: GmClient, private readonly country: CountryLookup) {}

  private ctx(state: GameState) {
    const c = this.country(state.countryIso3);
    if (!c) throw new GameMasterError("error", `ไม่พบข้อมูลประเทศ ${state.countryIso3}`);
    return { nameEn: c.nameEn, nameTh: c.nameTh, region: c.region };
  }

  async judge(input: { state: GameState; card: Card; playerText: string; evidence: Evidence[] }): Promise<Judgment> {
    const r = await judge({ country: this.ctx(input.state), ...input }, { client: this.client });
    if (!r.ok) throw new GameMasterError(r.reason, r.reason === "refused"
      ? "คณะรัฐมนตรีไม่ยอมดำเนินการตามคำสั่งนี้"
      : "ผู้ประเมินนโยบายตอบไม่ได้ในตอนนี้ ลองใหม่อีกครั้ง");
    return r.value;
  }

  async narrate(input: NarrateInput) {
    const r = await narrate({ country: this.ctx(input.state), ...input }, { client: this.client });
    if (!r.ok) throw new GameMasterError(r.reason, "ผู้เล่าผลตอบไม่ได้ในตอนนี้");
    return { narration: r.value.narration, headlines: r.value.headlines };
  }

  async historian(input: { state: GameState; grades: unknown; legacy: number }) {
    const r = await historian(
      { country: this.ctx(input.state), state: input.state, grades: input.grades as PillarGrades, legacy: input.legacy },
      { client: this.client },
    );
    if (!r.ok) throw new GameMasterError(r.reason, "นักประวัติศาสตร์ตอบไม่ได้ในตอนนี้");
    return { archetype: r.value.archetype, line: r.value.line };
  }
}
