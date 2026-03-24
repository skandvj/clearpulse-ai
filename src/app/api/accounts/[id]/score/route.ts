import { prisma } from "@/lib/db";
import { requireAccountAccess, requirePermission } from "@/lib/auth-helpers";
import { PERMISSIONS } from "@/lib/rbac";
import { runAccountHealthScoring } from "@/lib/ai/scoreKPIHealth";
import { logError } from "@/lib/logging";
import { checkRateLimit } from "@/lib/rate-limit";
import { createAccountScorePostHandler } from "@/lib/api/account-score-post";

export const POST = createAccountScorePostHandler({
  requirePermission: () => requirePermission(PERMISSIONS.RUN_HEALTH_RESCORE),
  requireAccountAccess,
  getAccountById: (accountId) =>
    prisma.clientAccount.findUnique({
      where: { id: accountId },
      select: { csmId: true },
    }),
  checkRateLimit,
  runAccountHealthScoring,
  logError,
});
