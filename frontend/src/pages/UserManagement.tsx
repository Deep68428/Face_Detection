import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Search, Plus, Pencil, Trash2, Eye, EyeOff, UserCog, ToggleLeft, ToggleRight, KeyRound } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { useRole } from "@/contexts/RoleContext";
import api from "@/lib/api";
import { QUERY_KEYS } from "@/lib/queryKeys";
import { formatDateTime } from "@/lib/utils";

interface User {
  id: string; name: string; role: string;
  department: string; status: "active" | "inactive";
  last_login: string | null; created_at: string;
}

const roles = ["Super Admin", "Admin", "Viewer"];
const departments = ["HR", "Admin", "General"];
const emptyForm = { name: "", role: "Viewer", department: "", password: "", confirmPassword: "" };

export default function UserManagement() {
  const { canEdit, canDelete } = useRole();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [resetPwOpen, setResetPwOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [targetUser, setTargetUser] = useState<User | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showPw, setShowPw] = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPw, setConfirmNewPw] = useState("");
  const [showNewPw, setShowNewPw] = useState(false);

  const { data: users = [] } = useQuery<User[]>({
    queryKey: QUERY_KEYS.users(search),
    queryFn: () => api.get("/api/users", { params: { search } }).then((r) => r.data),
  });

  const createMut = useMutation({
    mutationFn: (data: typeof emptyForm) => api.post("/api/users", data).then((r) => r.data),
    onSuccess: (u) => { qc.invalidateQueries({ queryKey: ["users"] }); toast.success(`User "${u.name}" created`); setDialogOpen(false); setForm(emptyForm); },
    onError: (err: any) => toast.error(err.response?.data?.detail || "Failed to create user"),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, ...data }: { id: string } & typeof emptyForm) => api.put(`/api/users/${id}`, data).then((r) => r.data),
    onSuccess: (u) => { qc.invalidateQueries({ queryKey: ["users"] }); toast.success(`User "${u.name}" updated`); setDialogOpen(false); },
    onError: (err: any) => toast.error(err.response?.data?.detail || "Failed to update user"),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => api.delete(`/api/users/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["users"] }); toast.success(`User "${targetUser?.name}" deleted`); setDeleteOpen(false); setTargetUser(null); },
    onError: () => toast.error("Failed to delete user"),
  });

  const toggleMut = useMutation({
    mutationFn: (id: string) => api.patch(`/api/users/${id}/status`).then((r) => r.data),
    onSuccess: (data) => { qc.invalidateQueries({ queryKey: ["users"] }); toast.success(`User ${data.status === "active" ? "activated" : "deactivated"}`); },
    onError: () => toast.error("Failed to toggle status"),
  });

  const resetPwMut = useMutation({
    mutationFn: ({ id, password }: { id: string; password: string }) => api.post(`/api/users/${id}/reset-password`, { new_password: password }),
    onSuccess: () => { toast.success(`Password reset for "${targetUser?.name}"`); setResetPwOpen(false); setNewPassword(""); setConfirmNewPw(""); setTargetUser(null); },
    onError: () => toast.error("Failed to reset password"),
  });

  const activeCount = users.filter((u) => u.status === "active").length;

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.name.trim()) e.name = "Name is required";
    if (!form.department) e.department = "Department is required";
    if (!form.role) e.role = "Role is required";
    if (!editingUser) {
      if (!form.password) e.password = "Password is required";
      if (form.password !== form.confirmPassword) e.confirmPassword = "Passwords do not match";
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const openAdd = () => { setEditingUser(null); setForm(emptyForm); setErrors({}); setShowPw(false); setShowConfirmPw(false); setDialogOpen(true); };
  const openEdit = (u: User) => { setEditingUser(u); setForm({ name: u.name, role: u.role, department: u.department, password: "", confirmPassword: "" }); setErrors({}); setDialogOpen(true); };

  const handleSave = () => {
    if (!validate()) return;
    if (editingUser) { updateMut.mutate({ id: editingUser.id, ...form }); }
    else { createMut.mutate(form); }
  };

  const handleResetPassword = () => {
    if (!newPassword) { toast.error("Password is required"); return; }
    if (newPassword !== confirmNewPw) { toast.error("Passwords do not match"); return; }
    if (targetUser) resetPwMut.mutate({ id: targetUser.id, password: newPassword });
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">User Management</h1>
          <p className="text-sm text-muted-foreground">Create, edit, and manage system users</p>
        </div>
        {canEdit && <Button onClick={openAdd} className="gap-1.5"><Plus className="h-4 w-4" /> Add User</Button>}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="glass-card"><CardContent className="p-4 flex items-center gap-3"><div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center"><UserCog className="h-4 w-4 text-primary" /></div><div><p className="text-xs text-muted-foreground">Total Users</p><p className="text-lg font-bold text-foreground">{users.length}</p></div></CardContent></Card>
        <Card className="glass-card"><CardContent className="p-4 flex items-center gap-3"><div className="h-9 w-9 rounded-lg bg-accent flex items-center justify-center"><ToggleRight className="h-4 w-4 text-accent-foreground" /></div><div><p className="text-xs text-muted-foreground">Active</p><p className="text-lg font-bold text-foreground">{activeCount}</p></div></CardContent></Card>
        <Card className="glass-card"><CardContent className="p-4 flex items-center gap-3"><div className="h-9 w-9 rounded-lg bg-destructive/10 flex items-center justify-center"><ToggleLeft className="h-4 w-4 text-destructive" /></div><div><p className="text-xs text-muted-foreground">Inactive</p><p className="text-lg font-bold text-foreground">{users.length - activeCount}</p></div></CardContent></Card>
      </div>

      <Card className="glass-card">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium">All Users</CardTitle>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input placeholder="Search users..." className="pl-8 h-8 w-64 text-sm" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead><TableHead>Role</TableHead><TableHead>Department</TableHead>
                <TableHead>Status</TableHead><TableHead>Last Login</TableHead><TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((u) => (
                <TableRow key={u.id}>
                  <TableCell>
                    <div className="flex items-center gap-2.5">
                      <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-semibold text-primary">{u.name.split(" ").map((n) => n[0]).join("")}</div>
                      <div><p className="font-medium text-sm">{u.name}</p></div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={u.role === "Super Admin" ? "border-primary/40 text-primary bg-primary/5" : u.role === "Admin" ? "border-accent-foreground/30 text-accent-foreground bg-accent/40" : "border-muted-foreground/30 text-muted-foreground"}>
                      {u.role}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">{u.department}</TableCell>
                  <TableCell><Badge variant="outline" className={u.status === "active" ? "status-active" : "status-inactive"}>{u.status === "active" ? "Active" : "Inactive"}</Badge></TableCell>
                  <TableCell className="text-xs text-muted-foreground">{u.last_login ? formatDateTime(u.last_login).slice(0, -3) : "—"}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      {canEdit && (
                        <>
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(u)} title="Edit user"><Pencil className="h-3.5 w-3.5" /></Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => toggleMut.mutate(u.id)} title={u.status === "active" ? "Deactivate" : "Activate"}>
                            {u.status === "active" ? <ToggleRight className="h-3.5 w-3.5 text-primary" /> : <ToggleLeft className="h-3.5 w-3.5 text-muted-foreground" />}
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setTargetUser(u); setNewPassword(""); setConfirmNewPw(""); setShowNewPw(false); setResetPwOpen(true); }} title="Reset password"><KeyRound className="h-3.5 w-3.5" /></Button>
                        </>
                      )}
                      {canDelete && (
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => { setTargetUser(u); setDeleteOpen(true); }} title="Delete user"><Trash2 className="h-3.5 w-3.5" /></Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {users.length === 0 && <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No users found</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Add / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingUser ? "Edit User" : "Add New User"}</DialogTitle>
            <DialogDescription>{editingUser ? "Update user details below." : "Fill in details to create a new user account."}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid grid-cols-1 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="name">Full Name *</Label>
                <Input id="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="John Doe" />
                {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Role *</Label>
                <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{roles.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
                </Select>
                {errors.role && <p className="text-xs text-destructive">{errors.role}</p>}
              </div>
              <div className="space-y-1.5">
                <Label>Department *</Label>
                <Select value={form.department} onValueChange={(v) => setForm({ ...form, department: v })}>
                  <SelectTrigger><SelectValue placeholder="Select department" /></SelectTrigger>
                  <SelectContent>{departments.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
                </Select>
                {errors.department && <p className="text-xs text-destructive">{errors.department}</p>}
              </div>
            </div>
            {!editingUser && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="password">Password *</Label>
                  <div className="relative">
                    <Input id="password" type={showPw ? "text" : "password"} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="Enter password" />
                    <Button type="button" variant="ghost" size="icon" className="absolute right-0 top-0 h-10 w-10" onClick={() => setShowPw(!showPw)}>
                      {showPw ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                    </Button>
                  </div>
                  {errors.password && <p className="text-xs text-destructive">{errors.password}</p>}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="confirmPw">Confirm Password *</Label>
                  <div className="relative">
                    <Input id="confirmPw" type={showConfirmPw ? "text" : "password"} value={form.confirmPassword} onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })} placeholder="Re-enter password" />
                    <Button type="button" variant="ghost" size="icon" className="absolute right-0 top-0 h-10 w-10" onClick={() => setShowConfirmPw(!showConfirmPw)}>
                      {showConfirmPw ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                    </Button>
                  </div>
                  {errors.confirmPassword && <p className="text-xs text-destructive">{errors.confirmPassword}</p>}
                </div>
              </div>
            )}
            {editingUser && <p className="text-xs text-muted-foreground bg-muted/50 rounded-md px-3 py-2">To change this user's password, use the <KeyRound className="inline h-3 w-3 mx-0.5" /> Reset Password action from the table.</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={createMut.isPending || updateMut.isPending}>{editingUser ? "Save Changes" : "Create User"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete User</DialogTitle>
            <DialogDescription>Are you sure you want to delete <span className="font-semibold text-foreground">{targetUser?.name}</span>? This action cannot be undone.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={() => targetUser && deleteMut.mutate(targetUser.id)} disabled={deleteMut.isPending}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reset Password Dialog */}
      <Dialog open={resetPwOpen} onOpenChange={setResetPwOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Reset Password</DialogTitle>
            <DialogDescription>Set a new password for <span className="font-semibold text-foreground">{targetUser?.name}</span>.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label>New Password</Label>
              <div className="relative">
                <Input type={showNewPw ? "text" : "password"} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Enter password" />
                <Button type="button" variant="ghost" size="icon" className="absolute right-0 top-0 h-10 w-10" onClick={() => setShowNewPw(!showNewPw)}>
                  {showNewPw ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </Button>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Confirm Password</Label>
              <Input type="password" value={confirmNewPw} onChange={(e) => setConfirmNewPw(e.target.value)} placeholder="Re-enter password" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResetPwOpen(false)}>Cancel</Button>
            <Button onClick={handleResetPassword} disabled={resetPwMut.isPending}>Reset Password</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
