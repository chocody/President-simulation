// Glue between Next route handlers and the plain handler functions in handlers.ts.
import { getContent } from "./content";
import { getGameMaster } from "./game-master";
import type { ApiResult, Deps } from "./handlers";

function json(result: ApiResult): Response {
  return new Response(JSON.stringify(result.body), {
    status: result.status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
}

function deps(): Deps | Response {
  try {
    return { content: getContent(), gm: getGameMaster() };
  } catch (e) {
    console.error("content load failed:", e);
    return json({ status: 500, body: { error: "โหลดข้อมูลเกมไม่สำเร็จ ตรวจสอบโฟลเดอร์ data/" } });
  }
}

/** POST route: parses the JSON body (400 in Thai if it is not JSON) and calls the handler. */
export async function postRoute(req: Request, handler: (body: unknown, d: Deps) => Promise<ApiResult>): Promise<Response> {
  const d = deps();
  if (d instanceof Response) return d;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json({ status: 400, body: { error: "ข้อมูลที่ส่งมาไม่ใช่ JSON" } });
  }
  return json(await handler(body, d));
}

export async function getRoute(handler: (d: Deps) => Promise<ApiResult>): Promise<Response> {
  const d = deps();
  if (d instanceof Response) return d;
  return json(await handler(d));
}
