import { supabase } from "@/lib/supabase";
import { getOrCreateContactoPropio } from "./contactos";

// 1. OBTENER EVENTOS DEL USUARIO (como creador o participante)
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

// 2. CREAR EVENTO CON PARTICIPANTES
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

// 3. INVITAR UN CONTACTO A UN EVENTO EXISTENTE
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
};

// 4. ELIMINAR UN EVENTO
export const deleteEvento = async (eventoId: string) => {
  const { error } = await supabase.from("eventos").delete().eq("id", eventoId);

  if (error) throw error;
};

// 5. CAMBIAR ESTADO DE UN EVENTO (abierto/finalizado)
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

export const getEvento = async (eventoId: string) => {
  const { data, error } = await supabase
    .from("eventos")
    .select(
      `
      *,
      participantes_evento(
        contacto_id,
        rol,
        contactos(id, nombre)
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
  }
) => {
  const { data, error } = await supabase
    .from('eventos')
    .update(datos)
    .eq('id', eventoId)
    .select()
    .single();

  if (error) throw error;
  return data;
};