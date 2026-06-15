import { Loader2 } from "lucide-react";

const LoadingScreen = () => {
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background/80 backdrop-blur-sm transition-all duration-300">
      <div className="flex flex-col items-center gap-4 p-8 glass-card rounded-2xl animate-in fade-in zoom-in duration-500">
        <div className="relative">
          <Loader2 className="h-12 w-12 text-primary animate-spin" />
          <div className="absolute inset-0 h-12 w-12 border-4 border-primary/20 rounded-full" />
        </div>
        <div className="flex flex-col items-center gap-1">
          <h2 className="text-xl font-semibold text-foreground tracking-tight">AI Attendance</h2>
          <p className="text-sm text-muted-foreground animate-pulse">Initializing system components...</p>
        </div>
      </div>
    </div>
  );
};

export default LoadingScreen;
