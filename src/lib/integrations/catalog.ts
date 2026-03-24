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
  browserConfigurable: boolean;
  fields: IntegrationFieldDefinition[];
}

export type IntegrationFieldInputType =
  | "text"
  | "password"
  | "url"
  | "email";

export interface IntegrationFieldDefinition {
  key: string;
  label: string;
  inputType: IntegrationFieldInputType;
  secret: boolean;
  browserEditable: boolean;
  helperText?: string;
  placeholder?: string;
}

export const INTEGRATION_DEFINITIONS: Record<SignalSource, IntegrationDefinition> = {
  SLACK: {
    source: "SLACK",
    authType: "API Key",
    description: "Slack conversations, search results, and thread replies tied to customer accounts.",
    requiredEnv: ["SLACK_BOT_TOKEN", "SLACK_SIGNING_SECRET"],
    browserConfigurable: true,
    fields: [
      {
        key: "SLACK_BOT_TOKEN",
        label: "Bot Token",
        inputType: "password",
        secret: true,
        browserEditable: true,
        helperText: "Used for conversations history, search, and thread lookups.",
      },
      {
        key: "SLACK_SIGNING_SECRET",
        label: "Signing Secret",
        inputType: "password",
        secret: true,
        browserEditable: true,
        helperText: "Required to verify inbound Slack signatures and webhooks.",
      },
    ],
  },
  FATHOM: {
    source: "FATHOM",
    authType: "API Key",
    description: "Fathom meetings, transcripts, summaries, and webhook-triggered meeting enrichment.",
    requiredEnv: ["FATHOM_API_KEY", "FATHOM_WEBHOOK_SECRET"],
    browserConfigurable: true,
    fields: [
      {
        key: "FATHOM_API_KEY",
        label: "API Key",
        inputType: "password",
        secret: true,
        browserEditable: true,
        helperText: "Used for fetching meetings, transcripts, and enrichment data.",
      },
      {
        key: "FATHOM_WEBHOOK_SECRET",
        label: "Webhook Secret",
        inputType: "password",
        secret: true,
        browserEditable: true,
        helperText: "Used to verify webhook payloads from Fathom.",
      },
    ],
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
    browserConfigurable: false,
    fields: [
      {
        key: "GOOGLE_CLIENT_ID",
        label: "Google Client ID",
        inputType: "text",
        secret: false,
        browserEditable: false,
      },
      {
        key: "GOOGLE_CLIENT_SECRET",
        label: "Google Client Secret",
        inputType: "password",
        secret: true,
        browserEditable: false,
      },
      {
        key: "GOOGLE_REFRESH_TOKEN",
        label: "Google Refresh Token",
        inputType: "password",
        secret: true,
        browserEditable: false,
      },
    ],
  },
  VITALLY: {
    source: "VITALLY",
    authType: "API Key",
    description: "Vitally account notes, traits, and timeline data plus outbound health pushes.",
    requiredEnv: ["VITALLY_API_KEY", "VITALLY_ORG_ID"],
    browserConfigurable: true,
    fields: [
      {
        key: "VITALLY_API_KEY",
        label: "API Key",
        inputType: "password",
        secret: true,
        browserEditable: true,
        helperText: "Used for both inbound Vitally sync and outbound KPI pushes.",
      },
      {
        key: "VITALLY_ORG_ID",
        label: "Org ID",
        inputType: "text",
        secret: false,
        browserEditable: true,
        helperText: "Optional but useful for keeping Vitally context explicit.",
      },
    ],
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
    browserConfigurable: false,
    fields: [
      {
        key: "SALESFORCE_CLIENT_ID",
        label: "Client ID",
        inputType: "text",
        secret: false,
        browserEditable: false,
      },
      {
        key: "SALESFORCE_CLIENT_SECRET",
        label: "Client Secret",
        inputType: "password",
        secret: true,
        browserEditable: false,
      },
      {
        key: "SALESFORCE_INSTANCE_URL",
        label: "Instance URL",
        inputType: "url",
        secret: false,
        browserEditable: false,
      },
      {
        key: "SALESFORCE_USERNAME",
        label: "Username",
        inputType: "text",
        secret: false,
        browserEditable: false,
      },
      {
        key: "SALESFORCE_PASSWORD",
        label: "Password",
        inputType: "password",
        secret: true,
        browserEditable: false,
      },
    ],
  },
  PERSONAS: {
    source: "PERSONAS",
    authType: "API Key",
    description: "Persona and segment context used as background signal for customer health.",
    requiredEnv: ["PERSONAS_API_URL", "PERSONAS_API_KEY"],
    browserConfigurable: true,
    fields: [
      {
        key: "PERSONAS_API_URL",
        label: "API URL",
        inputType: "url",
        secret: false,
        browserEditable: true,
        helperText: "Base URL for the Personas profile and segment API.",
      },
      {
        key: "PERSONAS_API_KEY",
        label: "API Key",
        inputType: "password",
        secret: true,
        browserEditable: true,
      },
    ],
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
    browserConfigurable: false,
    fields: [
      {
        key: "MICROSOFT_CLIENT_ID",
        label: "Microsoft Client ID",
        inputType: "text",
        secret: false,
        browserEditable: false,
      },
      {
        key: "MICROSOFT_CLIENT_SECRET",
        label: "Microsoft Client Secret",
        inputType: "password",
        secret: true,
        browserEditable: false,
      },
      {
        key: "MICROSOFT_TENANT_ID",
        label: "Tenant ID",
        inputType: "text",
        secret: false,
        browserEditable: false,
      },
      {
        key: "SHAREPOINT_SITE_ID",
        label: "Site ID",
        inputType: "text",
        secret: false,
        browserEditable: false,
      },
    ],
  },
  JIRA: {
    source: "JIRA",
    authType: "API Key",
    description: "Jira issues, comments, and blocker history mapped into customer signals.",
    requiredEnv: ["JIRA_BASE_URL", "JIRA_EMAIL", "JIRA_API_TOKEN"],
    browserConfigurable: true,
    fields: [
      {
        key: "JIRA_BASE_URL",
        label: "Base URL",
        inputType: "url",
        secret: false,
        browserEditable: true,
        helperText: "Example: https://your-company.atlassian.net",
      },
      {
        key: "JIRA_EMAIL",
        label: "Atlassian Email",
        inputType: "email",
        secret: false,
        browserEditable: true,
      },
      {
        key: "JIRA_API_TOKEN",
        label: "API Token",
        inputType: "password",
        secret: true,
        browserEditable: true,
      },
    ],
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
    browserConfigurable: false,
    fields: [
      {
        key: "GOOGLE_CLIENT_ID",
        label: "Google Client ID",
        inputType: "text",
        secret: false,
        browserEditable: false,
      },
      {
        key: "GOOGLE_CLIENT_SECRET",
        label: "Google Client Secret",
        inputType: "password",
        secret: true,
        browserEditable: false,
      },
      {
        key: "GOOGLE_REFRESH_TOKEN",
        label: "Google Refresh Token",
        inputType: "password",
        secret: true,
        browserEditable: false,
      },
      {
        key: "GDRIVE_CUSTOMERS_FOLDER_ID",
        label: "Customers Root Folder ID",
        inputType: "text",
        secret: false,
        browserEditable: false,
      },
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
