import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Users, Camera, UserCheck, AlertTriangle, ArrowUpRight, ArrowDownRight, Wifi, WifiOff, Clock, User } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar,
} from "recharts";
import { DataDelayBanner } from "@/components/DataDelayBanner";
import { Skeleton } from "@/components/ui/skeleton";
import api, { BASE_URL } from "@/lib/api";
import { QUERY_KEYS } from "@/lib/queryKeys";
import { formatDateTime } from "@/lib/utils";

// ─── Fetchers ────────────────────────────────────────────────────────────────
const fetchStats = () => api.get("/api/dashboard/stats").then((r) => r.data);
const fetchMovementTrends = () => api.get("/api/dashboard/movement-trends").then((r) => r.data);
const fetchCameraActivity = () => api.get("/api/dashboard/camera-activity").then((r) => r.data);
const fetchCameraFeeds = () => api.get("/api/dashboard/camera-feeds").then((r) => r.data);
const fetchFailed = () => api.get("/api/dashboard/failed-detections").then((r) => r.data);
const fetchRecentDetections = () => api.get("/api/dashboard/recent-detections").then((r) => r.data);
const fetchPresentList = () => api.get("/api/dashboard/present-list").then((r) => r.data);

// ─── Sub-components ──────────────────────────────────────────────────────────
type CameraStatus = "active" | "inactive" | "error";

function CameraStatusDot({ status }: { status: CameraStatus }) {
  if (status === "active") return <span className="absolute top-1.5 left-1.5 h-2 w-2 rounded-full bg-success animate-pulse-subtle" />;
  if (status === "error") return <span className="absolute top-1.5 left-1.5 h-2 w-2 rounded-full bg-destructive animate-pulse" />;
  return <span className="absolute top-1.5 left-1.5 h-2 w-2 rounded-full bg-muted-foreground" />;
}

function CameraStatusLabel({ status }: { status: CameraStatus }) {
  if (status === "active") return null;
  if (status === "error") return (
    <Badge variant="outline" className="absolute bottom-1 right-1 text-[8px] status-error py-0 px-1">Error</Badge>
  );
  return (
    <Badge variant="outline" className="absolute bottom-1 right-1 text-[8px] status-inactive py-0 px-1">Offline</Badge>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────
export default function Dashboard() {
  const { data: stats, isLoading: statsLoading } = useQuery({ queryKey: QUERY_KEYS.dashboardStats, queryFn: fetchStats, refetchInterval: 30000 });
  const { data: movementData = [], isLoading: trendsLoading } = useQuery({ queryKey: QUERY_KEYS.movementTrends, queryFn: fetchMovementTrends, refetchInterval: 60000 });
  const { data: cameraActivity = [], isLoading: activityLoading } = useQuery({ queryKey: QUERY_KEYS.cameraActivity, queryFn: fetchCameraActivity, refetchInterval: 60000 });
  const { data: cameraFeeds = [], isLoading: feedsLoading } = useQuery({ queryKey: QUERY_KEYS.cameraFeeds, queryFn: fetchCameraFeeds, refetchInterval: 30000 });
  const { data: failed, isLoading: failedLoading } = useQuery({ queryKey: QUERY_KEYS.failedDetections, queryFn: fetchFailed, refetchInterval: 60000 });
  const { data: recentDetections = [], isLoading: recentLoading } = useQuery({ queryKey: ["recentDetections"], queryFn: fetchRecentDetections, refetchInterval: 5000 });

  const [showPresentDialog, setShowPresentDialog] = useState(false);
  const { data: presentList = [], isLoading: presentListLoading } = useQuery({
    queryKey: ["presentList"],
    queryFn: fetchPresentList,
    enabled: showPresentDialog
  });

  const statCards = [
    {
      label: "Total Employees",
      value: stats?.total_employees?.value?.toLocaleString() ?? "—",
      change: stats?.total_employees?.trend ?? "",
      up: true,
      icon: Users,
      loading: statsLoading
    },
    {
      label: "Active Cameras",
      value: stats?.active_cameras?.value ?? "—",
      change: stats?.active_cameras?.trend ?? "",
      up: (stats?.active_cameras?.offline ?? 0) === 0,
      icon: Camera,
      loading: statsLoading
    },
    {
      label: "Present Today",
      value: stats?.present_today?.value?.toLocaleString() ?? "—",
      change: stats?.present_today?.trend ?? "",
      up: true,
      icon: UserCheck,
      loading: statsLoading,
      clickable: true
    },
    {
      label: "Unknown Faces",
      value: stats?.unknown_faces?.value ?? "—",
      change: stats?.unknown_faces?.trend ?? "",
      up: false,
      icon: AlertTriangle,
      loading: statsLoading
    },
  ];

  const onlineCount = cameraFeeds.filter((f: { status: string }) => f.status === "active").length;
  const offlineCount = cameraFeeds.filter((f: { status: string }) => f.status !== "active").length;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Dashboard</h1>
          <p className="text-sm text-muted-foreground">Real-time employee movement analytics</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <Clock className="h-3 w-3" />
            <span>Last Updated: {new Intl.DateTimeFormat('en-GB', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date()).replace(',', '')}</span>
          </div>
          <Badge variant="outline" className="text-xs font-normal border-success/30 text-success gap-1 bg-success/5">
            <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse-subtle" />
            Live
          </Badge>
        </div>
      </div>

      <DataDelayBanner delayMinutes={stats?.processing_delay ?? 0} threshold={5} />

      {/* Failed recognition summary */}
      <div className="flex items-center gap-2 rounded-lg border border-destructive/20 bg-destructive/5 px-4 py-2 text-xs">
        <AlertTriangle className="h-3.5 w-3.5 text-destructive shrink-0" />
        {failedLoading ? (
          <Skeleton className="h-4 w-48" />
        ) : (
          <span className="text-foreground">
            <strong>{failed?.failed_detections ?? 0} failed detections</strong> and{" "}
            <strong>{failed?.low_confidence ?? 0} low-confidence matches</strong> in the last hour
          </span>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((s) => (
          <Card
            key={s.label}
            className={`glass-card transition-all ${s.clickable ? "cursor-pointer hover:border-primary/40 hover:bg-primary/[0.02]" : ""}`}
            onClick={() => s.clickable && setShowPresentDialog(true)}
          >
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">{s.label}</p>
                  {s.loading ? (
                    <Skeleton className="h-8 w-16" />
                  ) : (
                    <p className="text-2xl font-bold text-foreground mt-1">{s.value}</p>
                  )}
                </div>
                <div className="h-9 w-9 rounded-lg bg-accent flex items-center justify-center">
                  <s.icon className="h-4 w-4 text-accent-foreground" />
                </div>
              </div>
              {s.change && !s.loading && (
                <div className="mt-3 flex items-center gap-1 text-xs font-medium">
                  {!s.clickable && (
                    s.up ? <ArrowUpRight className="h-3 w-3 text-success" /> : <ArrowDownRight className="h-3 w-3 text-destructive" />
                  )}
                  <span className={s.clickable ? "text-muted-foreground" : s.up ? "text-success" : "text-destructive"}>
                    {s.change}
                  </span>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Section 1: Data Analytics (Trends + Volume) */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* Main Trends Graph (3/4) */}
        <Card className="glass-card lg:col-span-3">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Movement Trends (Today)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-72">
              {trendsLoading ? (
                <Skeleton className="h-full w-full rounded-lg" />
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={movementData}>
                    <defs>
                      <linearGradient id="entryGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(243,100%,75%)" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="hsl(243,100%,75%)" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="exitGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(152,60%,45%)" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="hsl(152,60%,45%)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(240,6%,90%)" />
                    <XAxis dataKey="time" tick={{ fontSize: 11 }} stroke="hsl(228,10%,46%)" />
                    <YAxis tick={{ fontSize: 11 }} stroke="hsl(228,10%,46%)" />
                    <Tooltip contentStyle={{ background: "hsl(0,0%,100%)", border: "1px solid hsl(240,6%,90%)", borderRadius: 8, fontSize: 12 }} />
                    <Area type="monotone" dataKey="entries" stroke="hsl(243,100%,75%)" fill="url(#entryGrad)" strokeWidth={2} />
                    <Area type="monotone" dataKey="exits" stroke="hsl(152,60%,45%)" fill="url(#exitGrad)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Camera Activity Bar Chart - SIDEBAR (1/4) */}
        <Card className="glass-card lg:col-span-1">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium">Camera Volume</CardTitle>
              <Badge variant="secondary" className="text-[10px] font-normal px-1.5 h-4">Today</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-72">
              {activityLoading ? (
                <div className="space-y-4">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div key={i} className="flex flex-col gap-1">
                      <Skeleton className="h-2 w-12" />
                      <Skeleton className="h-4 w-full" />
                    </div>
                  ))}
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={cameraActivity} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(240,6%,90%)" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 10 }} stroke="hsl(228,10%,46%)" />
                    <YAxis dataKey="camera" type="category" tick={{ fontSize: 10 }} stroke="hsl(228,10%,46%)" width={70} />
                    <Tooltip contentStyle={{ background: "hsl(0,0%,100%)", border: "1px solid hsl(240,6%,90%)", borderRadius: 8, fontSize: 12 }} />
                    <Bar dataKey="activity" fill="hsl(243,100%,75%)" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Section 2: Real-time Monitoring (Camera Feeds + Recent Entries) */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* Camera Deployment Grid (3/4) */}
        <Card className="glass-card lg:col-span-3 h-full">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium">Camera Deployment Status</CardTitle>
              <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                <span className="flex items-center gap-1"><Wifi className="h-3 w-3 text-emerald-600" /> {onlineCount} Online</span>
                <span className="flex items-center gap-1"><WifiOff className="h-3 w-3 text-destructive" /> {offlineCount} Issues</span>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
              {feedsLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="rounded-lg border border-border bg-muted/50 overflow-hidden">
                    <Skeleton className="aspect-video w-full" />
                    <div className="p-2 space-y-1">
                      <Skeleton className="h-3 w-2/3" />
                      <Skeleton className="h-2 w-1/2" />
                    </div>
                  </div>
                ))
              ) : (
                cameraFeeds.map((f: { name: string; status: CameraStatus; people: number; last_image_url?: string }) => (
                  <div
                    key={f.name}
                    className={`rounded-lg border overflow-hidden ${f.status === "error" ? "border-destructive/30" : "border-border"} bg-muted/50`}
                  >
                    <div className="aspect-video bg-foreground/5 flex items-center justify-center relative">
                      {f.last_image_url ? (
                        <img
                          src={f.last_image_url.startsWith("http") ? f.last_image_url : `${BASE_URL}${f.last_image_url}`}
                          className="h-full w-full object-cover opacity-80"
                          loading="lazy"
                          onError={(e) => (e.currentTarget.style.display = "none")}
                          alt="Last detection"
                        />
                      ) : (
                        <Camera className="h-6 w-6 text-muted-foreground/40" />
                      )}
                      <CameraStatusDot status={f.status} />
                      <CameraStatusLabel status={f.status} />
                    </div>
                    <div className="p-2">
                      <p className="text-[10px] font-medium text-foreground truncate">{f.name}</p>
                      <p className="text-[9px] text-muted-foreground">{f.people} today</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        {/* Recent Entries - SIDEBAR (1/4) */}
        <Card className="glass-card lg:col-span-1 flex flex-col">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium">Recent Entries (IN)</CardTitle>
              <Badge variant="secondary" className="text-[10px] font-normal px-1.5 h-4">Live</Badge>
            </div>
          </CardHeader>
          <CardContent className="flex-1 overflow-hidden pointer-events-auto">
            <div className="h-[210px] overflow-y-auto pr-2 custom-scrollbar space-y-3">
              {recentLoading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3 p-2 rounded-lg bg-muted/30 border border-border/50">
                    <Skeleton className="h-8 w-8 rounded-md shrink-0" />
                    <div className="flex-1 space-y-1">
                      <Skeleton className="h-3 w-full" />
                      <Skeleton className="h-2 w-1/2" />
                    </div>
                  </div>
                ))
              ) : recentDetections.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-muted-foreground opacity-40 py-10">
                  <UserCheck className="h-6 w-6 mb-1" />
                  <p className="text-[10px]">No recent entries</p>
                </div>
              ) : (
                recentDetections.map((d: any) => (
                  <div key={d.id} className="flex items-center gap-3 p-2 rounded-lg bg-muted/30 border border-border/50 hover:bg-muted/50 transition-colors">
                    <div className="h-8 w-8 rounded-md overflow-hidden bg-accent shrink-0">
                      {d.image_url ? (
                        <img
                          src={d.image_url.startsWith("http") ? d.image_url : `${BASE_URL}${d.image_url}`}
                          className="h-full w-full object-cover"
                          loading="lazy"
                          alt={d.name}
                        />
                      ) : (
                        <div className="h-full w-full flex items-center justify-center text-[9px] font-bold text-accent-foreground">
                          {d.name.split(" ").map((n: string) => n[0]).join("")}
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[12px] font-semibold text-foreground truncate">{d.name}</p>
                      <div className="flex items-center justify-between mt-0.5">
                        <span className="text-[9px] text-muted-foreground truncate">{d.camera}</span>
                        <span className="text-[9px] font-mono text-muted-foreground">{formatDateTime(d.timestamp).split(" ")[1]?.slice(0, 5)}</span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Dialog open={showPresentDialog} onOpenChange={setShowPresentDialog}>
        <DialogContent className="max-w-md max-h-[80vh] overflow-hidden flex flex-col p-0">
          <DialogHeader className="p-6 pb-2">
            <DialogTitle className="flex items-center gap-2">
              <UserCheck className="h-5 w-5 text-success" />
              Employees Present Today
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto p-6 pt-2 space-y-2">
            {presentListLoading ? (
              Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full rounded-lg" />)
            ) : presentList.length === 0 ? (
              <p className="text-center text-sm text-muted-foreground py-10">No employees logged yet today.</p>
            ) : (
              presentList.map((emp: any) => (
                <div key={emp.emp_code} className="flex items-center gap-3 p-3 rounded-lg border border-border bg-accent/5">
                  <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                    <User className="h-4 w-4 text-primary" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium">{emp.emp_name}</p>
                    <p className="text-[10px] text-muted-foreground uppercase">{emp.emp_code}</p>
                  </div>
                  <Badge variant="outline" className="status-active text-[10px]">IN</Badge>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
