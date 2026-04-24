import { config } from "dotenv";
config({ path: ".env.local" });
import { ensureSessionsBucket } from "../lib/supabase/storage";

async function main() {
  await ensureSessionsBucket();
  console.log("ok — bucket `sessions` prêt");
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
