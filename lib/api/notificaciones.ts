import { supabase } from "@/lib/supabase";

export type Notificacion = {
  id: string;
  usuario_id: string;
  tipo: string;
  titulo: string;
  cuerpo: string | null;
  leida: boolean;
  creado_en: string;
};

export const obtenerNotificacionesUsuario = async (limit = 30) => {
  const { data, error } = await supabase
    .from("notificaciones")
    .select("*")
    .order("creado_en", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data ?? []) as Notificacion[];
};

export const contarNotificacionesNoLeidas = async () => {
  const { count, error } = await supabase
    .from("notificaciones")
    .select("id", { count: "exact", head: true })
    .eq("leida", false);

  if (error) throw error;
  return count ?? 0;
};

export const marcarNotificacionLeida = async (notificacionId: string) => {
  const { data, error } = await supabase
    .from("notificaciones")
    .update({ leida: true })
    .eq("id", notificacionId)
    .select("*")
    .single();

  if (error) throw error;
  return data as Notificacion;
};

export const marcarTodasLasNotificacionesLeidas = async () => {
  const { error } = await supabase
    .from("notificaciones")
    .update({ leida: true })
    .eq("leida", false);

  if (error) throw error;
};
