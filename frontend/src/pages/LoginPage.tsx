import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Eye, EyeOff, Shield, Loader2 } from "lucide-react";
import { useAuth, AuthUser } from "@/contexts/AuthContext";
import api from "@/lib/api";

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();

  const [tab, setTab] = useState<"login" | "signup">("login");
  const [form, setForm] = useState({
    name: "",
    password: "",
    department: "General",
  });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const from =
    (location.state as { from?: { pathname: string } })?.from?.pathname || "/";

  const handleChange = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setError("");
    setSuccessMsg("");
  };

  // ── Login ────────────────────────────────────────────────────────────────
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const formData = new URLSearchParams();
      formData.append("username", form.name);   // FastAPI OAuth2 uses "username"
      formData.append("password", form.password);

      const res = await api.post("/auth/login", formData, {
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
      });

      const { access_token, role, name, user_id } = res.data;
      const user: AuthUser = { id: user_id, name, role };
      login(access_token, user);
      console.log(access_token);
      navigate(from, { replace: true });
    } catch (err: any) {
      setError(err.response?.data?.detail || "Login failed. Check your name and password.");
    } finally {
      setLoading(false);
    }
  };

  // ── Signup ───────────────────────────────────────────────────────────────
  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await api.post("/auth/signup", {
        name: form.name,
        password: form.password,
        department: form.department,
      });
      setSuccessMsg("Account created! You can now sign in.");
      setTab("login");
      setForm((prev) => ({ ...prev, password: "" }));
    } catch (err: any) {
      setError(err.response?.data?.detail || err.message || "Signup failed. Try a different name.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-background">
      {/* ── Left branding panel ────────────────────────────────────────── */}
      <div className="hidden lg:flex flex-col justify-between w-[45%] bg-sidebar p-12 relative overflow-hidden">
        <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full bg-primary/20 blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 right-0 w-80 h-80 rounded-full bg-primary/10 blur-2xl pointer-events-none" />

        {/* Logo */}
        <div className="relative z-10 flex items-center gap-3">
          <div className="h-12 w-12 rounded-xl bg-white overflow-hidden flex items-center justify-center p-1 shadow-sm">
            <img src="/logo.jpg?v=2" alt="Ethics Infotech Logo" className="w-full h-full object-contain" />
          </div>
          <div>
            <p className="font-bold text-sidebar-foreground text-xl leading-none">Ethics Infotech</p>
            <p className="text-xs text-sidebar-foreground/60 mt-0.5">Attendance System</p>
          </div>
        </div>

        {/* Hero */}
        <div className="relative z-10 space-y-4">
          <h1 className="text-4xl font-bold text-sidebar-foreground leading-tight">
            Smart Attendance
            <br />
            <span className="text-primary">Powered by AI</span>
          </h1>
          <p className="text-sidebar-foreground/60 text-base max-w-xs leading-relaxed">
            Real-time face recognition, movement tracking, and attendance analytics — all in one platform.
          </p>
          <div className="flex flex-wrap gap-2 pt-2">
            {["Face Recognition", "Live Tracking"].map((f) => (
              <span
                key={f}
                className="text-xs px-3 py-1.5 rounded-full bg-sidebar-foreground/10 text-sidebar-foreground/70 border border-sidebar-foreground/10"
              >
                {f}
              </span>
            ))}
          </div>
        </div>

        <p className="relative z-10 text-xs text-sidebar-foreground/40">
          © 2026 EthicsAI · All Rights Reserved
        </p>
      </div>

      {/* ── Right form panel ───────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col items-center justify-center p-8">
        {/* Mobile logo */}
        <div className="flex lg:hidden items-center gap-3 mb-8">
          <div className="h-10 w-10 rounded-xl bg-white overflow-hidden flex items-center justify-center p-1 shadow-md border border-gray-100">
            <img src="/logo.jpg?v=2" alt="Ethics Infotech Logo" className="w-full h-full object-contain" />
          </div>
          <p className="font-bold text-foreground text-xl">Ethics Infotech</p>
        </div>

        <div className="w-full max-w-sm space-y-6">
          {/* Heading */}
          <div className="space-y-1">
            <h2 className="text-2xl font-bold text-foreground">
              {tab === "login" ? "Welcome back" : "Create account"}
            </h2>
            <p className="text-sm text-muted-foreground">
              {tab === "login"
                ? "Sign in with your name and password"
                : "Register with your name and password"}
            </p>
          </div>

          {/* Tab switcher */}
          <div className="flex p-1 rounded-lg bg-muted gap-1">
            {(["login", "signup"] as const).map((t) => (
              <button
                key={t}
                onClick={() => { setTab(t); setError(""); setSuccessMsg(""); }}
                className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-all ${tab === t
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
                  }`}
              >
                {t === "login" ? "Sign In" : "Sign Up"}
              </button>
            ))}
          </div>

          {/* Success message */}
          {successMsg && (
            <div className="px-4 py-3 rounded-lg bg-green-500/10 border border-green-500/20 text-green-600 dark:text-green-400 text-sm">
              {successMsg}
            </div>
          )}

          {/* Error message */}
          {error && (
            <div className="px-4 py-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm">
              {error}
            </div>
          )}

          {/* ── Sign In form ── */}
          {tab === "login" ? (
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground" htmlFor="login-name">
                  Name
                </label>
                <input
                  id="login-name"
                  type="text"
                  autoComplete="username"
                  required
                  placeholder="Your name"
                  value={form.name}
                  onChange={(e) => handleChange("name", e.target.value)}
                  className="w-full h-10 px-3 rounded-lg border border-input bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 transition"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground" htmlFor="login-password">
                  Password
                </label>
                <div className="relative">
                  <input
                    id="login-password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    required
                    placeholder="••••••••"
                    value={form.password}
                    onChange={(e) => handleChange("password", e.target.value)}
                    className="w-full h-10 px-3 pr-10 rounded-lg border border-input bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 transition"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full h-10 rounded-lg bg-primary text-primary-foreground text-sm font-semibold flex items-center justify-center gap-2 hover:bg-primary/90 transition disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                {loading ? "Signing in…" : "Sign In"}
              </button>
            </form>
          ) : (
            /* ── Sign Up form ── */
            <form onSubmit={handleSignup} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground" htmlFor="signup-name">
                  Full Name
                </label>
                <input
                  id="signup-name"
                  type="text"
                  required
                  placeholder="Your full name"
                  value={form.name}
                  onChange={(e) => handleChange("name", e.target.value)}
                  className="w-full h-10 px-3 rounded-lg border border-input bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 transition"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground" htmlFor="signup-dept">
                  Department
                </label>
                <input
                  id="signup-dept"
                  type="text"
                  placeholder="General"
                  value={form.department}
                  onChange={(e) => handleChange("department", e.target.value)}
                  className="w-full h-10 px-3 rounded-lg border border-input bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 transition"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground" htmlFor="signup-password">
                  Password
                </label>
                <div className="relative">
                  <input
                    id="signup-password"
                    type={showPassword ? "text" : "password"}
                    required
                    placeholder="Your password"
                    value={form.password}
                    onChange={(e) => handleChange("password", e.target.value)}
                    className="w-full h-10 px-3 pr-10 rounded-lg border border-input bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 transition"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full h-10 rounded-lg bg-primary text-primary-foreground text-sm font-semibold flex items-center justify-center gap-2 hover:bg-primary/90 transition disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                {loading ? "Creating account…" : "Create Account"}
              </button>

              <p className="text-center text-xs text-muted-foreground">
                New accounts get <span className="font-medium text-foreground">Viewer</span> access.
                An admin can upgrade your role.
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
