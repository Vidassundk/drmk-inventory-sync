import { listInStockParts } from "@/lib/parts";

export const dynamic = "force-dynamic";

export default async function Home() {
  const parts = await listInStockParts(12);

  return (
    <main className="mx-auto w-full max-w-5xl p-6">
      <h1 className="mb-6 text-2xl font-semibold">Latest in-stock parts</h1>
      <ul className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
        {parts.map((part) => (
          <li key={part.id} className="overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-800">
            {part.coverUrl ? (
              // Plain img: photos are served from R2 or Ovoko directly, without Next's image optimizer.
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={part.coverUrl}
                alt={part.name ?? ""}
                loading="lazy"
                className="aspect-4/3 w-full object-cover"
              />
            ) : (
              <div className="aspect-4/3 w-full bg-zinc-100 dark:bg-zinc-900" />
            )}
            <div className="space-y-1 p-3 text-sm">
              <p className="font-medium">{part.name}</p>
              <p className="text-zinc-500">{part.manufacturerCode}</p>
              <p>
                {part.price} {part.currency}
              </p>
              <p className="text-xs text-zinc-500">{part.coverOnR2 ? "Photo: R2" : "Photo: Ovoko"}</p>
            </div>
          </li>
        ))}
      </ul>
    </main>
  );
}
