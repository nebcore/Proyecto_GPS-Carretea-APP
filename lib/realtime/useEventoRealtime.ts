import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "../supabase";

export const useEventoRealtime = (eventoId: string) => {
  const queryClient = useQueryClient();

  useEffect(() => {
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
        () => {
          queryClient.invalidateQueries({ queryKey: ["gastos", eventoId] });
        },
      )
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
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [eventoId, queryClient]);
};
