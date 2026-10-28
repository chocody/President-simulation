// Browser-side API client. Errors carry the Thai message the server returned.
import type {
  AdvanceResponse, DecideResult, EndResponse, InfoResponse, NewResponse,
} from "./api-types";
import type { Answer, Difficulty, GameState } from "@ps/shared";

export class ApiClientError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = "ApiClientError";
  }
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, init);
  } catch {
    throw new ApiClientError("เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ ลองใหม่อีกครั้ง", 0);
  }
  let data: unknown = null;
  try {
    data = await res.json();
  } catch {
    // fall through to the generic error
  }
  if (!res.ok) {
    const msg = (data as { error?: string } | null)?.error;
    throw new ApiClientError(msg ?? "เกิดข้อผิดพลาดที่ไม่ทราบสาเหตุ", res.status);
  }
  return data as T;
}

const post = <T>(path: string, body: unknown): Promise<T> =>
  call<T>(path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });

export const api = {
  info: (iso3?: string) => call<InfoResponse>(`/api/game/info${iso3 ? `?iso3=${encodeURIComponent(iso3)}` : ""}`),
  newGame: (difficulty: Difficulty, exclude: string[] = []) => post<NewResponse>("/api/game/new", exclude.length > 0 ? { difficulty, exclude } : { difficulty }),
  advance: (state: GameState) => post<AdvanceResponse>("/api/game/advance", { state }),
  decide: (state: GameState, answer: Answer) => post<DecideResult>("/api/game/decide", { state, answer }),
  end: (state: GameState) => post<EndResponse>("/api/game/end", { state }),
};
