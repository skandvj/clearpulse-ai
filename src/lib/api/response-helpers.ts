import { NextResponse } from "next/server";

export function jsonError(message: string, status = 500) {
  return NextResponse.json({ error: message }, { status });
}

export function jsonUnauthorized(message = "Unauthorized") {
  return jsonError(message, 401);
}

export function jsonForbidden(message = "Forbidden") {
  return jsonError(message, 403);
}
