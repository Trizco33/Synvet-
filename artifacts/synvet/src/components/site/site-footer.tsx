import { Link } from "wouter";
import logoUrl from "@assets/synvet-logo.png";

export function SiteFooter() {
  return (
    <footer className="border-t border-white/5 bg-[#06070d] text-white/60">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12 grid gap-10 md:grid-cols-4">
        <div className="md:col-span-2">
          <img src={logoUrl} alt="Synvet" className="h-8 w-auto mb-4" />
          <p className="text-sm max-w-sm">
            A nova geração de software veterinário. Menos burocracia. Mais medicina.
          </p>
        </div>
        <div>
          <h4 className="text-white font-medium text-sm mb-3">Produto</h4>
          <ul className="space-y-2 text-sm">
            <li><a href="#produto" className="hover:text-white">Recursos</a></li>
            <li><a href="#copilot" className="hover:text-white">IA Copilot</a></li>
            <li><a href="#mobile" className="hover:text-white">Mobile / PWA</a></li>
            <li><a href="#planos" className="hover:text-white">Planos</a></li>
          </ul>
        </div>
        <div>
          <h4 className="text-white font-medium text-sm mb-3">Conta</h4>
          <ul className="space-y-2 text-sm">
            <li><Link href="/login"><span className="hover:text-white cursor-pointer">Entrar</span></Link></li>
            <li><a href="#solicitar-acesso" className="hover:text-white">Solicitar acesso</a></li>
            <li><a href="mailto:contato@synvet.app.br" className="hover:text-white">Contato</a></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-white/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 flex flex-col md:flex-row justify-between gap-3 text-xs">
          <span>© {new Date().getFullYear()} Synvet. Todos os direitos reservados.</span>
          <span>Feito para clínicas modernas no Brasil.</span>
        </div>
      </div>
    </footer>
  );
}
