import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { 
  LayoutDashboard, 
  Users, 
  Dog, 
  CalendarDays, 
  Stethoscope, 
  Settings, 
  LogOut, 
  Menu,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import logoUrl from "@assets/synvet-logo.png";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useGetMe } from "@workspace/api-client-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { BottomNav } from "@/components/layout/BottomNav";

const NAV_ITEMS = [
  { href: "/app", label: "Dashboard", icon: LayoutDashboard },
  { href: "/app/pacientes", label: "Pacientes", icon: Dog },
  { href: "/app/tutores", label: "Tutores", icon: Users },
  { href: "/app/consultas", label: "Consultas", icon: CalendarDays },
  { href: "/app/exames", label: "Exames", icon: Stethoscope },
  { href: "/app/configuracoes", label: "Configurações", icon: Settings },
];

export function AppLayout({ children }: { children: React.ReactNode }) {
  const [location, setLocation] = useLocation();
  const { signOut } = useAuth();
  const { data: me } = useGetMe();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [location]);

  const handleSignOut = async () => {
    await signOut();
    setLocation("/login");
  };

  const NavLinks = () => (
    <div className="space-y-1">
      {NAV_ITEMS.map((item) => {
        const isActive =
          location === item.href ||
          (item.href !== "/app" && location.startsWith(item.href + "/")) ||
          (item.href === "/app" && location === "/app");
        return (
          <Link key={item.href} href={item.href} data-testid={`nav-${item.label.toLowerCase()}`}>
            <div
              className={`flex items-center gap-3 px-3 py-2 rounded-md transition-colors cursor-pointer ${
                isActive 
                  ? "bg-primary text-primary-foreground font-medium" 
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary"
              }`}
            >
              <item.icon className="w-5 h-5" />
              <span>{item.label}</span>
            </div>
          </Link>
        );
      })}
    </div>
  );

  return (
    <div className="min-h-screen bg-background flex flex-col md:flex-row">
      {/* Mobile Header */}
      <div className="md:hidden flex items-center justify-between p-4 border-b border-border bg-card sticky top-0 z-20">
        <img src={logoUrl} alt="Synvet" className="h-8 w-auto" />
        <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" data-testid="button-mobile-menu">
              <Menu className="w-6 h-6" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-[280px] p-0 flex flex-col bg-card border-r-border">
            <div className="p-6">
              <img src={logoUrl} alt="Synvet" className="h-10 w-auto mb-8" />
              <NavLinks />
            </div>
            <div className="mt-auto p-6 border-t border-border">
              <div className="flex items-center gap-3 mb-6">
                <Avatar>
                  <AvatarFallback className="bg-primary/20 text-primary">
                    {me?.name?.charAt(0) || me?.email?.charAt(0) || "U"}
                  </AvatarFallback>
                </Avatar>
                <div className="flex flex-col">
                  <span className="text-sm font-medium">{me?.name || "Usuário"}</span>
                  <span className="text-xs text-muted-foreground truncate w-[160px]">{me?.email}</span>
                </div>
              </div>
              <Button variant="outline" className="w-full justify-start gap-2" onClick={handleSignOut} data-testid="button-signout-mobile">
                <LogOut className="w-4 h-4" />
                Sair
              </Button>
            </div>
          </SheetContent>
        </Sheet>
      </div>

      {/* Desktop Sidebar */}
      <div className="hidden md:flex flex-col w-[280px] bg-card border-r border-border h-screen sticky top-0">
        <div className="p-6">
          <img src={logoUrl} alt="Synvet" className="h-12 w-auto mb-8" />
          <NavLinks />
        </div>
        
        <div className="mt-auto p-6 border-t border-border">
          <div className="flex items-center gap-3 mb-6">
            <Avatar>
              <AvatarFallback className="bg-primary/20 text-primary">
                {me?.name?.charAt(0) || me?.email?.charAt(0) || "U"}
              </AvatarFallback>
            </Avatar>
            <div className="flex flex-col">
              <span className="text-sm font-medium text-foreground">{me?.name || "Usuário"}</span>
              <span className="text-xs text-muted-foreground truncate w-[160px]">{me?.email}</span>
            </div>
          </div>
          <Button variant="outline" className="w-full justify-start gap-2" onClick={handleSignOut} data-testid="button-signout-desktop">
            <LogOut className="w-4 h-4" />
            Sair
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <main className="flex-1 p-4 md:p-8 w-full max-w-7xl mx-auto pb-24 md:pb-8">
        {children}
      </main>
      <BottomNav />
    </div>
  );
}
