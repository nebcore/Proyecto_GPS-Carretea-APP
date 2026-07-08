import { supabase } from "@/lib/supabase";
import { normalizarTelefono } from "@/lib/utils/telefono";
import { getOrCreateContactoPropio } from "./contactos";
import { crearNotificacionEvento } from "./notificaciones";

type ContactoIdentidad = {
  id: string;
  nombre?: string | null;
  telefono?: string | null;
  referencia_usuario_id?: string | null;
};

const obtenerClaveContacto = (contacto?: ContactoIdentidad | null) => {
  if (!contacto) return null;
  if (contacto.referencia_usuario_id) {
    return `usuario:${contacto.referencia_usuario_id}`;
  }

  const telefonoNormalizado = contacto.telefono
    ? normalizarTelefono(contacto.telefono)
    : "";
  if (telefonoNormalizado) {
    return `telefono:${telefonoNormalizado}`;
  }

  return `contacto:${contacto.id}`;
};

const obtenerContactosPorIds = async (contactosIds: string[]) => {
  if (contactosIds.length === 0) return [];

  const { data, error } = await supabase
    .from("contactos")
    .select("id, nombre, telefono, referencia_usuario_id")
    .in("id", contactosIds);

  if (error) throw error;
  return (data ?? []) as ContactoIdentidad[];
};

const obtenerParticipantesConContacto = async (eventoId: string) => {
  const { data, error } = await supabase
    .from("participantes_evento")
    .select(
      `
      contacto_id,
      contactos(id, nombre, telefono, referencia_usuario_id)
    `,
    )
    .eq("evento_id", eventoId);

  if (error) throw error;
  return data ?? [];
};

const asegurarEventoAbierto = async (eventoId: string) => {
  const { data, error } = await supabase
    .from("eventos")
    .select("estado")
    .eq("id", eventoId)
    .single();

  if (error) throw error;
  if (data.estado === "finalizado") {
    throw new Error("El evento esta finalizado. Reabrelo para hacer cambios.");
  }
};

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

  // Armar lista de participantes evitando duplicados por persona.
  const contactosInvitados = await obtenerContactosPorIds(contactosIds);
  const contactosPorId = new Map(
    [contactoPropio, ...contactosInvitados].map((contacto) => [
      contacto.id,
      contacto,
    ]),
  );
  const clavesAgregadas = new Set<string>();
  const idsUnicos = [contactoPropio.id, ...contactosIds].filter(
    (contactoId) => {
      const clave = obtenerClaveContacto(contactosPorId.get(contactoId));
      if (!clave || clavesAgregadas.has(clave)) return false;
      clavesAgregadas.add(clave);
      return true;
    },
  );
  const participantesData = idsUnicos.map((contactoId) => ({
    evento_id: nuevoEvento.id,
    contacto_id: contactoId,
    rol: contactoId === contactoPropio.id ? "creador" : "invitado",
  }));

  const { error: errorParticipantes } = await supabase
    .from("participantes_evento")
    .insert(participantesData);

  if (errorParticipantes) throw errorParticipantes;

  const invitadosInsertadosIds = idsUnicos.filter(
    (contactoId) => contactoId !== contactoPropio.id,
  );

  if (invitadosInsertadosIds.length > 0) {
    // Solo si hay contactos invitados, enviamos notificaciones
    // Buscamos cuáles de esos contactos corresponden a usuarios reales (tienen referencia_usuario_id)
    const { data: contactosUsuarios } = await supabase
      .from("contactos")
      .select("referencia_usuario_id")
      .in("id", invitadosInsertadosIds)
      .not("referencia_usuario_id", "is", null);

    // Extraemos los IDs asegurándonos de no auto-notificarnos
    const idsUsuariosANotificar = (contactosUsuarios || [])
      .map((c) => c.referencia_usuario_id)
      .filter((id) => id !== user.id) as string[];

    // Enviamos la notificación directa solo a ellos
    if (idsUsuariosANotificar.length > 0) {
      await crearNotificacionEvento({
        eventoId: nuevoEvento.id,
        tipo: "nueva_invitacion",
        titulo: "¡Te han invitado!",
        cuerpo: `Has sido agregado al evento: ${titulo}`,
        usuarioIds: idsUsuariosANotificar, // Al pasar esto, la notificación es privada para ellos
      });
    }
  }

  return nuevoEvento;
};

// INVITAR UN CONTACTO A UN EVENTO EXISTENTE
export const invitarContactoAlEvento = async (
  eventoId: string,
  contactoId: string,
) => {
  // Verificar que no esté ya invitado
  await asegurarEventoAbierto(eventoId);

  const { data: contactoNuevo, error: errorContactoNuevo } = await supabase
    .from("contactos")
    .select("id, nombre, telefono, referencia_usuario_id")
    .eq("id", contactoId)
    .single();

  if (errorContactoNuevo) throw errorContactoNuevo;

  const claveContactoNuevo = obtenerClaveContacto(contactoNuevo);

  const { data: existente } = await supabase
    .from("participantes_evento")
    .select("contacto_id")
    .eq("evento_id", eventoId)
    .eq("contacto_id", contactoId)
    .maybeSingle();

  if (existente) throw new Error("Este contacto ya fue invitado al evento.");

  const participantesActuales = await obtenerParticipantesConContacto(eventoId);
  const participanteDuplicado = participantesActuales.find(
    (participante: any) => {
      const contacto = Array.isArray(participante.contactos)
        ? participante.contactos[0]
        : participante.contactos;

      return (
        claveContactoNuevo &&
        obtenerClaveContacto(contacto) === claveContactoNuevo
      );
    },
  );

  if (participanteDuplicado) {
    throw new Error("Esta persona ya participa en el evento.");
  }

  const { error } = await supabase
    .from("participantes_evento")
    .insert([
      { evento_id: eventoId, contacto_id: contactoId, rol: "invitado" },
    ]);

  if (error) throw error;

  // Obtenemos la información del contacto (nombre y ID de usuario)
  const { data: contacto } = await supabase
    .from("contactos")
    .select("nombre, referencia_usuario_id")
    .eq("id", contactoId)
    .single();

  // Avisa AL GRUPO (Feed del evento)
  await crearNotificacionEvento({
    eventoId,
    tipo: "nuevo_participante",
    titulo: "Nuevo integrante",
    cuerpo: `${contacto?.nombre || "Un contacto"} ha sido agregado al evento.`,
  });

  // Avisa AL USUARIO de forma directa a su bandeja
  if (contacto?.referencia_usuario_id) {
    const { data: eventoInfo } = await supabase
      .from("eventos")
      .select("titulo")
      .eq("id", eventoId)
      .single();

    await crearNotificacionEvento({
      // Notificación privada para el usuario invitado
      eventoId,
      tipo: "nueva_invitacion",
      titulo: "¡Te han invitado!",
      cuerpo: `Has sido agregado al evento: ${eventoInfo?.titulo || "Nuevo evento"}`,
      usuarioIds: [contacto.referencia_usuario_id],
    });
  }
};

// ELIMINAR UN PARTICIPANTE DE UN EVENTO
export const eliminarParticipanteDelEvento = async (
  eventoId: string,
  contactoId: string,
) => {
  await asegurarEventoAbierto(eventoId);

  const { data: contacto } = await supabase
    .from("contactos")
    .select("nombre")
    .eq("id", contactoId)
    .single();

  const { error } = await supabase
    .from("participantes_evento")
    .delete()
    .eq("evento_id", eventoId)
    .eq("contacto_id", contactoId);

  if (error) throw error;

  await crearNotificacionEvento({
    eventoId,
    tipo: "participante_eliminado",
    titulo: "Participante eliminado",
    cuerpo: `${contacto?.nombre || "Un participante"} fue eliminado del evento.`,
  });
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

// ACTUALIZAR DATOS DE UN EVENTO (versión básica, sin sync a Calendar)
export const updateEventoBasico = async (
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

export const salirDeEvento = async (eventoId: string, contactoId: string) => {
  await asegurarEventoAbierto(eventoId);

  const { data: contacto } = await supabase
    .from("contactos")
    .select("nombre")
    .eq("id", contactoId)
    .maybeSingle();

  await crearNotificacionEvento({
    eventoId,
    tipo: "participante_salio",
    titulo: "Participante salió del evento",
    cuerpo: `${contacto?.nombre || "Un participante"} salió del evento.`,
  });

  const { data, error } = await supabase
    .from("participantes_evento")
    .delete()
    .eq("evento_id", eventoId)
    .eq("contacto_id", contactoId)
    .select();

  if (error) throw error;
  if (!data || data.length === 0) {
    throw new Error(
      "No se pudo salir del evento. Puede faltar un permiso (RLS) para esta acción.",
    );
  }
};

// CAMBIAR ROL DE UN PARTICIPANTE (otorgar o quitar privilegios de administrador)
export const actualizarRolParticipante = async (
  eventoId: string,
  contactoId: string,
  rol: "invitado" | "administrador",
) => {
  await asegurarEventoAbierto(eventoId);

  const { error } = await supabase
    .from("participantes_evento")
    .update({ rol })
    .eq("evento_id", eventoId)
    .eq("contacto_id", contactoId);

  if (error) throw error;
};
