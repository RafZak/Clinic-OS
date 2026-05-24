import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { practitioners } from "@/db/schema";
import { getCurrentQuizPractitioner } from "@/lib/quiz-identity";
import { getCenterCareSnapshots } from "@/lib/care-quality/queries";
import {
  computeTeamAverage,
  computeDistribution,
} from "@/lib/care-quality/aggregate";
import { ManagerDashboardView } from "@/components/care/manager-dashboard-view";
import type { CareSnapshot } from "@/lib/care-quality/types";

export const dynamic = "force-dynamic";

export default async function ManagerDashboardPage() {
  const me = await getCurrentQuizPractitioner("audioprothesiste");

  let snaps: CareSnapshot[] = [];
  if (me) {
    const [pro] = await db
      .select({ centerId: practitioners.centerId })
      .from(practitioners)
      .where(eq(practitioners.id, me.id))
      .limit(1);
    if (pro?.centerId) {
      try {
        snaps = await getCenterCareSnapshots(pro.centerId);
      } catch {
        snaps = [];
      }
    }
  }

  return (
    <ManagerDashboardView
      teamRadar={computeTeamAverage(snaps)}
      distribution={computeDistribution(snaps)}
      clinicianCount={snaps.length}
    />
  );
}
