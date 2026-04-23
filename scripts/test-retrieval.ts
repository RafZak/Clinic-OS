import { config } from "dotenv";
import postgres from "postgres";
import { embedQuery } from "../lib/ingest/embed";

config({ path: ".env.local" });

const QUERIES = [
  "patient qui refuse la classe 2 pour raison financière",
  "comment demander la présence d'un tiers au téléphone",
  "objection prix quand présenter la recommandation",
  "accueillir l'objection comme un signe d'intérêt",
  "premier contact téléphonique prise de RDV",
  "recommandation bouche à oreille programme un coeur en or",
  "décrocher le téléphone dès la troisième sonnerie",
];

async function main() {
  const sql = postgres(process.env.DATABASE_URL!, { max: 1 });

  const [totals] = await sql<{ total_chunks: number; total_files: number }[]>`
    SELECT count(*)::int as total_chunks, count(distinct drive_file_id)::int as total_files
    FROM knowledge_chunks
  `;
  console.log(
    `DB : ${totals.total_chunks} chunks sur ${totals.total_files} fichiers\n`
  );

  const perProg = await sql<
    { program_slug: string | null; source_type: string; chunks: number }[]
  >`
    SELECT program_slug, source_type, count(*)::int as chunks
    FROM knowledge_chunks
    GROUP BY program_slug, source_type
    ORDER BY program_slug, source_type
  `;
  console.log("Par programme / type :");
  perProg.forEach((r) =>
    console.log(
      `  ${(r.program_slug ?? "-").padEnd(24)} ${r.source_type.padEnd(18)} ${r.chunks}`
    )
  );

  for (const q of QUERIES) {
    console.log(`\n▸ "${q}"`);
    const t0 = Date.now();
    const embedding = await embedQuery(q);
    const vec = `[${embedding.join(",")}]`;
    const results = await sql<
      {
        source_file: string;
        program_slug: string | null;
        module_number: number | null;
        source_type: string;
        content: string;
        similarity: number;
      }[]
    >`
      SELECT
        source_file,
        program_slug,
        module_number,
        source_type,
        content,
        1 - (embedding <=> ${vec}::vector) AS similarity
      FROM knowledge_chunks
      WHERE embedding IS NOT NULL
      ORDER BY embedding <=> ${vec}::vector
      LIMIT 3
    `;
    const dt = Date.now() - t0;
    console.log(`  ${results.length} résultats (${dt} ms)`);
    results.forEach((r, i) =>
      console.log(
        `  ${i + 1}. [${r.similarity.toFixed(3)}] ${r.program_slug}${
          r.module_number ? ` · m${r.module_number}` : ""
        } — ${r.source_file}\n     “${r.content.slice(0, 180).replace(/\s+/g, " ")}…”`
      )
    );
  }

  await sql.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
