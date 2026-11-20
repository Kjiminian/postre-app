"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  ShoppingCart,
  CalendarDays,
  UtensilsCrossed,
  ChefHat,
  BadgeDollarSign,
  Receipt,
  Scale,
  FileSpreadsheet,
  Database,
  TrendingUp,
  Menu,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

const navigation = [
  { name: "Panel Principal", href: "/", icon: LayoutDashboard },
  { name: "Ventas & Cobros", href: "/ventas", icon: ShoppingCart },
  { name: "Cuadre Semanal", href: "/cuadre", icon: CalendarDays },
  { name: "Productos & Insumos", href: "/ingredientes", icon: UtensilsCrossed },
  { name: "Actualización de Precios", href: "/actualizacion-precios", icon: TrendingUp },
  { name: "Recetas & Subrecetas", href: "/recetas", icon: ChefHat },
  { name: "Costos y Precios", href: "/costos-precios", icon: BadgeDollarSign },
  { name: "Gastos Operativos", href: "/gastos", icon: Receipt },
  { name: "Conversor de Unidades", href: "/conversiones", icon: Scale },
  { name: "Mantenimientos", href: "/mantenimientos", icon: Database },
  { name: "Importación XLSX", href: "/importar", icon: FileSpreadsheet },
];

export function Sidebar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const sidebarContent = (
    <>
      {/* Brand Header */}
      <div className="p-6 border-b border-cream-300/80 bg-cream-50/50 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-plum-500 to-plum-600 flex items-center justify-center text-white shadow-md font-serif font-bold text-xl">
            K
          </div>
          <div>
            <h1 className="font-serif font-bold text-lg text-ink leading-tight">K_Sweet</h1>
            <p className="text-xs text-ink-muted">Gestión de Repostería RD$</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setMobileOpen(false)}
          aria-label="Cerrar menú"
          className="md:hidden p-1.5 rounded-lg text-ink-muted hover:bg-cream-200"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        <div className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-wider text-ink-muted">
          Módulos del Sistema
        </div>
        {navigation.map((item) => {
          const isActive = pathname === item.href || (item.href !== "/" && pathname?.startsWith(item.href));
          const Icon = item.icon;
          return (
            <Link
              key={item.name}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              className={cn(
                "flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-colors",
                isActive
                  ? "bg-plum-500 text-white shadow-sm"
                  : "text-ink hover:bg-cream-200/80 hover:text-plum-600"
              )}
            >
              <Icon className={cn("w-4 h-4 shrink-0", isActive ? "text-white" : "text-plum-500")} />
              <span>{item.name}</span>
            </Link>
          );
        })}
      </nav>

      {/* Footer Info */}
      <div className="p-4 border-t border-cream-300/80 text-xs text-ink-muted space-y-1 bg-cream-50/40">
        <div className="flex items-center justify-between">
          <span>Moneda:</span>
          <span className="font-semibold text-ink">RD$ (DOP)</span>
        </div>
        <div className="flex items-center justify-between">
          <span>Zona Horaria:</span>
          <span className="text-ink font-medium">America/Sto_Dgo</span>
        </div>
        <div className="flex items-center justify-between pt-1 text-[10px] text-plum-600 font-semibold">
          <span>K_Sweet ERP v1.0</span>
          <span>GEM V3</span>
        </div>
      </div>
    </>
  );

  return (
    <>
      {/* Botón flotante para abrir menú en móvil */}
      <button
        type="button"
        onClick={() => setMobileOpen(true)}
        aria-label="Abrir menú de navegación"
        className="md:hidden fixed bottom-4 right-4 z-40 w-12 h-12 rounded-full bg-[#9C4266] text-white shadow-lg flex items-center justify-center hover:bg-[#831843] transition-colors"
      >
        <Menu className="w-6 h-6" />
      </button>

      {/* Drawer móvil */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div
            className="fixed inset-0 bg-black/40"
            onClick={() => setMobileOpen(false)}
            aria-hidden="true"
          />
          <aside className="relative w-72 max-w-[85vw] bg-cream-100 border-r border-cream-300 min-h-screen flex flex-col shadow-xl z-10">
            {sidebarContent}
          </aside>
        </div>
      )}

      {/* Barra lateral fija en escritorio */}
      <aside className="hidden md:flex w-64 shrink-0 bg-cream-100 border-r border-cream-300 min-h-screen flex-col shadow-sidebar select-none">
        {sidebarContent}
      </aside>
    </>
  );
}
