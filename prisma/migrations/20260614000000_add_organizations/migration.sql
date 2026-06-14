CREATE TABLE "Organization" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "domain" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "User" ADD COLUMN "organizationId" TEXT;
ALTER TABLE "ClientAccount" ADD COLUMN "organizationId" TEXT;
ALTER TABLE "AuditLog" ADD COLUMN "organizationId" TEXT;
ALTER TABLE "IntegrationSetting" ADD COLUMN "organizationId" TEXT;
ALTER TABLE "AiSetting" ADD COLUMN "organizationId" TEXT;
ALTER TABLE "KpiFrameworkSetting" ADD COLUMN "organizationId" TEXT;
ALTER TABLE "SyncJob" ADD COLUMN "organizationId" TEXT;

DROP INDEX IF EXISTS "ClientAccount_vitallyAccountId_key";
DROP INDEX IF EXISTS "ClientAccount_salesforceId_key";
DROP INDEX IF EXISTS "Meeting_fathomId_key";
DROP INDEX IF EXISTS "IntegrationSetting_source_key_key";
DROP INDEX IF EXISTS "AiSetting_key_key";
DROP INDEX IF EXISTS "KpiFrameworkSetting_key_key";

CREATE UNIQUE INDEX "Organization_slug_key" ON "Organization"("slug");
CREATE UNIQUE INDEX "Organization_domain_key" ON "Organization"("domain");
CREATE UNIQUE INDEX "ClientAccount_organizationId_vitallyAccountId_key" ON "ClientAccount"("organizationId", "vitallyAccountId");
CREATE UNIQUE INDEX "ClientAccount_organizationId_salesforceId_key" ON "ClientAccount"("organizationId", "salesforceId");
CREATE UNIQUE INDEX "Meeting_accountId_fathomId_key" ON "Meeting"("accountId", "fathomId");
CREATE UNIQUE INDEX "IntegrationSetting_organizationId_source_key_key" ON "IntegrationSetting"("organizationId", "source", "key");
CREATE UNIQUE INDEX "AiSetting_organizationId_key_key" ON "AiSetting"("organizationId", "key");
CREATE UNIQUE INDEX "KpiFrameworkSetting_organizationId_key_key" ON "KpiFrameworkSetting"("organizationId", "key");

CREATE INDEX "User_organizationId_role_idx" ON "User"("organizationId", "role");
CREATE INDEX "ClientAccount_organizationId_name_idx" ON "ClientAccount"("organizationId", "name");
CREATE INDEX "ClientAccount_organizationId_csmId_idx" ON "ClientAccount"("organizationId", "csmId");
CREATE INDEX "AuditLog_organizationId_createdAt_idx" ON "AuditLog"("organizationId", "createdAt");
CREATE INDEX "SyncJob_organizationId_createdAt_idx" ON "SyncJob"("organizationId", "createdAt");

ALTER TABLE "User"
    ADD CONSTRAINT "User_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ClientAccount"
    ADD CONSTRAINT "ClientAccount_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "AuditLog"
    ADD CONSTRAINT "AuditLog_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "IntegrationSetting"
    ADD CONSTRAINT "IntegrationSetting_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "AiSetting"
    ADD CONSTRAINT "AiSetting_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "KpiFrameworkSetting"
    ADD CONSTRAINT "KpiFrameworkSetting_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "SyncJob"
    ADD CONSTRAINT "SyncJob_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
