import { createSupabaseServiceClient } from "@/lib/auth/supabase-server";

const BUCKET = "range-artifacts";
const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

/** Sanitize a storage object key: no traversal, no leading slash, bounded charset. */
export function safeObjectKey(...parts: string[]): string {
  const joined = parts
    .map((p) => p.replace(/[^A-Za-z0-9._/-]/g, "_"))
    .join("/")
    .replace(/\.\.+/g, "_")
    .replace(/^\/+/, "")
    .replace(/\/{2,}/g, "/");
  if (joined.includes("..")) throw new Error("invalid object key");
  return joined;
}

export async function uploadArtifact(key: string, bytes: Buffer, contentType = "application/octet-stream"): Promise<string> {
  if (bytes.byteLength > MAX_UPLOAD_BYTES) throw new Error("artifact exceeds size limit");
  const safe = safeObjectKey(key);
  const supabase = createSupabaseServiceClient();
  const { error } = await supabase.storage.from(BUCKET).upload(safe, bytes, { contentType, upsert: true });
  if (error) throw new Error(`upload failed: ${error.message}`);
  return safe;
}

/** Short-lived signed download URL (spec §23: signed, short TTL). */
export async function signedDownloadUrl(key: string, ttlSeconds = 120): Promise<string> {
  const supabase = createSupabaseServiceClient();
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(key, ttlSeconds);
  if (error || !data) throw new Error(`sign failed: ${error?.message ?? "unknown"}`);
  return data.signedUrl;
}

export async function ensureBucket(): Promise<void> {
  const supabase = createSupabaseServiceClient();
  const { data } = await supabase.storage.getBucket(BUCKET);
  if (!data) await supabase.storage.createBucket(BUCKET, { public: false, fileSizeLimit: MAX_UPLOAD_BYTES });
}

export { BUCKET, MAX_UPLOAD_BYTES };
