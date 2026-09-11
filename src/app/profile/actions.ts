"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { orgProfiles, orgRegulationScope, regulationSets } from "@/lib/db/schema";
import { requireSession } from "@/lib/auth/session";
import { analyzeCompany } from "@/lib/regulations/engine";
import { regsToMetadata, regsVersionLabel } from "@/lib/regulations/metadata";
import type { CompanyProfile } from "@/lib/regulations/types";

function parseList(formData: FormData, key: string): string[] {
  return formData.getAll(key).map(String).filter(Boolean);
}

export async function saveProfileAndAnalyze(formData: FormData): Promise<void> {
  const session = await requireSession();
  if (!session) redirect("/login");

  const profile: CompanyProfile = {
    name: String(formData.get("name") || ""),
    revenue: Number(formData.get("revenue") || 0),
    employees: Number(formData.get("employees") || 0),
    consumers: Number(formData.get("consumers") || 0),
    dataSale: Number(formData.get("dataSale") || 0),
    industry: String(formData.get("industry") || "") as CompanyProfile["industry"],
    states: parseList(formData, "states"),
    intl: parseList(formData, "intl"),
    vendorCountries: parseList(formData, "vendorCountries"),
    dataTypes: parseList(formData, "dataTypes"),
    aiRoles: parseList(formData, "aiRoles"),
    marketingChannels: parseList(formData, "marketingChannels"),
  };

  const db = getDb();

  // Append-only: always a new row, never an update — see schema.ts comment.
  const [profileRow] = await db
    .insert(orgProfiles)
    .values({
      orgId: session.orgId,
      createdBy: session.userId,
      revenue: String(profile.revenue),
      employees: profile.employees,
      consumers: profile.consumers,
      dataSale: String(profile.dataSale),
      industry: profile.industry,
      states: profile.states,
      intl: profile.intl,
      vendorCountries: profile.vendorCountries,
      dataTypes: profile.dataTypes,
      aiRoles: profile.aiRoles,
      marketingChannels: profile.marketingChannels,
    })
    .returning();

  // Reuse the current regulation_sets snapshot if REGS content hasn't
  // changed since it was last seeded; otherwise create it on the fly so
  // scoring never blocks on a separate seed step having been run.
  const versionLabel = regsVersionLabel();
  let [regSet] = await db
    .select()
    .from(regulationSets)
    .where(eq(regulationSets.versionLabel, versionLabel))
    .limit(1);
  if (!regSet) {
    [regSet] = await db
      .insert(regulationSets)
      .values({ versionLabel, metadata: regsToMetadata() })
      .returning();
  }

  const analysis = analyzeCompany(profile);
  const serializable = analysis.results.map((r) => ({
    acronym: r.reg.acronym,
    name: r.reg.name,
    group: r.reg.group,
    inScope: r.inScope,
    watch: r.watch,
    tests: r.tests.map((t) => ({
      label: t.label,
      req: t.req,
      compVal: t.compVal,
      passed: t.passed,
    })),
  }));

  await db.insert(orgRegulationScope).values({
    orgId: session.orgId,
    orgProfileId: profileRow.id,
    regulationSetId: regSet.id,
    results: serializable,
  });

  revalidatePath("/scope");
  redirect("/scope");
}
