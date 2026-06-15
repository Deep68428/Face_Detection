import { Save, Loader2, ShieldAlert } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { useRole } from "@/contexts/RoleContext";
import { Badge } from "@/components/ui/badge";
import api from "@/lib/api";
export default function SettingsPage() {
  const { isAdmin, isSuperAdmin } = useRole();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState({
    confidence_threshold: 75,
    start_time: "09:00",
    end_time: "19:00",
    auto_detect_unknown: true,
    real_time_processing: true,
    track_after_hours: false
  });

  useEffect(() => {
    api.get("/api/settings/")
      .then(res => {
        setSettings(res.data);
        setLoading(false);
      })
      .catch(err => {
        console.error("Failed to load settings:", err);
        setLoading(false);
      });
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const response = await api.post("/api/settings/", settings);
      if (response.status === 200 || response.status === 201) {
        toast.success("Settings saved successfully");
      } else {
        toast.error("Failed to save settings");
      }
    } catch (err) {
      toast.error("Network error while saving");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold text-foreground">Settings</h1>
            {!isAdmin && <Badge variant="outline" className="bg-muted text-muted-foreground border-none text-[10px]">View Only</Badge>}
          </div>
          <p className="text-sm text-muted-foreground">Configure system preferences and integrations</p>
        </div>
        {isAdmin && (
          <Button className="gap-1.5" onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {saving ? "Saving..." : "Save Changes"}
          </Button>
        )}
      </div>

      {!isAdmin && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-center gap-3 text-amber-800 text-sm">
          <ShieldAlert className="h-4 w-4 shrink-0" />
          <p>You have view-only access to settings. Please contact a Super Admin to make changes.</p>
        </div>
      )}

      {/* Recognition Settings */}
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="text-sm font-semibold">Face Recognition</CardTitle>
          <CardDescription className="text-xs">Adjust detection confidence and thresholds</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm">Confidence Threshold</Label>
              <span className="text-sm font-mono font-medium text-primary">{settings.confidence_threshold}%</span>
            </div>
            <Slider 
              value={[settings.confidence_threshold]} 
              onValueChange={(val) => setSettings({...settings, confidence_threshold: val[0]})} 
              min={30} max={99} step={1} 
              disabled={!isAdmin}
            />
            <p className="text-xs text-muted-foreground">
              Faces detected below this threshold will be marked as unknown
            </p>
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-sm">Auto-detect Unknown Faces</Label>
              <p className="text-xs text-muted-foreground">Send alerts when unknown faces are detected</p>
            </div>
            <Switch 
              checked={settings.auto_detect_unknown} 
              onCheckedChange={(val) => setSettings({...settings, auto_detect_unknown: val})} 
              disabled={!isAdmin}
            />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-sm">Real-time Processing</Label>
              <p className="text-xs text-muted-foreground">Process camera feeds in real-time</p>
            </div>
            <Switch 
              checked={settings.real_time_processing} 
              onCheckedChange={(val) => setSettings({...settings, real_time_processing: val})} 
              disabled={!isAdmin}
            />
          </div>
        </CardContent>
      </Card>

      {/* Working Hours */}
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="text-sm font-semibold">Working Hours</CardTitle>
          <CardDescription className="text-xs">Default working hours for all cameras</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-sm">Start Time</Label>
              <Input 
                type="time" 
                value={settings.start_time} 
                onChange={(e) => setSettings({...settings, start_time: e.target.value})} 
                disabled={!isAdmin}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm">End Time</Label>
              <Input 
                type="time" 
                value={settings.end_time} 
                onChange={(e) => setSettings({...settings, end_time: e.target.value})} 
                disabled={!isAdmin}
              />
            </div>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-sm">Track After-hours Movement</Label>
              <p className="text-xs text-muted-foreground">Log movements outside working hours</p>
            </div>
            <Switch 
              checked={settings.track_after_hours} 
              onCheckedChange={(val) => setSettings({...settings, track_after_hours: val})} 
              disabled={!isAdmin}
            />
          </div>
        </CardContent>
      </Card>

      {/* Integration */}
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="text-sm font-semibold">Integrations</CardTitle>
          <CardDescription className="text-xs">API keys and external service configurations</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label className="text-sm">API Key</Label>
            <Input 
              type="password" 
              defaultValue={isSuperAdmin ? "sk-fce88c73227439389236355fee41" : "••••••••••••••••••••••••"} 
              className="font-mono text-sm" 
              disabled 
            />
          </div>
          <div className="space-y-2">
            <Label className="text-sm">Webhook URL</Label>
            <Input placeholder="https://your-app.com/webhook" className="text-sm" disabled />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
