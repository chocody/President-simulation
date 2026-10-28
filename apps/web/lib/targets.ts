import { STAT_KEYS, type StatKey } from "@ps/shared";

export function isStatKey(x: string): x is StatKey {
  return (STAT_KEYS as readonly string[]).includes(x);
}
