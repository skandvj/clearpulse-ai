import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  requirePermission,
  unauthorizedResponse,
  forbiddenResponse,
  errorResponse,
} from "@/lib/auth-helpers";
import { PERMISSIONS } from "@/lib/rbac";
import { updateContactSchema } from "@/lib/validations/contact";

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string; contactId: string } }
) {
  try {
    await requirePermission(PERMISSIONS.EDIT_ACCOUNT_FIELDS);

    const contact = await prisma.contact.findUnique({
      where: { id: params.contactId, accountId: params.id },
    });

    if (!contact) {
      return errorResponse("Contact not found", 404);
    }

    const body = await request.json();
    const result = updateContactSchema.safeParse(body);

    if (!result.success) {
      return errorResponse(result.error.issues[0].message, 400);
    }

    const updated = await prisma.contact.update({
      where: { id: params.contactId },
      data: result.data,
    });

    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "Unauthorized") return unauthorizedResponse();
      if (error.message.startsWith("Forbidden")) return forbiddenResponse(error.message);
    }
    return errorResponse("Failed to update contact");
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string; contactId: string } }
) {
  try {
    await requirePermission(PERMISSIONS.EDIT_ACCOUNT_FIELDS);

    const contact = await prisma.contact.findUnique({
      where: { id: params.contactId, accountId: params.id },
    });

    if (!contact) {
      return errorResponse("Contact not found", 404);
    }

    await prisma.contact.delete({ where: { id: params.contactId } });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "Unauthorized") return unauthorizedResponse();
      if (error.message.startsWith("Forbidden")) return forbiddenResponse(error.message);
    }
    return errorResponse("Failed to delete contact");
  }
}
