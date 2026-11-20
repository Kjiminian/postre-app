"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import {
  TrendingUp,
  RefreshCw,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Link2,
  Plus,
  ExternalLink,
  Eye,
  X,
  ClipboardPaste,
  History,
  ShieldCheck,
  Search,
  Trash2,
} from "lucide-react";
import { Header } from "@/components/layout/Header";
import { formatDOP } from "@/lib/utils";
import type { ApplyStrategy, AssistedParsedLine } from "@/lib/services/price-adapters";
import type { ImpactSimulationReport } from "@/lib/services/price-approval";

type TabKey = "INBOX" | "LINKS" | "ASSISTED" | "HISTORY";
type InboxFilter = "ALL" | "UP" | "DOWN" | "ALERTS";

interface PriceSourceRow {
  id: string;
  code: string;
  name: string;
  baseUrl: string | null;
  adapterType: string;
  captureMode: string;
  taxMode: string;
  isActive: boolean;
  lastSyncedAt: string | null;
  lastStatus: string | null;
  _count?: { links: number; proposals: number };
}

interface IngredientOption {
  id: string;
  code: string | null;
  name: string;
  category: string;
  packagePriceCents: number;
  packageQty: number;
  packageUnit: string;
  baseUnit: string;
  conversionFactor: number;
  costPerBaseUnit: number;
}

interface LinkRow {
  id: string;
  ingredientId: string;
  sourceId: string;
  isPrimary: boolean;
  externalSku: string | null;
  externalUrl: string | null;
  expectedPackageQty: number;
  expectedPackageUnit: string;
  packTolerancePct: number;
  applyStrategy: ApplyStrategy;
  taxRatePct: number;
  lastCheckedAt: string | null;
  lastSeenPriceCents: number | null;
  lastSeenInStock: boolean | null;
  lastError: string | null;
  isActive: boolean;
  ingredient: IngredientOption;
  source: { id: string; code: string; name: string; adapterType: string; captureMode: string; taxMode: string };
}

interface ProposalRow {
  id: string;
  code: string;
  status: "PENDING" | "APPROVED" | "REJECTED" | "EXPIRED";
  applyStrategyUsed: ApplyStrategy;
  currentPriceCents: number;
  currentCostPerBaseUnit: number;
  detectedPriceCents: number;
  detectedInStock: boolean;
  detectedPackQty: number | null;
  detectedPackUnit: string | null;
  detectedRawTitle: string | null;
  proposedPriceCents: number;
  proposedCostPerBaseUnit: number;
  diffPriceCents: number;
  diffPercent: number;
  packCheckStatus: string;
  alerts: string[];
  evidenceUrl: string | null;
  reviewNote: string | null;
  reviewedAt: string | null;
  expiresAt: string;
  createdAt: string;
  ingredient: IngredientOption;
  source: { id: string; code: string; name: string; captureMode: string; taxMode: string };
  link?: { id: string; externalUrl: string | null; applyStrategy: string; taxRatePct: number } | null;
}

interface SyncRunRow {
  id: string;
  triggerType: string;
  status: string;
  totalChecked: number;
  proposalsCreated: number;
  errorsCount: number;
  startedAt: string;
  finishedAt: string | null;
  source: { id: string; code: string; name: string } | null;
}

interface RecipeOption {
  id: string;
  name: string;
  recipeType: string;
}

interface VerificationPreview {
  detectedTitle?: string;
  detectedPriceWithTaxCents: number;
  detectedInStock: boolean;
  detectedPackQty?: number | null;
  detectedPackUnit?: string | null;
  packCheckStatus: string;
  proposedPriceCents: number;
  diffPercent: number;
  alerts: string[];
  variants?: Array<{ id: string; title: string; priceCents: number }>;
  ambiguousVariant?: boolean;
}

const ALERT_LABELS: Record<string, string> = {
  PACK_MISMATCH: "Cambio de empaque/peso",
  UNIT_INCOMPATIBLE: "Unidad incompatible",
  OUT_OF_STOCK: "Sin stock en portal",
  PRICE_SPIKE_GT_20: "Subida > 20%",
  PRICE_DROP_GT_30: "Bajada > 30%",
  AMBIGUOUS_VARIANT: "Múltiples variantes",
  AMBIGUOUS_PRICE_RANGE: "Rango variable",
  UNKNOWN_PACK: "Peso no detectado",
};

const CRITICAL_ALERTS = new Set([
  "PACK_MISMATCH",
  "UNIT_INCOMPATIBLE",
  "OUT_OF_STOCK",
  "PRICE_SPIKE_GT_20",
  "PRICE_DROP_GT_30",
  "AMBIGUOUS_VARIANT",
  "UNKNOWN_PACK",
]);

const STRATEGY_LABELS: Record<ApplyStrategy, string> = {
  STRICT_SAME_PACK: "Bloquear si cambia empaque",
  REBASE_UNIT_COST: "Reescalar al empaque K_Sweet",
  ADOPT_SOURCE_PACK: "Adoptar empaque del portal",
};

const PACK_CHECK_LABELS: Record<string, string> = {
  MATCH: "Mismo empaque",
  UNIT_CONVERTED: "Unidad equivalente",
  PACK_MISMATCH: "Empaque distinto",
  UNIT_INCOMPATIBLE: "Unidad incompatible",
  UNKNOWN: "Empaque sin confirmar",
};

const TAX_MODE_LABELS: Record<string, string> = {
  INCLUDED: "ITBIS incluido",
  PLUS_ITBIS: "Más ITBIS",
};

const PROPOSAL_STATUS_LABELS: Record<string, string> = {
  PENDING: "Pendiente",
  APPROVED: "Aprobada",
  REJECTED: "Rechazada",
  EXPIRED: "Expirada",
};

const RUN_STATUS_LABELS: Record<string, string> = {
  OK: "Completada",
  DEGRADED: "Con advertencias",
  BLOCKED: "Bloqueada (anti-bot)",
  ERROR: "Error",
  RUNNING: "En progreso",
};

export default function ActualizacionPreciosPage() {
  const [activeTab, setActiveTab] = useState<TabKey>("INBOX");
  const [inboxFilter, setInboxFilter] = useState<InboxFilter>("ALL");

  const [sources, setSources] = useState<PriceSourceRow[]>([]);
  const [links, setLinks] = useState<LinkRow[]>([]);
  const [proposals, setProposals] = useState<ProposalRow[]>([]);
  const [historyProposals, setHistoryProposals] = useState<ProposalRow[]>([]);
  const [syncRuns, setSyncRuns] = useState<SyncRunRow[]>([]);
  const [ingredients, setIngredients] = useState<IngredientOption[]>([]);
  const [recipes, setRecipes] = useState<RecipeOption[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ type: "success" | "error"; text: string; actionHref?: string } | null>(null);

  // Sync bar state
  const [syncScope, setSyncScope] = useState<"ALL" | "SOURCE" | "RECIPE">("ALL");
  const [syncSourceId, setSyncSourceId] = useState("");
  const [syncRecipeId, setSyncRecipeId] = useState("");
  const [isSyncing, setIsSyncing] = useState(false);

  // Selection & inline overrides
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [priceDraftsDOP, setPriceDraftsDOP] = useState<Record<string, string>>({});
  const [strategyDrafts, setStrategyDrafts] = useState<Record<string, ApplyStrategy>>({});
  const [submittingId, setSubmittingId] = useState<string | null>(null);

  // Impact drawer / modal
  const [impactOpen, setImpactOpen] = useState(false);
  const [impactLoading, setImpactLoading] = useState(false);
  const [impactReport, setImpactReport] = useState<ImpactSimulationReport | null>(null);

  // Confirmation modal for critical alerts
  const [confirmModal, setConfirmModal] = useState<{
    proposalIds: string[];
    alerts: string[];
    action: "APPROVE" | "REJECT";
  } | null>(null);
  const [criticalChecked, setCriticalChecked] = useState(false);
  const [rejectNote, setRejectNote] = useState("");

  // Link Modal
  const [linkModalOpen, setLinkModalOpen] = useState(false);
  const [linkSearchIng, setLinkSearchIng] = useState("");
  const [linkForm, setLinkForm] = useState({
    ingredientId: "",
    sourceId: "",
    externalUrl: "",
    externalSku: "",
    applyStrategy: "STRICT_SAME_PACK" as ApplyStrategy,
    taxRatePct: "0",
    isPrimary: true,
  });
  const [verifyingLink, setVerifyingLink] = useState(false);
  const [verifyResult, setVerifyResult] = useState<VerificationPreview | null>(null);
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [savingLink, setSavingLink] = useState(false);

  // Plan B Assisted
  const [assistedText, setAssistedText] = useState("");
  const [assistedSourceId, setAssistedSourceId] = useState("");
  const [assistedLines, setAssistedLines] = useState<
    Array<
      AssistedParsedLine & {
        selectedIngredientId: string;
        priceDOP: string;
        taxRatePct: string;
        include: boolean;
      }
    >
  >([]);
  const [parsingAssisted, setParsingAssisted] = useState(false);
  const [submittingAssisted, setSubmittingAssisted] = useState(false);
  const [registerExpense, setRegisterExpense] = useState(false);
  const [expenseForm, setExpenseForm] = useState({
    expenseDate: new Date().toISOString().slice(0, 10),
    paymentMethod: "EFECTIVO" as "EFECTIVO" | "TRANSFERENCIA" | "TARJETA",
    amountDOP: "",
    concept: "Compra de insumos / reposición",
  });

  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
  }, []);

  const showToast = useCallback((type: "success" | "error", text: string, actionHref?: string) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast({ type, text, actionHref });
    toastTimerRef.current = setTimeout(() => setToast(null), 5500);
  }, []);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [resSrc, resLinks, resPend, resHist, resRuns, resIng, resRec] = await Promise.all([
        fetch("/api/precios/fuentes"),
        fetch("/api/precios/vinculos"),
        fetch("/api/precios/propuestas?status=PENDING"),
        fetch("/api/precios/propuestas?status=ALL&limit=60"),
        fetch("/api/precios/sincronizar"),
        fetch("/api/ingredientes"),
        fetch("/api/recetas"),
      ]);

      const [dSrc, dLinks, dPend, dHist, dRuns, dIng, dRec] = await Promise.all([
        resSrc.json(),
        resLinks.json(),
        resPend.json(),
        resHist.json(),
        resRuns.json(),
        resIng.json(),
        resRec.json(),
      ]);

      if (!dSrc.success) throw new Error(dSrc.error || "Error cargando fuentes");
      if (!dPend.success) throw new Error(dPend.error || "Error cargando propuestas");

      setSources(dSrc.data || []);
      setLinks(dLinks.success ? dLinks.data : []);
      setProposals(dPend.data || []);
      setHistoryProposals(
        (dHist.success ? dHist.data : []).filter((p: ProposalRow) => p.status !== "PENDING")
      );
      setSyncRuns(dRuns.success ? dRuns.data : []);
      setIngredients(dIng.success ? dIng.data : []);
      setRecipes(dRec.success ? dRec.data : []);

      if (dSrc.data?.length > 0) {
        const autoSrc = dSrc.data.find((s: PriceSourceRow) => s.captureMode === "AUTO") || dSrc.data[0];
        const manSrc = dSrc.data.find((s: PriceSourceRow) => s.code === "canal_asistido") || dSrc.data[0];
        setSyncSourceId((prev) => prev || autoSrc.id);
        setLinkForm((prev) => (prev.sourceId ? prev : { ...prev, sourceId: autoSrc.id }));
        setAssistedSourceId((prev) => prev || manSrc.id);
      }
      if (dRec.data?.length > 0) {
        setSyncRecipeId((prev) => prev || dRec.data[0].id);
      }
    } catch (err: any) {
      setError(err.message || "Error conectando con el módulo de actualización de precios");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setImpactOpen(false);
        setConfirmModal(null);
        setLinkModalOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const buildOverridesFor = (ids: string[]) => {
    const overrides: Record<string, { proposedPriceCents?: number; applyStrategy?: ApplyStrategy }> = {};
    for (const id of ids) {
      const draftStr = priceDraftsDOP[id];
      const strat = strategyDrafts[id];
      if (draftStr !== undefined || strat !== undefined) {
        const num = draftStr !== undefined ? Number.parseFloat(draftStr) : NaN;
        overrides[id] = {
          ...(Number.isFinite(num) && num > 0 ? { proposedPriceCents: Math.round(num * 100) } : {}),
          ...(strat ? { applyStrategy: strat } : {}),
        };
      }
    }
    return overrides;
  };

  const handleStrategyChange = (proposalId: string, nextStrategy: ApplyStrategy) => {
    setStrategyDrafts((prev) => ({ ...prev, [proposalId]: nextStrategy }));
    setPriceDraftsDOP((prev) => {
      if (prev[proposalId] === undefined) return prev;
      const copy = { ...prev };
      delete copy[proposalId];
      return copy;
    });
  };

  const handleRunSync = async () => {
    setIsSyncing(true);
    try {
      const payload = {
        scope: syncScope,
        ...(syncScope === "SOURCE" && syncSourceId ? { sourceId: syncSourceId } : {}),
        ...(syncScope === "RECIPE" && syncRecipeId ? { recipeId: syncRecipeId } : {}),
      };
      const res = await fetch("/api/precios/sincronizar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "Error consultando portales");

      const run: SyncRunRow = json.data.run;
      if (run.status === "BLOCKED") {
        showToast(
          "error",
          `Consulta bloqueada por protección anti-bot en portal (${run.errorsCount} enlaces). Usa Carga Asistida (Plan B).`
        );
      } else {
        showToast(
          "success",
          `Consulta completada: ${run.totalChecked} enlaces revisados, ${run.proposalsCreated} propuestas nuevas.`
        );
      }
      await loadAll();
    } catch (err: any) {
      showToast("error", err.message || "Error ejecutando consulta");
    } finally {
      setIsSyncing(false);
    }
  };

  const handleOpenImpact = async (ids: string[]) => {
    setImpactOpen(true);
    setImpactLoading(true);
    setImpactReport(null);
    try {
      const res = await fetch("/api/precios/propuestas/simular", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          proposalIds: ids,
          overridesByProposalId: buildOverridesFor(ids),
        }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "Error simulando impacto");
      setImpactReport(json.data);
    } catch (err: any) {
      setImpactOpen(false);
      showToast("error", err.message || "Error al calcular impacto en recetas");
    } finally {
      setImpactLoading(false);
    }
  };

  const triggerApprove = async (ids: string[], confirmCritical = false) => {
    const targetProps = proposals.filter((p) => ids.includes(p.id));
    const collectedAlerts = Array.from(
      new Set(targetProps.flatMap((p) => p.alerts.filter((a) => CRITICAL_ALERTS.has(a))))
    );

    if (!confirmCritical && collectedAlerts.length > 0) {
      setCriticalChecked(false);
      setConfirmModal({ proposalIds: ids, alerts: collectedAlerts, action: "APPROVE" });
      return;
    }

    setSubmittingId(ids.length === 1 ? ids[0] : "BATCH");
    try {
      const res = await fetch("/api/precios/propuestas/aprobar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          proposalIds: ids,
          confirmCriticalAlerts: confirmCritical,
          overridesByProposalId: buildOverridesFor(ids),
        }),
      });
      const json = await res.json();
      if (!json.success) {
        throw new Error(json.error || "No se pudo aprobar la propuesta");
      }

      const summary = json.data.summary;
      setConfirmModal(null);
      setSelectedIds((prev) => prev.filter((id) => !ids.includes(id)));
      setStrategyDrafts((prev) => {
        const copy = { ...prev };
        for (const id of ids) delete copy[id];
        return copy;
      });
      setPriceDraftsDOP((prev) => {
        const copy = { ...prev };
        for (const id of ids) delete copy[id];
        return copy;
      });
      showToast(
        "success",
        `Aprobado: ${summary.affectedIngredientsCount} producto(s) actualizados, ${summary.affectedRecipesCount} receta(s) recalculadas.`,
        summary.belowTargetMarginCount > 0 ? "/costos-precios" : undefined
      );
      await loadAll();
    } catch (err: any) {
      showToast("error", err.message || "Error aprobando propuesta");
    } finally {
      setSubmittingId(null);
    }
  };

  const handleConfirmReject = async () => {
    if (!confirmModal) return;
    setSubmittingId(confirmModal.proposalIds.length === 1 ? confirmModal.proposalIds[0] : "BATCH");
    try {
      const res = await fetch("/api/precios/propuestas/rechazar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          proposalIds: confirmModal.proposalIds,
          reviewNote: rejectNote || "Descartada en bandeja de revisión",
        }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "Error rechazando propuesta");
      setConfirmModal(null);
      setRejectNote("");
      setSelectedIds((prev) => prev.filter((id) => !confirmModal.proposalIds.includes(id)));
      showToast("success", `Rechazada(s) ${json.rejectedCount} propuesta(s) sin cambiar costos.`);
      await loadAll();
    } catch (err: any) {
      showToast("error", err.message || "Error al rechazar");
    } finally {
      setSubmittingId(null);
    }
  };

  const handleVerifyLink = async () => {
    if (!linkForm.ingredientId || !linkForm.sourceId || !linkForm.externalUrl) {
      setVerifyError("Selecciona un producto, un portal y escribe la URL HTTPS.");
      return;
    }
    setVerifyingLink(true);
    setVerifyError(null);
    setVerifyResult(null);
    try {
      const res = await fetch("/api/precios/vinculos/verificar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ingredientId: linkForm.ingredientId,
          sourceId: linkForm.sourceId,
          externalUrl: linkForm.externalUrl,
          externalSku: linkForm.externalSku || null,
          taxRatePct: Number(linkForm.taxRatePct),
          applyStrategy: linkForm.applyStrategy,
        }),
      });
      const json = await res.json();
      if (!json.success) {
        setVerifyError(json.error || "No se pudo verificar el enlace");
        return;
      }
      setVerifyResult(json.data);
    } catch (err: any) {
      setVerifyError(err.message || "Error de conexión verificando enlace");
    } finally {
      setVerifyingLink(false);
    }
  };

  const handleSaveLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingLink(true);
    setVerifyError(null);
    try {
      const res = await fetch("/api/precios/vinculos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ingredientId: linkForm.ingredientId,
          sourceId: linkForm.sourceId,
          externalUrl: linkForm.externalUrl || null,
          externalSku: linkForm.externalSku || null,
          applyStrategy: linkForm.applyStrategy,
          taxRatePct: Number(linkForm.taxRatePct),
          isPrimary: linkForm.isPrimary,
        }),
      });
      const json = await res.json();
      if (!json.success) {
        setVerifyError(json.error || "No se pudo guardar el vínculo");
        return;
      }
      setLinkModalOpen(false);
      setVerifyResult(null);
      setLinkForm((prev) => ({ ...prev, ingredientId: "", externalUrl: "", externalSku: "" }));
      showToast("success", "Vínculo con portal guardado.");
      await loadAll();
    } catch (err: any) {
      setVerifyError(err.message || "Error guardando vínculo");
    } finally {
      setSavingLink(false);
    }
  };

  const handleDeleteLink = async (id: string) => {
    try {
      const res = await fetch(`/api/precios/vinculos?id=${id}`, { method: "DELETE" });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      showToast("success", "Vínculo desactivado.");
      await loadAll();
    } catch (err: any) {
      showToast("error", err.message || "Error desactivando vínculo");
    }
  };

  const handleParseAssisted = async () => {
    if (!assistedText.trim()) return;
    setParsingAssisted(true);
    try {
      const res = await fetch("/api/precios/asistido", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "PREVIEW", rawText: assistedText }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "Error analizando texto");

      const parsedLines: AssistedParsedLine[] = json.data.lines || [];
      setAssistedLines(
        parsedLines.map((l) => ({
          ...l,
          selectedIngredientId: l.matchedIngredientId || "",
          priceDOP: l.detectedPriceCents ? (l.detectedPriceCents / 100).toFixed(2) : "",
          taxRatePct: "0",
          include: Boolean(l.matchedIngredientId && l.detectedPriceCents),
        }))
      );
    } catch (err: any) {
      showToast("error", err.message || "No se pudo analizar la cotización");
    } finally {
      setParsingAssisted(false);
    }
  };

  const handleSendAssistedToInbox = async () => {
    const validItems = assistedLines
      .filter((l) => l.include && l.selectedIngredientId && Number.parseFloat(l.priceDOP) > 0)
      .map((l) => ({
        ingredientId: l.selectedIngredientId,
        detectedPriceCents: Math.round(Number.parseFloat(l.priceDOP) * 100),
        detectedPackQty: l.detectedPackQty,
        detectedPackUnit: l.detectedPackUnit,
        detectedRawTitle: l.detectedTitle,
        applyStrategy: "STRICT_SAME_PACK" as ApplyStrategy,
        taxRatePct: Number(l.taxRatePct) || 0,
      }));

    if (validItems.length === 0) {
      showToast("error", "Selecciona al menos un producto emparejado con precio > 0.");
      return;
    }

    setSubmittingAssisted(true);
    try {
      const expTotalCents = registerExpense
        ? Math.round((Number.parseFloat(expenseForm.amountDOP) || 0) * 100)
        : 0;
      if (registerExpense && expTotalCents <= 0) {
        throw new Error("El monto de la compra en Gastos Operativos debe ser mayor a 0.");
      }

      const res = await fetch("/api/precios/asistido", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "CREATE",
          sourceId: assistedSourceId || undefined,
          triggerType: "ASSISTED_TEXT",
          items: validItems,
          registerExpense,
          ...(registerExpense
            ? {
                expense: {
                  expenseDate: expenseForm.expenseDate,
                  paymentMethod: expenseForm.paymentMethod,
                  amountCents: expTotalCents,
                  concept: expenseForm.concept,
                },
              }
            : {}),
        }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "Error enviando a bandeja");

      setAssistedText("");
      setAssistedLines([]);
      setRegisterExpense(false);
      setActiveTab("INBOX");
      showToast(
        "success",
        `Enviadas ${json.data.proposalsCreated} propuesta(s) a la Bandeja de Aprobación.${
          json.data.expenseCreated ? " Compra registrada en Gastos Operativos." : ""
        }`
      );
      await loadAll();
    } catch (err: any) {
      showToast("error", err.message || "Error al procesar carga asistida");
    } finally {
      setSubmittingAssisted(false);
    }
  };

  const filteredInbox = proposals.filter((p) => {
    if (inboxFilter === "UP") return p.diffPriceCents > 0;
    if (inboxFilter === "DOWN") return p.diffPriceCents < 0;
    if (inboxFilter === "ALERTS") return p.alerts.length > 0;
    return true;
  });

  const lastSyncDate = sources
    .map((s) => (s.lastSyncedAt ? new Date(s.lastSyncedAt).getTime() : 0))
    .reduce((a, b) => Math.max(a, b), 0);

  const selectedSourceObj = sources.find((s) => s.id === linkForm.sourceId);

  const filteredIngredientsForLink = ingredients.filter((i) => {
    if (!linkSearchIng.trim()) return true;
    const q = linkSearchIng.toLowerCase();
    return i.name.toLowerCase().includes(q) || (i.code && i.code.toLowerCase().includes(q));
  });

  return (
    <div className="min-h-screen bg-[#FAF8F6] pb-24">
      <Header
        title="Actualización de Precios"
        subtitle="Revisión de cambios desde portales RD y facturas con aprobación previa"
      />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Toast z-[60] */}
        {toast && (
          <div
            className={`fixed bottom-20 md:bottom-6 right-4 left-4 md:left-auto md:max-w-md z-[60] flex items-center justify-between gap-3 px-4 py-3 rounded-xl shadow-lg border text-xs font-medium ${
              toast.type === "success"
                ? "bg-[#C6F6D5] border-[#9AE6B4] text-[#22543D]"
                : "bg-[#FED7D7] border-[#FEB2B2] text-[#742A2A]"
            }`}
          >
            <div className="space-y-1">
              <p>{toast.text}</p>
              {toast.actionHref && (
                <Link href={toast.actionHref} className="underline font-bold inline-block">
                  Revisar carta afectada en Costos y Precios →
                </Link>
              )}
            </div>
            <button onClick={() => setToast(null)} aria-label="Cerrar notificación" className="p-1">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Banner de tranquilidad */}
        <div className="p-3.5 rounded-xl bg-white border border-[#E8E2D9] shadow-sm flex items-start gap-3">
          <div className="w-8 h-8 rounded-lg bg-[#FAF5F7] text-[#9C4266] flex items-center justify-center shrink-0">
            <ShieldCheck className="w-4 h-4" />
          </div>
          <p className="text-xs text-[#4A3B32] leading-relaxed">
            <strong>Aprobación humana obligatoria:</strong> Ningún precio de producto ni costo de receta cambia hasta que
            tú lo apruebes. Tus ventas pasadas y precios de carta manuales se conservan intactos.
          </p>
        </div>

        {/* 4 KPIs */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <div className="p-4 rounded-xl bg-white border border-[#E8E2D9] shadow-sm">
            <span className="text-[11px] font-medium text-[#7D6E65] block">Pendientes de aprobar</span>
            <strong className="text-2xl font-serif text-[#9C4266] tabular-nums">{proposals.length}</strong>
          </div>
          <div className="p-4 rounded-xl bg-white border border-[#E8E2D9] shadow-sm">
            <span className="text-[11px] font-medium text-[#7D6E65] block">Productos vinculados</span>
            <strong className="text-2xl font-serif text-[#4A3B32] tabular-nums">{links.length}</strong>
          </div>
          <div className="p-4 rounded-xl bg-white border border-[#E8E2D9] shadow-sm">
            <span className="text-[11px] font-medium text-[#7D6E65] block">Portales configurados</span>
            <strong className="text-2xl font-serif text-[#4A3B32] tabular-nums">{sources.length}</strong>
          </div>
          <div className="p-4 rounded-xl bg-white border border-[#E8E2D9] shadow-sm">
            <span className="text-[11px] font-medium text-[#7D6E65] block">Última consulta</span>
            <strong className="text-sm font-semibold text-[#4A3B32] tabular-nums">
              {lastSyncDate > 0 ? new Date(lastSyncDate).toLocaleString("es-DO") : "Sin corridas aún"}
            </strong>
          </div>
        </div>

        {/* Barra de Consulta bajo demanda */}
        <div className="p-4 rounded-xl bg-white border border-[#E8E2D9] shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={syncScope}
              onChange={(e) => setSyncScope(e.target.value as "ALL" | "SOURCE" | "RECIPE")}
              aria-label="Alcance de consulta"
              className="px-3 py-2 text-xs font-semibold rounded-lg border border-[#E8E2D9] bg-[#FAF8F6] text-[#4A3B32]"
            >
              <option value="ALL">Todos los productos vinculados</option>
              <option value="SOURCE">Solo un portal</option>
              <option value="RECIPE">Insumos de una Receta Madre</option>
            </select>

            {syncScope === "SOURCE" && (
              <select
                value={syncSourceId}
                onChange={(e) => setSyncSourceId(e.target.value)}
                aria-label="Seleccionar portal"
                className="px-3 py-2 text-xs rounded-lg border border-[#E8E2D9] bg-white text-[#4A3B32]"
              >
                {sources
                  .filter((s) => s.captureMode === "AUTO")
                  .map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
              </select>
            )}

            {syncScope === "RECIPE" && (
              <select
                value={syncRecipeId}
                onChange={(e) => setSyncRecipeId(e.target.value)}
                aria-label="Seleccionar receta"
                className="px-3 py-2 text-xs rounded-lg border border-[#E8E2D9] bg-white text-[#4A3B32] max-w-xs"
              >
                {recipes.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            )}
          </div>

          <button
            type="button"
            disabled={isSyncing || links.length === 0}
            onClick={handleRunSync}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-[#9C4266] hover:bg-[#831843] text-white text-xs font-semibold shadow-sm transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${isSyncing ? "animate-spin" : ""}`} />
            <span>{isSyncing ? "Consultando portales..." : "Consultar precios"}</span>
          </button>
        </div>

        {/* Pestañas */}
        <div className="flex flex-wrap gap-2 bg-white p-2 rounded-xl border border-[#E8E2D9] shadow-sm">
          {[
            { key: "INBOX" as TabKey, label: `Bandeja de Aprobación (${proposals.length})`, icon: TrendingUp },
            { key: "LINKS" as TabKey, label: `Vínculos con Portales (${links.length})`, icon: Link2 },
            { key: "ASSISTED" as TabKey, label: "Carga Asistida (Plan B)", icon: ClipboardPaste },
            { key: "HISTORY" as TabKey, label: "Historial", icon: History },
          ].map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-colors ${
                  active ? "bg-[#9C4266] text-white" : "text-[#7D6E65] hover:bg-[#FAF8F6] hover:text-[#4A3B32]"
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* 4 ESTADOS UI */}
        {loading ? (
          <div className="bg-white rounded-xl p-12 border border-[#E8E2D9] text-center space-y-3">
            <RefreshCw className="w-8 h-8 text-[#9C4266] animate-spin mx-auto" />
            <p className="text-sm text-[#7D6E65]">Cargando módulo de precios y vínculos...</p>
          </div>
        ) : error ? (
          <div className="bg-[#FFF5F5] rounded-xl p-8 border border-[#FED7D7] text-center space-y-3">
            <AlertTriangle className="w-8 h-8 text-[#C53030] mx-auto" />
            <p className="text-sm font-semibold text-[#742A2A]">{error}</p>
            <button
              onClick={loadAll}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#9C4266] text-white text-xs font-semibold"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Reintentar
            </button>
          </div>
        ) : activeTab === "INBOX" ? (
          <div className="space-y-4">
            {/* Filtros de bandeja */}
            <div className="flex flex-wrap items-center gap-2">
              {[
                { key: "ALL" as InboxFilter, label: `Todas (${proposals.length})` },
                { key: "UP" as InboxFilter, label: `Subidas (${proposals.filter((p) => p.diffPriceCents > 0).length})` },
                { key: "DOWN" as InboxFilter, label: `Bajadas (${proposals.filter((p) => p.diffPriceCents < 0).length})` },
                { key: "ALERTS" as InboxFilter, label: `Con alertas (${proposals.filter((p) => p.alerts.length > 0).length})` },
              ].map((chip) => (
                <button
                  key={chip.key}
                  type="button"
                  onClick={() => setInboxFilter(chip.key)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                    inboxFilter === chip.key
                      ? "bg-[#9C4266] text-white"
                      : "bg-white border border-[#E8E2D9] text-[#7D6E65] hover:bg-[#FAF8F6]"
                  }`}
                >
                  {chip.label}
                </button>
              ))}
            </div>

            {filteredInbox.length === 0 ? (
              <div className="bg-white rounded-xl p-10 border border-[#E8E2D9] text-center space-y-3">
                <CheckCircle2 className="w-10 h-10 text-[#3B7865] mx-auto" />
                <h3 className="text-base font-serif font-bold text-[#4A3B32]">
                  {links.length === 0 ? "Aún no tienes productos vinculados" : "Bandeja al día"}
                </h3>
                <p className="text-xs text-[#7D6E65] max-w-md mx-auto">
                  {links.length === 0
                    ? "Vincula un producto con La Sirena, NTD Ingredientes, Empaketería o Dumé Papelería, o usa Carga Asistida (Plan B) para pegar cotizaciones/facturas."
                    : "No hay propuestas pendientes que coincidan con el filtro seleccionado."}
                </p>
                <div className="flex flex-wrap justify-center gap-2 pt-1">
                  <button
                    onClick={() => {
                      setActiveTab("LINKS");
                      setLinkModalOpen(true);
                    }}
                    className="px-4 py-2 rounded-lg bg-[#9C4266] text-white text-xs font-semibold"
                  >
                    + Vincular producto
                  </button>
                  <button
                    onClick={() => setActiveTab("ASSISTED")}
                    className="px-4 py-2 rounded-lg bg-[#FAF8F6] border border-[#E8E2D9] text-[#4A3B32] text-xs font-semibold"
                  >
                    Ir a Carga Asistida (Plan B)
                  </button>
                </div>
              </div>
            ) : (
              <>
                {/* Desktop Table */}
                <div className="hidden md:block bg-white rounded-xl border border-[#E8E2D9] shadow-sm overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-[#FAF8F6] border-b border-[#E8E2D9] text-xs font-semibold text-[#7D6E65] uppercase tracking-wider">
                          <th className="py-3 px-3">
                            <input
                              type="checkbox"
                              aria-label="Seleccionar todas las propuestas"
                              checked={selectedIds.length === filteredInbox.length && filteredInbox.length > 0}
                              onChange={(e) =>
                                setSelectedIds(e.target.checked ? filteredInbox.map((p) => p.id) : [])
                              }
                            />
                          </th>
                          <th className="py-3 px-3">ID / Producto</th>
                          <th className="py-3 px-3">Portal</th>
                          <th className="py-3 px-3">Presentación</th>
                          <th className="py-3 px-3">Actual → Propuesto (RD$)</th>
                          <th className="py-3 px-3">Variación</th>
                          <th className="py-3 px-3">Alertas</th>
                          <th className="py-3 px-3 text-right">Acciones</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#E8E2D9] text-sm">
                        {filteredInbox.map((p) => {
                          const draftPrice = priceDraftsDOP[p.id] ?? (p.proposedPriceCents / 100).toFixed(2);
                          const isBusy = submittingId === p.id || submittingId === "BATCH";
                          return (
                            <tr key={p.id} className="hover:bg-[#FAF8F6]/70">
                              <td className="py-3 px-3">
                                <input
                                  type="checkbox"
                                  aria-label={`Seleccionar ${p.code}`}
                                  checked={selectedIds.includes(p.id)}
                                  onChange={(e) =>
                                    setSelectedIds((prev) =>
                                      e.target.checked ? [...prev, p.id] : prev.filter((x) => x !== p.id)
                                    )
                                  }
                                />
                              </td>
                              <td className="py-3 px-3">
                                <div className="flex items-center gap-1.5">
                                  <span className="font-mono text-[11px] font-bold px-1.5 py-0.5 rounded bg-[#F3EFEA] text-[#9C4266]">
                                    {p.code}
                                  </span>
                                  <span className="font-mono text-[11px] text-[#7D6E65]">
                                    {p.ingredient.code}
                                  </span>
                                </div>
                                <div className="font-semibold text-[#4A3B32] mt-0.5">{p.ingredient.name}</div>
                                {p.detectedRawTitle && (
                                  <div className="text-[11px] text-[#7D6E65] truncate max-w-[230px]">
                                    Portal: {p.detectedRawTitle}
                                  </div>
                                )}
                              </td>
                              <td className="py-3 px-3 text-xs text-[#4A3B32]">
                                <div className="font-medium">{p.source.name}</div>
                                {p.evidenceUrl && (
                                  <a
                                    href={p.evidenceUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 text-[11px] text-[#9C4266] hover:underline"
                                  >
                                    Ver en portal <ExternalLink className="w-3 h-3" />
                                  </a>
                                )}
                              </td>
                              <td className="py-3 px-3 text-xs text-[#7D6E65] tabular-nums space-y-1">
                                <div>
                                  K_Sweet: {p.ingredient.packageQty} {p.ingredient.packageUnit}
                                </div>
                                <div>
                                  Detectado:{" "}
                                  {p.detectedPackQty
                                    ? `${p.detectedPackQty} ${p.detectedPackUnit || ""}`
                                    : "No especificado"}
                                </div>
                                {p.packCheckStatus === "PACK_MISMATCH" && (
                                  <select
                                    aria-label={`Estrategia de empaque para ${p.ingredient.name}`}
                                    value={strategyDrafts[p.id] ?? p.applyStrategyUsed}
                                    onChange={(e) => handleStrategyChange(p.id, e.target.value as ApplyStrategy)}
                                    className="w-full max-w-[190px] px-1.5 py-1 text-[11px] font-semibold rounded border border-[#D69E2E] bg-[#FEFCBF]/60 text-[#744210]"
                                  >
                                    <option value="STRICT_SAME_PACK">Bloquear (empaque distinto)</option>
                                    <option value="REBASE_UNIT_COST">Reescalar al empaque K_Sweet</option>
                                    <option value="ADOPT_SOURCE_PACK">Adoptar empaque detectado</option>
                                  </select>
                                )}
                              </td>
                              <td className="py-3 px-3 tabular-nums">
                                <div className="text-xs text-[#7D6E65]">
                                  Actual: {formatDOP(p.currentPriceCents)}
                                </div>
                                <div className="flex items-center gap-1 mt-1">
                                  <span className="text-xs font-semibold text-[#4A3B32]">RD$</span>
                                  <input
                                    type="number"
                                    step="0.01"
                                    min="0.01"
                                    aria-label={`Precio propuesto RD$ para ${p.ingredient.name}`}
                                    value={draftPrice}
                                    onChange={(e) =>
                                      setPriceDraftsDOP((prev) => ({ ...prev, [p.id]: e.target.value }))
                                    }
                                    className="w-24 px-2 py-1 text-xs font-bold rounded border border-[#E8E2D9] text-[#9C4266] tabular-nums"
                                  />
                                </div>
                              </td>
                              <td className="py-3 px-3 tabular-nums">
                                <span
                                  className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold ${
                                    p.diffPriceCents > 0
                                      ? "bg-[#FED7D7] text-[#742A2A]"
                                      : "bg-[#C6F6D5] text-[#22543D]"
                                  }`}
                                >
                                  {p.diffPriceCents > 0 ? "+" : ""}
                                  {p.diffPercent.toFixed(1)}%
                                </span>
                              </td>
                              <td className="py-3 px-3">
                                {p.alerts.length === 0 ? (
                                  <span className="text-xs text-[#3B7865] font-medium">Sin alertas</span>
                                ) : (
                                  <div className="flex flex-wrap gap-1 max-w-[180px]">
                                    {p.alerts.map((a) => (
                                      <span
                                        key={a}
                                        className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-[#FEFCBF] text-[#744210]"
                                      >
                                        {ALERT_LABELS[a] || a}
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </td>
                              <td className="py-3 px-3 text-right">
                                <div className="flex items-center justify-end gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => handleOpenImpact([p.id])}
                                    title="Ver impacto en recetas"
                                    aria-label={`Ver impacto en recetas de ${p.ingredient.name}`}
                                    className="p-1.5 rounded border border-[#E8E2D9] text-[#4A3B32] hover:bg-[#FAF8F6]"
                                  >
                                    <Eye className="w-4 h-4" />
                                  </button>
                                  <button
                                    type="button"
                                    disabled={isBusy}
                                    onClick={() => triggerApprove([p.id])}
                                    className="px-2.5 py-1.5 rounded bg-[#3B7865] hover:bg-[#2F6152] text-white text-xs font-semibold disabled:opacity-50"
                                  >
                                    Aprobar
                                  </button>
                                  <button
                                    type="button"
                                    disabled={isBusy}
                                    onClick={() =>
                                      setConfirmModal({ proposalIds: [p.id], alerts: [], action: "REJECT" })
                                    }
                                    className="p-1.5 rounded border border-[#FEB2B2] text-[#C53030] hover:bg-[#FFF5F5]"
                                    aria-label={`Rechazar ${p.code}`}
                                    title="Rechazar"
                                  >
                                    <XCircle className="w-4 h-4" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Mobile Stacked Cards */}
                <div className="md:hidden space-y-3">
                  {filteredInbox.map((p) => {
                    const draftPrice = priceDraftsDOP[p.id] ?? (p.proposedPriceCents / 100).toFixed(2);
                    const isBusy = submittingId === p.id || submittingId === "BATCH";
                    return (
                      <div key={p.id} className="bg-white rounded-xl border border-[#E8E2D9] p-4 shadow-sm space-y-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-start gap-2">
                            <input
                              type="checkbox"
                              aria-label={`Seleccionar propuesta ${p.code} de ${p.ingredient.name}`}
                              checked={selectedIds.includes(p.id)}
                              onChange={(e) =>
                                setSelectedIds((prev) =>
                                  e.target.checked ? [...prev, p.id] : prev.filter((x) => x !== p.id)
                                )
                              }
                              className="mt-1"
                            />
                            <div>
                              <span className="font-mono text-[11px] font-bold text-[#9C4266]">
                                {p.code} · {p.ingredient.code}
                              </span>
                              <h3 className="font-semibold text-sm text-[#4A3B32]">{p.ingredient.name}</h3>
                              <p className="text-[11px] text-[#7D6E65]">{p.source.name}</p>
                            </div>
                          </div>
                          <span
                            className={`px-2 py-0.5 rounded-full text-xs font-bold tabular-nums ${
                              p.diffPriceCents > 0 ? "bg-[#FED7D7] text-[#742A2A]" : "bg-[#C6F6D5] text-[#22543D]"
                            }`}
                          >
                            {p.diffPriceCents > 0 ? "+" : ""}
                            {p.diffPercent.toFixed(1)}%
                          </span>
                        </div>

                        {p.alerts.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {p.alerts.map((a) => (
                              <span
                                key={a}
                                className="px-2 py-0.5 rounded text-[10px] font-semibold bg-[#FEFCBF] text-[#744210]"
                              >
                                {ALERT_LABELS[a] || a}
                              </span>
                            ))}
                          </div>
                        )}

                        <div className="grid grid-cols-2 gap-2 text-xs bg-[#FAF8F6] p-2.5 rounded-lg tabular-nums">
                          <div>
                            <span className="text-[#7D6E65] block">Actual ({p.ingredient.packageQty} {p.ingredient.packageUnit}):</span>
                            <strong className="text-[#4A3B32]">{formatDOP(p.currentPriceCents)}</strong>
                          </div>
                          <div>
                            <span className="text-[#7D6E65] block">Propuesto (RD$):</span>
                            <input
                              type="number"
                              step="0.01"
                              min="0.01"
                              aria-label={`Precio propuesto RD$ móvil para ${p.ingredient.name}`}
                              value={draftPrice}
                              onChange={(e) =>
                                setPriceDraftsDOP((prev) => ({ ...prev, [p.id]: e.target.value }))
                              }
                              className="w-full px-2 py-1 text-xs font-bold rounded border border-[#E8E2D9] bg-white text-[#9C4266]"
                            />
                          </div>
                        </div>

                        {p.packCheckStatus === "PACK_MISMATCH" && (
                          <div className="space-y-1 text-xs">
                            <span className="text-[11px] font-semibold text-[#744210] block">
                              Empaque distinto ({p.detectedPackQty} {p.detectedPackUnit} detectado):
                            </span>
                            <select
                              aria-label={`Estrategia de empaque móvil para ${p.ingredient.name}`}
                              value={strategyDrafts[p.id] ?? p.applyStrategyUsed}
                              onChange={(e) => handleStrategyChange(p.id, e.target.value as ApplyStrategy)}
                              className="w-full px-2 py-1.5 text-xs font-semibold rounded-lg border border-[#D69E2E] bg-[#FEFCBF]/60 text-[#744210]"
                            >
                              <option value="STRICT_SAME_PACK">Bloquear (empaque distinto)</option>
                              <option value="REBASE_UNIT_COST">Reescalar al empaque K_Sweet</option>
                              <option value="ADOPT_SOURCE_PACK">Adoptar empaque detectado</option>
                            </select>
                          </div>
                        )}

                        <button
                          type="button"
                          onClick={() => handleOpenImpact([p.id])}
                          className="w-full py-2 text-xs font-semibold text-[#9C4266] bg-[#FAF5F7] rounded-lg border border-[#F3D5E2]"
                        >
                          Ver impacto en recetas y márgenes ▸
                        </button>

                        <div className="flex gap-2">
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => setConfirmModal({ proposalIds: [p.id], alerts: [], action: "REJECT" })}
                            className="w-2/5 min-h-[44px] rounded-lg border border-[#FEB2B2] text-[#C53030] text-xs font-semibold"
                          >
                            Rechazar
                          </button>
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => triggerApprove([p.id])}
                            className="w-3/5 min-h-[44px] rounded-lg bg-[#3B7865] text-white text-xs font-semibold"
                          >
                            Aprobar cambio
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Barra sticky de aprobación en lote (con pr-20 en móvil para no chocar con Sidebar FAB) */}
                {selectedIds.length > 0 && (
                  <div className="fixed bottom-4 left-4 right-4 md:left-72 z-30 bg-[#4A3B32] text-white rounded-xl px-4 py-3 pr-20 md:pr-4 shadow-xl flex flex-wrap items-center justify-between gap-3">
                    <span className="text-xs font-semibold tabular-nums">
                      {selectedIds.length} propuesta(s) seleccionada(s)
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleOpenImpact(selectedIds)}
                        className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-semibold"
                      >
                        Simular impacto
                      </button>
                      <button
                        type="button"
                        disabled={submittingId === "BATCH"}
                        onClick={() =>
                          setConfirmModal({ proposalIds: selectedIds, alerts: [], action: "REJECT" })
                        }
                        className="px-3 py-1.5 rounded-lg bg-[#C53030] text-xs font-semibold"
                      >
                        Rechazar
                      </button>
                      <button
                        type="button"
                        disabled={submittingId === "BATCH"}
                        onClick={() => triggerApprove(selectedIds)}
                        className="px-4 py-1.5 rounded-lg bg-[#3B7865] hover:bg-[#2F6152] text-xs font-semibold"
                      >
                        Aprobar seleccionadas
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        ) : activeTab === "LINKS" ? (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <p className="text-xs text-[#7D6E65]">
                Vincula tus productos con URLs de portales RD. Verificamos el peso/empaque antes de permitir cambios.
              </p>
              <button
                type="button"
                onClick={() => {
                  setVerifyResult(null);
                  setVerifyError(null);
                  setLinkModalOpen(true);
                }}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#9C4266] text-white text-xs font-semibold"
              >
                <Plus className="w-4 h-4" /> Vincular producto
              </button>
            </div>

            {links.length === 0 ? (
              <div className="bg-white rounded-xl p-10 border border-[#E8E2D9] text-center space-y-3">
                <Link2 className="w-9 h-9 text-[#A89F91] mx-auto" />
                <h3 className="text-base font-serif font-bold text-[#4A3B32]">Sin vínculos configurados</h3>
                <p className="text-xs text-[#7D6E65] max-w-md mx-auto">
                  Agrega enlaces de La Sirena, NTD Ingredientes, Empaketería RD o Dumé Papelería para consultar precios en línea.
                </p>
                <button
                  onClick={() => setLinkModalOpen(true)}
                  className="px-4 py-2 rounded-lg bg-[#9C4266] text-white text-xs font-semibold"
                >
                  + Vincular primer producto
                </button>
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-[#E8E2D9] shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-[#FAF8F6] border-b border-[#E8E2D9] text-xs font-semibold text-[#7D6E65] uppercase tracking-wider">
                        <th className="py-3 px-4">Producto</th>
                        <th className="py-3 px-4">Portal</th>
                        <th className="py-3 px-4">Estrategia / ITBIS</th>
                        <th className="py-3 px-4">Último Chequeo</th>
                        <th className="py-3 px-4 text-right">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E8E2D9] text-sm">
                      {links.map((l) => (
                        <tr key={l.id} className="hover:bg-[#FAF8F6]/70">
                          <td className="py-3 px-4">
                            <span className="font-mono text-[11px] font-bold text-[#9C4266]">{l.ingredient.code}</span>
                            <div className="font-semibold text-[#4A3B32]">{l.ingredient.name}</div>
                            <div className="text-xs text-[#7D6E65] tabular-nums">
                              {formatDOP(l.ingredient.packagePriceCents)} / {l.ingredient.packageQty} {l.ingredient.packageUnit}
                            </div>
                          </td>
                          <td className="py-3 px-4 text-xs">
                            <div className="font-semibold text-[#4A3B32]">{l.source.name}</div>
                            {l.externalUrl && (
                              <a
                                href={l.externalUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-[#9C4266] hover:underline max-w-[220px] truncate"
                              >
                                Abrir ficha <ExternalLink className="w-3 h-3 shrink-0" />
                              </a>
                            )}
                          </td>
                          <td className="py-3 px-4 text-xs text-[#7D6E65]">
                            <div>{STRATEGY_LABELS[l.applyStrategy] || l.applyStrategy}</div>
                            <div>
                              ITBIS: {l.taxRatePct}% ({TAX_MODE_LABELS[l.source.taxMode] || l.source.taxMode})
                            </div>
                          </td>
                          <td className="py-3 px-4 text-xs tabular-nums">
                            {l.lastError ? (
                              <span className="text-[#C53030] font-medium">{l.lastError}</span>
                            ) : l.lastSeenPriceCents ? (
                              <span className="text-[#22543D] font-semibold">
                                {formatDOP(l.lastSeenPriceCents)} {l.lastSeenInStock === false ? "(Agotado)" : ""}
                              </span>
                            ) : (
                              <span className="text-[#A89F91]">Pendiente consultar</span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <button
                              type="button"
                              onClick={() => handleDeleteLink(l.id)}
                              aria-label={`Desactivar vínculo de ${l.ingredient.name}`}
                              className="p-1.5 text-[#7D6E65] hover:text-[#C53030] rounded hover:bg-[#FAF8F6]"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        ) : activeTab === "ASSISTED" ? (
          <div className="bg-white rounded-xl border border-[#E8E2D9] shadow-sm p-5 space-y-4">
            <div>
              <h2 className="text-base font-serif font-bold text-[#4A3B32]">
                Carga Asistida (Plan B · Proveedores locales sin web o portales con bloqueo)
              </h2>
              <p className="text-xs text-[#7D6E65] mt-1">
                Pega cotizaciones de WhatsApp, líneas de factura o filas copiadas de Excel (ej.{" "}
                <code>PROD-007, Harina de Trigo, 215</code> o <code>Mantequilla Sosua 5 lb RD$ 540</code>).
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="md:col-span-2">
                <label htmlFor="assisted-raw" className="block text-xs font-semibold text-[#4A3B32] mb-1">
                  Texto de cotización / factura
                </label>
                <textarea
                  id="assisted-raw"
                  rows={4}
                  value={assistedText}
                  onChange={(e) => setAssistedText(e.target.value)}
                  placeholder={"Ejemplo:\nLeche Carnation 315g RD$ 75\nPROD-007, Harina de Trigo, 215.00"}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-[#E8E2D9] focus:outline-none focus:ring-2 focus:ring-[#9C4266]"
                />
              </div>
              <div className="space-y-3">
                <div>
                  <label htmlFor="assisted-source" className="block text-xs font-semibold text-[#4A3B32] mb-1">
                    Canal / Proveedor de origen
                  </label>
                  <select
                    id="assisted-source"
                    value={assistedSourceId}
                    onChange={(e) => setAssistedSourceId(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-[#E8E2D9] bg-white"
                  >
                    {sources.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>
                <button
                  type="button"
                  disabled={parsingAssisted || !assistedText.trim()}
                  onClick={handleParseAssisted}
                  className="w-full py-2.5 rounded-lg bg-[#9C4266] hover:bg-[#831843] text-white text-xs font-semibold disabled:opacity-50"
                >
                  {parsingAssisted ? "Analizando..." : "Analizar y emparejar"}
                </button>
              </div>
            </div>

            {assistedLines.length > 0 && (
              <div className="space-y-4 pt-3 border-t border-[#E8E2D9]">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#7D6E65]">
                  Líneas detectadas ({assistedLines.length})
                </h3>
                <div className="space-y-2">
                  {assistedLines.map((line, idx) => (
                    <div
                      key={idx}
                      className="grid grid-cols-1 md:grid-cols-12 gap-2 items-center p-2.5 rounded-lg bg-[#FAF8F6] border border-[#E8E2D9] text-xs"
                    >
                      <div className="md:col-span-4 flex items-center gap-2">
                        <input
                          type="checkbox"
                          aria-label={`Incluir línea ${idx + 1}`}
                          checked={line.include}
                          onChange={(e) => {
                            const checked = e.target.checked;
                            setAssistedLines((prev) =>
                              prev.map((item, i) => (i === idx ? { ...item, include: checked } : item))
                            );
                          }}
                        />
                        <span className="truncate font-medium text-[#4A3B32]" title={line.rawLine}>
                          {line.rawLine}
                        </span>
                      </div>
                      <div className="md:col-span-4">
                        <select
                          aria-label={`Producto para línea ${idx + 1}`}
                          value={line.selectedIngredientId}
                          onChange={(e) => {
                            const selectedId = e.target.value;
                            setAssistedLines((prev) =>
                              prev.map((item, i) =>
                                i === idx
                                  ? {
                                      ...item,
                                      selectedIngredientId: selectedId,
                                      include: selectedId && item.priceDOP ? true : item.include,
                                    }
                                  : item
                              )
                            );
                          }}
                          className="w-full px-2 py-1.5 rounded border border-[#E8E2D9] bg-white text-xs"
                        >
                          <option value="">-- Seleccionar producto K_Sweet --</option>
                          {ingredients.map((ing) => (
                            <option key={ing.id} value={ing.id}>
                              {ing.code} · {ing.name} ({ing.packageQty} {ing.packageUnit})
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="md:col-span-2">
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          aria-label={`Precio RD$ para línea ${idx + 1}`}
                          placeholder="Precio RD$"
                          value={line.priceDOP}
                          onChange={(e) => {
                            const val = e.target.value;
                            setAssistedLines((prev) =>
                              prev.map((item, i) => (i === idx ? { ...item, priceDOP: val } : item))
                            );
                          }}
                          className="w-full px-2 py-1.5 rounded border border-[#E8E2D9] bg-white font-bold text-[#9C4266] tabular-nums"
                        />
                      </div>
                      <div className="md:col-span-2">
                        <select
                          aria-label={`ITBIS para línea ${idx + 1}`}
                          value={line.taxRatePct}
                          onChange={(e) => {
                            const tax = e.target.value;
                            setAssistedLines((prev) =>
                              prev.map((item, i) => (i === idx ? { ...item, taxRatePct: tax } : item))
                            );
                          }}
                          className="w-full px-2 py-1.5 rounded border border-[#E8E2D9] bg-white text-xs"
                        >
                          <option value="0">ITBIS 0%</option>
                          <option value="16">ITBIS 16%</option>
                          <option value="18">ITBIS 18%</option>
                        </select>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Opción de gasto operativo sin duplicar COGS (RF-020) */}
                <div className="p-3.5 rounded-xl bg-[#FAF8F6] border border-[#E8E2D9] space-y-3">
                  <label className="flex items-center gap-2 text-xs font-semibold text-[#4A3B32] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={registerExpense}
                      onChange={(e) => setRegisterExpense(e.target.checked)}
                    />
                    <span>
                      Registrar también esta compra en Gastos Operativos (marcada como{" "}
                      <code>Compra de Insumos</code> para no duplicar COGS en el Cuadre Semanal)
                    </span>
                  </label>

                  {registerExpense && (
                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5 pt-1">
                      <input
                        type="date"
                        value={expenseForm.expenseDate}
                        onChange={(e) => setExpenseForm({ ...expenseForm, expenseDate: e.target.value })}
                        className="px-2.5 py-1.5 text-xs rounded border border-[#E8E2D9] bg-white"
                      />
                      <input
                        type="number"
                        step="0.01"
                        min="0.01"
                        placeholder="Monto total factura (RD$)"
                        value={expenseForm.amountDOP}
                        onChange={(e) => setExpenseForm({ ...expenseForm, amountDOP: e.target.value })}
                        className="px-2.5 py-1.5 text-xs font-bold rounded border border-[#E8E2D9] bg-white tabular-nums"
                      />
                      <select
                        value={expenseForm.paymentMethod}
                        onChange={(e) =>
                          setExpenseForm({
                            ...expenseForm,
                            paymentMethod: e.target.value as "EFECTIVO" | "TRANSFERENCIA" | "TARJETA",
                          })
                        }
                        className="px-2.5 py-1.5 text-xs rounded border border-[#E8E2D9] bg-white"
                      >
                        <option value="EFECTIVO">Efectivo (Arqueo)</option>
                        <option value="TRANSFERENCIA">Transferencia</option>
                        <option value="TARJETA">Tarjeta</option>
                      </select>
                      <input
                        type="text"
                        placeholder="Concepto de factura"
                        value={expenseForm.concept}
                        onChange={(e) => setExpenseForm({ ...expenseForm, concept: e.target.value })}
                        className="px-2.5 py-1.5 text-xs rounded border border-[#E8E2D9] bg-white"
                      />
                    </div>
                  )}
                </div>

                <div className="flex justify-end">
                  <button
                    type="button"
                    disabled={submittingAssisted}
                    onClick={handleSendAssistedToInbox}
                    className="px-5 py-2.5 rounded-lg bg-[#9C4266] hover:bg-[#831843] text-white text-xs font-semibold disabled:opacity-50"
                  >
                    {submittingAssisted ? "Enviando..." : "Enviar a Bandeja de Aprobación"}
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-xl border border-[#E8E2D9] p-4 shadow-sm space-y-3">
              <h3 className="font-serif font-bold text-sm text-[#4A3B32]">
                Propuestas Procesadas ({historyProposals.length})
              </h3>
              {historyProposals.length === 0 ? (
                <p className="text-xs text-[#7D6E65] py-6 text-center">Sin historial de revisiones todavía.</p>
              ) : (
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {historyProposals.map((hp) => (
                    <div
                      key={hp.id}
                      className="p-2.5 rounded-lg bg-[#FAF8F6] border border-[#E8E2D9] flex items-center justify-between text-xs gap-2"
                    >
                      <div>
                        <span className="font-mono font-bold text-[#9C4266]">{hp.code}</span>{" "}
                        <strong className="text-[#4A3B32]">{hp.ingredient.name}</strong>
                        <div className="text-[11px] text-[#7D6E65] tabular-nums">
                          {formatDOP(hp.currentPriceCents)} → {formatDOP(hp.proposedPriceCents)} ({hp.source.name})
                        </div>
                      </div>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${
                          hp.status === "APPROVED"
                            ? "bg-[#C6F6D5] text-[#22543D]"
                            : hp.status === "REJECTED"
                            ? "bg-[#FED7D7] text-[#742A2A]"
                            : "bg-[#F3EFEA] text-[#7D6E65]"
                        }`}
                      >
                        {PROPOSAL_STATUS_LABELS[hp.status] || hp.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-white rounded-xl border border-[#E8E2D9] p-4 shadow-sm space-y-3">
              <h3 className="font-serif font-bold text-sm text-[#4A3B32]">
                Últimas Consultas ({syncRuns.length})
              </h3>
              {syncRuns.length === 0 ? (
                <p className="text-xs text-[#7D6E65] py-6 text-center">Sin corridas registradas aún.</p>
              ) : (
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {syncRuns.map((run) => (
                    <div
                      key={run.id}
                      className="p-2.5 rounded-lg bg-[#FAF8F6] border border-[#E8E2D9] flex items-center justify-between text-xs"
                    >
                      <div>
                        <strong className="text-[#4A3B32]">{run.source?.name || run.triggerType}</strong>
                        <div className="text-[11px] text-[#7D6E65] tabular-nums">
                          {new Date(run.startedAt).toLocaleString("es-DO")} · Revisados: {run.totalChecked} · Nuevas:{" "}
                          {run.proposalsCreated}
                        </div>
                      </div>
                      <span className="px-2 py-0.5 rounded bg-[#F3EFEA] text-[10px] font-bold text-[#4A3B32]">
                        {RUN_STATUS_LABELS[run.status] || run.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* DRAWER / MODAL DE IMPACTO EN RECETAS ANTES DE APROBAR */}
        {impactOpen && (
          <div className="fixed inset-0 z-[55] flex items-center justify-center p-4 bg-black/50" role="dialog" aria-modal="true">
            <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-xl border border-[#E8E2D9] relative max-h-[88vh] overflow-y-auto space-y-4">
              <button
                onClick={() => setImpactOpen(false)}
                aria-label="Cerrar simulador de impacto"
                className="absolute top-4 right-4 p-1.5 rounded-full text-[#7D6E65] hover:bg-[#FAF8F6]"
              >
                <X className="w-5 h-5" />
              </button>
              <div>
                <h2 className="text-lg font-serif font-bold text-[#4A3B32]">Impacto Antes de Aprobar</h2>
                <p className="text-xs text-[#7D6E65]">
                  Simulación en solo lectura. Tus ventas pasadas y precios de carta fijados manualmente no cambiarán.
                </p>
              </div>

              {impactLoading ? (
                <div className="py-10 text-center">
                  <RefreshCw className="w-6 h-6 text-[#9C4266] animate-spin mx-auto mb-2" />
                  <p className="text-xs text-[#7D6E65]">Calculando cascada en recetas y presentaciones...</p>
                </div>
              ) : impactReport ? (
                <div className="space-y-4">
                  {impactReport.warnings.length > 0 && (
                    <div className="p-3 rounded-lg bg-[#FEFCBF]/70 border border-[#F6E05E] text-xs text-[#744210] space-y-1">
                      <strong>Advertencias heredadas de conversión (se conservan valores previos):</strong>
                      {impactReport.warnings.map((w, i) => (
                        <div key={i}>• {w.entityName}: {w.message}</div>
                      ))}
                    </div>
                  )}

                  <div>
                    <h4 className="text-xs font-bold uppercase text-[#7D6E65] mb-2">
                      Recetas Madre / Subrecetas Afectadas ({impactReport.recipes.length})
                    </h4>
                    {impactReport.recipes.length === 0 ? (
                      <p className="text-xs text-[#7D6E65]">Este producto aún no está asignado a recetas activas.</p>
                    ) : (
                      <div className="space-y-2">
                        {impactReport.recipes.map((r) => (
                          <div
                            key={r.recipeId}
                            className="p-2.5 rounded-lg bg-[#FAF8F6] border border-[#E8E2D9] flex items-center justify-between text-xs tabular-nums"
                          >
                            <div>
                              <strong className="text-[#4A3B32]">{r.recipeName}</strong>
                              <div className="text-[#7D6E65]">
                                Lote: {formatDOP(r.batchCostBeforeCents)} →{" "}
                                <strong className="text-[#9C4266]">{formatDOP(r.batchCostAfterCents)}</strong>
                              </div>
                            </div>
                            <span className="font-bold text-[#9C4266]">
                              {r.deltaBatchCents >= 0 ? "+" : ""}
                              {r.deltaPercent}%
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div>
                    <h4 className="text-xs font-bold uppercase text-[#7D6E65] mb-2">
                      Presentaciones y Variantes Afectadas ({impactReport.presentations.length})
                    </h4>
                    {impactReport.presentations.length === 0 ? (
                      <p className="text-xs text-[#7D6E65]">Sin presentaciones afectadas.</p>
                    ) : (
                      <div className="space-y-2">
                        {impactReport.presentations.map((pr) => (
                          <div
                            key={pr.presentationId}
                            className="p-2.5 rounded-lg bg-[#FAF8F6] border border-[#E8E2D9] flex items-center justify-between text-xs tabular-nums gap-2"
                          >
                            <div>
                              <strong className="text-[#4A3B32]">
                                {pr.recipeName} — {pr.presentationName}
                              </strong>
                              <div className="text-[#7D6E65]">
                                Costo: {formatDOP(pr.totalCostBeforeCents)} → {formatDOP(pr.totalCostAfterCents)} | Carta:{" "}
                                {formatDOP(pr.finalPriceCents)}
                              </div>
                            </div>
                            <span
                              className={`px-2 py-0.5 rounded font-semibold shrink-0 ${
                                pr.healthStatus === "OK"
                                  ? "bg-[#C6F6D5] text-[#22543D]"
                                  : "bg-[#FED7D7] text-[#742A2A]"
                              }`}
                            >
                              Margen: {pr.realMarginBeforePct}% → {pr.realMarginAfterPct}%
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        )}

        {/* MODAL CONFIRMACIÓN ALERTAS CRÍTICAS / RECHAZO */}
        {confirmModal && (() => {
          const modalProps = proposals.filter((p) => confirmModal.proposalIds.includes(p.id));
          const mismatchModalProps = modalProps.filter((p) => p.packCheckStatus === "PACK_MISMATCH");
          const unresolvedMismatchCount = mismatchModalProps.filter(
            (p) => (strategyDrafts[p.id] ?? p.applyStrategyUsed) === "STRICT_SAME_PACK"
          ).length;

          return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" role="dialog" aria-modal="true">
            <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-[#E8E2D9] space-y-4">
              <h3 className="text-lg font-serif font-bold text-[#4A3B32]">
                {confirmModal.action === "APPROVE" ? "Confirmar Alertas Críticas" : "Rechazar Propuesta(s)"}
              </h3>

              {confirmModal.action === "APPROVE" ? (
                <>
                  <p className="text-xs text-[#7D6E65]">
                    Las propuestas seleccionadas presentan las siguientes alertas. Confirma que verificaste el enlace y
                    el peso/presentación antes de aplicar el nuevo costo:
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {confirmModal.alerts.map((a) => (
                      <span key={a} className="px-2 py-0.5 rounded text-xs font-semibold bg-[#FEFCBF] text-[#744210]">
                        {ALERT_LABELS[a] || a}
                      </span>
                    ))}
                  </div>

                  {mismatchModalProps.length > 0 && (
                    <div className="p-3 rounded-lg bg-[#FAF8F6] border border-[#E8E2D9] space-y-2 text-xs">
                      <p className="font-semibold text-[#4A3B32]">
                        Resolución obligatoria de empaque distinto:
                      </p>
                      {mismatchModalProps.map((mp) => {
                        const eff = strategyDrafts[mp.id] ?? mp.applyStrategyUsed;
                        return (
                          <div key={mp.id} className="space-y-1">
                            <div className="text-[11px] text-[#7D6E65]">
                              <strong>{mp.ingredient.name}</strong> ({mp.ingredient.packageQty}{" "}
                              {mp.ingredient.packageUnit} vs {mp.detectedPackQty} {mp.detectedPackUnit})
                            </div>
                            <select
                              aria-label={`Resolver empaque de ${mp.ingredient.name}`}
                              value={eff}
                              onChange={(e) => handleStrategyChange(mp.id, e.target.value as ApplyStrategy)}
                              className="w-full px-2 py-1.5 text-xs font-semibold rounded border border-[#D69E2E] bg-white text-[#4A3B32]"
                            >
                              <option value="STRICT_SAME_PACK">Bloquear (no permite aprobar)</option>
                              <option value="REBASE_UNIT_COST">Reescalar al empaque actual en K_Sweet</option>
                              <option value="ADOPT_SOURCE_PACK">Adoptar empaque detectado del portal</option>
                            </select>
                          </div>
                        );
                      })}
                      {unresolvedMismatchCount > 0 && (
                        <p className="text-[11px] text-[#C53030] font-medium">
                          Selecciona &ldquo;Reescalar&rdquo; o &ldquo;Adoptar empaque&rdquo; para poder aprobar.
                        </p>
                      )}
                    </div>
                  )}

                  <label className="flex items-center gap-2 text-xs font-semibold text-[#4A3B32] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={criticalChecked}
                      onChange={(e) => setCriticalChecked(e.target.checked)}
                    />
                    Verifiqué enlace, ITBIS y presentación del producto
                  </label>
                  <div className="flex flex-wrap justify-between items-center gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => handleOpenImpact(confirmModal.proposalIds)}
                      className="px-3 py-2 text-xs font-semibold text-[#9C4266] bg-[#FAF5F7] border border-[#F3D5E2] rounded-lg"
                    >
                      Simular impacto
                    </button>
                    <div className="flex gap-2 ml-auto">
                      <button
                        type="button"
                        onClick={() => setConfirmModal(null)}
                        className="px-4 py-2 text-xs font-semibold text-[#7D6E65]"
                      >
                        Cancelar
                      </button>
                      <button
                        type="button"
                        disabled={!criticalChecked || submittingId !== null || unresolvedMismatchCount > 0}
                        onClick={() => triggerApprove(confirmModal.proposalIds, true)}
                        className="px-4 py-2 text-xs font-semibold text-white bg-[#9C4266] rounded-lg disabled:opacity-50"
                      >
                        Aprobar de todas formas
                      </button>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <label htmlFor="reject-note" className="block text-xs font-semibold text-[#4A3B32] mb-1">
                      Motivo opcional
                    </label>
                    <input
                      id="reject-note"
                      type="text"
                      value={rejectNote}
                      onChange={(e) => setRejectNote(e.target.value)}
                      placeholder="Ej. Presentación distinta o precio promocional temporal"
                      className="w-full px-3 py-2 text-xs rounded-lg border border-[#E8E2D9]"
                    />
                  </div>
                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setConfirmModal(null)}
                      className="px-4 py-2 text-xs font-semibold text-[#7D6E65]"
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      disabled={submittingId !== null}
                      onClick={handleConfirmReject}
                      className="px-4 py-2 text-xs font-semibold text-white bg-[#C53030] rounded-lg disabled:opacity-50"
                    >
                      Confirmar Rechazo
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
          );
        })()}

        {/* MODAL VINCULAR PRODUCTO */}
        {linkModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" role="dialog" aria-modal="true">
            <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-[#E8E2D9] relative max-h-[90vh] overflow-y-auto space-y-4">
              <button
                onClick={() => setLinkModalOpen(false)}
                aria-label="Cerrar modal vincular"
                className="absolute top-4 right-4 p-1.5 rounded-full text-[#7D6E65] hover:bg-[#FAF8F6]"
              >
                <X className="w-5 h-5" />
              </button>

              <h2 className="text-lg font-serif font-bold text-[#4A3B32]">Vincular Producto a Portal RD</h2>

              <form onSubmit={handleSaveLink} className="space-y-3.5">
                <div>
                  <label htmlFor="search-ing-link" className="block text-xs font-semibold text-[#4A3B32] mb-1">
                    Buscar Producto K_Sweet
                  </label>
                  <div className="relative mb-1.5">
                    <Search className="w-3.5 h-3.5 text-[#A89F91] absolute left-2.5 top-1/2 -translate-y-1/2" />
                    <input
                      id="search-ing-link"
                      type="text"
                      placeholder="Filtrar por PROD-XXX o nombre..."
                      value={linkSearchIng}
                      onChange={(e) => setLinkSearchIng(e.target.value)}
                      className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-[#E8E2D9]"
                    />
                  </div>
                  <select
                    required
                    value={linkForm.ingredientId}
                    onChange={(e) => setLinkForm({ ...linkForm, ingredientId: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-[#E8E2D9] bg-white"
                  >
                    <option value="">-- Selecciona un producto --</option>
                    {filteredIngredientsForLink.slice(0, 120).map((ing) => (
                      <option key={ing.id} value={ing.id}>
                        {ing.code} · {ing.name} ({formatDOP(ing.packagePriceCents)} / {ing.packageQty} {ing.packageUnit})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="link-source" className="block text-xs font-semibold text-[#4A3B32] mb-1">
                      Portal / Fuente *
                    </label>
                    <select
                      id="link-source"
                      required
                      value={linkForm.sourceId}
                      onChange={(e) => setLinkForm({ ...linkForm, sourceId: e.target.value })}
                      className="w-full px-3 py-2 text-xs rounded-lg border border-[#E8E2D9] bg-white"
                    >
                      {sources.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="link-itbis" className="block text-xs font-semibold text-[#4A3B32] mb-1">
                      ITBIS Aplicable
                    </label>
                    <select
                      id="link-itbis"
                      value={linkForm.taxRatePct}
                      onChange={(e) => setLinkForm({ ...linkForm, taxRatePct: e.target.value })}
                      className="w-full px-3 py-2 text-xs rounded-lg border border-[#E8E2D9] bg-white"
                    >
                      <option value="0">0% (Exento o Incluido)</option>
                      <option value="16">16% (Azúcar/Lácteos/Grasas RD)</option>
                      <option value="18">18% (Empaques / Otros)</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label htmlFor="link-url" className="block text-xs font-semibold text-[#4A3B32] mb-1">
                    URL del Producto en el Portal {selectedSourceObj?.adapterType === "MANUAL_ASSISTED" ? "(Opcional)" : "*"}
                  </label>
                  <div className="flex gap-2">
                    <input
                      id="link-url"
                      type="url"
                      required={selectedSourceObj?.adapterType !== "MANUAL_ASSISTED"}
                      placeholder="https://www.sirena.do/..."
                      value={linkForm.externalUrl}
                      onChange={(e) => setLinkForm({ ...linkForm, externalUrl: e.target.value })}
                      className="flex-1 px-3 py-2 text-xs rounded-lg border border-[#E8E2D9]"
                    />
                    {selectedSourceObj?.adapterType !== "MANUAL_ASSISTED" && (
                      <button
                        type="button"
                        disabled={verifyingLink}
                        onClick={handleVerifyLink}
                        className="px-3 py-2 rounded-lg bg-[#FAF8F6] border border-[#9C4266] text-[#9C4266] text-xs font-semibold shrink-0 disabled:opacity-50"
                      >
                        {verifyingLink ? "Verificando..." : "Verificar enlace"}
                      </button>
                    )}
                  </div>
                </div>

                <div>
                  <label htmlFor="link-strategy" className="block text-xs font-semibold text-[#4A3B32] mb-1">
                    Si el empaque del portal difiere al de K_Sweet:
                  </label>
                  <select
                    id="link-strategy"
                    value={linkForm.applyStrategy}
                    onChange={(e) => setLinkForm({ ...linkForm, applyStrategy: e.target.value as ApplyStrategy })}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-[#E8E2D9] bg-white"
                  >
                    <option value="STRICT_SAME_PACK">Bloquear si cambia el empaque (Recomendado)</option>
                    <option value="REBASE_UNIT_COST">Reescalar al empaque actual en K_Sweet</option>
                    <option value="ADOPT_SOURCE_PACK">Adoptar empaque detectado del portal</option>
                  </select>
                </div>

                {verifyError && (
                  <div className="p-2.5 rounded-lg bg-[#FED7D7]/70 border border-[#FEB2B2] text-xs text-[#742A2A]">
                    {verifyError}
                  </div>
                )}

                {verifyResult && (
                  <div className="p-3 rounded-lg bg-[#FAF5F7] border border-[#F3D5E2] text-xs space-y-1.5 tabular-nums">
                    <div className="font-bold text-[#9C4266]">
                      Detectado: {verifyResult.detectedTitle} — {formatDOP(verifyResult.detectedPriceWithTaxCents)}
                    </div>
                    <div className="text-[#4A3B32]">
                      Empaque portal:{" "}
                      {verifyResult.detectedPackQty
                        ? `${verifyResult.detectedPackQty} ${verifyResult.detectedPackUnit}`
                        : "No detectado"}{" "}
                      · Estado: <strong>{PACK_CHECK_LABELS[verifyResult.packCheckStatus] || verifyResult.packCheckStatus}</strong>
                    </div>
                    {verifyResult.alerts?.length > 0 && (
                      <div className="flex flex-wrap gap-1 pt-0.5">
                        {verifyResult.alerts.map((a) => (
                          <span key={a} className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-[#FEFCBF] text-[#744210]">
                            {ALERT_LABELS[a] || a}
                          </span>
                        ))}
                      </div>
                    )}
                    {verifyResult.ambiguousVariant && verifyResult.variants && verifyResult.variants.length > 1 && (
                      <div className="text-[11px] text-[#744210] pt-1">
                        Múltiples variantes encontradas (copia <code>?variant=ID</code> en la URL o usa SKU):{" "}
                        {verifyResult.variants.slice(0, 4).map((v) => `${v.title} (${v.id})`).join(" · ")}
                      </div>
                    )}
                  </div>
                )}

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setLinkModalOpen(false)}
                    className="px-4 py-2 text-xs font-semibold text-[#7D6E65]"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={savingLink}
                    className="px-5 py-2 rounded-lg bg-[#9C4266] text-white text-xs font-semibold disabled:opacity-50"
                  >
                    {savingLink ? "Guardando..." : "Guardar Vínculo"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
