import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "../supabase";

export const useAppRealtime = (usuarioId: string | undefined) => {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!usuarioId) return;

    const refrescarEventos = () => {
      queryClient.invalidateQueries({ queryKey: ["eventos"] });
      queryClient.invalidateQueries({ queryKey: ["total-gastos"] });
      queryClient.invalidateQueries({ queryKey: ["actividad-reciente"] });
    };

    const refrescarAgenda = () => {
      queryClient.invalidateQueries({ queryKey: ["contactos"] });
      queryClient.invalidateQueries({ queryKey: ["contactos-invitar"] });
      queryClient.invalidateQueries({ queryKey: ["grupos"] });
    };

    const refrescarPerfil = () => {
      queryClient.invalidateQueries({ queryKey: ["perfil"] });
      queryClient.invalidateQueries({ queryKey: ["datos-bancarios"] });
      queryClient.invalidateQueries({ queryKey: ["estado-email"] });
    };

    const channel = supabase
      .channel(`app-realtime-${usuarioId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "eventos",
        },
        refrescarEventos,
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "participantes_evento",
        },
        refrescarEventos,
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "gastos",
        },
        refrescarEventos,
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "pagos",
        },
        refrescarEventos,
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "contactos",
          filter: `usuario_id=eq.${usuarioId}`,
        },
        () => {
          refrescarAgenda();
          refrescarEventos();
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "grupos_contacto",
          filter: `usuario_id=eq.${usuarioId}`,
        },
        refrescarAgenda,
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "contactos_grupos",
        },
        refrescarAgenda,
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "usuarios",
          filter: `id=eq.${usuarioId}`,
        },
        refrescarPerfil,
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "datos_bancarios",
          filter: `usuario_id=eq.${usuarioId}`,
        },
        refrescarPerfil,
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notificaciones",
          filter: `usuario_id=eq.${usuarioId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["notificaciones"] });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient, usuarioId]);
};
