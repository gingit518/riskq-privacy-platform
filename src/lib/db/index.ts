import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

// DATABASE_URL is intentionally not provisioned yet — see README "Setup
// required before this deploys". Reading it lazily (not at module load in a
// way that throws) keeps `next build` working without it; runtime routes
// that touch the DB will fail clearly if it's missing, which is preferable
// to a silent no-op.
function getConnectionString(): string {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL is not set. Provision a Postgres instance (Vercel Postgres, " +
        "Neon, or Supabase all work) and set it in the Vercel project's " +
        "environment variables — see README."
    );
  }
  return url;
}

let _client: ReturnType<typeof postgres> | null = null;
let _db: ReturnType<typeof drizzle<typeof schema>> | null = null;

export function getDb() {
  if (!_db) {
    _client = postgres(getConnectionString(), { max: 1 });
    _db = drizzle(_client, { schema });
  }
  return _db;
}
