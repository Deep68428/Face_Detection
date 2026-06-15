import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface ConfidenceBadgeProps {
  level: "high" | "medium" | "low";
  score?: number;
}

const config = {
  high: { label: "High", className: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  medium: { label: "Medium", className: "bg-amber-50 text-amber-700 border-amber-200" },
  low: { label: "Low", className: "bg-red-50 text-red-600 border-red-200" },
};

export function ConfidenceBadge({ level, score }: ConfidenceBadgeProps) {
  const c = config[level];
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge variant="outline" className={`text-[10px] cursor-help ${c.className}`}>
          {c.label} {score !== undefined && `(${score}%)`}
        </Badge>
      </TooltipTrigger>
      <TooltipContent side="top" className="text-xs max-w-52">
        <p className="font-medium mb-1">Data Confidence: {c.label}</p>
        <p className="text-muted-foreground">
          Based on recognition confidence, detection completeness, and data consistency.
        </p>
      </TooltipContent>
    </Tooltip>
  );
}

export function getConfidenceLevel(score: number): "high" | "medium" | "low" {
  if (score >= 85) return "high";
  if (score >= 70) return "medium";
  return "low";
}
