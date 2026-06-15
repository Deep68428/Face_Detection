import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Suspense, lazy } from "react";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { RoleProvider } from "@/contexts/RoleContext";
import { AuthProvider } from "@/contexts/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import { AppLayout } from "@/components/AppLayout";
import LoadingScreen from "@/components/LoadingScreen";

// ─── Lazy Loaded Pages ──────────────────────────────────────────────────────
const LoginPage = lazy(() => import("./pages/LoginPage"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const CameraManagement = lazy(() => import("./pages/CameraManagement"));
const EmployeeDirectory = lazy(() => import("./pages/EmployeeDirectory"));
const FaceMapping = lazy(() => import("./pages/FaceMapping"));
const MovementLogs = lazy(() => import("./pages/MovementLogs"));
const Reports = lazy(() => import("./pages/Reports"));
const RolesPermissions = lazy(() => import("./pages/RolesPermissions"));
const SettingsPage = lazy(() => import("./pages/SettingsPage"));
const UserManagement = lazy(() => import("./pages/UserManagement"));
const NotFound = lazy(() => import("./pages/NotFound"));

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AuthProvider>
        <RoleProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Suspense fallback={<LoadingScreen />}>
              <Routes>
                {/* ── Public ──────────────────────────────────────────── */}
                <Route path="/login" element={<LoginPage />} />

                {/* ── Protected: all dashboard pages ──────────────────── */}
                <Route
                  path="/"
                  element={
                    <ProtectedRoute>
                      <AppLayout>
                        <Dashboard />
                      </AppLayout>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/cameras"
                  element={
                    <ProtectedRoute>
                      <AppLayout>
                        <CameraManagement />
                      </AppLayout>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/employees"
                  element={
                    <ProtectedRoute>
                      <AppLayout>
                        <EmployeeDirectory />
                      </AppLayout>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/face-mapping"
                  element={
                    <ProtectedRoute>
                      <AppLayout>
                        <FaceMapping />
                      </AppLayout>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/movement-logs"
                  element={
                    <ProtectedRoute>
                      <AppLayout>
                        <MovementLogs />
                      </AppLayout>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/reports"
                  element={
                    <ProtectedRoute>
                      <AppLayout>
                        <Reports />
                      </AppLayout>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/roles"
                  element={
                    <ProtectedRoute>
                      <AppLayout>
                        <RolesPermissions />
                      </AppLayout>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/users"
                  element={
                    <ProtectedRoute>
                      <AppLayout>
                        <UserManagement />
                      </AppLayout>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/settings"
                  element={
                    <ProtectedRoute>
                      <AppLayout>
                        <SettingsPage />
                      </AppLayout>
                    </ProtectedRoute>
                  }
                />

                {/* ── Fallback ─────────────────────────────────────────── */}
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          </BrowserRouter>
        </RoleProvider>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
