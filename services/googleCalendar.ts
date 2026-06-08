interface Evento {
  titulo: string;
  fechaInicio: string;
  fechaFin: string;
  descripcion?: string;
}

export const crearEventoCalendar = async (
  accessToken: string,
  evento: Evento
): Promise<any> => {
  const response = await fetch(
    'https://www.googleapis.com/calendar/v3/calendars/primary/events',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        summary: evento.titulo,
        description: evento.descripcion,
        start: { dateTime: evento.fechaInicio },
        end: { dateTime: evento.fechaFin },
      }),
    }
  );

  const data = await response.json();
  console.log('Respuesta Calendar API:', data);
  return data;
};