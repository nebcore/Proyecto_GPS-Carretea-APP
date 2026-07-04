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

export const enviarRecordatorioManual = async (
  eventoId: string,
  deudorContactoId: string,
  monto: number,
) => {
  // Buscar si el contacto deudor tiene una cuenta real en la app
  const { data: deudor, error: deudorError } = await supabase
    .from("contactos")
    .select("referencia_usuario_id")
    .eq("id", deudorContactoId)
    .single();

  if (deudorError) throw deudorError;

  if (!deudor?.referencia_usuario_id) {
    throw new Error(
      "Este usuario es un invitado sin cuenta en la app. Cóbrale en persona.",
    );
  }

  // Buscar el nombre del evento para que el mensaje sea claro
  const { data: evento, error: eventoError } = await supabase
    .from("eventos")
    .select("titulo")
    .eq("id", eventoId)
    .single();

  if (eventoError) throw eventoError;

  // Generar la notificación in-app usando la función base
  await crearNotificacionEvento({
    eventoId,
    tipo: "recordatorio_manual",
    titulo: "¡Recordatorio de pago!",
    cuerpo: `Tienes una deuda pendiente de $${monto} en el evento "${evento?.titulo}".`,
    usuarioIds: [deudor.referencia_usuario_id], // Enviar SOLO al deudor
  });
};
