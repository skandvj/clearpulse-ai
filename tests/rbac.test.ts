import test from "node:test";
import assert from "node:assert/strict";
import { Role } from "@prisma/client";
import {
  PERMISSIONS,
  canAccessAccount,
  getAllPermissions,
  hasPermission,
  requirePermission,
} from "@/lib/rbac";

test("admins receive all declared permissions", () => {
  const permissions = getAllPermissions(Role.ADMIN);

  assert.equal(
    permissions.length,
    Object.keys(PERMISSIONS).length,
    "admin should retain the full permission set"
  );

  for (const permission of Object.values(PERMISSIONS)) {
    assert.equal(hasPermission(Role.ADMIN, permission), true);
  }
});

test("leadership permissions stay read-only", () => {
  assert.equal(hasPermission(Role.LEADERSHIP, PERMISSIONS.VIEW_ALL_ACCOUNTS), true);
  assert.equal(
    hasPermission(Role.LEADERSHIP, PERMISSIONS.DOWNLOAD_PDF_REPORT),
    true
  );
  assert.equal(
    hasPermission(Role.LEADERSHIP, PERMISSIONS.EDIT_ACCOUNT_FIELDS),
    false
  );
  assert.equal(
    hasPermission(Role.LEADERSHIP, PERMISSIONS.TRIGGER_SOURCE_SYNC),
    false
  );
});

test("csm account access is restricted to owned accounts", () => {
  assert.equal(canAccessAccount(Role.CSM, "user-1", "user-1"), true);
  assert.equal(canAccessAccount(Role.CSM, "user-1", "user-2"), false);
  assert.equal(canAccessAccount(Role.CSM, "user-1", null), false);
});

test("viewer has read access but cannot inspect signal evidence", () => {
  assert.equal(hasPermission(Role.VIEWER, PERMISSIONS.VIEW_ALL_ACCOUNTS), true);
  assert.equal(hasPermission(Role.VIEWER, PERMISSIONS.VIEW_KPI_HEALTH), true);
  assert.equal(
    hasPermission(Role.VIEWER, PERMISSIONS.VIEW_SIGNAL_EVIDENCE),
    false
  );
  assert.equal(hasPermission(Role.VIEWER, PERMISSIONS.EDIT_KPIS), false);
});

test("requirePermission throws a helpful error for missing access", () => {
  assert.throws(
    () => requirePermission(Role.VIEWER, PERMISSIONS.RUN_HEALTH_RESCORE),
    /Forbidden: role "VIEWER" lacks permission "RUN_HEALTH_RESCORE"/
  );
});
