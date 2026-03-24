type LogLevel = "info" | "warn" | "error";

function serializeError(error: unknown) {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
    };
  }

  return {
    message: typeof error === "string" ? error : JSON.stringify(error),
  };
}

function sanitize(data: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(data).filter(([, value]) => value !== undefined)
  );
}

function writeLog(level: LogLevel, event: string, data: Record<string, unknown>) {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    event,
    ...sanitize(data),
  };

  const line = JSON.stringify(entry);
  if (level === "error") {
    console.error(line);
    return;
  }

  if (level === "warn") {
    console.warn(line);
    return;
  }

  console.log(line);
}

export function logInfo(event: string, data: Record<string, unknown> = {}) {
  writeLog("info", event, data);
}

export function logWarn(event: string, data: Record<string, unknown> = {}) {
  writeLog("warn", event, data);
}

export function logError(
  event: string,
  error: unknown,
  data: Record<string, unknown> = {}
) {
  writeLog("error", event, {
    ...data,
    error: serializeError(error),
  });
}
