import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import {
  requirePermission,
  unauthorizedResponse,
  forbiddenResponse,
  errorResponse,
} from "@/lib/auth-helpers";
import { PERMISSIONS } from "@/lib/rbac";
import { createUserSchema } from "@/lib/validations/user";

export async function GET(request: NextRequest) {
  try {
    await requirePermission(PERMISSIONS.MANAGE_USERS);

    const search = request.nextUrl.searchParams.get("search")?.trim();
    const where: Prisma.UserWhereInput = search
      ? {
          OR: [
            { email: { contains: search, mode: "insensitive" } },
            { name: { contains: search, mode: "insensitive" } },
          ],
        }
      : {};

    const users = await prisma.user.findMany({
      where,
      orderBy: [{ isActive: "desc" }, { createdAt: "desc" }],
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

    return NextResponse.json(users);
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "Unauthorized") return unauthorizedResponse();
      if (error.message.startsWith("Forbidden")) {
        return forbiddenResponse(error.message);
      }
    }

    return errorResponse("Failed to fetch users");
  }
}

export async function POST(request: NextRequest) {
  try {
    const admin = await requirePermission(PERMISSIONS.MANAGE_USERS);
    const body = await request.json();
    const result = createUserSchema.safeParse(body);

    if (!result.success) {
      return errorResponse(result.error.issues[0]?.message ?? "Invalid payload", 400);
    }

    const email = result.data.email.trim().toLowerCase();
    const existing = await prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });

    if (existing) {
      return errorResponse("A user with this email already exists", 409);
    }

    const password =
      result.data.password && result.data.password.trim().length > 0
        ? await bcrypt.hash(result.data.password.trim(), 10)
        : null;

    const user = await prisma.user.create({
      data: {
        email,
        name: result.data.name?.trim() || null,
        role: result.data.role,
        password,
        isActive: true,
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
        action: "USER_CREATED",
        entityType: "User",
        entityId: user.id,
        metadata: {
          email: user.email,
          role: user.role,
          passwordSet: Boolean(password),
        },
      },
    });

    return NextResponse.json(user, { status: 201 });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "Unauthorized") return unauthorizedResponse();
      if (error.message.startsWith("Forbidden")) {
        return forbiddenResponse(error.message);
      }
    }

    return errorResponse("Failed to create user");
  }
}
