import type { Line } from "@/lib/parsing";

/** Builds a parser Line with sensible defaults for unit tests. */
export function line(text: string, overrides: Partial<Line> = {}): Line {
  return {
    text,
    page: 1,
    y: 0,
    x: 0.1,
    right: 0.9,
    fontSize: 10.5,
    bold: false,
    listItem: false,
    inTable: false,
    inTextBox: false,
    region: "body",
    ...overrides,
  };
}

/** A heading line styled like most resumes: bold capitals. */
export function heading(text: string, overrides: Partial<Line> = {}): Line {
  return line(text.toUpperCase(), { bold: true, ...overrides });
}
