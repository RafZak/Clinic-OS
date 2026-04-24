import { config } from "dotenv";
config({ path: ".env.local" });
import { ensureSessionsBucket } from "../lib/supabase/storage";
import { ensureVaultBucket } from "../lib/vault/storage";

async function main() {
  await ensureSessionsBucket();
  console.log("ok — bucket `sessions` prêt");
  await ensureVaultBucket();
  console.log("ok — bucket `vault` prêt");
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
