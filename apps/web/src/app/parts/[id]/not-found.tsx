import Link from "next/link";

export default function PartNotFound() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-3 p-6">
      <p>Dalis nerasta.</p>
      <Link href="/parts" className="text-sm text-blue-600 hover:underline">
        Grįžti į sąrašą
      </Link>
    </main>
  );
}
