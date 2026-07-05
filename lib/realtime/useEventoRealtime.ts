import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "../supabase";

export const useEventoRealtime = (eventoId: string) => {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!eventoId) return;

    const channel = supabase
      .channel(`evento-${eventoId}`)
      // Escuchar cambios en Gastos
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "gastos",
          filter: `evento_id=eq.${eventoId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["gastos", eventoId] });
        },
      )
      // Escuchar cambios en Pagos
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "pagos",
          filter: `evento_id=eq.${eventoId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["pagos", eventoId] });
        },
      )
      // Escuchar inserciones en Notificaciones (Feed del Evento)
      .on(
        "postgres_changes",
        {
          event: "INSERT", // Solo nos interesan las nuevas filas que entran al feed
          schema: "public",
          table: "notificaciones",
          filter: `evento_id=eq.${eventoId}`,
        },
        () => {
          // Esto invalida la query de la pestaña Feed y fuerza el refresco visual inmediato
          queryClient.invalidateQueries({
            queryKey: ["notificaciones-evento", eventoId],
          });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [eventoId, queryClient]);
};
