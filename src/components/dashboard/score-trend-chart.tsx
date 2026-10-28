"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";

import { formatDate } from "@/lib/utils/format";

type Point = { date: string; atsScore: number };

const HEIGHT = 120;
// Room for the latest value's label on the right and the end marker at the top.
const PAD = { top: 10, right: 34, bottom: 2, left: 6 };
const TOOLTIP_WIDTH = 96;
const TOOLTIP_GAP = 10;

/**
 * ATS score over the latest scans — docs/PLANNING.md §7.4: one series, a light area wash
 * on a fixed 0–100 scale, no gridlines. Hover or arrow keys read any point; the latest
 * value is labelled; a table shows every value without hovering.
 */
export function ScoreTrendChart({ points }: { points: Point[] }) {
  const id = useId();
  const box = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [active, setActive] = useState<number | null>(null);

  useEffect(() => {
    const element = box.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setWidth(entry.contentRect.width);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const last = points.length - 1;
  const innerWidth = Math.max(0, width - PAD.left - PAD.right);
  const innerHeight = HEIGHT - PAD.top - PAD.bottom;
  const x = (i: number) => PAD.left + (last === 0 ? innerWidth : (i / last) * innerWidth);
  const y = (score: number) => PAD.top + (1 - score / 100) * innerHeight;

  const line = points
    .map((p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(p.atsScore).toFixed(1)}`)
    .join(" ");
  const baseline = HEIGHT - PAD.bottom;
  const area = `${line} L${x(last).toFixed(1)},${baseline} L${x(0).toFixed(1)},${baseline} Z`;

  function nearest(clientX: number) {
    const rect = box.current?.getBoundingClientRect();
    if (!rect || last < 0) return;
    const ratio = (clientX - rect.left - PAD.left) / Math.max(innerWidth, 1);
    setActive(Math.min(last, Math.max(0, Math.round(ratio * last))));
  }

  function onKeyDown(event: KeyboardEvent) {
    const current = active ?? last;
    const next =
      event.key === "ArrowLeft"
        ? current - 1
        : event.key === "ArrowRight"
          ? current + 1
          : event.key === "Home"
            ? 0
            : event.key === "End"
              ? last
              : null;
    if (next === null) return;
    event.preventDefault();
    setActive(Math.min(last, Math.max(0, next)));
  }

  const shown = active !== null ? points[active] : undefined;
  const latest = points[last];
  const describe = (p: Point) => `${formatDate(p.date)}: ${p.atsScore}`;

  return (
    <figure className="grid gap-3">
      <div
        ref={box}
        role="group"
        tabIndex={0}
        aria-label={`ATS score over your last ${points.length} scans. Use the arrow keys to read each score.`}
        aria-describedby={`${id}-readout`}
        onPointerMove={(event) => nearest(event.clientX)}
        onPointerDown={(event) => nearest(event.clientX)}
        onPointerLeave={() => setActive(null)}
        onFocus={() => setActive((current) => current ?? last)}
        onBlur={() => setActive(null)}
        onKeyDown={onKeyDown}
        className="relative touch-pan-y rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        style={{ height: HEIGHT }}
      >
        {width > 0 && latest ? (
          // 100% wide so the chart never pushes its card wider, even for the moment
          // between a resize and the next measurement.
          <svg
            width="100%"
            height={HEIGHT}
            viewBox={`0 0 ${width} ${HEIGHT}`}
            preserveAspectRatio="none"
            aria-hidden="true"
            className="block"
          >
            <line
              x1={PAD.left}
              x2={width - PAD.right}
              y1={baseline}
              y2={baseline}
              stroke="var(--border)"
              strokeWidth={1}
            />
            <path d={area} fill="var(--navy)" fillOpacity={0.1} />
            <path
              d={line}
              fill="none"
              stroke="var(--navy)"
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
            {shown ? (
              <line
                x1={x(active!)}
                x2={x(active!)}
                y1={PAD.top - 6}
                y2={baseline}
                stroke="var(--border-strong)"
                strokeWidth={1}
              />
            ) : null}
            {/* The latest point carries the marker and the only direct label. */}
            <circle
              cx={x(last)}
              cy={y(latest.atsScore)}
              r={4}
              fill="var(--navy)"
              stroke="var(--background)"
              strokeWidth={2}
            />
            <text
              x={x(last) + 9}
              y={y(latest.atsScore) + 4}
              fill="var(--foreground)"
              fontSize={12}
              fontWeight={500}
              style={{ fontVariantNumeric: "tabular-nums" }}
            >
              {latest.atsScore}
            </text>
            {shown && active !== last ? (
              <circle
                cx={x(active!)}
                cy={y(shown.atsScore)}
                r={4}
                fill="var(--navy)"
                stroke="var(--background)"
                strokeWidth={2}
              />
            ) : null}
          </svg>
        ) : null}

        {shown ? (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute top-0 w-24 rounded-md border border-border bg-background px-2.5 py-1.5 text-xs shadow-card"
            // Beside the crosshair, on the side with room, so it never hides the point.
            style={{
              left:
                x(active!) + TOOLTIP_GAP + TOOLTIP_WIDTH <= width
                  ? x(active!) + TOOLTIP_GAP
                  : Math.max(0, x(active!) - TOOLTIP_GAP - TOOLTIP_WIDTH),
            }}
          >
            <span className="block text-sm font-medium text-foreground tabular-nums">
              {shown.atsScore}
            </span>
            <span className="block text-subtle">{formatDate(shown.date)}</span>
          </div>
        ) : null}
        <p id={`${id}-readout`} role="status" className="sr-only">
          {shown ? describe(shown) : ""}
        </p>
      </div>

      <details className="group text-sm">
        <summary className="w-fit cursor-pointer rounded-sm text-xs text-subtle outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring">
          Show as table
        </summary>
        <table className="mt-3 w-full text-left text-sm">
          <caption className="sr-only">ATS score by scan date</caption>
          <thead>
            <tr className="text-xs text-subtle">
              <th scope="col" className="pb-1 font-normal">
                Scanned
              </th>
              <th scope="col" className="pb-1 text-right font-normal">
                ATS score
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {points.map((p, i) => (
              <tr key={`${p.date}-${i}`}>
                <td className="py-1.5 text-body">{formatDate(p.date)}</td>
                <td className="py-1.5 text-right text-foreground tabular-nums">
                  {p.atsScore}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}
