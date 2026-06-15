import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Camera, Plus, Search, Edit, Trash2, AlertTriangle, WifiOff, Wifi } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EmptyState } from "@/components/EmptyState";
import { Skeleton } from "@/components/ui/skeleton";
import { useRole } from "@/contexts/RoleContext";
import { toast } from "sonner";
import api from "@/lib/api";
import { QUERY_KEYS } from "@/lib/queryKeys";

interface CameraData {
  id: number;
  name: string;
  location: string;
  status: "Active" | "Inactive" | "Error";
  ip: string;
  last_active: string;
  confidence_override: number;
  priority: "High" | "Medium" | "Low";
  work_start: string;
  work_end: string;
}

const emptyForm: Omit<CameraData, "id" | "last_active"> = {
  name: "", location: "", status: "Active", ip: "",
  confidence_override: 75, priority: "Medium", work_start: "06:00", work_end: "22:00",
};

function StatusIcon({ status }: { status: string }) {
  if (status === "Active") return <Wifi className="h-3 w-3 text-emerald-600" />;
  if (status === "Error") return <AlertTriangle className="h-3 w-3 text-destructive" />;
  return <WifiOff className="h-3 w-3 text-muted-foreground" />;
}

function getStatusClass(status: string) {
  if (status === "Active") return "status-active";
  if (status === "Error") return "status-error";
  return "status-inactive";
}

export default function CameraManagement() {
  const [search, setSearch] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [editCamera, setEditCamera] = useState<CameraData | null>(null);
  const [form, setForm] = useState<Omit<CameraData, "id" | "last_active">>(emptyForm);
  const { canEdit, canDelete } = useRole();
  const qc = useQueryClient();

  const { data: cameras = [], isLoading } = useQuery<CameraData[]>({
    queryKey: QUERY_KEYS.cameras(search),
    queryFn: () => api.get("/api/cameras", { params: { search } }).then((r) => r.data),
  });

  const createMut = useMutation({
    mutationFn: (data: typeof emptyForm) => api.post("/api/cameras", data).then((r) => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["cameras"] }); toast.success("Camera added"); setAddOpen(false); setForm(emptyForm); },
    onError: () => toast.error("Failed to add camera"),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, ...data }: CameraData) => api.put(`/api/cameras/${id}`, data).then((r) => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["cameras"] }); toast.success("Camera updated"); setEditCamera(null); },
    onError: () => toast.error("Failed to update camera"),
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => api.delete(`/api/cameras/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["cameras"] }); toast.success("Camera deleted"); },
    onError: () => toast.error("Failed to delete camera"),
  });

  const openEdit = (cam: CameraData) => {
    setEditCamera(cam);
    setForm({ name: cam.name, location: cam.location, status: cam.status, ip: cam.ip, confidence_override: cam.confidence_override, priority: cam.priority, work_start: cam.work_start, work_end: cam.work_end });
  };

  const activeCount = cameras.filter((c) => c.status === "Active").length;
  const errorCount = cameras.filter((c) => c.status === "Error").length;

  const renderCameraFormFields = () => (
    <div className="space-y-4 py-4">
      <div className="space-y-2"><Label>Camera Name</Label><Input placeholder="e.g. Main Gate Camera" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
      <div className="space-y-2"><Label>Location</Label><Input placeholder="e.g. Building A - Entrance" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} /></div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2"><Label>IP Address</Label><Input placeholder="192.168.1.x" value={form.ip} onChange={(e) => setForm({ ...form, ip: e.target.value })} /></div>
        <div className="space-y-2">
          <Label>Status</Label>
          <Select value={form.status.toLowerCase()} onValueChange={(v) => setForm({ ...form, status: v === "active" ? "Active" : v === "error" ? "Error" : "Inactive" })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
              <SelectItem value="error">Error</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2"><Label>Work Hours Start</Label><Input type="time" value={form.work_start} onChange={(e) => setForm({ ...form, work_start: e.target.value })} /></div>
        <div className="space-y-2"><Label>Work Hours End</Label><Input type="time" value={form.work_end} onChange={(e) => setForm({ ...form, work_end: e.target.value })} /></div>
      </div>
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label>Confidence Threshold</Label>
          <span className="text-sm font-mono font-medium text-primary">{form.confidence_override}%</span>
        </div>
        <Slider value={[form.confidence_override]} onValueChange={([v]) => setForm({ ...form, confidence_override: v })} min={50} max={99} step={1} />
      </div>
      <div className="space-y-2">
        <Label>Priority</Label>
        <Select value={form.priority.toLowerCase()} onValueChange={(v) => setForm({ ...form, priority: (v.charAt(0).toUpperCase() + v.slice(1)) as "High" | "Medium" | "Low" })}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="high">High</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="low">Low</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Camera Management</h1>
          <p className="text-sm text-muted-foreground">Manage and configure surveillance cameras</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            {isLoading ? (
              <Skeleton className="h-4 w-32" />
            ) : (
              <>
                <span className="flex items-center gap-1"><Wifi className="h-3 w-3 text-emerald-600" />{activeCount} Active</span>
                {errorCount > 0 && <span className="flex items-center gap-1 text-destructive"><AlertTriangle className="h-3 w-3" />{errorCount} Error</span>}
              </>
            )}
          </div>
          {canEdit && (
            <Dialog open={addOpen} onOpenChange={setAddOpen}>
              <DialogTrigger asChild><Button className="gap-1.5"><Plus className="h-4 w-4" /> Add Camera</Button></DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Add New Camera</DialogTitle></DialogHeader>
                {renderCameraFormFields()}
                <DialogFooter>
                  <Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
                  <Button onClick={() => createMut.mutate(form)} disabled={createMut.isPending}>Save Camera</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      {/* Edit Dialog */}
      <Dialog open={!!editCamera} onOpenChange={(o) => { if (!o) { setEditCamera(null); setForm(emptyForm); } }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>Edit Camera</DialogTitle></DialogHeader>
          {renderCameraFormFields()}
          <DialogFooter>
            <Button variant="outline" onClick={() => { setEditCamera(null); setForm(emptyForm); }}>Cancel</Button>
            <Button onClick={() => editCamera && updateMut.mutate({ ...editCamera, ...form })} disabled={updateMut.isPending}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Card className="glass-card">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium">All Cameras ({isLoading ? <Skeleton className="h-3 w-4 inline-block" /> : cameras.length})</CardTitle>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input placeholder="Search cameras..." className="pl-8 h-8 w-56 text-sm" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Camera Name</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>IP Address</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Last Active</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {Array.from({ length: 4 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-40" /></TableCell>
                    <TableCell><Skeleton className="h-3 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-16 rounded-full" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-12 rounded-full" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                    <TableCell className="text-right"><Skeleton className="h-7 w-16 ml-auto" /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : cameras.length === 0 ? (
            <EmptyState title="No cameras configured" description="Add your first camera to start tracking" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Camera Name</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>IP Address</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Last Active</TableHead>
                  {canEdit && <TableHead className="text-right">Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {cameras.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium"><div className="flex items-center gap-2"><StatusIcon status={c.status} />{c.name}</div></TableCell>
                    <TableCell className="text-muted-foreground">{c.location}</TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">{c.ip}</TableCell>
                    <TableCell><Badge variant="outline" className={getStatusClass(c.status)}>{c.status}</Badge></TableCell>
                    <TableCell><Badge variant="outline" className="text-[10px]">{c.priority}</Badge></TableCell>
                    <TableCell className="text-muted-foreground text-sm">{c.last_active}</TableCell>
                    {canEdit && (
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground" onClick={() => openEdit(c)}><Edit className="h-3.5 w-3.5" /></Button>
                          {canDelete && (
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteMut.mutate(c.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                          )}
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
