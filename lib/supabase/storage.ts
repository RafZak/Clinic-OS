import "server-only";
import { createClient } from "@supabase/supabase-js";

const BUCKET = "sessions";

function admin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase env missing (URL or SERVICE_ROLE_KEY)");
  return createClient(url, key, { auth: { persistSession: false } });
}

export async function ensureSessionsBucket(): Promise<void> {
  const s = admin();
  const { data: list } = await s.storage.listBuckets();
  if (list?.some((b) => b.name === BUCKET)) return;
  const { error } = await s.storage.createBucket(BUCKET, { public: false });
  if (error && !/already exists/i.test(error.message)) throw error;
}

export async function uploadSessionAudio(
  sessionId: string,
  bytes: ArrayBuffer | Buffer,
  contentType: string
): Promise<string> {
  const s = admin();
  const ext = contentType.includes("mp4") ? "mp4" : "webm";
  const path = `${sessionId}.${ext}`;
  const { error } = await s.storage.from(BUCKET).upload(path, bytes as ArrayBuffer, {
    contentType,
    upsert: true,
  });
  if (error) throw error;
  return `${BUCKET}/${path}`;
}
