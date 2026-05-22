import { supabase } from "../supabase";

export const getGrupos = async () => {
  const { data, error } = await supabase
    .from("grupos_contacto")
    .select("*")
    .order("nombre", { ascending: true });
  if (error) throw error;
  return data;
};

export const createGrupo = async (nombre: string) => {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from("grupos_contacto")
    .insert({ nombre, usuario_id: user!.id })
    .select()
    .single();
  if (error) throw error;
  return data;
};

export const deleteGrupo = async (id: string) => {
  const { error } = await supabase
    .from("grupos_contacto")
    .delete()
    .eq("id", id);
  if (error) throw error;
};
