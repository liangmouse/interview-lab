export type RadarDimensionKey =
  | "professional"
  | "confidence"
  | "expression"
  | "logic"
  | "adaptability";

interface RadarDimension {
  key: RadarDimensionKey;
  label: string;
  aliases: string[];
}

export const RADAR_DIMENSIONS: RadarDimension[] = [
  {
    key: "professional",
    label: "专业能力",
    aliases: ["professional", "technical", "技术能力", "专业能力"],
  },
  {
    key: "confidence",
    label: "自信",
    aliases: ["confidence", "self_confidence", "自信"],
  },
  {
    key: "expression",
    label: "语言表达",
    aliases: ["expression", "communication", "语言表达", "沟通表达"],
  },
  {
    key: "logic",
    label: "逻辑思维",
    aliases: ["logic", "logical", "problem_solving", "问题解决", "逻辑思维"],
  },
  {
    key: "adaptability",
    label: "应变能力",
    aliases: ["adaptability", "adaptation", "应变能力", "临场应变"],
  },
];

export type RawRadarScores = Record<string, number | null | undefined>;
export type NormalizedRadarScores = Record<RadarDimensionKey, number>;

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function normalizeSingleValue(value: number): number {
  // 大多数评分是 1-5 分制，统一换算到百分制。
  if (value <= 5) {
    return clampScore(value * 20);
  }
  return clampScore(value);
}

export function normalizeRadarScores(
  rawScores?: RawRadarScores | null,
): NormalizedRadarScores {
  const normalized: NormalizedRadarScores = {
    professional: 0,
    confidence: 0,
    expression: 0,
    logic: 0,
    adaptability: 0,
  };

  if (!rawScores) {
    return normalized;
  }

  const lookup = new Map<string, number>();
  Object.entries(rawScores).forEach(([key, value]) => {
    if (typeof value !== "number" || Number.isNaN(value)) return;
    lookup.set(key.trim().toLowerCase(), value);
  });

  for (const dimension of RADAR_DIMENSIONS) {
    const matchedAlias = dimension.aliases.find((alias) =>
      lookup.has(alias.toLowerCase()),
    );

    if (!matchedAlias) {
      continue;
    }

    const matchedValue = lookup.get(matchedAlias.toLowerCase());
    if (typeof matchedValue !== "number") {
      continue;
    }

    normalized[dimension.key] = normalizeSingleValue(matchedValue);
  }

  return normalized;
}

export function averageRadarScores(
  scoreList: Array<RawRadarScores | null | undefined>,
): NormalizedRadarScores {
  if (scoreList.length === 0) {
    return normalizeRadarScores({});
  }

  const sums: Record<RadarDimensionKey, number> = {
    professional: 0,
    confidence: 0,
    expression: 0,
    logic: 0,
    adaptability: 0,
  };

  scoreList.forEach((scoreItem) => {
    const normalized = normalizeRadarScores(scoreItem ?? {});
    (Object.keys(sums) as RadarDimensionKey[]).forEach((key) => {
      sums[key] += normalized[key];
    });
  });

  const count = scoreList.length;
  return {
    professional: clampScore(sums.professional / count),
    confidence: clampScore(sums.confidence / count),
    expression: clampScore(sums.expression / count),
    logic: clampScore(sums.logic / count),
    adaptability: clampScore(sums.adaptability / count),
  };
}

export function toRadarPolygonPoints(
  scores: number[],
  size = 180,
  padding = 20,
): string {
  if (!scores.length) {
    return "";
  }

  const center = size / 2;
  const radius = Math.max(1, size / 2 - padding);

  return scores
    .map((score, index) => {
      const safeScore = clampScore(score);
      const ratio = safeScore / 100;
      const angle = (Math.PI * 2 * index) / scores.length - Math.PI / 2;
      const x = center + Math.cos(angle) * radius * ratio;
      const y = center + Math.sin(angle) * radius * ratio;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
}
