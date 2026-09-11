// Public, UNAUTHENTICATED DSAR intake page (PRD §5.3). Reachable at
// /intake/<org-slug> — the org's own slug (same one used at signup), not a
// secret token. Good enough for V1 given there's no public-facing "give me
// my intake link" flow yet; a future pass could add a random per-org token
// instead of the slug if guessability becomes a concern.

import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { orgs } from "@/lib/db/schema";
import PublicIntakeForm from "@/components/PublicIntakeForm";

export default async function PublicIntakePage({
  params,
}: {
  params: { slug: string };
}) {
  const db = getDb();
  const [org] = await db.select().from(orgs).where(eq(orgs.slug, params.slug)).limit(1);

  if (!org) {
    return (
      <main style={{ maxWidth: 480, margin: "80px auto", fontFamily: "system-ui" }}>
        <h1>Request form not found</h1>
        <p>This link doesn&apos;t match a known organization.</p>
      </main>
    );
  }

  return <PublicIntakeForm slug={params.slug} orgName={org.name} />;
}
