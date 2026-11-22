type LogOutput = Pick<Console, "info" | "warn" | "error">;

// The default output works in both browsers and Node.js. Keep native argument
// formatting and Error objects rather than serializing diagnostic details.
export function createLogger(output: LogOutput = console) {
  return {
    info(message: string, ...details: unknown[]): void {
      output.info(`[INFO] ${message}`, ...details);
    },
    warn(message: string, ...details: unknown[]): void {
      output.warn(`[WARN] ${message}`, ...details);
    },
    error(message: string, ...details: unknown[]): void {
      output.error(`[ERROR] ${message}`, ...details);
    },
  };
}

export const logger = createLogger();
