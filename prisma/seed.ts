import { PrismaClient, Role } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const adminPassword = await bcrypt.hash("admin123", 12);
  const csmPassword = await bcrypt.hash("csm123", 12);

  const admin = await prisma.user.upsert({
    where: { email: "admin@clearpulse.dev" },
    update: {
      name: "Admin User",
      role: Role.ADMIN,
      isActive: true,
    },
    create: {
      email: "admin@clearpulse.dev",
      name: "Admin User",
      password: adminPassword,
      role: Role.ADMIN,
      isActive: true,
    },
  });

  const leadership = await prisma.user.upsert({
    where: { email: "leadership@clearpulse.dev" },
    update: {
      name: "VP of Customer Success",
      role: Role.LEADERSHIP,
      isActive: true,
    },
    create: {
      email: "leadership@clearpulse.dev",
      name: "VP of Customer Success",
      password: await bcrypt.hash("lead123", 12),
      role: Role.LEADERSHIP,
      isActive: true,
    },
  });

  const csm = await prisma.user.upsert({
    where: { email: "csm@clearpulse.dev" },
    update: {
      name: "Customer Success Manager",
      role: Role.CSM,
      isActive: true,
    },
    create: {
      email: "csm@clearpulse.dev",
      name: "Customer Success Manager",
      password: csmPassword,
      role: Role.CSM,
      isActive: true,
    },
  });

  const viewer = await prisma.user.upsert({
    where: { email: "viewer@clearpulse.dev" },
    update: {
      name: "Read-Only Viewer",
      role: Role.VIEWER,
      isActive: true,
    },
    create: {
      email: "viewer@clearpulse.dev",
      name: "Read-Only Viewer",
      password: await bcrypt.hash("viewer123", 12),
      role: Role.VIEWER,
      isActive: true,
    },
  });

  console.log("Seeded users:", { admin, leadership, csm, viewer });

  const account1 = await prisma.clientAccount.upsert({
    where: { vitallyAccountId: "demo-acme-corp" },
    update: {},
    create: {
      name: "Acme Corp",
      domain: "acme.com",
      vitallyAccountId: "demo-acme-corp",
      csmId: csm.id,
      tier: "ENTERPRISE",
      industry: "SaaS",
      healthScore: 73,
      healthStatus: "AT_RISK",
      currentSolution:
        "Acme Corp uses our AI-powered deflection engine to reduce Tier 1 HR support tickets. Deployed across 12,000 employees in NA.",
      currentState:
        "The team currently spends ~35 hours/week manually responding to HR inquiries at an estimated cost of $420,000/year.",
      businessGoals:
        "Achieve 90% HR deflection rate by Q3 2026. Reduce average response time from 4.2 hours to under 30 minutes.",
    },
  });

  const account2 = await prisma.clientAccount.upsert({
    where: { vitallyAccountId: "demo-globex-inc" },
    update: {},
    create: {
      name: "Globex Inc",
      domain: "globex.io",
      vitallyAccountId: "demo-globex-inc",
      csmId: csm.id,
      tier: "GROWTH",
      industry: "Fintech",
      healthScore: 85,
      healthStatus: "HEALTHY",
      currentSolution:
        "Globex leverages our platform for automated compliance document retrieval and employee onboarding workflows.",
      currentState:
        "Onboarding new hires previously took 2 weeks of manual processing. Now averaging 3 days with 95% automation.",
    },
  });

  const account3 = await prisma.clientAccount.upsert({
    where: { vitallyAccountId: "demo-initech-llc" },
    update: {},
    create: {
      name: "Initech LLC",
      domain: "initech.com",
      vitallyAccountId: "demo-initech-llc",
      csmId: csm.id,
      tier: "ENTERPRISE",
      industry: "Manufacturing",
      healthScore: 32,
      healthStatus: "CRITICAL",
      currentSolution:
        "Initech deployed our platform for IT helpdesk deflection. Currently in rollback risk due to poor adoption metrics.",
      currentState:
        "Adoption stalled at 18% after 90 days. 3 open Jira blockers. Executive sponsor escalated concerns in Slack.",
    },
  });

  console.log("Seeded accounts:", {
    account1: account1.name,
    account2: account2.name,
    account3: account3.name,
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
