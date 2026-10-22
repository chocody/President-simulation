export const FREE_TEXT_MIN = 20;
export const FREE_TEXT_MAX = 800;

export type Selection =
  | { kind: "none" }
  | { kind: "preset"; choiceId: string }
  | { kind: "free"; text: string };

/** Submit is allowed once a choice is picked, or typed text (trimmed) is 20-800 characters. */
export function canSubmit(s: Selection): boolean {
  if (s.kind === "preset") return true;
  if (s.kind === "free") {
    const n = s.text.trim().length;
    return n >= FREE_TEXT_MIN && n <= FREE_TEXT_MAX;
  }
  return false;
}
