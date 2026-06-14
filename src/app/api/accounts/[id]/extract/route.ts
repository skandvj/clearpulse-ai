import { prisma } from "@/lib/db";
import {
  getAccessibleAccountWhere,
  requireAccountAccess,
  requirePermission,
} from "@/lib/auth-helpers";
import { PERMISSIONS } from "@/lib/rbac";
import { runKpiExtraction } from "@/lib/ai/extractKPIs";
import { runAccountHealthScoring } from "@/lib/ai/scoreKPIHealth";
import { logError } from "@/lib/logging";
import { checkRateLimit } from "@/lib/rate-limit";
import { createAccountExtractPostHandler } from "@/lib/api/account-extract-post";

export const POST = createAccountExtractPostHandler({
  requirePermission: () => requirePermission(PERMISSIONS.TRIGGER_SOURCE_SYNC),
  requireAccountAccess,
  getAccountById: async (accountId) => {
    const user = await requirePermission(PERMISSIONS.TRIGGER_SOURCE_SYNC);
    return prisma.clientAccount.findFirst({
      where: getAccessibleAccountWhere(user, accountId),
      select: { csmId: true },
    });
  },
  checkRateLimit,
  runKpiExtraction,
  runAccountHealthScoring,
  logError,
});
