import { SignalSource } from "@prisma/client";
import { SourceAdapter } from "@/lib/ingestion/types";
import { SlackAdapter } from "./slack";
import { FathomAdapter } from "./fathom";
import { AMMeetingsAdapter } from "./am-meetings";
import { VitallyAdapter } from "./vitally";
import { SalesforceAdapter } from "./salesforce";
import { PersonasAdapter } from "./personas";
import { SharePointAdapter } from "./sharepoint";
import { JiraAdapter } from "./jira";
import { GDriveAdapter } from "./gdrive";

const adapters: Record<SignalSource, SourceAdapter> = {
  [SignalSource.SLACK]: new SlackAdapter(),
  [SignalSource.FATHOM]: new FathomAdapter(),
  [SignalSource.AM_MEETING]: new AMMeetingsAdapter(),
  [SignalSource.VITALLY]: new VitallyAdapter(),
  [SignalSource.SALESFORCE]: new SalesforceAdapter(),
  [SignalSource.PERSONAS]: new PersonasAdapter(),
  [SignalSource.SHAREPOINT]: new SharePointAdapter(),
  [SignalSource.JIRA]: new JiraAdapter(),
  [SignalSource.GOOGLE_DRIVE]: new GDriveAdapter(),
};

export function getAdapter(source: SignalSource): SourceAdapter {
  const adapter = adapters[source];
  if (!adapter) {
    throw new Error(`No adapter registered for source: ${source}`);
  }
  return adapter;
}

export function getAllAdapters(): SourceAdapter[] {
  return Object.values(adapters);
}
