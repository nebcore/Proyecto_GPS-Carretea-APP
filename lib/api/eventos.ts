import { supabase } from "../supabase";

export const getEventos = async () => {
  const { data, error } = await supabase
    .from("eventos")
    .select("*")
    .order("fecha_evento", { ascending: false });
  if (error) throw error;
  return data;
};

export const createEvento = async (evento: {
  titulo: string;
  descripcion?: string;
  ubicacion?: string;
  fecha_evento: string;
}) => {
  const { data, error } = await supabase
    .from("eventos")
    .insert(evento)
    .select()
    .single();
  if (error) throw error;
  return data;
};
