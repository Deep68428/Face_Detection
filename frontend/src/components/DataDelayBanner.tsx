import { AlertTriangle } from "lucide-react";

interface DataDelayBannerProps {
  delayMinutes?: number;
  threshold?: number;
}

export function DataDelayBanner({ delayMinutes = 0, threshold = 5 }: DataDelayBannerProps) {
  if (delayMinutes <= threshold) return null;

  return (
    <div className="flex items-center gap-2 rounded-lg border border-warning/30 bg-warning/10 px-4 py-2.5 text-sm">
      <AlertTriangle className="h-4 w-4 text-warning shrink-0" />
      <span className="text-black text-xs font-medium">
        Data may be delayed by ~{delayMinutes} min due to processing backlog
      </span>
    </div>
  );
}
