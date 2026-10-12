/**
 * Minimal structured logger: one JSON line per event.
 * Rule: log ids, codes, sizes and durations only — never resume or job description text.
 */

type Level = "error" | "warn" | "info" | "debug";
const ORDER: Record<Level, number> = { error: 0, warn: 1, info: 2, debug: 3 };

function threshold(): number {
  const configured = (process.env.LOG_LEVEL ?? "info").toLowerCase();
  if (configured === "fatal") return ORDER.error;
  if (configured === "trace") return ORDER.debug;
  return ORDER[configured as Level] ?? ORDER.info;
}

type Fields = Record<string, string | number | boolean | null | undefined>;

function write(level: Level, event: string, fields: Fields = {}) {
  if (process.env.NODE_ENV === "test" || ORDER[level] > threshold()) return;
  const line = JSON.stringify({
    level,
    event,
    time: new Date().toISOString(),
    ...fields,
  });
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

export const logger = {
  error: (event: string, fields?: Fields) => write("error", event, fields),
  warn: (event: string, fields?: Fields) => write("warn", event, fields),
  info: (event: string, fields?: Fields) => write("info", event, fields),
  debug: (event: string, fields?: Fields) => write("debug", event, fields),
};
