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

export type SaldosEvento = {
  balances: BalanceParticipante[];
  deudas: Deuda[];
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

    return {
      balances,
      deudas: simplificarDeudas(balances),
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
