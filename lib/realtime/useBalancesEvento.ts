import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

import { getGastosByEvento } from "@/lib/api/gastos";
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

  const query = useQuery({
    queryKey: ["gastos", eventoId],
    queryFn: () => getGastosByEvento(eventoId),
    enabled: Boolean(eventoId),
  });

  const saldos = useMemo<SaldosEvento>(() => {
    const gastos = (query.data ?? []) as GastoConParticipaciones[];
    const { pagadores, consumidores } = extraerParticipaciones(gastos);
    const balances = calcularBalances(pagadores, consumidores);

    return {
      balances,
      deudas: simplificarDeudas(balances),
    };
  }, [query.data]);

  return {
    ...query,
    ...saldos,
  };
};
