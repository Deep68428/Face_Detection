import { useState } from "react";
import { Shield, Plus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";

interface Role {
  name: string;
  users: number;
  permissions: Record<string, boolean>;
}

const defaultPermissions = { view: false, edit: false, delete: false, export: false };

const initialRoles: Role[] = [
  {
    name: "Super Admin",
    users: 2,
    permissions: { view: true, edit: true, delete: true, export: true },
  },
  {
    name: "Admin",
    users: 5,
    permissions: { view: true, edit: true, delete: false, export: true },
  },
  {
    name: "Viewer",
    users: 12,
    permissions: { view: true, edit: false, delete: false, export: false },
  },
];

export default function RolesPermissions() {
  const [roles, setRoles] = useState<Role[]>(initialRoles);
  const [open, setOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newPerms, setNewPerms] = useState<Record<string, boolean>>({ ...defaultPermissions });
  const [nameError, setNameError] = useState("");

  const handleAdd = () => {
    const trimmed = newName.trim();
    if (!trimmed) {
      setNameError("Role name is required");
      return;
    }
    if (roles.some((r) => r.name.toLowerCase() === trimmed.toLowerCase())) {
      setNameError("Role already exists");
      return;
    }
    setRoles((prev) => [...prev, { name: trimmed, users: 0, permissions: { ...newPerms } }]);
    toast.success(`Role "${trimmed}" created`);
    setOpen(false);
    setNewName("");
    setNewPerms({ ...defaultPermissions });
    setNameError("");
  };

  const handleCancel = () => {
    setOpen(false);
    setNewName("");
    setNewPerms({ ...defaultPermissions });
    setNameError("");
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Roles & Permissions</h1>
          <p className="text-sm text-muted-foreground">Manage access control and user roles</p>
        </div>
        <Button className="gap-1.5" onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4" /> Add Role
        </Button>
      </div>

      <div className="grid gap-4">
        {roles.map((role) => (
          <Card key={role.name} className="glass-card">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-lg bg-accent flex items-center justify-center">
                    <Shield className="h-4 w-4 text-accent-foreground" />
                  </div>
                  <div>
                    <CardTitle className="text-sm font-semibold">{role.name}</CardTitle>
                    <p className="text-xs text-muted-foreground">{role.users} users assigned</p>
                  </div>
                </div>
                <Badge variant="outline" className="text-xs">{role.users} users</Badge>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Permission</TableHead>
                    <TableHead className="text-right">Enabled</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {Object.entries(role.permissions).map(([key, value]) => (
                    <TableRow key={key}>
                      <TableCell className="capitalize font-medium">{key}</TableCell>
                      <TableCell className="text-right">
                        <Switch checked={value} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Add Role Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create New Role</DialogTitle>
          </DialogHeader>
          <div className="space-y-5 py-2">
            <div className="space-y-2">
              <Label htmlFor="role-name">Role Name</Label>
              <Input
                id="role-name"
                placeholder="e.g. Manager, Operator"
                value={newName}
                onChange={(e) => { setNewName(e.target.value); setNameError(""); }}
              />
              {nameError && <p className="text-xs text-destructive">{nameError}</p>}
            </div>
            <div className="space-y-3">
              <Label>Permissions</Label>
              {Object.keys(defaultPermissions).map((perm) => (
                <div key={perm} className="flex items-center justify-between rounded-md border px-3 py-2">
                  <span className="text-sm font-medium capitalize">{perm}</span>
                  <Switch
                    checked={newPerms[perm]}
                    onCheckedChange={(v) => setNewPerms((prev) => ({ ...prev, [perm]: v }))}
                  />
                </div>
              ))}
            </div>
          </div>
          <DialogFooter className="flex justify-end gap-2">
            <Button variant="outline" onClick={handleCancel}>Cancel</Button>
            <Button onClick={handleAdd}>Create Role</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
