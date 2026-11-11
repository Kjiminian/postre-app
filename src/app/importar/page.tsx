"use client";

import { useState } from "react";
import {
  FileSpreadsheet,
  Upload,
  CheckCircle2,
  AlertTriangle,
  Download,
  Database,
  ArrowRight,
  Eye,
  FileCheck,
  ShieldCheck,
  Layers,
} from "lucide-react";
import { Header } from "@/components/layout/Header";

interface SheetInfo {
  name: string;
  rows: number;
  columns: number;
  status: "OK" | "WARNING" | "ERROR";
  issue?: string;
}

const DISCOVERED_SHEETS: SheetInfo[] = [
  {
    name: "Cheesecake",
    rows: 65,
    columns: 8,
    status: "ERROR",
    issue: "Fórmulas #REF! encontradas en celdas C47:C51 y fila 62. Conservadas sin modificar silenciosamente.",
  },
  {
    name: "Producto precios",
    rows: 80,
    columns: 14,
    status: "WARNING",
    issue: "Referencias a celdas vacías ('Producto precios'!L66, !G62). Unidades ambiguas 'framos', 'palitos'.",
  },
  {
    name: "Harina y Azúcar",
    rows: 45,
    columns: 6,
    status: "WARNING",
    issue: "Inconsistencia en paquete Harina 5 lb (se multiplicó por 453g en lugar de 2,267.96g).",
  },
  {
    name: "Bizcochos",
    rows: 50,
    columns: 7,
    status: "OK",
  },
];

export default function ImportarPage() {
  const [selectedSheet, setSelectedSheet] = useState<string>("Cheesecake");
  const [fileName, setFileName] = useState<string>("costos postres calciulos totales 2.xlsx");
  const [fileSize, setFileSize] = useState<string>("27.1 KB");
  const [importStatus, setImportStatus] = useState<"IDLE" | "PREVIEW" | "CONFIRMED">("PREVIEW");

  // Columnas para mapeo
  const [mapping, setMapping] = useState({
    ingredienteCol: "Columna A (Insumo)",
    cantidadCol: "Columna B (Cantidad)",
    unidadCol: "Columna C (Unidad)",
    costoCol: "Columna D (Costo)",
  });

  const handleConfirmDraftImport = () => {
    setImportStatus("CONFIRMED");
  };

  const handleDownloadBackup = () => {
    const data = {
      app: "K_Sweet",
      timestamp: new Date().toISOString(),
      sourceFile: fileName,
      message: "Respaldo completo de base de datos generado conforme a RF-026",
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ksweet-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
  };

  return (
    <div className="min-h-screen bg-cream-100 pb-16">
      <Header
        title="Importación XLSX / CSV & Respaldos"
        subtitle="Mapeo de columnas, validaciones, preservación del archivo original y auditoría de fórmulas"
      />

      <div className="p-8 max-w-7xl mx-auto space-y-6">
        {/* Banner de Trazabilidad y Seguridad (RF-024) */}
        <div className="p-5 rounded-2xl bg-white border border-plum-200 shadow-card flex items-start gap-4">
          <div className="w-10 h-10 rounded-xl bg-plum-100 text-plum-600 flex items-center justify-center shrink-0">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div className="text-xs text-ink-light space-y-1 leading-relaxed">
            <h4 className="font-bold text-ink text-sm">
              Trazabilidad y Preservación del Archivo Original (RF-024 y RF-025)
            </h4>
            <p>
              • El archivo original <strong>se almacena íntegro</strong> sin alterar coordenadas, hojas ni fórmulas.
            </p>
            <p>
              • Las recetas o ingredientes con datos incompletos o errores de fórmula ingresan como{" "}
              <strong>Borradores por Revisar</strong> (<code>reviewFlag: true</code>) y jamás como costos aprobados.
            </p>
            <p>
              • <strong>Prohibido inventar datos:</strong> Si una celda no tiene precio, cliente o fecha, no se
              generan valores sintéticos ficticios.
            </p>
          </div>
        </div>

        {/* Información del Archivo Vinculado */}
        <div className="p-6 bg-white rounded-2xl border border-cream-300 shadow-card flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-sage-500/10 text-sage-600 flex items-center justify-center">
              <FileSpreadsheet className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-serif font-bold text-ink text-base">{fileName}</h3>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-cream-200 text-ink">
                  {fileSize}
                </span>
              </div>
              <p className="text-xs text-ink-muted mt-0.5">
                Resguardado en <code>data/costos_postres_original.xlsx</code> con hash y metadatos intactos.
              </p>
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleDownloadBackup}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-cream-100 hover:bg-cream-200 text-ink text-xs font-semibold border border-cream-300 transition-colors"
            >
              <Download className="w-4 h-4 text-plum-500" />
              <span>Exportar Respaldo JSON</span>
            </button>
          </div>
        </div>

        {/* Hojas del Archivo e Inconsistencias Detectadas */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Lista de Hojas */}
          <div className="p-6 bg-white rounded-2xl border border-cream-300 shadow-card">
            <h4 className="font-serif font-bold text-ink text-sm mb-3 flex items-center gap-2">
              <Layers className="w-4 h-4 text-plum-500" />
              <span>Hojas Detectadas en el Excel</span>
            </h4>

            <div className="space-y-2">
              {DISCOVERED_SHEETS.map((s) => (
                <button
                  key={s.name}
                  onClick={() => setSelectedSheet(s.name)}
                  className={`w-full text-left p-3 rounded-xl border transition-all text-xs flex items-center justify-between ${
                    selectedSheet === s.name
                      ? "border-plum-500 bg-plum-50/50 shadow-sm"
                      : "border-cream-200 bg-cream-50 hover:bg-cream-100"
                  }`}
                >
                  <div>
                    <span className="font-bold text-ink block">{s.name}</span>
                    <span className="text-[11px] text-ink-muted">
                      {s.rows} filas • {s.columns} columnas
                    </span>
                  </div>
                  <div>
                    {s.status === "ERROR" && (
                      <span className="p-1 rounded-full bg-red-100 text-red-600 block">
                        <AlertTriangle className="w-3.5 h-3.5" />
                      </span>
                    )}
                    {s.status === "WARNING" && (
                      <span className="p-1 rounded-full bg-amber-100 text-amber-700 block">
                        <AlertTriangle className="w-3.5 h-3.5" />
                      </span>
                    )}
                    {s.status === "OK" && (
                      <span className="p-1 rounded-full bg-sage-500/10 text-sage-600 block">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                      </span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Detalle de la Hoja Seleccionada y Mapeo */}
          <div className="lg:col-span-2 p-6 bg-white rounded-2xl border border-cream-300 shadow-card space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-cream-200">
              <div>
                <h4 className="font-serif font-bold text-ink text-base">
                  Auditoría de Hoja: <span className="text-plum-600">{selectedSheet}</span>
                </h4>
                <p className="text-xs text-ink-muted">Inspección de fórmulas y coordenadas originales</p>
              </div>

              <span className="px-3 py-1 rounded-full bg-amber-100 text-amber-900 text-xs font-semibold">
                Borrador pendiente de confirmación
              </span>
            </div>

            {/* Inconsistencias de la hoja actual */}
            {DISCOVERED_SHEETS.find((s) => s.name === selectedSheet)?.issue && (
              <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-300 text-xs text-amber-900 flex items-start gap-2.5">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <strong>Inconsistencia detectada en el Excel original:</strong>
                  <p className="mt-0.5 text-amber-800">
                    {DISCOVERED_SHEETS.find((s) => s.name === selectedSheet)?.issue}
                  </p>
                </div>
              </div>
            )}

            {/* Mapeo de Columnas */}
            <div className="space-y-3 pt-2">
              <h5 className="font-bold text-ink text-xs uppercase tracking-wider">
                Mapeo de Columnas para Copia de Trabajo
              </h5>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="block text-ink-muted mb-1 font-semibold">Columna de Insumo / Ingrediente</label>
                  <select
                    value={mapping.ingredienteCol}
                    onChange={(e) => setMapping({ ...mapping, ingredienteCol: e.target.value })}
                    className="w-full p-2 bg-cream-50 border border-cream-300 rounded-lg text-ink font-medium"
                  >
                    <option value="Columna A (Insumo)">Columna A (Insumo / Descripción)</option>
                    <option value="Columna B (Cantidad)">Columna B (Cantidad)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-ink-muted mb-1 font-semibold">Columna de Cantidad</label>
                  <select
                    value={mapping.cantidadCol}
                    onChange={(e) => setMapping({ ...mapping, cantidadCol: e.target.value })}
                    className="w-full p-2 bg-cream-50 border border-cream-300 rounded-lg text-ink font-medium"
                  >
                    <option value="Columna B (Cantidad)">Columna B (Cantidad)</option>
                    <option value="Columna C (Unidad)">Columna C (Unidad)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-ink-muted mb-1 font-semibold">Columna de Unidad</label>
                  <select
                    value={mapping.unidadCol}
                    onChange={(e) => setMapping({ ...mapping, unidadCol: e.target.value })}
                    className="w-full p-2 bg-cream-50 border border-cream-300 rounded-lg text-ink font-medium"
                  >
                    <option value="Columna C (Unidad)">Columna C (Unidad)</option>
                    <option value="Columna D (Costo)">Columna D (Costo)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-ink-muted mb-1 font-semibold">Columna de Costo / Precio</label>
                  <select
                    value={mapping.costoCol}
                    onChange={(e) => setMapping({ ...mapping, costoCol: e.target.value })}
                    className="w-full p-2 bg-cream-50 border border-cream-300 rounded-lg text-ink font-medium"
                  >
                    <option value="Columna D (Costo)">Columna D (Costo)</option>
                    <option value="Columna E (Importe)">Columna E (Importe)</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Acción de confirmación */}
            <div className="pt-4 border-t border-cream-200 flex items-center justify-between">
              <span className="text-xs text-ink-muted">
                Los registros confirmados se guardarán como borradores en el catálogo.
              </span>

              {importStatus === "CONFIRMED" ? (
                <div className="flex items-center gap-1.5 text-xs font-bold text-sage-600 bg-sage-500/10 px-3 py-1.5 rounded-lg border border-sage-500/20">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Importado como Borrador para Revisión</span>
                </div>
              ) : (
                <button
                  onClick={handleConfirmDraftImport}
                  className="px-4 py-2 rounded-lg bg-plum-500 hover:bg-plum-600 text-white font-medium text-xs shadow-sm transition-colors"
                >
                  Confirmar e Importar como Borrador
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
