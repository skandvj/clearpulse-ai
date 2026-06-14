import { NextResponse } from "next/server";
import {
  unauthorizedResponse,
  forbiddenResponse,
  errorResponse,
  getServerUser,
} from "@/lib/auth-helpers";
import { getKpiFrameworkSettings } from "@/lib/kpi-framework";

export async function GET() {
  try {
    const user = await getServerUser();

    if (!user) {
      return unauthorizedResponse();
    }

    const settings = await getKpiFrameworkSettings(user.organizationId);

    return NextResponse.json({ settings });
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("Forbidden")) {
      return forbiddenResponse(error.message);
    }

    return errorResponse("Failed to fetch KPI framework settings");
  }
}
