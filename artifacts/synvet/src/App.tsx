import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/hooks/use-auth";
import { useEffect, type ComponentType } from "react";

import { AppLayout } from "@/components/layout/AppLayout";
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

// Protected Route Wrapper
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
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground text-sm">Carregando...</div>;
  }

  if (configured && !user) {
    return null;
  }

  return (
    <AppLayout>
      <Component />
    </AppLayout>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/login" component={Login} />
      
      <Route path="/">
        {() => <ProtectedRoute component={Dashboard} />}
      </Route>
      <Route path="/pacientes">
        {() => <ProtectedRoute component={Pacientes} />}
      </Route>
      <Route path="/pacientes/:petId">
        {() => <ProtectedRoute component={PetDetail} />}
      </Route>
      <Route path="/tutores">
        {() => <ProtectedRoute component={Tutores} />}
      </Route>
      <Route path="/tutores/:tutorId">
        {() => <ProtectedRoute component={TutorDetail} />}
      </Route>
      <Route path="/consultas">
        {() => <ProtectedRoute component={Consultas} />}
      </Route>
      <Route path="/consultas/:consultationId">
        {() => <ProtectedRoute component={ConsultationDetail} />}
      </Route>
      <Route path="/exames">
        {() => <ProtectedRoute component={Exames} />}
      </Route>
      <Route path="/configuracoes">
        {() => <ProtectedRoute component={Configuracoes} />}
      </Route>
      
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <Router />
          </WouterRouter>
        </AuthProvider>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
