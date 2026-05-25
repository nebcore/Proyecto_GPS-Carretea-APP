import { supabase } from "@/lib/supabase";

// 1. OBTENER LISTA DE EVENTOS (Separado en pasos para evitar error de RLS)
export const getEventos = async () => {
  // PASO A: Traer SOLO los eventos (sin juntarlos con participantes todavía)
  const { data: eventos, error: errorEventos } = await supabase
    .from("eventos")
    .select("*")
    .order("fecha_evento", { ascending: true });

  if (errorEventos) {
    console.error("Error al obtener eventos:", errorEventos.message);
    throw errorEventos;
  }

  // Si no hay eventos, devolvemos un arreglo vacío directamente
  if (!eventos || eventos.length === 0) {
    return [];
  }

  // PASO B: Extraer los IDs de los eventos que acabamos de traer
  const eventosIds = eventos.map((evento) => evento.id);

 // PASO C: Traer los participantes e incluir la relación con la tabla 'contactos'
  const { data: participantes, error: errorParticipantes } = await supabase
    .from("participantes_evento")
    .select(`
      evento_id, 
      contacto_id, 
      rol,
      contactos (
        id,
        nombre
      )
    `)
    .in("evento_id", eventosIds);

  if (errorParticipantes) {
    console.error("Error al obtener participantes:", errorParticipantes.message);
    throw errorParticipantes;
  }

  // PASO D: Unir todo usando JavaScript en lugar de SQL
  const eventosCompletos = eventos.map((evento) => ({
    ...evento,
    // Filtramos los participantes que corresponden a este evento en particular
    participantes_evento: participantes?.filter(
      (p) => p.evento_id === evento.id
    ) || [],
  }));

  return eventosCompletos;
};

export const invitarUsuarioAlEvento = async (eventoId: string, contactoId: string) => {
  const { data, error } = await supabase
    .from("participantes_evento")
    .insert([{ evento_id: eventoId, contacto_id: contactoId }]);

  if (error) throw error;
  return data;
};

// 2. CREAR UN EVENTO CON SUS PARTICIPANTES
export const createEventoConParticipantes = async (
  titulo: string,
  descripcion: string,
  ubicacion: string,
  fechaEvento: string,
  contactosIds: string[]
) => {
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) throw new Error("Usuario no autenticado");

  // Insertar en 'eventos'
  const { data: nuevoEvento, error: errorEvento } = await supabase
    .from("eventos") // Corregido a plural
    .insert([
      {
        titulo,
        descripcion,
        ubicacion,
        fecha_evento: fechaEvento,
        creador_id: user.id,
      },
    ])
    .select()
    .single();

  if (errorEvento) {
    console.error("Error al crear el evento:", errorEvento.message);
    throw errorEvento;
  }

  // Insertar en 'participantes_evento' incluyendo el 'rol'
  if (contactosIds && contactosIds.length > 0) {
    const participantesData = contactosIds.map((contactoId) => ({
      evento_id: nuevoEvento.id,
      contacto_id: contactoId,
      rol: "invitado" // Definimos el rol que pide tu diagrama
    }));

    const { error: errorParticipantes } = await supabase
      .from("participantes_evento")
      .insert(participantesData);

    if (errorParticipantes) {
      console.error("Error al insertar participantes:", errorParticipantes.message);
      throw errorParticipantes;
    }
  }

  return nuevoEvento;
};

// 3. SUSCRIPCIÓN EN TIEMPO REAL (Realtime)
export const suscribirAEventos = (onCambio: () => void) => {
  return supabase
    .channel("cambios-en-eventos")
    .on(
      "postgres_changes",
      { event: "*", scheme: "public", table: "eventos" }, // Corregido a plural
      (payload) => {
        console.log("Cambio en eventos detectado:", payload);
        onCambio();
      }
    )
    .subscribe();
};

// 4. ELIMINAR UN EVENTO
export const deleteEvento = async (eventoId: string) => {
  const { error } = await supabase
    .from("eventos")
    .delete()
    .eq("id", eventoId);

  if (error) {
    console.error("Error al eliminar el evento:", error.message);
    throw error;
  }
  return true;
};