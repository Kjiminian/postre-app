import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Formatea centavos a RD$ con 2 decimales */
export function formatDOP(cents: number): string {
  return `RD$ ${(cents / 100).toLocaleString("es-DO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** Formatea un float como RD$ */
export function formatDOPFloat(value: number): string {
  return formatDOP(Math.round(value * 100));
}

/** Convierte valor decimal RD$ a centavos enteros (sin floating point errors) */
export function toCents(dop: number | string): number {
  return Math.round(parseFloat(String(dop)) * 100);
}

/** Convierte centavos a float RD$ */
export function fromCents(cents: number): number {
  return cents / 100;
}

/** Formatea una fecha a dd/mm/aaaa en zona RD */
export function formatDateRD(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("es-DO", {
    timeZone: "America/Santo_Domingo",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

/** Slug seguro desde nombre */
export function toSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Genera código de pedido único */
export function generateOrderCode(): string {
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10).replace(/-/g, "");
  const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `PED-${dateStr}-${rand}`;
}
