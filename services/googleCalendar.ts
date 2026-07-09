interface Evento {
  titulo: string;
  fechaInicio: string;
  fechaFin: string;
  descripcion?: string;
  attendees?: { email: string }[];
}

export const crearEventoCalendar = async (
  accessToken: string,
  evento: Evento,
): Promise<any> => {
  const response = await fetch(
    "https://www.googleapis.com/calendar/v3/calendars/primary/events?sendUpdates=all",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        summary: evento.titulo,
        description: evento.descripcion,
        start: { dateTime: evento.fechaInicio },
        end: { dateTime: evento.fechaFin },
        attendees: evento.attendees ?? [],
      }),
    },
  );

  const data = await response.json();
  console.log("Respuesta Calendar API:", data);
  return data; // retorna el objeto con el id del evento
};

export const eliminarEventoCalendar = async (
  accessToken: string,
  googleEventId: string,
): Promise<void> => {
  const response = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events/${googleEventId}?sendUpdates=all`,
    {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  );

  // Google responde 204 (sin body) cuando el DELETE es exitoso.
  // Si el evento ya no existe, responde 410 (Gone), que también podemos tratar como "ya está borrado".
  if (!response.ok && response.status !== 410) {
    let errorBody: any = null;
    try {
      errorBody = await response.json();
    } catch {
      // algunas respuestas de error no traen body parseable
    }
    console.log(
      "Error al eliminar evento en Calendar:",
      response.status,
      errorBody,
    );
    throw new Error(
      errorBody?.error?.message ??
        `No se pudo eliminar el evento de Calendar (status ${response.status})`,
    );
  }
};

export const actualizarEventoCalendar = async (
  accessToken: string,
  googleEventId: string,
  evento: Evento,
  sendUpdates: "all" | "none" = "all",
): Promise<any> => {
  const response = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events/${googleEventId}?sendUpdates=${sendUpdates}`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        summary: evento.titulo,
        description: evento.descripcion,
        start: { dateTime: evento.fechaInicio },
        end: { dateTime: evento.fechaFin },
        attendees: evento.attendees ?? [],
      }),
    },
  );

  const data = await response.json();
  console.log("Evento actualizado en Calendar:", data);
  return data;
};
