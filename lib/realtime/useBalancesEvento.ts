import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

import { getGastosByEvento } from "@/lib/api/gastos";
import { obtenerPagosEvento } from "@/lib/api/pagos";
import {
    calcularBalances,
    simplificarDeudas,
    type BalanceParticipante,
    type Deuda,
} from "@/lib/balances";
import { useEventoRealtime } from "./useEventoRealtime";

type GastoConParticipaciones = {
  gastos_pagadores?: { contacto_id: string; monto_aportado: number }[];
  gastos_consumidores?: { contacto_id: string; parte: number }[];
};

type MovimientoSaldo = {
  tipo: "aporte" | "consumo" | "pago_saldado";
  descripcion: string;
  monto: number;
  fecha?: string | null;
  contraparteId?: string;
};

export type DetalleParticipanteSaldo = {
  contactoId: string;
  saldoNeto: number;
  totalAportado: number;
  totalConsumido: number;
  pagosSaldados: number;
  movimientos: MovimientoSaldo[];
};

export type SaldosEvento = {
  balances: BalanceParticipante[];
  deudas: Deuda[];
  detalleParticipantes: DetalleParticipanteSaldo[];
};

const extraerParticipaciones = (gastos: GastoConParticipaciones[]) => {
  const pagadores: { contacto_id: string; monto_aportado: number }[] = [];
  const consumidores: { contacto_id: string; parte: number }[] = [];

  for (const gasto of gastos) {
    if (gasto.gastos_pagadores?.length) {
      pagadores.push(...gasto.gastos_pagadores);
    }

    if (gasto.gastos_consumidores?.length) {
      consumidores.push(...gasto.gastos_consumidores);
    }
  }

  return { pagadores, consumidores };
};

export const useBalancesEvento = (eventoId: string) => {
  useEventoRealtime(eventoId);

  // Consultar todos los gastos del evento
  const queryGastos = useQuery({
    queryKey: ["gastos", eventoId],
    queryFn: () => getGastosByEvento(eventoId),
    enabled: Boolean(eventoId),
  });

  // Consultar todos los pagos del evento (NUEVO)
  const queryPagos = useQuery({
    queryKey: ["pagos", eventoId],
    queryFn: () => obtenerPagosEvento(eventoId),
    enabled: Boolean(eventoId),
  });

  // Recalcular saldos cuando cambien los gastos o los pagos
  const saldos = useMemo<SaldosEvento>(() => {
    const gastos = (queryGastos.data ?? []) as GastoConParticipaciones[];
    const pagos = (queryPagos.data ?? []) as any[];

    const { pagadores, consumidores } = extraerParticipaciones(gastos);

    // Filtramos para considerar SOLO los pagos que el acreedor ya confirmó (saldados)
    const pagosSaldados = pagos.filter((p) => p.estado === "saldado");

    // Le pasamos el nuevo parámetro a nuestro motor de cálculo
    const balances = calcularBalances(pagadores, consumidores, pagosSaldados);
    const detalles = new Map<string, DetalleParticipanteSaldo>();

    const obtenerDetalle = (contactoId: string): DetalleParticipanteSaldo => {
      const existente = detalles.get(contactoId);

      if (existente) return existente;

      const nuevoDetalle: DetalleParticipanteSaldo = {
        contactoId,
        saldoNeto: 0,
        totalAportado: 0,
        totalConsumido: 0,
        pagosSaldados: 0,
        movimientos: [],
      };

      detalles.set(contactoId, nuevoDetalle);
      return nuevoDetalle;
    };

    for (const gasto of gastos as any[]) {
      const fecha = gasto.fecha ?? null;

      for (const pagador of gasto.gastos_pagadores ?? []) {
        const detalle = obtenerDetalle(pagador.contacto_id);
        const monto = Number(pagador.monto_aportado ?? 0);

        detalle.totalAportado += monto;
        detalle.movimientos.push({
          tipo: "aporte",
          descripcion: `Aporte${gasto.descripcion ? ` en ${gasto.descripcion}` : ""}`,
          monto,
          fecha,
        });
      }

      for (const consumidor of gasto.gastos_consumidores ?? []) {
        const detalle = obtenerDetalle(consumidor.contacto_id);
        const monto = Number(consumidor.parte ?? 0);

        detalle.totalConsumido += monto;
        detalle.movimientos.push({
          tipo: "consumo",
          descripcion: `Consumo${gasto.descripcion ? ` en ${gasto.descripcion}` : ""}`,
          monto,
          fecha,
        });
      }
    }

    for (const pago of pagosSaldados) {
      const monto = Number(pago.monto ?? 0);

      if (pago.deudor_id) {
        const detalle = obtenerDetalle(pago.deudor_id);
        detalle.pagosSaldados += monto;
        detalle.movimientos.push({
          tipo: "pago_saldado",
          descripcion: "Pago confirmado",
          monto,
          fecha: pago.confirmado_en ?? null,
          contraparteId: pago.acreedor_id,
        });
      }

      if (pago.acreedor_id) {
        const detalle = obtenerDetalle(pago.acreedor_id);
        detalle.pagosSaldados += monto;
        detalle.movimientos.push({
          tipo: "pago_saldado",
          descripcion: "Pago recibido y confirmado",
          monto,
          fecha: pago.confirmado_en ?? null,
          contraparteId: pago.deudor_id,
        });
      }
    }

    for (const balance of balances) {
      const detalle = obtenerDetalle(balance.contactoId);
      detalle.saldoNeto = balance.balance;
    }

    return {
      balances,
      deudas: simplificarDeudas(balances),
      detalleParticipantes: Array.from(detalles.values()).sort(
        (izquierda, derecha) =>
          izquierda.contactoId.localeCompare(derecha.contactoId),
      ),
    };
  }, [queryGastos.data, queryPagos.data]);

  // Retornamos combinando los estados de carga de ambas consultas
  return {
    isLoading: queryGastos.isLoading || queryPagos.isLoading,
    error: queryGastos.error || queryPagos.error,
    balances: saldos.balances,
    deudas: saldos.deudas,
  };
};
