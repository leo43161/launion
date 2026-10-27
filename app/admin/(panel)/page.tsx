"use client";
// Por ahora el inicio del panel es el catálogo. Cuando estén ventas y taller, acá va el resumen del día.
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function Inicio() {
  const router = useRouter();
  useEffect(() => router.replace("/admin/catalogo/"), [router]);
  return null;
}
