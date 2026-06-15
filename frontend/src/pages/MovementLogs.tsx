import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { Search, Download, Info, AlertTriangle, Clock, ArrowRight, Filter as FilterIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ConfidenceBadge, getConfidenceLevel } from "@/components/ConfidenceBadge";
import { EmptyState } from "@/components/EmptyState";
import { Skeleton } from "@/components/ui/skeleton";
import { useRole } from "@/contexts/RoleContext";
import api, { BASE_URL } from "@/lib/api";
import { QUERY_KEYS } from "@/lib/queryKeys";
import { formatDateTime } from "@/lib/utils";

interface LogEntry {
  id: number;
  emp_code: string;
  emp_name: string;
  camera_name: string;
  timestamp: string;
  direction: "IN" | "OUT";
  confidence: number;
  flag: string | null;
  image_url: string | null;
}

export default function MovementLogs() {
  const [searchParams] = useSearchParams();
  const [search, setSearch] = useState("");

  // Sync global search from URL
  useEffect(() => {
    const query = searchParams.get("search");
    if (query !== null) setSearch(query);
  }, [searchParams]);

  const [date, setDate] = useState("");
  const [camera, setCamera] = useState("all");
  const [direction, setDirection] = useState("all");
  const [page, setPage] = useState(1);
  const [selectedEmployee, setSelectedEmployee] = useState<string | null>(null);
  const { canExport } = useRole();

  const params = { search, date, camera: camera !== "all" ? camera : "", direction: direction !== "all" ? direction : "", page, page_size: 20 };

  const { data: logsData, isLoading: logsLoading } = useQuery({
    queryKey: QUERY_KEYS.movementLogs(params),
    queryFn: () => api.get("/api/movement-logs", { params }).then((r) => r.data),
    placeholderData: (prev) => prev,
  });

  const { data: cameras = [], isLoading: camerasLoading } = useQuery({
    queryKey: ["cameras"],
    queryFn: () => api.get("/api/cameras").then((r) => r.data),
  });

  const { data: timeline = [], isLoading: timelineLoading } = useQuery<LogEntry[]>({
    queryKey: QUERY_KEYS.employeeTimeline(selectedEmployee ?? "", date),
    queryFn: () => api.get(`/api/movement-logs/timeline/${selectedEmployee}`, { params: { date } }).then((r) => r.data),
    enabled: !!selectedEmployee,
  });

  const logs: LogEntry[] = logsData?.data ?? [];
  const total: number = logsData?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / 20));

  const handleExport = () => {
    const url = `${BASE_URL}/api/movement-logs/export?date=${date}&camera=${camera !== "all" ? camera : ""}&direction=${direction !== "all" ? direction : ""}`;
    window.open(url, "_blank");
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Movement Logs</h1>
          <p className="text-sm text-muted-foreground">Track all employee movement events</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Clock className="h-3.5 w-3.5" />
            <span>Live Data</span>
          </div>
          {canExport && (
            <Button variant="outline" className="gap-1.5" onClick={handleExport}>
              <Download className="h-4 w-4" /> Export
            </Button>
          )}
        </div>
      </div>

      <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
        <FilterIcon className="h-3 w-3" />
        {logsLoading ? <Skeleton className="h-3 w-32" /> : <span>Showing {total} total entries</span>}
      </div>

      {/* Timeline */}
      {selectedEmployee && (timeline.length > 0 || timelineLoading) && (
        <Card className="glass-card">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-medium text-foreground">
                  Movement Timeline: {timelineLoading ? <Skeleton className="h-4 w-32 inline-block" /> : timeline[0]?.emp_name}
                </h3>
                {!timelineLoading && <Badge variant="outline" className="text-[10px]">{timeline[0]?.emp_code}</Badge>}
              </div>
              <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => setSelectedEmployee(null)}>Close</Button>
            </div>
            <div className="flex items-center gap-1 overflow-x-auto pb-2">
              {timelineLoading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="flex items-center shrink-0">
                    <Skeleton className="h-10 w-24 rounded-lg" />
                    {i < 3 && <ArrowRight className="h-3.5 w-3.5 text-muted-foreground mx-1 shrink-0" />}
                  </div>
                ))
              ) : (
                timeline.map((t, i) => (
                  <div key={t.id} className="flex items-center shrink-0">
                    <div className="flex flex-col items-center">
                      <div className={`px-3 py-1.5 rounded-lg border text-xs font-medium ${t.direction === "IN" ? "bg-emerald-50 border-emerald-200 text-emerald-700" : "bg-red-50 border-red-200 text-red-600"}`}>
                        {t.camera_name}
                      </div>
                      <span className="text-[9px] text-muted-foreground mt-1">{formatDateTime(t.timestamp).split(" ")[1]?.slice(0, 5)} · {t.direction}</span>
                    </div>
                    {i < timeline.length - 1 && <ArrowRight className="h-3.5 w-3.5 text-muted-foreground mx-1 shrink-0" />}
                  </div>
                ))
              )}
            </div>
            {!timelineLoading && <p className="text-[10px] text-muted-foreground mt-2">Route: {timeline.map((t) => t.camera_name).join(" → ")}</p>}
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <Card className="glass-card sticky top-14 z-20">
        <CardContent className="p-3 flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input placeholder="Search logs..." className="pl-8 h-8 text-sm" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
          </div>
          <Input type="date" className="h-8 w-40 text-sm" value={date} onChange={(e) => { setDate(e.target.value); setPage(1); }} />
          <Select value={camera} onValueChange={(v) => { setCamera(v); setPage(1); }}>
            <SelectTrigger className="h-8 w-40 text-sm"><SelectValue placeholder="All Cameras" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Cameras</SelectItem>
              {cameras.map((c: any) => (
                <SelectItem key={c.id || c.name} value={c.name.toLowerCase()}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={direction} onValueChange={(v) => { setDirection(v); setPage(1); }}>
            <SelectTrigger className="h-8 w-32 text-sm"><SelectValue placeholder="Direction" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="in">IN</SelectItem>
              <SelectItem value="out">OUT</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <Card className="glass-card">
        <CardContent className="p-0">
          {logsLoading ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>#</TableHead>
                  <TableHead>Face</TableHead>
                  <TableHead>Employee</TableHead>
                  <TableHead>Emp Code</TableHead>
                  <TableHead>Camera</TableHead>
                  <TableHead>Timestamp</TableHead>
                  <TableHead>Direction</TableHead>
                  <TableHead>Confidence</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {Array.from({ length: 10 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-3 w-4" /></TableCell>
                    <TableCell><Skeleton className="h-10 w-10 rounded-md" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-3 w-16" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-3 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-16 rounded-full" /></TableCell>
                    <TableCell><Skeleton className="h-6 w-16 rounded-full" /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : logs.length === 0 ? (
            <EmptyState title="No movement logs found" description="Try adjusting your search or filters" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>#</TableHead>
                  <TableHead>Face</TableHead>
                  <TableHead>Employee</TableHead>
                  <TableHead>Emp Code</TableHead>
                  <TableHead>Camera</TableHead>
                  <TableHead>
                    <span className="flex items-center gap-1">
                      Timestamp
                      <Tooltip>
                        <TooltipTrigger asChild><Info className="h-3 w-3 text-muted-foreground cursor-help" /></TooltipTrigger>
                        <TooltipContent className="text-xs max-w-48">IN = first detection · OUT = last detection</TooltipContent>
                      </Tooltip>
                    </span>
                  </TableHead>
                  <TableHead>Direction</TableHead>
                  <TableHead>Confidence</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((l, i) => (
                  <TableRow
                    key={l.id}
                    className="cursor-pointer hover:bg-accent/40"
                    onClick={() => setSelectedEmployee(l.emp_code)}
                  >
                    <TableCell className="text-muted-foreground text-xs">{(page - 1) * 20 + i + 1}</TableCell>
                    <TableCell>
                      {l.image_url ? (
                        <div className="h-10 w-10 rounded-md overflow-hidden border border-border bg-muted flex items-center justify-center shrink-0">
                          <img
                            src={l.image_url.startsWith("http") ? l.image_url : `${BASE_URL}${l.image_url}`}
                            alt={l.emp_name}
                            className="h-full w-full object-cover"
                            loading="lazy"
                            onError={(e) => (e.currentTarget.style.display = "none")}
                          />
                        </div>
                      ) : (
                        <div className="h-10 w-10 rounded-md bg-muted flex items-center justify-center border border-dashed border-border shrink-0">
                          <Info className="h-4 w-4 text-muted-foreground/30" />
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="font-medium">{l.emp_name}</TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">{l.emp_code}</TableCell>
                    <TableCell className="text-muted-foreground">{l.camera_name}</TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">{formatDateTime(l.timestamp).slice(0, -3)}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={l.direction === "IN" ? "status-active" : "status-inactive"}>{l.direction}</Badge>
                    </TableCell>
                    <TableCell><ConfidenceBadge level={getConfidenceLevel(l.confidence)} score={l.confidence} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">Showing {logs.length} of {total} entries</p>
        <div className="flex items-center gap-1">
          <Button variant="outline" size="sm" className="h-7 text-xs" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</Button>
          {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => i + 1).map((p) => (
            <Button key={p} variant={p === page ? "default" : "outline"} size="sm" className="h-7 text-xs" onClick={() => setPage(p)}>{p}</Button>
          ))}
          <Button variant="outline" size="sm" className="h-7 text-xs" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>Next</Button>
        </div>
      </div>
    </div>
  );
}
