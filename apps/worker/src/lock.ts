import type { Db } from "@drmk/db";

/** Runs `fn` under a session advisory lock so two runs of the same job never overlap. */
export async function exclusive<T>(client: Db["$client"], key: string, fn: () => Promise<T>): Promise<T> {
  const conn = await client.reserve();
  try {
    const [{ locked }] = await conn`select pg_try_advisory_lock(hashtext(${key})) as locked`;
    if (!locked) throw new Error(`Another "${key}" run is in progress`);
    try {
      return await fn();
    } finally {
      await conn`select pg_advisory_unlock(hashtext(${key}))`;
    }
  } finally {
    conn.release();
  }
}
