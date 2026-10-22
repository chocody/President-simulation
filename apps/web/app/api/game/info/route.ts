import { handleInfo } from "../../../../server/handlers";
import { getRoute } from "../../../../server/route-helpers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request): Promise<Response> {
  const iso3 = new URL(req.url).searchParams.get("iso3");
  return getRoute((d) => handleInfo({ iso3 }, d));
}
