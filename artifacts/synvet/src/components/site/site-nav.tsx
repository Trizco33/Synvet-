import { useEffect, useState } from "react";
import { Link } from "wouter";
import { Menu, X } from "lucide-react";
import logoUrl from "@assets/synvet-logo.png";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "#produto", label: "Produto" },
  { href: "#copilot", label: "IA Copilot" },
  { href: "#mobile", label: "Mobile" },
  { href: "#seguranca", label: "Segurança" },
  { href: "#planos", label: "Planos" },
];

export function SiteNav() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={cn(
        "fixed top-0 inset-x-0 z-50 transition-all duration-300",
        scrolled
          ? "bg-[#06070d]/80 backdrop-blur-xl border-b border-white/5"
          : "bg-transparent",
      )}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        <Link href="/" data-testid="site-nav-logo">
          <div className="flex items-center gap-2 cursor-pointer">
            <img src={logoUrl} alt="Synvet" className="h-8 w-auto" />
          </div>
        </Link>

        <nav className="hidden md:flex items-center gap-8">
          {NAV.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="text-sm text-white/70 hover:text-white transition-colors"
            >
              {item.label}
            </a>
          ))}
        </nav>

        <div className="hidden md:flex items-center gap-2">
          <Link href="/login">
            <Button variant="ghost" className="text-white/80 hover:text-white hover:bg-white/5">
              Entrar
            </Button>
          </Link>
          <a href="#solicitar-acesso">
            <Button
              className="bg-gradient-to-r from-[#7A5CFF] to-[#5B8CFF] text-white hover:opacity-90 shadow-[0_0_24px_-6px_rgba(122,92,255,0.6)]"
              data-testid="site-nav-cta"
            >
              Solicitar acesso
            </Button>
          </a>
        </div>

        <button
          type="button"
          className="md:hidden text-white p-2"
          onClick={() => setOpen((v) => !v)}
          aria-label="Menu"
        >
          {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {open && (
        <div className="md:hidden border-t border-white/5 bg-[#06070d]/95 backdrop-blur-xl">
          <div className="px-4 py-4 flex flex-col gap-1">
            {NAV.map((item) => (
              <a
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className="px-3 py-2 rounded-md text-sm text-white/80 hover:bg-white/5"
              >
                {item.label}
              </a>
            ))}
            <div className="h-px bg-white/5 my-2" />
            <Link href="/login" onClick={() => setOpen(false)}>
              <div className="px-3 py-2 rounded-md text-sm text-white/80 hover:bg-white/5 cursor-pointer">
                Entrar
              </div>
            </Link>
            <a
              href="#solicitar-acesso"
              onClick={() => setOpen(false)}
              className="mt-1 px-3 py-2 rounded-md text-sm font-medium text-white text-center bg-gradient-to-r from-[#7A5CFF] to-[#5B8CFF]"
            >
              Solicitar acesso
            </a>
          </div>
        </div>
      )}
    </header>
  );
}
