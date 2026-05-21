import { supabase } from "../supabase";

export const getContactos = async () => {
  const { data, error } = await supabase
    .from("contactos")
    .select("*")
    .order("nombre", { ascending: true });
  if (error) throw error;
  return data;
};

export const createContacto = async (contacto: {
  nombre: string;
  telefono?: string;
  referencia_usuario_id?: string;
}) => {
  const { data, error } = await supabase
    .from("contactos")
    .insert(contacto)
    .select()
    .single();
  if (error) throw error;
  return data;
};
