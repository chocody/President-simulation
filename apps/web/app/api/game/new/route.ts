import { handleNew } from "../../../../server/handlers";
import { postRoute } from "../../../../server/route-helpers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request): Promise<Response> {
  return postRoute(req, handleNew);
}
