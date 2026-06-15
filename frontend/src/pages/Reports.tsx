import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { FileSpreadsheet, FileText, Filter, Info, Clock, AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer } from "recharts";
import { ConfidenceBadge, getConfidenceLevel } from "@/components/ConfidenceBadge";
import { Skeleton } from "@/components/ui/skeleton";
import { useRole } from "@/contexts/RoleContext";
import api, { BASE_URL } from "@/lib/api";
import { QUERY_KEYS } from "@/lib/queryKeys";

const today = new Date();
const formatDate = (d: Date) => d.toISOString().split("T")[0];
const thirtyDaysAgo = new Date(today); thirtyDaysAgo.setDate(today.getDate() - 30);

export default function Reports() {
  const [dateFrom, setDateFrom] = useState(formatDate(thirtyDaysAgo));
  const [dateTo, setDateTo] = useState(formatDate(today));
  const [camera, setCamera] = useState("all");
  const [empCode, setEmpCode] = useState("all");
  const { canExport } = useRole();

  const reportParams = { date_from: dateFrom, date_to: dateTo, camera: camera !== "all" ? camera : "", emp_code: empCode !== "all" ? empCode : "" };

  const { data: employeeReport = [], isLoading: empLoading } = useQuery({
    queryKey: QUERY_KEYS.employeeReport(reportParams),
    queryFn: () => api.get("/api/reports/employee", { params: reportParams }).then((r) => r.data),
  });

  const { data: cameraReport = [], isLoading: camLoading } = useQuery({
    queryKey: QUERY_KEYS.cameraReport({ date_from: dateFrom, date_to: dateTo }),
    queryFn: () => api.get("/api/reports/camera", { params: { date_from: dateFrom, date_to: dateTo } }).then((r) => r.data),
  });

  const { data: timeData = [], isLoading: timeLoading } = useQuery({
    queryKey: QUERY_KEYS.timeSpentReport,
    queryFn: () => api.get("/api/reports/time-spent").then((r) => r.data),
  });

  const { data: failedSummary, isLoading: failedLoading } = useQuery({
    queryKey: QUERY_KEYS.reportFailedSummary({ date_from: dateFrom, date_to: dateTo }),
    queryFn: () => api.get("/api/reports/failed-summary", { params: { date_from: dateFrom, date_to: dateTo } }).then((r) => r.data),
  });

  const { data: cameras = [] } = useQuery({
    queryKey: QUERY_KEYS.cameras(""),
    queryFn: () => api.get("/api/cameras").then((r) => r.data),
  });

  const { data: employees = [] } = useQuery({
    queryKey: QUERY_KEYS.employees(""),
    queryFn: () => api.get("/api/employees").then((r) => r.data),
  });

  const handleExport = (format: "excel" | "pdf") => {
    const params = new URLSearchParams({
      date_from: dateFrom,
      date_to: dateTo,
      camera: camera !== "all" ? camera : "",
      emp_code: empCode !== "all" ? empCode : ""
    });
    const baseUrl = BASE_URL;
    const url = `${baseUrl}/api/reports/export/${format}?${params.toString()}`;
    window.open(url, "_blank");
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Reports</h1>
          <p className="text-sm text-muted-foreground">Generate and export analytics reports</p>
        </div>
        <div className="flex items-center gap-2">
          {canExport && (
            <>
              <Button variant="outline" className="gap-1.5 text-sm" onClick={() => handleExport("excel")}><FileSpreadsheet className="h-4 w-4" /> Excel</Button>
              <Button variant="outline" className="gap-1.5 text-sm" onClick={() => handleExport("pdf")}><FileText className="h-4 w-4" /> PDF</Button>
            </>
          )}
        </div>
      </div>

      {/* Meta bar */}
      <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
        <div className="flex items-center gap-1.5"><Clock className="h-3.5 w-3.5" /><span>Live Data · {dateFrom} to {dateTo}</span></div>
      </div>

      {/* Filters */}
      <Card className="glass-card sticky top-14 z-20">
        <CardContent className="p-3 flex flex-wrap items-center gap-3">
          <Input type="date" className="h-8 w-40 text-sm" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
          <span className="text-xs text-muted-foreground">to</span>
          <Input type="date" className="h-8 w-40 text-sm" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
          <Select value={camera} onValueChange={setCamera}>
            <SelectTrigger className="h-8 w-40 text-sm"><SelectValue placeholder="All Cameras" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Cameras</SelectItem>
              {cameras.map((c: any) => (
                <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={empCode} onValueChange={setEmpCode}>
            <SelectTrigger className="h-8 w-44 text-sm"><SelectValue placeholder="All Employees" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Employees</SelectItem>
              {employees.map((e: any) => (
                <SelectItem key={e.code} value={e.name}>{e.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Failed recognition summary */}
      <div className="flex items-center gap-2 rounded-lg border border-destructive/20 bg-destructive/5 px-4 py-2 text-xs">
        <AlertTriangle className="h-3.5 w-3.5 text-destructive shrink-0" />
        {failedLoading ? (
          <Skeleton className="h-4 w-48" />
        ) : (
          <span className="text-foreground">
            <strong>{failedSummary?.failed_detections ?? 0} failed detections</strong> and{" "}
            <strong>{failedSummary?.low_confidence ?? 0} low-confidence matches</strong> in this period
          </span>
        )}
      </div>

      <Tabs defaultValue="employee">
        <TabsList>
          <TabsTrigger value="employee">Employee-wise</TabsTrigger>
          <TabsTrigger value="camera">Camera-wise</TabsTrigger>
          <TabsTrigger value="time">Time Spent</TabsTrigger>
        </TabsList>

        <TabsContent value="employee" className="mt-4">
          <Card className="glass-card">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead>Code</TableHead>
                    <TableHead>Total Movements</TableHead>
                    <TableHead>Avg Time/Day</TableHead>
                    <TableHead>Late Arrivals</TableHead>
                    <TableHead>Confidence</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {empLoading ? (
                    Array.from({ length: 5 }).map((_, i) => (
                      <TableRow key={i}>
                        <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                        <TableCell><Skeleton className="h-3 w-16" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-8" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-8" /></TableCell>
                        <TableCell><Skeleton className="h-6 w-16 rounded-full" /></TableCell>
                      </TableRow>
                    ))
                  ) : employeeReport.length === 0 ? (
                    <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No data for selected period</TableCell></TableRow>
                  ) : (
                    employeeReport.map((r: any) => (
                      <TableRow key={r.code}>
                        <TableCell className="font-medium">{r.name}</TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground">{r.code}</TableCell>
                        <TableCell>{r.total_movements}</TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-medium text-foreground">{r.avg_time}</span>
                            {r.first_in && (
                              <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                                <Clock className="h-2.5 w-2.5" /> {r.first_in}
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell><span className={r.late_arrivals > 0 ? "text-destructive font-medium" : "text-muted-foreground"}>{r.late_arrivals}</span></TableCell>
                        <TableCell><ConfidenceBadge level={getConfidenceLevel(r.confidence)} score={r.confidence} /></TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="camera" className="mt-4">
          <Card className="glass-card">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Camera</TableHead>
                    <TableHead>Total Detections</TableHead>
                    <TableHead>Avg Daily</TableHead>
                    <TableHead>Peak Hour</TableHead>
                    <TableHead>Failed</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {camLoading ? (
                    Array.from({ length: 4 }).map((_, i) => (
                      <TableRow key={i}>
                        <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-12" /></TableCell>
                        <TableCell><Skeleton className="h-3 w-16" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-8" /></TableCell>
                      </TableRow>
                    ))
                  ) : cameraReport.length === 0 ? (
                    <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No data for selected period</TableCell></TableRow>
                  ) : (
                    cameraReport.map((r: any) => (
                      <TableRow key={r.camera}>
                        <TableCell className="font-medium">{r.camera}</TableCell>
                        <TableCell>{r.total_detections?.toLocaleString()}</TableCell>
                        <TableCell className="text-muted-foreground">{r.avg_daily}</TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground">{r.peak_hour}</TableCell>
                        <TableCell>
                          {r.failed_detections > 10
                            ? <span className="text-destructive font-medium text-xs">{r.failed_detections}</span>
                            : <span className="text-muted-foreground text-xs">{r.failed_detections}</span>
                          }
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="time" className="mt-4">
          <Card className="glass-card">
            <CardHeader><CardTitle className="text-sm font-medium">Average Hours per Day (This Week)</CardTitle></CardHeader>
            <CardContent>
              <div className="h-64">
                {timeLoading ? (
                  <Skeleton className="h-full w-full rounded-lg" />
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={timeData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(240,6%,90%)" />
                      <XAxis dataKey="name" tick={{ fontSize: 12 }} stroke="hsl(228,10%,46%)" />
                      <YAxis tick={{ fontSize: 12 }} stroke="hsl(228,10%,46%)" />
                      <RechartsTooltip contentStyle={{ background: "hsl(0,0%,100%)", border: "1px solid hsl(240,6%,90%)", borderRadius: 8, fontSize: 12 }} />
                      <Bar dataKey="hours" fill="hsl(243,100%,75%)" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
