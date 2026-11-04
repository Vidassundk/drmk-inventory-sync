import { AwsClient } from "aws4fetch";

export type R2 = ReturnType<typeof r2FromEnv>;

/** Minimal R2 client over its S3 API. */
export function r2FromEnv(env: NodeJS.ProcessEnv = process.env) {
  const required = ["R2_ACCOUNT_ID", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_BUCKET", "R2_PUBLIC_BASE_URL"];
  const missing = required.filter((key) => !env[key]);
  if (missing.length) throw new Error(`Missing env vars: ${missing.join(", ")}`);

  const aws = new AwsClient({
    accessKeyId: env.R2_ACCESS_KEY_ID!,
    secretAccessKey: env.R2_SECRET_ACCESS_KEY!,
    service: "s3",
    region: "auto",
  });
  const bucketUrl = `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${env.R2_BUCKET}`;
  const publicBase = env.R2_PUBLIC_BASE_URL!.replace(/\/$/, "");
  const objectUrl = (key: string) => `${bucketUrl}/${key.split("/").map(encodeURIComponent).join("/")}`;

  async function check(res: Response, action: string, key: string) {
    if (!res.ok) throw new Error(`R2 ${action} ${key} failed: HTTP ${res.status} ${(await res.text()).slice(0, 200)}`);
    return res;
  }

  return {
    publicUrl: (key: string) => `${publicBase}/${key}`,

    async put(key: string, body: Uint8Array<ArrayBuffer>, contentType: string) {
      await check(
        await aws.fetch(objectUrl(key), {
          method: "PUT",
          body,
          headers: {
            "Content-Type": contentType,
            // Keys are content hashes, so an object never changes.
            "Cache-Control": "public, max-age=31536000, immutable",
          },
        }),
        "PUT",
        key,
      );
    },

    async exists(key: string) {
      const res = await aws.fetch(objectUrl(key), { method: "HEAD" });
      if (res.status === 404) return false;
      await check(res, "HEAD", key);
      return true;
    },

    async delete(key: string) {
      await check(await aws.fetch(objectUrl(key), { method: "DELETE" }), "DELETE", key);
    },
  };
}
