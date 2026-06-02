import { useMemo } from "react";
import { buildSparkline } from "@/lib/evolution-utils";
import type { Tables } from "@/integrations/supabase/types";

interface Props {
  kr: Tables<"key_results"> & { expected_progress_mode?: string };
  cycle: Tables<"cycles">;
  checkins: any[];
}

export default function Sparkline({ kr, cycle, checkins }: Props) {
  const data = useMemo(() => buildSparkline(kr, cycle, checkins || []), [kr, cycle, checkins]);

  if (!data.length) return null;

  const maxBars = data.length;
  const barWidth = 6;
  const gap = 2;
  const height = 24;
  const width = maxBars * (barWidth + gap) - gap;

  return (
    <svg width={width} height={height} className="inline-block align-middle" aria-label="Evolução mensal">
      {data.map((v, i) => {
        const h = v != null ? Math.max(2, v * height) : 0;
        const noData = v == null;
        return (
          <rect
            key={i}
            x={i * (barWidth + gap)}
            y={height - h}
            width={barWidth}
            height={h || 2}
            rx={1}
            className={noData ? "fill-muted" : "fill-primary"}
            opacity={noData ? 0.3 : 0.8 + (v || 0) * 0.2}
          />
        );
      })}
    </svg>
  );
}
