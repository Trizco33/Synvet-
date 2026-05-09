import { Switch, Route, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/hooks/use-auth";
import { useEffect, type ComponentType } from "react";

import { AppLayout } from "@/components/layout/AppLayout";
import { CopilotProvider } from "@/components/ai/copilot/copilot-provider";
import { CopilotFab } from "@/components/ai/copilot/copilot-fab";
import { CopilotDrawer } from "@/components/ai/copilot/copilot-drawer";
import Landing from "@/pages/site/landing";
import Login from "@/pages/login";
import Dashboard from "@/pages/dashboard";
import Tutores from "@/pages/tutores";
import TutorDetail from "@/pages/tutor-detail";
import Pacientes from "@/pages/pacientes";
import PetDetail from "@/pages/pet-detail";
import Consultas from "@/pages/consultas";
import ConsultationDetail from "@/pages/consultation-detail";
import Exames from "@/pages/exames";
import Configuracoes from "@/pages/configuracoes";
import NotFound from "@/pages/not-found";

const queryClient = new QueryClient();

type ProtectedRouteProps = {
  component: ComponentType;
};

function ProtectedRoute({ component: Component }: ProtectedRouteProps) {
  const { user, loading, configured } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!loading && configured && !user) {
      setLocation("/login");
    }
  }, [loading, configured, user, setLocation]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-muted-foreground text-sm">
        Carregando...
      </div>
    );
  }

  if (configured && !user) {
    return null;
  }

  return (
    <AppLayout>
      <Component />
      <CopilotFab />
      <CopilotDrawer />
    </AppLayout>
  );
}

function Router() {
  return (
    <Switch>
      {/* Public site */}
      <Route path="/" component={Landing} />
      <Route path="/login" component={Login} />

      {/* Authenticated app at /app/* */}
      <Route path="/app">{() => <ProtectedRoute component={Dashboard} />}</Route>
      <Route path="/app/pacientes">{() => <ProtectedRoute component={Pacientes} />}</Route>
      <Route path="/app/pacientes/:petId">{() => <ProtectedRoute component={PetDetail} />}</Route>
      <Route path="/app/tutores">{() => <ProtectedRoute component={Tutores} />}</Route>
      <Route path="/app/tutores/:tutorId">{() => <ProtectedRoute component={TutorDetail} />}</Route>
      <Route path="/app/consultas">{() => <ProtectedRoute component={Consultas} />}</Route>
      <Route path="/app/consultas/:consultationId">{() => <ProtectedRoute component={ConsultationDetail} />}</Route>
      <Route path="/app/exames">{() => <ProtectedRoute component={Exames} />}</Route>
      <Route path="/app/configuracoes">{() => <ProtectedRoute component={Configuracoes} />}</Route>

      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <CopilotProvider>
            <Router />
            <Toaster />
          </CopilotProvider>
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
