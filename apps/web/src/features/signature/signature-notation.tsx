import type { Signature } from "@drum-tutor/contracts";
import { cn } from "cn";
import type { ReactElement } from "react";
import { layoutSignatureV1, type NotationLayout } from "./notation-layout";

/** What the practice panel wants the notation to show on top of the static drawing (ADR-0054). */
export type NotationVisual =
  | { kind: "static" }
  | { kind: "count-in"; number: number }
  | { kind: "playing"; beat: number | null };

const STATIC: NotationVisual = { kind: "static" };

/** Drum staff for a lesson's signature, shared by the lesson page and the admin preview (ADR-0052). */
export function SignatureNotation({
  signature,
  visual = STATIC,
  className,
}: {
  signature: Signature;
  visual?: NotationVisual;
  className?: string;
}): ReactElement {
  // Every format version needs its own branch: the return type makes a missing one a type error.
  switch (signature.version) {
    case "v1":
      return <Staff layout={layoutSignatureV1(signature)} visual={visual} className={className} />;
  }
}

function Staff({
  layout,
  visual,
  className,
}: {
  layout: NotationLayout;
  visual: NotationVisual;
  className?: string;
}) {
  const top = layout.staffLines[0] as number;
  const bottom = layout.staffLines[4] as number;
  const beat = visual.kind === "playing" ? visual.beat : null;
  const highlight = beat === null ? null : layout.highlights[beat];

  return (
    <div className={cn("relative", className)}>
      <svg
        viewBox={`0 0 ${layout.width} ${layout.height}`}
        className={cn(
          "block h-auto w-full text-foreground transition-[opacity,filter]",
          visual.kind === "count-in" && "opacity-35 grayscale",
        )}
        role="img"
        aria-label="Drum notation: one bar of 4/4"
        data-beat={beat === null ? undefined : beat + 1}
      >
        {highlight && (
          <g className="text-beat">
            <rect {...highlight} rx={6} fill="currentColor" opacity={0.18} />
            <line
              x1={highlight.x + highlight.width / 2}
              x2={highlight.x + highlight.width / 2}
              y1={highlight.y}
              y2={highlight.y + highlight.height}
              stroke="currentColor"
              strokeWidth={3}
            />
          </g>
        )}

        {layout.staffLines.map((y) => (
          <line
            key={y}
            x1={layout.staffLeft}
            x2={layout.staffRight}
            y1={y}
            y2={y}
            stroke="currentColor"
          />
        ))}
        <line
          x1={layout.staffRight}
          x2={layout.staffRight}
          y1={top}
          y2={bottom}
          stroke="currentColor"
          strokeWidth={2}
        />
        {layout.clefBars.map((bar) => (
          <rect key={bar.x} {...bar} fill="currentColor" />
        ))}
        {layout.timeSignature.map((t) => (
          <text
            key={t.y}
            x={t.x}
            y={t.y}
            textAnchor="middle"
            fontFamily="Georgia, serif"
            fontWeight={700}
            fontSize={22}
            fill="currentColor"
          >
            {t.text}
          </text>
        ))}

        {layout.noteheads.map((n) =>
          n.shape === "x" ? (
            <g key={`${n.x}-${n.instrument}`} stroke="currentColor" strokeWidth={2}>
              <line x1={n.x - 5} y1={n.y - 5} x2={n.x + 5} y2={n.y + 5} />
              <line x1={n.x - 5} y1={n.y + 5} x2={n.x + 5} y2={n.y - 5} />
            </g>
          ) : (
            <ellipse
              key={`${n.x}-${n.instrument}`}
              cx={n.x}
              cy={n.y}
              rx={6.5}
              ry={4.8}
              transform={`rotate(-20 ${n.x} ${n.y})`}
              fill="currentColor"
            />
          ),
        )}
        {layout.stems.map((s) => (
          <line
            key={s.x}
            x1={s.x}
            x2={s.x}
            y1={s.yBottom}
            y2={s.yTop}
            stroke="currentColor"
            strokeWidth={1.5}
          />
        ))}
        {layout.beams.map((b) => (
          <rect
            key={b.x1}
            x={b.x1 - 0.75}
            y={b.y}
            width={b.x2 - b.x1 + 1.5}
            height={5}
            fill="currentColor"
          />
        ))}
        {layout.flags.map((f) => (
          <path
            key={f.x}
            d={`M${f.x} ${f.y} q 9 7 8 20`}
            stroke="currentColor"
            strokeWidth={2.5}
            fill="none"
          />
        ))}
        {layout.rests.map((r) =>
          r.kind === "eighth" ? (
            <g key={r.x} fill="currentColor" stroke="currentColor">
              <circle cx={r.x - 3} cy={r.y - 6} r={3} stroke="none" />
              <path d={`M${r.x - 3} ${r.y - 4} q 5 3 8 -3 l -6 18`} strokeWidth={1.6} fill="none" />
            </g>
          ) : (
            <path
              key={r.x}
              d={`M${r.x - 3} ${r.y - 15} l 6 7 l -5 6 l 6 7 q -7 -3 -6 5`}
              stroke="currentColor"
              strokeWidth={2.5}
              strokeLinejoin="round"
              fill="none"
            />
          ),
        )}

        {layout.comments.map((c) => (
          <text
            key={c.x}
            x={c.x}
            y={c.y}
            textAnchor="middle"
            fontSize={14}
            fontWeight={600}
            fill="currentColor"
          >
            {c.text}
          </text>
        ))}
        <g className="text-muted-foreground">
          {layout.counts.map((c) => (
            <text key={c.x} x={c.x} y={c.y} textAnchor="middle" fontSize={11} fill="currentColor">
              {c.text}
            </text>
          ))}
        </g>
      </svg>

      {visual.kind === "count-in" && (
        <div className="absolute inset-0 flex items-center justify-center">
          <span
            data-testid="count-in-number"
            className="rounded-xl bg-background/80 px-7 py-2 text-6xl font-bold tabular-nums shadow-md"
          >
            {visual.number}
          </span>
        </div>
      )}
    </div>
  );
}
