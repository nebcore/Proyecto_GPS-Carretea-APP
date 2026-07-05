import { supabase } from "@/lib/supabase";
import { getOrCreateContactoPropio } from "./contactos";
import { crearNotificacionEvento } from "./notificaciones";

// OBTENER EVENTOS DEL USUARIO (como creador o participante)
export const getEventos = async () => {
  const { data: eventos, error: errorEventos } = await supabase
    .from("eventos")
    .select("*")
    .order("fecha_evento", { ascending: true });

  if (errorEventos) throw errorEventos;
  if (!eventos || eventos.length === 0) return [];

  const eventosIds = eventos.map((e) => e.id);

  const { data: participantes, error: errorParticipantes } = await supabase
    .from("participantes_evento")
    .select(`evento_id, contacto_id, rol, contactos(id, nombre, telefono)`)
    .in("evento_id", eventosIds);

  if (errorParticipantes) throw errorParticipantes;

  return eventos.map((evento) => ({
    ...evento,
    participantes_evento: (participantes ?? []).filter(
      (p) => p.evento_id === evento.id,
    ),
  }));
};

// CREAR EVENTO CON PARTICIPANTES
export const createEventoConParticipantes = async (
  titulo: string,
  descripcion: string,
  ubicacion: string,
  fechaEvento: string,
  contactosIds: string[],
) => {
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) throw new Error("Usuario no autenticado");

  // Crear el evento
  const { data: nuevoEvento, error: errorEvento } = await supabase
    .from("eventos")
    .insert({
      titulo,
      descripcion,
      ubicacion,
      fecha_evento: fechaEvento,
      creador_id: user.id,
    })
    .select()
    .single();

  if (errorEvento) throw errorEvento;

  // Obtener o crear el auto-contacto del creador
  const contactoPropio = await getOrCreateContactoPropio();

  // Armar lista de participantes: creador + invitados (sin duplicados)
  const idsUnicos = [...new Set([contactoPropio.id, ...contactosIds])];
  const participantesData = idsUnicos.map((contactoId) => ({
    evento_id: nuevoEvento.id,
    contacto_id: contactoId,
    rol: contactoId === contactoPropio.id ? "creador" : "invitado",
  }));

  const { error: errorParticipantes } = await supabase
    .from("participantes_evento")
    .insert(participantesData);

  if (errorParticipantes) throw errorParticipantes;

  return nuevoEvento;
};

// INVITAR UN CONTACTO A UN EVENTO EXISTENTE
export const invitarContactoAlEvento = async (
  eventoId: string,
  contactoId: string,
) => {
  // Verificar que no esté ya invitado
  const { data: existente } = await supabase
    .from("participantes_evento")
    .select("contacto_id")
    .eq("evento_id", eventoId)
    .eq("contacto_id", contactoId)
    .maybeSingle();

  if (existente) throw new Error("Este contacto ya fue invitado al evento.");

  const { error } = await supabase
    .from("participantes_evento")
    .insert([
      { evento_id: eventoId, contacto_id: contactoId, rol: "invitado" },
    ]);

  if (error) throw error;

  const { data: contacto } = await supabase
    .from("contactos")
    .select("nombre")
    .eq("id", contactoId)
    .single();

  await crearNotificacionEvento({
    eventoId,
    tipo: "nuevo_participante",
    titulo: "Nuevo integrante",
    cuerpo: `${contacto?.nombre || "Un contacto"} ha sido agregado al evento.`,
  });
};

// ELIMINAR UN PARTICIPANTE DE UN EVENTO
export const eliminarParticipanteDelEvento = async (
  eventoId: string,
  contactoId: string,
) => {
  const { error } = await supabase
    .from("participantes_evento")
    .delete()
    .eq("evento_id", eventoId)
    .eq("contacto_id", contactoId);

  if (error) throw error;
};

// ELIMINAR UN EVENTO
export const deleteEvento = async (eventoId: string) => {
  const { error } = await supabase.from("eventos").delete().eq("id", eventoId);

  if (error) throw error;
};

// CAMBIAR ESTADO DE UN EVENTO (abierto/finalizado)
export const actualizarEstadoEvento = async (
  eventoId: string,
  estado: "abierto" | "finalizado",
) => {
  const { error } = await supabase
    .from("eventos")
    .update({ estado })
    .eq("id", eventoId);

  if (error) throw error;
};

// ACTUALIZAR DATOS DE UN EVENTO
export const updateEvento = async (
  eventoId: string,
  datos: {
    titulo: string;
    descripcion: string;
    ubicacion: string;
    fechaEvento: string;
  },
) => {
  const { error } = await supabase
    .from("eventos")
    .update({
      titulo: datos.titulo,
      descripcion: datos.descripcion,
      ubicacion: datos.ubicacion,
      fecha_evento: datos.fechaEvento,
    })
    .eq("id", eventoId);

  if (error) throw error;
};

export const getEvento = async (eventoId: string) => {
  const { data, error } = await supabase
    .from("eventos")
    .select(
      `
      *,
      participantes_evento(
        contacto_id,
        rol,
        contactos(id, nombre, referencia_usuario_id)
      )
    `,
    )
    .eq("id", eventoId)
    .single();
  if (error) throw error;
  return data;
};

export const updateEvento = async (
  eventoId: string,
  datos: {
    titulo?: string;
    descripcion?: string;
    ubicacion?: string;
    fecha_evento?: string;
  },
) => {
  const { data, error } = await supabase
    .from("eventos")
    .update(datos)
    .eq("id", eventoId)
    .select()
    .single();

  if (error) throw error;
  return data;
};

export const obtenerAttendeesParaCalendar = async (
  participantes: any[],
  excluirUsuarioId?: string | null,
): Promise<{ attendees: { email: string }[]; sinEmail: string[] }> => {
  const idsUsuarios = participantes
    .map((p) => p.contactos?.referencia_usuario_id)
    .filter(Boolean);

  let emailsPorUsuarioId: Record<string, string> = {};

  if (idsUsuarios.length > 0) {
    const { data, error } = await supabase
      .from("usuarios")
      .select("id, email")
      .in("id", idsUsuarios);
    if (error) throw error;
    emailsPorUsuarioId = Object.fromEntries(
      (data ?? []).map((u: any) => [u.id, u.email]),
    );
  }

  const attendees: { email: string }[] = [];
  const sinEmail: string[] = [];

  for (const p of participantes) {
    const refId = p.contactos?.referencia_usuario_id;
    if (excluirUsuarioId && refId === excluirUsuarioId) {
      continue;
    }

    const email = refId ? emailsPorUsuarioId[refId] : null;
    if (email) {
      attendees.push({ email });
    } else {
      sinEmail.push(p.contactos?.nombre ?? "Participante");
    }
  }

  return { attendees, sinEmail };
};
