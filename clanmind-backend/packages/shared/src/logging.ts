/**
 * Structured JSON logging with correlation IDs (spec §101).
 * Logs must never contain provider secrets or raw private payloads (§164, §287-analog).
 */
export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LogContext {
  request_id?: string;
  trace_id?: string;
  user_id?: string;
  group_id?: string;
  project_id?: string;
  ai_run_id?: string;
  operation_id?: string;
  [key: string]: unknown;
}

const LEVEL_WEIGHT: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

export class Logger {
  constructor(
    private readonly minLevel: LogLevel = "info",
    private readonly base: LogContext = {},
  ) {}

  child(ctx: LogContext): Logger {
    return new Logger(this.minLevel, { ...this.base, ...ctx });
  }

  private write(level: LogLevel, message: string, ctx: LogContext): void {
    if (LEVEL_WEIGHT[level] < LEVEL_WEIGHT[this.minLevel]) return;
    const line = JSON.stringify({
      ts: new Date().toISOString(),
      level,
      message,
      ...this.base,
      ...ctx,
    });
    if (level === "error") console.error(line);
    else if (level === "warn") console.warn(line);
    else console.log(line);
  }

  debug(message: string, ctx: LogContext = {}): void {
    this.write("debug", message, ctx);
  }
  info(message: string, ctx: LogContext = {}): void {
    this.write("info", message, ctx);
  }
  warn(message: string, ctx: LogContext = {}): void {
    this.write("warn", message, ctx);
  }
  error(message: string, ctx: LogContext = {}): void {
    this.write("error", message, ctx);
  }
}
