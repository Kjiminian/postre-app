"use client";

import { Bell, Sparkles } from "lucide-react";
import { formatDateRD } from "@/lib/utils";

interface HeaderProps {
  title?: string;
  subtitle?: string;
}

export function Header({ title = "Panel de Control", subtitle }: HeaderProps) {
  const todayStr = formatDateRD(new Date());

  return (
    <header className="h-16 border-b border-cream-300 bg-cream-50/70 backdrop-blur-sm px-8 flex items-center justify-between sticky top-0 z-10">
      <div>
        <h2 className="text-xl font-serif font-bold text-ink">{title}</h2>
        {subtitle && <p className="text-xs text-ink-muted">{subtitle}</p>}
      </div>

      <div className="flex items-center gap-4">
        <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-cream-200/70 text-xs font-medium text-ink-light border border-cream-300">
          <span className="w-2 h-2 rounded-full bg-sage-500 animate-pulse"></span>
          <span>Santo Domingo: {todayStr}</span>
        </div>

        <div className="flex items-center gap-2 border-l border-cream-300 pl-4">
          <div className="w-8 h-8 rounded-full bg-plum-100 border border-plum-200 text-plum-600 flex items-center justify-center font-semibold text-xs">
            KS
          </div>
          <div className="hidden md:block text-left text-xs">
            <p className="font-semibold text-ink">Administrador</p>
            <p className="text-[11px] text-ink-muted">K_Sweet Obradoiro</p>
          </div>
        </div>
      </div>
    </header>
  );
}
