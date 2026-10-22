// Reads the shipped content (cards, evidence) for the offline scripts. Read-only.
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { parse } from "yaml";
import { Card, Evidence } from "@ps/shared";

export const REPO_ROOT = join(import.meta.dirname, "../../..");

export function loadCards(dir = join(REPO_ROOT, "data/cards")): Card[] {
  return readdirSync(dir)
    .filter((f) => f.endsWith(".yaml"))
    .sort()
    .map((f) => Card.parse(parse(readFileSync(join(dir, f), "utf8"))));
}

export function loadEvidence(file = join(REPO_ROOT, "data/evidence/evidence.yaml")): Evidence[] {
  return (parse(readFileSync(file, "utf8")) as unknown[]).map((e) => Evidence.parse(e));
}

/** Generic country for content that is written to work in any country (cards, pre-judge, smoke eval). */
export const GENERIC_COUNTRY = {
  nameEn: "a generic middle-income country (no real country data)",
  nameTh: "ประเทศรายได้ปานกลางทั่วไป",
  region: "not specified",
} as const;
