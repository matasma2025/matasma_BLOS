import { useEffect, useState } from "react";
import { Switch, Route, useLocation } from "wouter";
import { queryClient, fetchCsrfToken, clearCsrfToken } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { getAuthUser, setAuthUser, clearAuthUser } from "@/lib/auth";
import { TermsAndConditionsModal } from "@/components/TermsAndConditionsModal";
import Welcome from "@/pages/Welcome";
import VerifyOTP from "@/pages/VerifyOTP";
import Dashboard from "@/pages/Dashboard";
import ChatDetail from "@/pages/ChatDetail";
import Vault from "@/pages/Vault";
import Boards from "@/pages/Boards";
import BoardDetail from "@/pages/BoardDetail";
import MarketIntelligence from "@/pages/MarketIntelligence";
import AdminEnterprise from "@/pages/AdminEnterprise";
import AdminUsers from "@/pages/AdminUsers";
import AcceptInvitation from "@/pages/AcceptInvitation";
import SuperAdmin from "@/pages/SuperAdmin";
import AgenticWorkflow from "@/pages/AgenticWorkflow";
import AdminAgenticWorkflow from "@/pages/AdminAgenticWorkflow";
import SemanticSqlTest from "@/pages/SemanticSqlTest";
import NotFound from "@/pages/not-found";
import Downloads from "@/pages/Downloads";

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const [, setLocation] = useLocation();
  // Always start in "checking" — verify against the server on every mount.
  // This catches expired sessions even when in-memory auth state still exists.
  const [authState, setAuthState] = useState<'checking' | 'ok' | 'denied'>('checking');

  useEffect(() => {
    // Always validate against the server — in-memory user may be stale if session expired.
    fetch('/api/auth/me', { credentials: 'include' })
      .then(r => r.ok ? r.json() : Promise.reject(r))
      .then(async (user) => {
        setAuthUser(user);
        // SG-41: Fetch/refresh the CSRF token every time auth is confirmed
        await fetchCsrfToken();
        setAuthState('ok');
      })
      .catch(() => {
        clearAuthUser();
        clearCsrfToken();
        setAuthState('denied');
        setLocation('/');
      });
  }, [setLocation]);

  if (authState === 'checking') return null;
  return <>{children}</>;
}

function DashboardLayout({ children }: { children: React.ReactNode }) {
  const style = {
    "--sidebar-width": "20rem",
    "--sidebar-width-icon": "3rem",
  };

  return (
    <ProtectedRoute>
      <TermsAndConditionsModal />
      <SidebarProvider style={style as React.CSSProperties}>
        <div className="flex h-screen w-full bg-background">
          <AppSidebar />
          <main className="flex-1 overflow-hidden bg-background">
            {children}
          </main>
        </div>
      </SidebarProvider>
    </ProtectedRoute>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={Welcome} />
      <Route path="/verify-otp" component={VerifyOTP} />
      <Route path="/accept-invitation" component={AcceptInvitation} />
      <Route path="/dashboard">
        <DashboardLayout>
          <Dashboard />
        </DashboardLayout>
      </Route>
      <Route path="/chat/:id">
        <DashboardLayout>
          <ChatDetail />
        </DashboardLayout>
      </Route>
      <Route path="/vault">
        <DashboardLayout>
          <Vault />
        </DashboardLayout>
      </Route>
      <Route path="/boards">
        <DashboardLayout>
          <Boards />
        </DashboardLayout>
      </Route>
      <Route path="/board/:id">
        <DashboardLayout>
          <BoardDetail />
        </DashboardLayout>
      </Route>
      <Route path="/market-intelligence">
        <DashboardLayout>
          <MarketIntelligence />
        </DashboardLayout>
      </Route>
      <Route path="/admin/enterprise">
        <DashboardLayout>
          <AdminEnterprise />
        </DashboardLayout>
      </Route>
      <Route path="/admin/users">
        <DashboardLayout>
          <AdminUsers />
        </DashboardLayout>
      </Route>
      <Route path="/admin/agentic-workflow">
        <DashboardLayout>
          <AdminAgenticWorkflow />
        </DashboardLayout>
      </Route>
      <Route path="/super-admin">
        <DashboardLayout>
          <SuperAdmin />
        </DashboardLayout>
      </Route>
      <Route path="/agentic-workflow">
        <DashboardLayout>
          <AgenticWorkflow />
        </DashboardLayout>
      </Route>
      <Route path="/semantic-sql-test">
        <DashboardLayout>
          <SemanticSqlTest />
        </DashboardLayout>
      </Route>
      <Route path="/downloads" component={Downloads} />
      <Route component={NotFound} />
    </Switch>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}
