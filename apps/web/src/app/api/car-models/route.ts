import { searchCarModels } from "@/lib/parts";
import { MODELS_PAGE_SIZE } from "@/lib/parts-query";

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const q = params.get("q")?.slice(0, 100) ?? "";
  const offset = Math.max(0, Number(params.get("offset")) || 0);
  const models = await searchCarModels(q, params.get("brand"), MODELS_PAGE_SIZE, offset);
  return Response.json(models);
}
