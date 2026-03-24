import type { SignalSource } from "@prisma/client";

export type IntegrationStatus =
  | "CONNECTED"
  | "PARTIAL"
  | "DISCONNECTED"
  | "ERROR";

export interface IntegrationDefinition {
  source: SignalSource;
  authType: "API Key" | "OAuth" | "Hybrid";
  description: string;
  requiredEnv: string[];
}

export const INTEGRATION_DEFINITIONS: Record<SignalSource, IntegrationDefinition> = {
  SLACK: {
    source: "SLACK",
    authType: "API Key",
    description: "Slack conversations, search results, and thread replies tied to customer accounts.",
    requiredEnv: ["SLACK_BOT_TOKEN", "SLACK_SIGNING_SECRET"],
  },
  FATHOM: {
    source: "FATHOM",
    authType: "API Key",
    description: "Fathom meetings, transcripts, summaries, and webhook-triggered meeting enrichment.",
    requiredEnv: ["FATHOM_API_KEY", "FATHOM_WEBHOOK_SECRET"],
  },
  AM_MEETING: {
    source: "AM_MEETING",
    authType: "OAuth",
    description: "Google Calendar and meeting notes for account manager meeting activity.",
    requiredEnv: [
      "GOOGLE_CLIENT_ID",
      "GOOGLE_CLIENT_SECRET",
      "GOOGLE_REFRESH_TOKEN",
    ],
  },
  VITALLY: {
    source: "VITALLY",
    authType: "API Key",
    description: "Vitally account notes, traits, and timeline data plus outbound health pushes.",
    requiredEnv: ["VITALLY_API_KEY", "VITALLY_ORG_ID"],
  },
  SALESFORCE: {
    source: "SALESFORCE",
    authType: "Hybrid",
    description: "Salesforce accounts, opportunities, activity history, and case-derived signals.",
    requiredEnv: [
      "SALESFORCE_CLIENT_ID",
      "SALESFORCE_CLIENT_SECRET",
      "SALESFORCE_INSTANCE_URL",
      "SALESFORCE_USERNAME",
      "SALESFORCE_PASSWORD",
    ],
  },
  PERSONAS: {
    source: "PERSONAS",
    authType: "API Key",
    description: "Persona and segment context used as background signal for customer health.",
    requiredEnv: ["PERSONAS_API_URL", "PERSONAS_API_KEY"],
  },
  SHAREPOINT: {
    source: "SHAREPOINT",
    authType: "OAuth",
    description: "SharePoint documents and pages pulled through Microsoft Graph.",
    requiredEnv: [
      "MICROSOFT_CLIENT_ID",
      "MICROSOFT_CLIENT_SECRET",
      "MICROSOFT_TENANT_ID",
      "SHAREPOINT_SITE_ID",
    ],
  },
  JIRA: {
    source: "JIRA",
    authType: "API Key",
    description: "Jira issues, comments, and blocker history mapped into customer signals.",
    requiredEnv: ["JIRA_BASE_URL", "JIRA_EMAIL", "JIRA_API_TOKEN"],
  },
  GOOGLE_DRIVE: {
    source: "GOOGLE_DRIVE",
    authType: "OAuth",
    description: "Google Drive documents and customer folders, including high-priority notes.",
    requiredEnv: [
      "GOOGLE_CLIENT_ID",
      "GOOGLE_CLIENT_SECRET",
      "GOOGLE_REFRESH_TOKEN",
      "GDRIVE_CUSTOMERS_FOLDER_ID",
    ],
  },
};

export function getConfiguredEnv(requiredEnv: string[]) {
  const missingEnv = requiredEnv.filter((envName) => {
    const value = process.env[envName];
    return !value || value.trim().length === 0;
  });

  return {
    configuredCount: requiredEnv.length - missingEnv.length,
    requiredCount: requiredEnv.length,
    missingEnv,
  };
}
