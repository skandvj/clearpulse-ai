export function isProductionRuntime(): boolean {
  return process.env.NODE_ENV === "production";
}

export function isDevelopmentRuntime(): boolean {
  return !isProductionRuntime();
}
