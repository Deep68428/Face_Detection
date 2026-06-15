import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import {
  Search, Upload, Eye, UserCheck, UserX,
  AlertCircle, Loader2, Camera, Clock, Pencil,
  MapPin, Users
} from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell,
  TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader,
  DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import api, { BASE_URL } from "@/lib/api";
import { QUERY_KEYS } from "@/lib/queryKeys";
import { formatDateTime } from "@/lib/utils";

const departments = ["HR", "Admin", "General"];

interface Employee {
  code: string;
  name: string;
  department: string;
  face_status: "Mapped" | "Unmapped";
  avatar: string;
  movements_today: number;
  profile_image_url?: string;
}

interface DetectionImage {
  url: string;
  camera: string;
  timestamp: string;
  confidence: number;
}

// ── Employee View Dialog ─────────────────────────────────────────────────────
function EmployeeViewDialog({ employee }: { employee: Employee }) {
  const [open, setOpen] = useState(false);

  const { data: images = [], isLoading: imagesLoading } = useQuery<DetectionImage[]>({
    queryKey: ["employee-images", employee.code],
    queryFn: () =>
      api.get(`/api/employees/${employee.code}/images`).then((r) => r.data),
    enabled: open,
    staleTime: 30_000,
  });

  // Best image to show as profile — use the first detection image if no profile url
  const profileSrc =
    employee.profile_image_url
      ? employee.profile_image_url.startsWith("http") ? employee.profile_image_url : `${BASE_URL}${employee.profile_image_url}`
      : images.length > 0
        ? images[0].url.startsWith("http") ? images[0].url : `${BASE_URL}${images[0].url}`
        : null;
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="text-xs">
          <Eye className="h-3.5 w-3.5 mr-1" /> View
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{employee.name}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Profile header */}
          <div className="flex items-center gap-4">
            <div className="h-20 w-20 rounded-lg overflow-hidden bg-primary/10 flex items-center justify-center text-xl font-bold text-primary border-2 border-border shadow-sm shrink-0">
              {profileSrc ? (
                <img src={profileSrc} className="h-full w-full object-cover" alt={employee.name} loading="lazy" />
              ) : (
                employee.avatar
              )}
            </div>
            <div>
              <p className="font-semibold text-lg text-foreground">{employee.name}</p>
              <p className="text-sm text-muted-foreground">{employee.code} · {employee.department}</p>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">Face Status</p>
              <p className="text-sm font-medium mt-0.5">{employee.face_status}</p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">Today's Movements</p>
              <p className="text-sm font-medium mt-0.5">{employee.movements_today}</p>
            </div>
          </div>

          {/* Detection Images */}
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2">
              Recent Detection Images
            </p>

            {imagesLoading ? (
              /* Loading skeleton */
              <div className="grid grid-cols-3 gap-2">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="aspect-square rounded-lg" />
                ))}
              </div>
            ) : images.length === 0 ? (
              /* Empty state */
              <div className="flex flex-col items-center justify-center py-6 rounded-lg border border-dashed border-border gap-2">
                <Camera className="h-6 w-6 text-muted-foreground/40" />
                <p className="text-xs text-muted-foreground">No detection images yet</p>
              </div>
            ) : (
              /* Real images grid */
              <div className="grid grid-cols-3 gap-2">
                {images.map((img, idx) => (
                  <div
                    key={idx}
                    className="aspect-square rounded-lg overflow-hidden bg-muted border border-border relative group cursor-pointer"
                    title={`${img.camera} · ${formatDateTime(img.timestamp)}`}
                    onClick={() => window.open(`${BASE_URL}${img.url}`, "_blank")}
                  >
                    <img
                      src={img.url.startsWith("http") ? img.url : `${BASE_URL}${img.url}`}
                      alt={`Detection ${idx + 1}`}
                      className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-105"
                      loading="lazy"
                      onError={(e) => {
                        const el = e.target as HTMLImageElement;
                        el.style.display = "none";
                        if (el.parentElement) {
                          el.parentElement.innerHTML =
                            '<div class="h-full w-full flex items-center justify-center text-xs text-muted-foreground">No image</div>';
                        }
                      }}
                    />

                    {/* Hover overlay with metadata */}
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity duration-150 flex flex-col justify-end p-1.5 gap-0.5">
                      <p className="text-[9px] text-white font-medium truncate flex items-center gap-0.5">
                        <Camera className="h-2.5 w-2.5 shrink-0" />
                        {img.camera}
                      </p>
                      <p className="text-[8px] text-white/80 flex items-center gap-0.5">
                        <Clock className="h-2 w-2 shrink-0" />
                        {formatDateTime(img.timestamp).split(" ")[1]?.slice(0, 5)}
                      </p>
                    </div>

                    {/* Confidence pill */}
                    <div className="absolute top-1 right-1">
                      <span
                        className={`text-[8px] font-bold px-1 py-0.5 rounded text-white ${img.confidence >= 85
                          ? "bg-emerald-500/90"
                          : img.confidence >= 70
                            ? "bg-amber-500/90"
                            : "bg-red-500/90"
                          }`}
                      >
                        {img.confidence}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Employee Edit Dialog ─────────────────────────────────────────────────────
function EmployeeEditDialog({ employee, onSaved }: { employee: Employee; onSaved: () => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(employee.name);
  const [dept, setDept] = useState(employee.department);

  const mut = useMutation({
    mutationFn: () =>
      api.put(`/api/employees/${employee.code}`, { name, department: dept }).then((r) => r.data),
    onSuccess: () => {
      toast.success(`${name} updated successfully`);
      onSaved();
      setOpen(false);
    },
    onError: () => toast.error("Failed to update employee"),
  });

  // Reset fields when dialog opens
  const handleOpen = (val: boolean) => {
    if (val) { setName(employee.name); setDept(employee.department); }
    setOpen(val);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="text-xs">
          <Pencil className="h-3.5 w-3.5 mr-1" /> Edit
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Edit Employee</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="emp-code">Employee Code</Label>
            <Input id="emp-code" value={employee.code} disabled className="font-mono text-muted-foreground bg-muted" />
            <p className="text-[11px] text-muted-foreground">Code cannot be changed</p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="emp-name">Full Name</Label>
            <Input
              id="emp-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Employee full name"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="emp-dept">Department</Label>
            <Select value={dept} onValueChange={setDept}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select department" />
              </SelectTrigger>
              <SelectContent>
                {departments.map((d) => (
                  <SelectItem key={d} value={d}>
                    {d}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button
            onClick={() => mut.mutate()}
            disabled={mut.isPending || !name.trim() || !dept.trim()}
          >
            {mut.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Seen Today List Dialog ───────────────────────────────────────────────────
interface SeenTodayEntry {
  code: string;
  name: string;
  dept: string;
  last_seen: string;
  total_detections: number;
}

function SeenTodayDialog({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const { data: list = [], isLoading } = useQuery<SeenTodayEntry[]>({
    queryKey: ["seen-today-list"],
    queryFn: () => api.get("/api/employees/seen-today").then((r) => r.data),
    enabled: open,
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-emerald-500" />
            Detected Recently (Today)
          </DialogTitle>
        </DialogHeader>
        <div className="max-h-[60vh] overflow-y-auto pr-1">
          {isLoading ? (
            <div className="py-10 flex flex-col items-center justify-center gap-2 text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin" />
              <p className="text-sm">Loading today's detections...</p>
            </div>
          ) : list.length === 0 ? (
            <div className="py-10 text-center text-muted-foreground border rounded-lg border-dashed">
              <p className="text-sm">No recognition data for today yet.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {list.map((item) => (
                <div key={item.code} className="flex items-center justify-between p-3 rounded-lg border bg-zinc-50/50 dark:bg-zinc-900/50">
                  <div>
                    <p className="text-sm font-semibold text-foreground">{item.name}</p>
                    <p className="text-[11px] text-muted-foreground">{item.code} · {item.dept}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[11px] font-medium text-foreground flex items-center justify-end gap-1">
                      <Clock className="h-3 w-3 text-emerald-500" />
                      {item.last_seen.includes(":") ? item.last_seen : formatDateTime(item.last_seen).split(" ")[1]?.slice(0, 5)}
                    </p>
                    <p className="text-[9px] text-muted-foreground flex items-center justify-end gap-1">
                      <Users className="h-2.5 w-2.5" />
                      Total: {item.total_detections} detections
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function EmployeeDirectory() {
  const qc = useQueryClient();
  const [searchParams] = useSearchParams();
  const [search, setSearch] = useState("");

  // Sync global search from URL
  useEffect(() => {
    const query = searchParams.get("search");
    if (query !== null) setSearch(query);
  }, [searchParams]);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkData, setBulkData] = useState("");

  const { data: employees = [], isLoading: empLoading } = useQuery<Employee[]>({
    queryKey: QUERY_KEYS.employees(search),
    queryFn: () => api.get("/api/employees", { params: { search } }).then((r) => r.data),
  });

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: QUERY_KEYS.employeeStats,
    queryFn: () => api.get("/api/employees/stats").then((r) => r.data),
  });

  const refreshEmployees = () => {
    qc.invalidateQueries({ queryKey: ["employees"] });
    qc.invalidateQueries({ queryKey: QUERY_KEYS.employeeStats });
  };

  const bulkMut = useMutation({
    mutationFn: (data: { name: string; department: string }[]) =>
      api.post("/api/employees/bulk", data).then((r) => r.data),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["employees"] });
      toast.success(`Successfully added ${res.created} employees`);
      setBulkOpen(false);
      setBulkData("");
    },
    onError: () => toast.error("Bulk upload failed. Please check your data format."),
  });

  const handleBulkSubmit = () => {
    const lines = bulkData.split("\n").filter((l) => l.trim());
    const parsedData = lines
      .map((line) => {
        const [name, dept] = line.split(",").map((item) => item.trim());
        return { name, department: dept || "General" };
      })
      .filter((item) => item.name);

    if (parsedData.length === 0) {
      toast.error("Please enter data in 'Name, Department' format");
      return;
    }
    bulkMut.mutate(parsedData);
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Employee Directory</h1>
          <p className="text-sm text-muted-foreground">Manage employee profiles and face data</p>
        </div>
        <Dialog open={bulkOpen} onOpenChange={setBulkOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" className="gap-1.5">
              <Upload className="h-4 w-4" /> Bulk Upload
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader><DialogTitle>Bulk Employee Upload</DialogTitle></DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="bulk-data">Data (Format: Name, Department)</Label>
                <Textarea
                  id="bulk-data"
                  placeholder={"Rahul Verma, Engineering\nSneha Jain, HR\nAmit Singh, Operations"}
                  className="min-h-[200px] font-mono text-sm"
                  value={bulkData}
                  onChange={(e) => setBulkData(e.target.value)}
                />
                <p className="text-[11px] text-muted-foreground flex items-start gap-1">
                  <AlertCircle className="h-3 w-3 mt-0.5" />
                  Enter one employee per line. Use a comma to separate name and department.
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setBulkOpen(false)}>Cancel</Button>
              <Button onClick={handleBulkSubmit} disabled={bulkMut.isPending}>
                {bulkMut.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Upload Employees
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        {[
          { label: "Face Mapped", value: stats?.mapped, sub: "AI can recognise", icon: UserCheck, color: "bg-accent" },
          { label: "Unmapped", value: stats?.unmapped, sub: "No face data", icon: UserX, color: "bg-destructive/10", textColor: "text-destructive" },
          { label: "Seen Today", value: stats?.seen_today, sub: "Detected by cameras", icon: Eye, color: "bg-emerald-500/10", textColor: "text-emerald-500" },
          { label: "Total", value: stats?.total, sub: "All employees", icon: UserCheck, color: "bg-info/10", textColor: "text-info" },
        ].map((item, i) => (
          <Card key={i} className="glass-card">
            <CardContent className="p-4 flex items-center gap-3">
              <div className={`h-9 w-9 rounded-lg ${item.color} flex items-center justify-center`}>
                <item.icon className={`h-4 w-4 ${item.textColor || "text-accent-foreground"}`} />
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">{item.label}</p>
                {statsLoading ? (
                  <Skeleton className="h-5 w-12" />
                ) : (
                  <p className="text-lg font-bold text-foreground">{item.value ?? "—"}</p>
                )}
                <p className="text-[10px] text-muted-foreground">{item.sub}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Table */}
      <Card className="glass-card">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium">All Employees</CardTitle>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Search by name, code, dept..."
                className="pl-8 h-8 w-64 text-sm"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead>Code</TableHead>
                <TableHead>Department</TableHead>
                <TableHead>Face Status</TableHead>
                <TableHead>Movements Today</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {empLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell>
                      <div className="flex items-center gap-2.5">
                        <Skeleton className="h-8 w-8 rounded-full" />
                        <Skeleton className="h-4 w-32" />
                      </div>
                    </TableCell>
                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-20 rounded-full" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-8 text-center" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-12" /></TableCell>
                    <TableCell className="text-right flex justify-end gap-1">
                      <Skeleton className="h-8 w-16" />
                      <Skeleton className="h-8 w-16" />
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                employees.map((e) => (
                  <TableRow key={e.code}>
                    <TableCell>
                      <div className="flex items-center gap-2.5">
                        <div className="h-8 w-8 rounded-full overflow-hidden bg-primary/10 flex items-center justify-center text-xs font-semibold text-primary border border-border">
                          {e.profile_image_url ? (
                            <img
                              src={e.profile_image_url.startsWith("http") ? e.profile_image_url : `${BASE_URL}${e.profile_image_url}`}
                              className="h-full w-full object-cover"
                              alt={e.name}
                              loading="lazy"
                            />
                          ) : (
                            e.avatar
                          )}
                        </div>
                        <span className="font-medium text-sm">{e.name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">{e.code}</TableCell>
                    <TableCell className="text-muted-foreground">{e.department}</TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={e.face_status === "Mapped" ? "status-active" : "status-inactive"}
                      >
                        {e.face_status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground font-medium">
                      {e.movements_today}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <EmployeeViewDialog employee={e} />
                        <EmployeeEditDialog employee={e} onSaved={refreshEmployees} />
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
