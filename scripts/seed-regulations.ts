// Seeds (or updates) the regulation_sets table with the current REGS content
// snapshot. Idempotent: re-running with unchanged REGS content is a no-op
// (versionLabel is a content hash — see regulations/metadata.ts).
//
// Run this after every deploy that changes src/lib/regulations/data.ts, and
// once before first use of the app against a fresh database.

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { eq } from "drizzle-orm";
import * as schema from "../src/lib/db/schema";
import { regsToMetadata, regsVersionLabel } from "../src/lib/regulations/metadata";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is not set.");
  }
  const client = postgres(url, { max: 1 });
  const db = drizzle(client, { schema });

  const versionLabel = regsVersionLabel();
  const existing = await db
    .select()
    .from(schema.regulationSets)
    .where(eq(schema.regulationSets.versionLabel, versionLabel))
    .limit(1);

  if (existing.length > 0) {
    console.log(`Regulation set ${versionLabel} already seeded — skipping.`);
  } else {
    await db.insert(schema.regulationSets).values({
      versionLabel,
      metadata: regsToMetadata(),
    });
    console.log(`Seeded regulation set ${versionLabel}.`);
  }

  await client.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
