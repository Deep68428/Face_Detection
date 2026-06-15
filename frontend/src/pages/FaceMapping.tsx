import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from "@tanstack/react-query";
import { UserCheck, UserX, CheckSquare, ArrowRight, UserPlus, Loader2 } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { EmptyState } from "@/components/EmptyState";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import api, { BASE_URL } from "@/lib/api";
import { QUERY_KEYS } from "@/lib/queryKeys";

type FaceStatus = "New" | "Reviewed" | "Assigned";

interface MappedEmployee { code: string; name: string; dept: string; images: number; last_seen: string; }
interface UnmappedFace { id: string; detected_at: string; time: string; confidence: number; status: FaceStatus; image_url?: string; }
interface EmployeePoolItem { code: string; name: string; dept: string; }
interface EmployeeImage { id: string; image_url: string; confidence: number; date: string; }

function getStatusClass(s: FaceStatus) {
  if (s === "New") return "status-new";
  if (s === "Reviewed") return "status-reviewed";
  return "status-assigned";
}

function getConfidenceColor(c: number) {
  if (c >= 85) return "text-emerald-700";
  if (c >= 70) return "text-amber-700";
  return "text-red-600";
}

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Check, ChevronsUpDown, Search, Calendar, Image as ImageIcon, Info } from "lucide-react";
import { cn, formatDateTime } from "@/lib/utils";

function EmployeePreview({ empCode, empName }: { empCode: string, empName: string }) {
  const { data: images = [], isLoading } = useQuery<EmployeeImage[]>({
    queryKey: QUERY_KEYS.employeeImages(empCode),
    queryFn: () => api.get(`/api/face-mapping/employee-images/${empCode}`).then((r) => r.data),
    enabled: !!empCode,
  });

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-primary">
          <Info className="h-3.5 w-3.5" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ImageIcon className="h-4 w-4" />
            Existing Faces: {empName}
          </DialogTitle>
        </DialogHeader>
        <div className="py-4">
          {isLoading ? (
            <div className="grid grid-cols-3 gap-2">
              {[1, 2, 3].map((i) => <Skeleton key={i} className="aspect-square rounded-md" />)}
            </div>
          ) : images.length === 0 ? (
            <p className="text-center py-8 text-sm text-muted-foreground">No images found for this employee.</p>
          ) : (
            <div className="grid grid-cols-3 gap-2 max-h-[300px] overflow-y-auto pr-2">
              {images.map((img) => (
                <div key={img.id} className="group relative aspect-square rounded-md overflow-hidden bg-muted border">
                  <img
                    src={img.image_url.startsWith("http") ? img.image_url : `${BASE_URL}${img.image_url}`}
                    className="h-full w-full object-cover transition-transform group-hover:scale-110"
                    alt="Employee face"
                  />
                  <div className="absolute inset-x-0 bottom-0 bg-black/60 p-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <p className="text-[8px] text-white text-center">{formatDateTime(img.date)}</p>
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

function EmployeeSearch({
  pool,
  value,
  onSelect,
  placeholder = "Select employee..."
}: {
  pool: EmployeePoolItem[],
  value: string,
  onSelect: (val: string) => void,
  placeholder?: string
}) {
  const [open, setOpen] = useState(false);
  const selectedEmp = pool.find((e) => e.code === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full h-8 justify-between text-xs font-normal"
        >
          {selectedEmp ? (
            <span className="truncate">{selectedEmp.code} – {selectedEmp.name}</span>
          ) : (
            <span className="text-muted-foreground">{placeholder}</span>
          )}
          <ChevronsUpDown className="ml-2 h-3 w-3 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[250px] p-0" align="start">
        <Command>
          <CommandInput placeholder="Search employee..." className="h-8 text-xs" />
          <CommandList className="max-h-[200px]">
            <CommandEmpty className="py-2 text-xs text-center">No employee found.</CommandEmpty>
            <CommandGroup>
              <CommandItem
                value="new"
                onSelect={() => { onSelect("new"); setOpen(false); }}
                className="text-xs text-primary font-medium"
              >
                <UserPlus className="mr-2 h-3 w-3" />
                + Add New Employee
              </CommandItem>
              {pool.map((emp) => (
                <CommandItem
                  key={emp.code}
                  value={`${emp.code} ${emp.name}`}
                  onSelect={() => {
                    onSelect(emp.code);
                    setOpen(false);
                  }}
                  className="text-xs"
                >
                  <Check
                    className={cn(
                      "mr-2 h-3 w-3",
                      value === emp.code ? "opacity-100" : "opacity-0"
                    )}
                  />
                  <div className="flex flex-col">
                    <span>{emp.name}</span>
                    <span className="text-[10px] text-muted-foreground">{emp.code} · {emp.dept}</span>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

const departments = ["HR", "Admin", "General"];

function UnmapButton({ empCode, empName, onSuccess }: { empCode: string, empName: string, onSuccess: () => void }) {
  const [open, setOpen] = useState(false);
  const mut = useMutation({
    mutationFn: () => api.post(`/api/face-mapping/unassign?emp_code=${empCode}`).then((r) => r.data),
    onSuccess: () => {
      toast.success(`Unmapped all faces from ${empName}`);
      onSuccess();
      setOpen(false);
    },
    onError: () => toast.error("Failed to unmap faces"),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="h-8 text-xs text-destructive hover:text-destructive hover:bg-destructive/10">
          Unmap
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Unmap Employee</DialogTitle>
        </DialogHeader>
        <div className="py-4">
          <p className="text-sm text-muted-foreground">Are you sure you want to unmap all faces assigned to <span className="font-semibold text-foreground">{empName}</span>? These faces will return to the Unmapped pool.</p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button variant="destructive" onClick={() => mut.mutate()} disabled={mut.isPending}>
            {mut.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Confirm Unmap
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function FaceMapping() {
  const qc = useQueryClient();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [assignments, setAssignments] = useState<Record<string, string>>({});
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingAssign, setPendingAssign] = useState<{ faceIds: string[]; empCode: string; empName: string } | null>(null);
  const [newEmpOpen, setNewEmpOpen] = useState(false);
  const [newEmpFaceId, setNewEmpFaceId] = useState<string | null>(null);
  const [newEmpName, setNewEmpName] = useState("");
  const [newEmpDept, setNewEmpDept] = useState("");
  const [newEmpEmail, setNewEmpEmail] = useState("");
  const [newEmpErrors, setNewEmpErrors] = useState<Record<string, string>>({});
  const [bulkEmp, setBulkEmp] = useState("");
  const [searchUnmapped, setSearchUnmapped] = useState("");
  const [searchMapped, setSearchMapped] = useState("");
  const [dateUnmapped, setDateUnmapped] = useState(new Date().toISOString().split("T")[0]);

  const { data: mapped = [], isLoading: isMappedLoading, isError: isMappedError } = useQuery<MappedEmployee[]>({ 
    queryKey: QUERY_KEYS.mappedFaces(searchMapped), 
    queryFn: () => api.get("/api/face-mapping/mapped", { params: { search: searchMapped } }).then((r) => r.data) 
  });

  const {
    data: unmappedData,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading: isUnmappedLoading,
    isError: isUnmappedError
  } = useInfiniteQuery<{ items: UnmappedFace[]; total: number }>({
    queryKey: QUERY_KEYS.unmappedFaces({ search: searchUnmapped, date: dateUnmapped }),
    queryFn: ({ pageParam = 1 }) =>
      api.get("/api/face-mapping/unmapped", { params: { page: pageParam, page_size: 10, search: searchUnmapped, date: dateUnmapped } }).then((r) => r.data),
    getNextPageParam: (lastPage, allPages) => lastPage.items.length === 10 ? allPages.length + 1 : undefined,
    initialPageParam: 1,
  });

  const unmapped: UnmappedFace[] = unmappedData?.pages.flatMap((p) => p.items) ?? [];
  const totalUnmapped = unmappedData?.pages[0]?.total ?? 0;

  const { data: employeePool = [] } = useQuery<EmployeePoolItem[]>({ queryKey: QUERY_KEYS.employeePool, queryFn: () => api.get("/api/face-mapping/employee-pool").then((r) => r.data) });

  const observer = useRef<IntersectionObserver | null>(null);
  const lastElementRef = (node: HTMLDivElement | null) => {
    if (isUnmappedLoading || isFetchingNextPage) return;
    if (observer.current) observer.current.disconnect();
    observer.current = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && hasNextPage) {
        fetchNextPage();
      }
    });
    if (node) observer.current.observe(node);
  };

  const assignMut = useMutation({
    mutationFn: (data: { face_ids: string[]; emp_code: string }) => api.post("/api/face-mapping/assign", data).then((r) => r.data),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["face-mapping"] });
      qc.invalidateQueries({ queryKey: ["face-mapping", "employee-images"] });
      toast.success(`${vars.face_ids.length} face(s) mapped successfully`);
      setSelected(new Set()); setBulkEmp(""); setAssignments({}); setConfirmOpen(false); setPendingAssign(null);
    },
    onError: () => toast.error("Assignment failed"),
  });

  const createEmpMut = useMutation({
    mutationFn: (data: { face_id: string | null; name: string; department: string; email: string }) =>
      api.post("/api/face-mapping/create-employee", data).then((r) => r.data),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["face-mapping"] });
      qc.invalidateQueries({ queryKey: ["employees"] });
      toast.success(`Employee "${data.name}" created (${data.code})`);
      setNewEmpOpen(false); setNewEmpFaceId(null); setNewEmpName(""); setNewEmpDept(""); setNewEmpEmail(""); setNewEmpErrors({});
    },
    onError: () => toast.error("Failed to create employee"),
  });

  const toggleSelect = (id: string) => {
    setSelected((prev) => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; });
  };

  const selectAll = () => setSelected(selected.size === unmapped.length ? new Set() : new Set(unmapped.map((u) => u.id)));

  const openNewEmpDialog = (faceId: string) => {
    setNewEmpFaceId(faceId); setNewEmpName(""); setNewEmpDept(""); setNewEmpEmail(""); setNewEmpErrors({}); setNewEmpOpen(true);
  };

  const handleSingleAssign = (faceId: string) => {
    const empCode = assignments[faceId];
    if (!empCode) { toast.error("Select an employee first"); return; }
    if (empCode === "new") { openNewEmpDialog(faceId); return; }
    const emp = employeePool.find((e) => e.code === empCode);
    setPendingAssign({ faceIds: [faceId], empCode, empName: emp?.name ?? empCode });
    setConfirmOpen(true);
  };

  const handleBulkAssign = () => {
    if (!bulkEmp) { toast.error("Select an employee first"); return; }
    const emp = employeePool.find((e) => e.code === bulkEmp);
    setPendingAssign({ faceIds: Array.from(selected), empCode: bulkEmp, empName: emp?.name ?? bulkEmp });
    setConfirmOpen(true);
  };

  const confirmAssignment = () => {
    if (!pendingAssign) return;
    assignMut.mutate({ face_ids: pendingAssign.faceIds, emp_code: pendingAssign.empCode });
  };

  const handleCreateEmployee = () => {
    const errors: Record<string, string> = {};
    if (!newEmpName.trim()) errors.name = "Name is required";
    if (!newEmpDept) errors.dept = "Department is required";
    if (Object.keys(errors).length > 0) { setNewEmpErrors(errors); return; }
    createEmpMut.mutate({ face_id: newEmpFaceId, name: newEmpName.trim(), department: newEmpDept, email: newEmpEmail });
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Face Mapping</h1>
        <p className="text-sm text-muted-foreground">Mapped employees vs unmapped detected faces</p>
      </div>

      <Tabs defaultValue="unmapped">
        <TabsList>
          <TabsTrigger value="mapped" className="gap-1.5">
            <UserCheck className="h-3.5 w-3.5" />
            Mapped ({isMappedLoading ? <Skeleton className="h-3 w-4 inline-block" /> : mapped.length})
          </TabsTrigger>
          <TabsTrigger value="unmapped" className="gap-1.5">
            <UserX className="h-3.5 w-3.5" />
            Unmapped ({isUnmappedLoading ? <Skeleton className="h-3 w-4 inline-block" /> : totalUnmapped})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="mapped" className="mt-4 space-y-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <Input 
                placeholder="Search mapped..." 
                className="pl-8 h-8 text-xs" 
                value={searchMapped}
                onChange={(e) => setSearchMapped(e.target.value)}
              />
            </div>
            <p className="text-[10px] text-muted-foreground font-medium">
              Total Mapped: <span className="text-foreground font-bold">{mapped.length}</span>
            </p>
          </div>

          <Card className="glass-card">
            <CardContent className="p-0">
              {isMappedLoading ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Employee</TableHead>
                      <TableHead>Code</TableHead>
                      <TableHead>Department</TableHead>
                      <TableHead>Face Images</TableHead>
                      <TableHead>Last Seen</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {Array.from({ length: 5 }).map((_, i) => (
                      <TableRow key={i}>
                        <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                        <TableCell><Skeleton className="h-3 w-16" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                        <TableCell><Skeleton className="h-5 w-20 rounded-full" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                        <TableCell className="text-right"><Skeleton className="h-8 w-20 ml-auto" /></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : isMappedError ? (
                <EmptyState title="Error loading data" description="Could not fetch mapped employees." />
              ) : mapped.length === 0 ? (
                <EmptyState 
                  title={searchMapped ? "No matches found" : "No mapped employees"} 
                  description={searchMapped ? `No results for "${searchMapped}"` : "Assign faces from the Unmapped tab to see them here."} 
                />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Employee</TableHead>
                      <TableHead>Code</TableHead>
                      <TableHead>Department</TableHead>
                      <TableHead>Face Images</TableHead>
                      <TableHead>Last Seen</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {mapped.map((m) => (
                      <TableRow key={m.code}>
                        <TableCell className="font-medium">{m.name}</TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground">{m.code}</TableCell>
                        <TableCell className="text-muted-foreground text-xs">{m.dept}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-[10px] py-0 h-5 font-normal">
                            {m.images} Images
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground text-xs">
                          {m.last_seen && m.last_seen !== "Never" ? formatDateTime(m.last_seen) : "Never"}
                        </TableCell>
                        <TableCell className="text-right">
                          <UnmapButton empCode={m.code} empName={m.name} onSuccess={() => qc.invalidateQueries({ queryKey: ["face-mapping"] })} />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="unmapped" className="mt-4 space-y-3">
          {selected.size > 0 && (
            <div className="flex items-center gap-3 rounded-lg border border-primary/20 bg-primary/5 px-4 py-2.5">
              <span className="text-sm font-medium text-foreground">{selected.size} selected</span>
              <div className="w-64">
                <EmployeeSearch
                  pool={employeePool}
                  value={bulkEmp}
                  onSelect={(v) => {
                    if (v === "new") { openNewEmpDialog(Array.from(selected)[0]); return; }
                    setBulkEmp(v);
                  }}
                  placeholder="Bulk assign to..."
                />
              </div>
              <Button size="sm" className="h-8 text-xs gap-1" onClick={handleBulkAssign}><CheckSquare className="h-3 w-3" /> Assign Selected</Button>
              <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => { setSelected(new Set()); setBulkEmp(""); }}>Clear</Button>
            </div>
          )}

          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Search by ID..."
                  className="pl-8 h-8 text-xs"
                  value={searchUnmapped}
                  onChange={(e) => setSearchUnmapped(e.target.value)}
                />
              </div>
              <div className="relative w-full sm:w-44">
                <Calendar className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  type="date"
                  className="pl-8 h-8 text-xs"
                  value={dateUnmapped}
                  onChange={(e) => setDateUnmapped(e.target.value)}
                />
              </div>
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
              <p className="text-[10px] text-muted-foreground font-medium hidden sm:block">
                {dateUnmapped === new Date().toISOString().split("T")[0] ? "Today's Count:" : "Date-wise Count:"} <span className="text-foreground font-bold">{totalUnmapped}</span>
              </p>
              <Button variant="outline" size="sm" className="h-8 text-xs px-3" onClick={selectAll}>
                {selected.size === unmapped.length ? "Deselect All" : "Select All"}
              </Button>
              {isFetchingNextPage && <div className="text-[10px] text-muted-foreground animate-pulse">Loading more...</div>}
            </div>
          </div>

          {isUnmappedLoading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {Array.from({ length: 10 }).map((_, i) => (
                <Card key={i} className="glass-card overflow-hidden">
                  <Skeleton className="aspect-square w-full" />
                  <CardContent className="p-3 space-y-2">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-1/2" />
                    <Skeleton className="h-7 w-full" />
                    <Skeleton className="h-7 w-full" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : isUnmappedError ? (
            <EmptyState title="Error fetching detections" description="Unable to load unmapped faces. Retry in a moment." />
          ) : unmapped.length === 0 ? (
            <EmptyState title="All faces mapped!" description="No unmapped detections remaining." />
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {unmapped.map((u, index) => (
                <Card
                  key={u.id}
                  ref={index === unmapped.length - 1 ? lastElementRef : null}
                  className={`glass-card overflow-hidden transition-shadow ${selected.has(u.id) ? "ring-2 ring-primary shadow-md" : ""}`}
                >
                  <div className="aspect-square bg-muted flex items-center justify-center relative overflow-hidden">
                    {u.image_url ? (
                      <img
                        src={u.image_url.startsWith("http") ? u.image_url : `${BASE_URL}${u.image_url}`}
                        className="h-full w-full object-cover transition-transform hover:scale-110 duration-500"
                        loading="lazy"
                        onError={(e) => (e.currentTarget.style.display = "none")}
                        alt="Unmapped face"
                      />
                    ) : (
                      <UserX className="h-10 w-10 text-muted-foreground/30" />
                    )}
                    <Badge className="absolute top-2 right-2 text-[10px] bg-primary/90">{u.confidence}%</Badge>
                    <Badge variant="outline" className={`absolute top-2 left-2 text-[9px] ${getStatusClass(u.status)}`}>{u.status}</Badge>
                    <div className="absolute bottom-2 left-2">
                      <Checkbox checked={selected.has(u.id)} onCheckedChange={() => toggleSelect(u.id)} className="h-4 w-4" />
                    </div>
                    <div className="absolute bottom-2 right-2">
                      <span className={`text-[9px] font-semibold ${getConfidenceColor(u.confidence)}`}>
                        {u.confidence >= 85 ? "High" : u.confidence >= 70 ? "Medium" : "Low"}
                      </span>
                    </div>
                  </div>
                  <CardContent className="p-3 space-y-2.5">
                    <div>
                      <p className="text-xs font-medium text-foreground truncate" title={u.id}>{u.id}</p>
                      <p className="text-[10px] text-muted-foreground">{formatDateTime(`${u.detected_at} ${u.time}`)}</p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="flex-1">
                        <EmployeeSearch
                          pool={employeePool}
                          value={assignments[u.id] ?? ""}
                          onSelect={(v) => {
                            if (v === "new") { openNewEmpDialog(u.id); return; }
                            setAssignments((prev) => ({ ...prev, [u.id]: v }));
                          }}
                        />
                      </div>
                      {assignments[u.id] && assignments[u.id] !== "new" && (
                        <EmployeePreview
                          empCode={assignments[u.id]}
                          empName={employeePool.find(e => e.code === assignments[u.id])?.name ?? ""}
                        />
                      )}
                    </div>
                    <Button size="sm" className="w-full h-8 text-xs gap-1.5 font-medium shadow-sm" onClick={() => handleSingleAssign(u.id)}>
                      <ArrowRight className="h-3.5 w-3.5" /> Assign Face
                    </Button>
                  </CardContent>
                </Card>
              ))}
              {isFetchingNextPage && Array.from({ length: 5 }).map((_, i) => (
                <Card key={`skeleton-${i}`} className="glass-card overflow-hidden opacity-50">
                  <Skeleton className="aspect-square w-full" />
                  <CardContent className="p-3 space-y-2">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-1/2" />
                    <Skeleton className="h-7 w-full" />
                    <Skeleton className="h-7 w-full" />
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Confirmation Dialog */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Confirm Assignment</DialogTitle></DialogHeader>
          {pendingAssign && (
            <div className="space-y-3 py-2">
              <p className="text-sm text-muted-foreground">Map <span className="font-semibold text-foreground">{pendingAssign.faceIds.length} face(s)</span> to:</p>
              <div className="rounded-md border px-3 py-2.5 flex items-center gap-3">
                <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                  {pendingAssign.empName.split(" ").map((n) => n[0]).join("")}
                </div>
                <div>
                  <p className="text-sm font-medium">{pendingAssign.empName}</p>
                  <p className="text-xs text-muted-foreground">{pendingAssign.empCode}</p>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">Face IDs: {pendingAssign.faceIds.join(", ")}</p>
            </div>
          )}
          <DialogFooter className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => { setConfirmOpen(false); setPendingAssign(null); }}>Cancel</Button>
            <Button onClick={confirmAssignment} disabled={assignMut.isPending}>Confirm & Map</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* New Employee Dialog */}
      <Dialog open={newEmpOpen} onOpenChange={setNewEmpOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><UserPlus className="h-5 w-5 text-primary" /> Create New Employee</DialogTitle>
          </DialogHeader>
          {newEmpFaceId && (
            <div className="rounded-md border border-primary/20 bg-primary/5 px-3 py-2 text-xs text-muted-foreground">
              Face <span className="font-semibold text-foreground">{newEmpFaceId}</span> will be auto-assigned.
            </div>
          )}
          <div className="space-y-4 py-1">
            <div className="space-y-1.5">
              <Label htmlFor="new-emp-name">Full Name <span className="text-destructive">*</span></Label>
              <Input id="new-emp-name" placeholder="e.g. Rahul Verma" value={newEmpName} onChange={(e) => { setNewEmpName(e.target.value); setNewEmpErrors((p) => ({ ...p, name: "" })); }} />
              {newEmpErrors.name && <p className="text-xs text-destructive">{newEmpErrors.name}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>Department <span className="text-destructive">*</span></Label>
              <Select value={newEmpDept} onValueChange={(v) => { setNewEmpDept(v); setNewEmpErrors((p) => ({ ...p, dept: "" })); }}>
                <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Select department" /></SelectTrigger>
                <SelectContent>{departments.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
              </Select>
              {newEmpErrors.dept && <p className="text-xs text-destructive">{newEmpErrors.dept}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="new-emp-email">Email <span className="text-muted-foreground text-xs">(optional)</span></Label>
              <Input id="new-emp-email" type="email" placeholder="rahul@company.com" value={newEmpEmail} onChange={(e) => setNewEmpEmail(e.target.value)} />
            </div>
          </div>
          <DialogFooter className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => { setNewEmpOpen(false); setNewEmpFaceId(null); }}>Cancel</Button>
            <Button onClick={handleCreateEmployee} disabled={createEmpMut.isPending}><UserPlus className="h-4 w-4 mr-1" /> Create & Assign</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
