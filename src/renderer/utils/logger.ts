export type LogLevel = "error" | "warn" | "info" | "debug" | "trace";

interface LoggerOptions {
  minLevel?: LogLevel;
  remoteLogging?: ((level: LogLevel, message: string, ...args: unknown[]) => void) | null;
}

export default class Logger {
  private static levels: LogLevel[] = ["trace", "debug", "info", "warn", "error"];
  private static minLevel: LogLevel = "info";

  private static remoteLogging?: LoggerOptions["remoteLogging"];

  /** Call once at app startup if you want to override defaults */
  public static configure(options: LoggerOptions) {
    const { minLevel, remoteLogging } = options;
    if (minLevel && Logger.levels.includes(minLevel)) {
      Logger.minLevel = minLevel;
    }
    if (Object.prototype.hasOwnProperty.call(options, "remoteLogging")) {
      Logger.remoteLogging = remoteLogging ?? undefined;
    }
  }

  /** Compare levels by index */
  private static shouldLog(level: LogLevel) {
    const configuredIndex = Logger.levels.indexOf(Logger.minLevel);
    const messageIndex = Logger.levels.indexOf(level);
    return messageIndex >= configuredIndex;
  }

  /** Prefixes your message with "[ISO-timestamp] LEVEL:" */
  private static format(level: LogLevel, args: unknown[]): [string, ...unknown[]] {
    const ts = new Date().toISOString();
    const prefix = `[${ts}] ${level.toUpperCase()}:`;
    if (typeof args[0] === "string") {
      const [first, ...rest] = args as [string, ...unknown[]];
      return [`${prefix} ${first}`, ...rest];
    }
    return [prefix, ...args];
  }

  public static error(...args: unknown[]) {
    const msg = Logger.format("error", args);
    Logger.remoteLogging?.("error", ...(msg as [string, ...unknown[]]));
    if (!Logger.shouldLog("error")) return;
    console.error(...msg);
  }

  public static warn(...args: unknown[]) {
    const msg = Logger.format("warn", args);
    Logger.remoteLogging?.("warn", ...(msg as [string, ...unknown[]]));
    if (!Logger.shouldLog("warn")) return;
    console.warn(...msg);
  }

  public static info(...args: unknown[]) {
    const msg = Logger.format("info", args);
    Logger.remoteLogging?.("info", ...(msg as [string, ...unknown[]]));
    if (!Logger.shouldLog("info")) return;
    console.info(...msg);
  }

  public static debug(...args: unknown[]) {
    const msg = Logger.format("debug", args);
    Logger.remoteLogging?.("debug", ...(msg as [string, ...unknown[]]));
    if (!Logger.shouldLog("debug")) return;
    console.debug(...msg);
  }

  public static trace(...args: unknown[]) {
    const msg = Logger.format("trace", args);
    Logger.remoteLogging?.("trace", ...(msg as [string, ...unknown[]]));
    if (!Logger.shouldLog("trace")) return;
    console.log(...msg); // console.trace will also print a stack, so using log here
  }
}
