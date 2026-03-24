import { SignalSource } from "@prisma/client";

export interface RawSignalInput {
  externalId: string;
  title?: string;
  content: string;
  author?: string;
  url?: string;
  signalDate: Date;
}

export interface SourceAdapter {
  source: SignalSource;
  fetchSignals(accountId: string, since?: Date): Promise<RawSignalInput[]>;
}

export interface IngestionResult {
  totalFetched: number;
  newSignals: number;
  duplicatesSkipped: number;
  errors: string[];
}
