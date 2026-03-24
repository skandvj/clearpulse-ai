import { prisma } from "@/lib/db";
import type { AuthenticatedUser } from "@/lib/auth-helpers";
import { canAccessAccount } from "@/lib/rbac";

function ensureAccountAccess(
  user: AuthenticatedUser,
  accountCsmId: string | null
): void {
  if (!canAccessAccount(user.role, user.id, accountCsmId)) {
    throw new Error("Forbidden");
  }
}

export async function getAccountMeetingsForUser(
  accountId: string,
  user: AuthenticatedUser
) {
  const account = await prisma.clientAccount.findUnique({
    where: { id: accountId },
    select: {
      id: true,
      name: true,
      csmId: true,
      csm: {
        select: {
          id: true,
          name: true,
          email: true,
          avatarUrl: true,
        },
      },
      meetings: {
        orderBy: {
          meetingDate: "desc",
        },
      },
    },
  });

  if (!account) {
    return null;
  }

  ensureAccountAccess(user, account.csmId);
  return account;
}

export async function getMeetingDetailForUser(
  accountId: string,
  meetingId: string,
  user: AuthenticatedUser
) {
  const account = await prisma.clientAccount.findUnique({
    where: { id: accountId },
    select: {
      id: true,
      name: true,
      csmId: true,
      csm: {
        select: {
          id: true,
          name: true,
          email: true,
          avatarUrl: true,
        },
      },
    },
  });

  if (!account) {
    return null;
  }

  ensureAccountAccess(user, account.csmId);

  const meeting = await prisma.meeting.findFirst({
    where: {
      id: meetingId,
      accountId,
    },
  });

  if (!meeting) {
    return null;
  }

  const signalMatchClauses = [
    ...(meeting.fathomId
      ? [{ externalId: `fathom-${meeting.fathomId}` }]
      : []),
    ...(meeting.recordingUrl ? [{ url: meeting.recordingUrl }] : []),
  ];

  const meetingSignalIds =
    signalMatchClauses.length === 0
      ? []
      : (
          await prisma.rawSignal.findMany({
            where: {
              accountId,
              source: "FATHOM",
              OR: signalMatchClauses,
            },
            select: { id: true },
          })
        ).map((signal) => signal.id);

  const meetingKpis =
    meetingSignalIds.length === 0
      ? []
      : await prisma.clientKPI.findMany({
          where: {
            accountId,
            evidence: {
              some: {
                signalId: { in: meetingSignalIds },
              },
            },
          },
          orderBy: [{ updatedAt: "desc" }],
          select: {
            id: true,
            metricName: true,
            healthScore: true,
            healthStatus: true,
            videoTimestamp: true,
            videoClipUrl: true,
          },
        });

  return {
    account,
    meeting,
    meetingKpis,
  };
}
