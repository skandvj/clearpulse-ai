import { Prisma, SignalSource } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireAccountAccess, requirePermission } from "@/lib/auth-helpers";
import { PERMISSIONS } from "@/lib/rbac";
import { enqueueBulkSync, enqueueIngestion } from "@/lib/ingestion/queue";
import { checkRateLimit } from "@/lib/rate-limit";
import { createSyncPostHandler } from "@/lib/api/sync-post";

export const POST = createSyncPostHandler({
  requirePermission: () => requirePermission(PERMISSIONS.TRIGGER_SOURCE_SYNC),
  requireAccountAccess,
  getAccountById: (accountId) =>
    prisma.clientAccount.findUnique({
      where: { id: accountId },
      select: { id: true, name: true, csmId: true },
    }),
  listAccountsForUser: (user) => {
    const where: Prisma.ClientAccountWhereInput =
      user.role === "CSM" ? { csmId: user.id } : {};

    return prisma.clientAccount.findMany({
      where,
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    });
  },
  enqueueIngestion: (source, accountId, userId) =>
    enqueueIngestion(source as SignalSource, accountId, userId),
  enqueueBulkSync,
  checkRateLimit,
});
