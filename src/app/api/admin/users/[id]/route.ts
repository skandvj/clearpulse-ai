import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  requirePermission,
  unauthorizedResponse,
  forbiddenResponse,
  errorResponse,
} from "@/lib/auth-helpers";
import { PERMISSIONS } from "@/lib/rbac";
import { updateUserSchema } from "@/lib/validations/user";

async function ensureActiveAdminSafety(
  userId: string,
  currentRole: "ADMIN" | "LEADERSHIP" | "CSM" | "VIEWER",
  currentIsActive: boolean,
  nextRole: "ADMIN" | "LEADERSHIP" | "CSM" | "VIEWER",
  nextIsActive: boolean
) {
  const removingAdminPrivileges =
    currentRole === "ADMIN" && currentIsActive && (!nextIsActive || nextRole !== "ADMIN");

  if (!removingAdminPrivileges) {
    return;
  }

  const remainingActiveAdmins = await prisma.user.count({
    where: {
      role: "ADMIN",
      isActive: true,
      id: { not: userId },
    },
  });

  if (remainingActiveAdmins === 0) {
    throw new Error("Cannot remove the last active admin");
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const admin = await requirePermission(PERMISSIONS.MANAGE_USERS);
    const body = await request.json();
    const result = updateUserSchema.safeParse(body);

    if (!result.success) {
      return errorResponse(result.error.issues[0]?.message ?? "Invalid payload", 400);
    }

    const target = await prisma.user.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        role: true,
        isActive: true,
      },
    });

    if (!target) {
      return errorResponse("User not found", 404);
    }

    const nextRole = result.data.role ?? target.role;
    const nextIsActive = result.data.isActive ?? target.isActive;

    if (admin.id === target.id) {
      if (result.data.role && result.data.role !== target.role) {
        return errorResponse("You cannot change your own role", 400);
      }
      if (result.data.isActive === false) {
        return errorResponse("You cannot deactivate your own account", 400);
      }
    }

    await ensureActiveAdminSafety(
      target.id,
      target.role,
      target.isActive,
      nextRole,
      nextIsActive
    );

    const updated = await prisma.user.update({
      where: { id: target.id },
      data: {
        role: result.data.role,
        isActive: result.data.isActive,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        lastLogin: true,
        createdAt: true,
        _count: {
          select: {
            accounts: true,
          },
        },
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: admin.id,
        action: "USER_UPDATED",
        entityType: "User",
        entityId: updated.id,
        metadata: {
          previousRole: target.role,
          nextRole: updated.role,
          previousIsActive: target.isActive,
          nextIsActive: updated.isActive,
        },
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "Unauthorized") return unauthorizedResponse();
      if (error.message.startsWith("Forbidden")) {
        return forbiddenResponse(error.message);
      }
      if (error.message === "Cannot remove the last active admin") {
        return errorResponse(error.message, 400);
      }
    }

    return errorResponse("Failed to update user");
  }
}
