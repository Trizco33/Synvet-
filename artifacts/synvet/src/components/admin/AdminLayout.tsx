import { Link, useLocation } from "wouter";
import { Building2, Inbox, BarChart3, LogOut, ShieldCheck } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useSuperAdmin } from "@/hooks/use-super-admin";

const NAV = [
  { href: "/admin/clinicas", label: "Clínicas", icon: Building2 },
  { href: "/admin/leads", label: "Leads", icon: Inbox },
  { href: "/admin/metricas", label: "Métricas", icon: BarChart3 },
];

export function AdminLayout({ children }: { children: React.ReactNode }) {
  const [location, setLocation] = useLocation();
  const { signOut } = useAuth();
  const { admin } = useSuperAdmin();

  const handleSignOut = async () => {
    await signOut();
    setLocation("/login");
  };

  return (
    <div className="min-h-screen bg-[#06070d] text-white">
      <header className="border-b border-white/10 bg-[#0a0c14]/80 backdrop-blur sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-md bg-gradient-to-br from-[#7A5CFF] to-[#5B8CFF] flex items-center justify-center">
              <ShieldCheck className="w-4 h-4 text-white" />
            </div>
            <div>
              <p className="text-sm font-semibold tracking-tight">Synvet · Back-office</p>
              <p className="text-[10px] uppercase tracking-wider text-white/40">
                Plataforma
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-white/50 hidden sm:inline">
              {admin?.email}
            </span>
            <button
              onClick={handleSignOut}
              className="text-xs text-white/60 hover:text-white flex items-center gap-1"
              data-testid="admin-signout"
            >
              <LogOut className="w-3.5 h-3.5" /> Sair
            </button>
          </div>
        </div>
      </header>
      <div className="max-w-7xl mx-auto grid md:grid-cols-[220px_1fr] gap-6 px-4 sm:px-6 py-6">
        <aside>
          <nav className="space-y-1">
            {NAV.map((item) => {
              const isActive = location.startsWith(item.href);
              const Icon = item.icon;
              return (
                <Link key={item.href} href={item.href}>
                  <div
                    className={`flex items-center gap-2.5 px-3 py-2 rounded-md text-sm cursor-pointer transition-colors ${
                      isActive
                        ? "bg-white/10 text-white font-medium"
                        : "text-white/60 hover:text-white hover:bg-white/5"
                    }`}
                    data-testid={`admin-nav-${item.label.toLowerCase()}`}
                  >
                    <Icon className="w-4 h-4" />
                    {item.label}
                  </div>
                </Link>
              );
            })}
          </nav>
        </aside>
        <main className="min-w-0">{children}</main>
      </div>
    </div>
  );
}
