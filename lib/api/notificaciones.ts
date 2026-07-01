import { supabase } from "../supabase";

export type Notificacion = {
  id: string;
  usuario_id: string;
  evento_id: string | null;
  tipo: string;
  titulo: string;
  cuerpo: string | null;
  leida: boolean;
  creado_en: string;
};

type CrearNotificacionEventoInput = {
  eventoId: string;
  tipo: string;
  titulo: string;
  cuerpo?: string | null;
  usuarioIds?: string[];
};

const obtenerUsuariosParticipantesEvento = async (eventoId: string) => {
  const [
    { data: evento, error: errorEvento },
    { data: participantes, error: errorParticipantes },
  ] = await Promise.all([
    supabase.from("eventos").select("creador_id").eq("id", eventoId).single(),
    supabase
      .from("participantes_evento")
      .select("contactos(referencia_usuario_id)")
      .eq("evento_id", eventoId),
  ]);

  if (errorEvento) throw errorEvento;
  if (errorParticipantes) throw errorParticipantes;

  const usuarioIds = new Set<string>();

  if (evento?.creador_id) {
    usuarioIds.add(evento.creador_id);
  }

  for (const participante of participantes ?? []) {
    const referenciaUsuarioId = (participante as any).contactos
      ?.referencia_usuario_id;
    if (referenciaUsuarioId) {
      usuarioIds.add(referenciaUsuarioId);
    }
  }

  return Array.from(usuarioIds);
};

export const crearNotificacionEvento = async ({
  eventoId,
  tipo,
  titulo,
  cuerpo = null,
  usuarioIds,
}: CrearNotificacionEventoInput) => {
  const destinatarios =
    usuarioIds ?? (await obtenerUsuariosParticipantesEvento(eventoId));

  if (destinatarios.length === 0) {
    return;
  }

  const { error } = await supabase.from("notificaciones").insert(
    destinatarios.map((usuarioId) => ({
      usuario_id: usuarioId,
      evento_id: eventoId,
      tipo,
      titulo,
      cuerpo,
    })),
  );

  if (error) throw error;
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

export const obtenerNotificacionesEvento = async (
  eventoId: string,
  limit = 30,
) => {
  const { data, error } = await supabase
    .from("notificaciones")
    .select("*")
    .eq("evento_id", eventoId)
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
