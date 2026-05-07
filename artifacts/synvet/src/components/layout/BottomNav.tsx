import { Link, useLocation } from "wouter";
import { LayoutDashboard, Dog, CalendarDays, Stethoscope, Settings } from "lucide-react";
import { cn } from "@/lib/utils";

const ITEMS = [
  { href: "/", label: "Início", icon: LayoutDashboard },
  { href: "/pacientes", label: "Pacientes", icon: Dog },
  { href: "/consultas", label: "Agenda", icon: CalendarDays },
  { href: "/exames", label: "Exames", icon: Stethoscope },
  { href: "/configuracoes", label: "Mais", icon: Settings },
];

export function BottomNav() {
  const [location] = useLocation();
  return (
    <nav
      className="md:hidden fixed bottom-0 inset-x-0 z-30 border-t border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <ul className="grid grid-cols-5">
        {ITEMS.map((item) => {
          const active =
            location === item.href ||
            (item.href !== "/" && location.startsWith(item.href));
          return (
            <li key={item.href}>
              <Link href={item.href} data-testid={`bottomnav-${item.label.toLowerCase()}`}>
                <div
                  className={cn(
                    "flex flex-col items-center justify-center gap-0.5 py-2.5 min-h-[56px] text-[11px] cursor-pointer",
                    active ? "text-primary" : "text-muted-foreground",
                  )}
                >
                  <item.icon className="w-5 h-5" />
                  <span>{item.label}</span>
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
