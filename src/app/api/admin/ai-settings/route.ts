import { NextResponse } from "next/server";
import { z } from "zod";
import {
  requirePermission,
  unauthorizedResponse,
  forbiddenResponse,
  errorResponse,
} from "@/lib/auth-helpers";
import { PERMISSIONS } from "@/lib/rbac";
import {
  buildAIFieldStates,
  summarizeAIFields,
  upsertAISettings,
} from "@/lib/ai/settings";
import { prisma } from "@/lib/db";

const updateSchema = z.object({
  values: z
    .object({
      ANTHROPIC_API_KEY: z.string().optional(),
      OPENAI_API_KEY: z.string().optional(),
    })
    .default({}),
});

export async function GET() {
  try {
    await requirePermission(PERMISSIONS.CONFIGURE_INTEGRATIONS);

    const fields = await buildAIFieldStates();
    const summary = summarizeAIFields(fields);

    return NextResponse.json({
      settings: {
        fields,
        configuredCount: summary.configuredCount,
        requiredCount: summary.requiredCount,
        missingKeys: summary.missingKeys,
      },
    });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "Unauthorized") return unauthorizedResponse();
      if (error.message.startsWith("Forbidden")) {
        return forbiddenResponse(error.message);
      }
    }

    return errorResponse("Failed to fetch AI settings");
  }
}

export async function PATCH(request: Request) {
  try {
    const user = await requirePermission(PERMISSIONS.CONFIGURE_INTEGRATIONS);
    const parsed = updateSchema.safeParse(await request.json().catch(() => ({})));

    if (!parsed.success) {
      return errorResponse("Invalid AI settings payload", 400);
    }

    await upsertAISettings({
      userId: user.id,
      values: parsed.data.values,
    });

    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: "AI_SETTINGS_UPDATED",
        entityType: "AISettings",
        entityId: "global",
        metadata: {
          keysUpdated: Object.keys(parsed.data.values),
        },
      },
    });

    const fields = await buildAIFieldStates();
    const summary = summarizeAIFields(fields);

    return NextResponse.json({
      message: "AI settings saved securely.",
      settings: {
        fields,
        configuredCount: summary.configuredCount,
        requiredCount: summary.requiredCount,
        missingKeys: summary.missingKeys,
      },
    });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "Unauthorized") return unauthorizedResponse();
      if (error.message.startsWith("Forbidden")) {
        return forbiddenResponse(error.message);
      }
    }

    return errorResponse("Failed to save AI settings");
  }
}
