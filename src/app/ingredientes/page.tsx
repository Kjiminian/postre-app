"use client";

import { useState } from "react";
import {
  UtensilsCrossed,
  Plus,
  Search,
  AlertTriangle,
  CheckCircle2,
  Scale,
  Sparkles,
  Info,
  X,
} from "lucide-react";
import { Header } from "@/components/layout/Header";
import { formatDOP } from "@/lib/utils";

interface IngredientItem {
  id: string;
  name: string;
  supplier: string;
  packagePriceCents: number;
  packageQty: number;
  packageUnit: string;
  baseUnit: string;
  costPerBaseUnit: number;
  density?: number;
  reviewFlag: boolean;
  notes?: string;
}

const INITIAL_INGREDIENTS: IngredientItem[] = [
  {
    id: "ING-001",
    name: "Queso Crema Philadelphia",
    supplier: "Distribuidora Lácteos del Este",
    packagePriceCents: 45000, // RD$ 450.00
    packageQty: 1.36,
    packageUnit: "kg",
    baseUnit: "g",
    costPerBaseUnit: 0.33088, // RD$ 0.33 por gramo
    reviewFlag: false,
  },
  {
    id: "ING-002",
    name: "Harina de Trigo Blanquita (5 lb)",
    supplier: "Molinos Modernos",
    packagePriceCents: 22000, // RD$ 220.00
    packageQty: 5,
    packageUnit: "lb",
    baseUnit: "g",
    costPerBaseUnit: 0.09700, // 22000 / (5 * 453.59237) = ~0.097 centavos/g
    reviewFlag: true, // Alerta Excel: en el Excel original se multiplicó por 453g en vez de 2,267.96g
    notes: "Corregido en el sistema para usar 1 lb = 453.59237g (2,267.96 g totales)",
  },
  {
    id: "ING-003",
    name: "Azúcar Crema",
    supplier: "Central Romana",
    packagePriceCents: 18000,
    packageQty: 5,
    packageUnit: "lb",
    baseUnit: "g",
    costPerBaseUnit: 0.07936,
    reviewFlag: false,
  },
  {
    id: "ING-004",
    name: "Mantequilla Sin Sal Lurpak",
    supplier: "Distribuidora Gourmet",
    packagePriceCents: 31000,
    packageQty: 500,
    packageUnit: "g",
    baseUnit: "g",
    costPerBaseUnit: 0.62000,
    reviewFlag: false,
  },
  {
    id: "ING-005",
    name: "Leche Evaporada Carnation",
    supplier: "Nestlé Dominicana",
    packagePriceCents: 8500,
    packageQty: 315,
    packageUnit: "ml",
    baseUnit: "ml",
    density: 1.07, // g/ml
    costPerBaseUnit: 0.26984,
    reviewFlag: false,
  },
  {
    id: "ING-006",
    name: "Extracto Puro de Vainilla",
    supplier: "Especias del Caribe",
    packagePriceCents: 55000,
    packageQty: 250,
    packageUnit: "ml",
    baseUnit: "ml",
    density: 1.05,
    costPerBaseUnit: 2.20000,
    reviewFlag: false,
  },
];

export default function IngredientesPage() {
  const [ingredients, setIngredients] = useState<IngredientItem[]>(INITIAL_INGREDIENTS);
  const [search, setSearch] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Formulario nuevo ingrediente
  const [newIng, setNewIng] = useState({
    name: "",
    supplier: "",
    packagePriceDOP: 0,
    packageQty: 1,
    packageUnit: "kg",
    baseUnit: "g",
    density: "",
    notes: "",
  });

  const filtered = ingredients.filter(
    (i) =>
      i.name.toLowerCase().includes(search.toLowerCase()) ||
      i.supplier.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-cream-100 pb-16">
      <Header
        title="Ingredientes & Insumos"
        subtitle="Proveedores, cantidades de empaque y cálculo exacto de costo unitario por unidad base"
      />

      <div className="p-8 max-w-7xl mx-auto space-y-6">
        {/* Banner de Regla de Negocio Anti-Slop (RF-011) */}
        <div className="p-4 rounded-xl border border-cream-300 bg-white shadow-card flex items-start gap-3">
          <Info className="w-5 h-5 text-plum-500 shrink-0 mt-0.5" />
          <div className="text-xs text-ink-light leading-relaxed">
            <span className="font-semibold text-ink">Política de Integridad (RF-011):</span> No se fusionan
            automáticamente variantes de ingredientes (por ejemplo marcas diferentes de chocolate o presentaciones
            de 1 lb vs 5 lb). Toda variante conserva su propio registro con costo unitario independiente a menos
            que el supervisor humano decida unificarlas.
          </div>
        </div>

        {/* Barra de Filtros y Acción */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 bg-white p-4 rounded-xl border border-cream-300 shadow-card">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-ink-muted absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Buscar ingrediente o proveedor..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm bg-cream-50 border border-cream-300 rounded-lg focus:outline-none focus:border-plum-500"
            />
          </div>

          <button
            onClick={() => setIsModalOpen(true)}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-plum-500 hover:bg-plum-600 text-white font-medium text-sm transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" />
            <span>Nuevo Ingrediente</span>
          </button>
        </div>

        {/* Tabla de Ingredientes */}
        <div className="bg-white rounded-xl border border-cream-300 shadow-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-cream-50 border-b border-cream-300 text-xs font-semibold text-ink-muted uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">Ingrediente</th>
                  <th className="py-3 px-4">Proveedor</th>
                  <th className="py-3 px-4 text-right">Precio Empaque</th>
                  <th className="py-3 px-4 text-center">Empaque</th>
                  <th className="py-3 px-4 text-center">Unidad Base</th>
                  <th className="py-3 px-4 text-right">Costo / Base</th>
                  <th className="py-3 px-4 text-center">Densidad</th>
                  <th className="py-3 px-4 text-center">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-cream-200">
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-ink-muted text-xs">
                      No se encontraron ingredientes para la búsqueda ingresada.
                    </td>
                  </tr>
                ) : (
                  filtered.map((item) => (
                    <tr key={item.id} className="hover:bg-cream-50/60 transition-colors">
                      <td className="py-3 px-4">
                        <p className="font-semibold text-ink">{item.name}</p>
                        {item.notes && <p className="text-[11px] text-ink-muted italic">{item.notes}</p>}
                      </td>
                      <td className="py-3 px-4 text-ink-light text-xs">{item.supplier}</td>
                      <td className="py-3 px-4 text-right font-medium text-ink tabular-nums">
                        {formatDOP(item.packagePriceCents)}
                      </td>
                      <td className="py-3 px-4 text-center text-xs tabular-nums">
                        {item.packageQty} {item.packageUnit}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className="px-2 py-0.5 rounded bg-cream-200 text-ink font-mono text-xs">
                          {item.baseUnit}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-plum-600 tabular-nums">
                        RD$ {(item.costPerBaseUnit).toFixed(4)} /{item.baseUnit}
                      </td>
                      <td className="py-3 px-4 text-center text-xs text-ink-muted tabular-nums">
                        {item.density ? `${item.density} g/ml` : "—"}
                      </td>
                      <td className="py-3 px-4 text-center">
                        {item.reviewFlag ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
                            <AlertTriangle className="w-3 h-3" /> Revisar Excel
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-sage-500/10 text-sage-600">
                            <CheckCircle2 className="w-3 h-3" /> Aprobado
                          </span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
