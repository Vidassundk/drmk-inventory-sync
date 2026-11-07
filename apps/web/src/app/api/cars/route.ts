import { searchCars } from "@/lib/parts";
import { OPTIONS_PAGE_SIZE } from "@/lib/parts-query";

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const q = params.get("q")?.slice(0, 100) ?? "";
  const offset = Math.max(0, Number(params.get("offset")) || 0);
  const model = Number(params.get("model")) || null;
  const cars = await searchCars(q, { brand: params.get("brand"), model }, OPTIONS_PAGE_SIZE, offset);
  return Response.json(cars);
}
