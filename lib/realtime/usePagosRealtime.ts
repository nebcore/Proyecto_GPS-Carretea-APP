import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "../supabase";

export const usePagosRealtime = (usuarioId: string) => {
  const queryClient = useQueryClient();

  useEffect(() => {
    const channel = supabase
      .channel(`pagos-usuario-${usuarioId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "pagos",
          filter: `deudor_id=eq.${usuarioId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["pagos"] });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [usuarioId, queryClient]);
};
