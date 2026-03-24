import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  requireAccountAccess,
  requirePermission,
  unauthorizedResponse,
  forbiddenResponse,
  errorResponse,
} from "@/lib/auth-helpers";
import { PERMISSIONS } from "@/lib/rbac";
import { createContactSchema } from "@/lib/validations/contact";

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const account = await prisma.clientAccount.findUnique({
      where: { id: params.id },
      select: { csmId: true },
    });

    if (!account) {
      return errorResponse("Account not found", 404);
    }

    await requireAccountAccess(account.csmId);

    const contacts = await prisma.contact.findMany({
      where: { accountId: params.id },
    });

    return NextResponse.json(contacts);
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "Unauthorized") return unauthorizedResponse();
      if (error.message.startsWith("Forbidden")) return forbiddenResponse(error.message);
    }
    return errorResponse("Failed to fetch contacts");
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await requirePermission(PERMISSIONS.EDIT_ACCOUNT_FIELDS);

    const account = await prisma.clientAccount.findUnique({
      where: { id: params.id },
      select: { csmId: true },
    });

    if (!account) {
      return errorResponse("Account not found", 404);
    }

    await requireAccountAccess(account.csmId);

    const body = await request.json();
    const result = createContactSchema.safeParse(body);

    if (!result.success) {
      return errorResponse(result.error.issues[0].message, 400);
    }

    const contact = await prisma.contact.create({
      data: {
        accountId: params.id,
        ...result.data,
      },
    });

    return NextResponse.json(contact, { status: 201 });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "Unauthorized") return unauthorizedResponse();
      if (error.message.startsWith("Forbidden")) return forbiddenResponse(error.message);
    }
    return errorResponse("Failed to create contact");
  }
}
