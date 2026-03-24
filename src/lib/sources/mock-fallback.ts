import { SignalSource } from "@prisma/client";
import { logWarn } from "@/lib/logging";
import { isProductionRuntime } from "@/lib/runtime";

interface MockFallbackArgs<T> {
  source: SignalSource;
  accountId: string;
  requiredEnv: string[];
  resolvedValues?: Record<string, string | undefined>;
  createMockSignals: () => Promise<T>;
}

export async function resolveMockFallback<T>({
  source,
  accountId,
  requiredEnv,
  resolvedValues,
  createMockSignals,
}: MockFallbackArgs<T>): Promise<T | null> {
  const missingEnv = requiredEnv.filter((envName) => {
    const value = resolvedValues?.[envName] ?? process.env[envName];
    return !value || value.trim().length === 0;
  });

  if (missingEnv.length === 0) {
    return null;
  }

  if (isProductionRuntime()) {
    throw new Error(
      `[${source}] Missing required integration settings: ${missingEnv.join(", ")}`
    );
  }

  logWarn("adapter.mock_fallback", {
    source,
    accountId,
    missingEnv,
    mode: "development_mock_signals",
  });

  return createMockSignals();
}
