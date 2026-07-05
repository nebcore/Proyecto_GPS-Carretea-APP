import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "../supabase";

const INTERVALO_RESPALDO_MS = 8000;
const ESPERA_REFRESCO_REALTIME_MS = 500;

export const useEventoRealtime = (eventoId: string) => {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!eventoId) return;

    const refrescarResumenes = () => {
      queryClient.invalidateQueries({ queryKey: ["eventos"] });
      queryClient.invalidateQueries({ queryKey: ["total-gastos"] });
      queryClient.invalidateQueries({ queryKey: ["actividad-reciente"] });
    };

    const refrescarGastosEvento = () => {
      queryClient.invalidateQueries({ queryKey: ["gastos", eventoId] });
      queryClient.invalidateQueries({ queryKey: ["gastos-detalle", eventoId] });
      refrescarResumenes();
    };

    const refrescarPagosEvento = () => {
      queryClient.invalidateQueries({ queryKey: ["pagos", eventoId] });
      refrescarResumenes();
    };

    const refrescarFeedEvento = () => {
      queryClient.invalidateQueries({
        queryKey: ["notificaciones-evento", eventoId],
      });
      queryClient.invalidateQueries({ queryKey: ["notificaciones"] });
      queryClient.invalidateQueries({ queryKey: ["notificaciones-no-leidas"] });
    };

    const refrescarEvento = () => {
      queryClient.invalidateQueries({ queryKey: ["evento", eventoId] });
      queryClient.invalidateQueries({ queryKey: ["participantes", eventoId] });
      refrescarResumenes();
    };

    const refrescarEventoCompleto = () => {
      refrescarEvento();
      refrescarGastosEvento();
      refrescarPagosEvento();
      refrescarFeedEvento();
    };

    const refrescarConEspera = () => {
      window.setTimeout(refrescarEventoCompleto, ESPERA_REFRESCO_REALTIME_MS);
    };

    const channel = supabase
      .channel(`evento-${eventoId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "gastos",
          filter: `evento_id=eq.${eventoId}`,
        },
        refrescarConEspera,
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "gastos_pagadores",
        },
        refrescarConEspera,
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "gastos_consumidores",
        },
        refrescarConEspera,
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "pagos",
          filter: `evento_id=eq.${eventoId}`,
        },
        refrescarConEspera,
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "participantes_evento",
          filter: `evento_id=eq.${eventoId}`,
        },
        refrescarConEspera,
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "eventos",
          filter: `id=eq.${eventoId}`,
        },
        refrescarConEspera,
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notificaciones",
          filter: `evento_id=eq.${eventoId}`,
        },
        refrescarConEspera,
      )
      .subscribe();

    const intervaloRespaldo = window.setInterval(
      refrescarEventoCompleto,
      INTERVALO_RESPALDO_MS,
    );

    return () => {
      window.clearInterval(intervaloRespaldo);
      supabase.removeChannel(channel);
    };
  }, [eventoId, queryClient]);
};
