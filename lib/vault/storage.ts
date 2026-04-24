import "server-only";
import { createClient } from "@supabase/supabase-js";

const BUCKET = "vault";

function admin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase env missing (URL or SERVICE_ROLE_KEY)");
  return createClient(url, key, { auth: { persistSession: false } });
}

export async function ensureVaultBucket(): Promise<void> {
  const s = admin();
  const { data: list } = await s.storage.listBuckets();
  if (list?.some((b) => b.name === BUCKET)) return;
  const { error } = await s.storage.createBucket(BUCKET, { public: false });
  if (error && !/already exists/i.test(error.message)) throw error;
}

export async function writeVaultFile(path: string, content: string): Promise<void> {
  const s = admin();
  const { error } = await s.storage.from(BUCKET).upload(path, new Blob([content], { type: "text/markdown" }), {
    contentType: "text/markdown; charset=utf-8",
    upsert: true,
  });
  if (error) throw error;
}

export async function readVaultFile(path: string): Promise<string | null> {
  const s = admin();
  const { data, error } = await s.storage.from(BUCKET).download(path);
  if (error) {
    if (/not found/i.test(error.message)) return null;
    throw error;
  }
  return await data.text();
}

export async function deleteVaultFile(path: string): Promise<void> {
  const s = admin();
  const { error } = await s.storage.from(BUCKET).remove([path]);
  if (error && !/not found/i.test(error.message)) throw error;
}

export async function listVaultFiles(prefix: string = ""): Promise<string[]> {
  const s = admin();
  const { data, error } = await s.storage.from(BUCKET).list(prefix, {
    limit: 1000,
    sortBy: { column: "name", order: "asc" },
  });
  if (error) throw error;
  return (data ?? []).filter((d) => d.name && !d.id?.startsWith("placeholder")).map((d) => d.name);
}
