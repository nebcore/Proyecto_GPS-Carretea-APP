import { supabase } from "../supabase";

export const signUpWithEmail = async (
  email: string,
  password: string,
  nombre: string,
  telefono: string,
) => {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { nombre, telefono } },
  });
  if (error) throw error;
  return data;
};

export const signInWithEmail = async (email: string, password: string) => {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  if (error) throw error;
  return data;
};

export const signOut = async () => {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
};

export const getSession = async () => {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return data.session;
};

export const getDatosBancarios = async () => {
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) throw new Error("Usuario no autenticado");

  const { data, error } = await supabase
    .from("datos_bancarios")
    .select("id, banco, tipo_cuenta, numero_cuenta, rut")
    .eq("usuario_id", user.id)
    .maybeSingle();

  if (error) throw error;
  return data;
};

export const upsertDatosBancarios = async (campos: {
  banco: string;
  tipo_cuenta: string;
  numero_cuenta: string;
  rut: string;
}) => {
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) throw new Error("Usuario no autenticado");

  const { data, error } = await supabase
    .from("datos_bancarios")
    .upsert({ ...campos, usuario_id: user.id }, { onConflict: "usuario_id" })
    .select()
    .single();

  if (error) throw error;
  return data;
};

export const getUsuarioPerfil = async () => {
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) throw new Error("Usuario no autenticado");

  const { data, error } = await supabase
    .from("usuarios")
    .select("id, nombre, email, telefono, foto_url, creado_en")
    .eq("id", user.id)
    .single();

  if (error) throw error;
  return data;
};

export const updateUsuarioPerfil = async (campos: { nombre?: string; telefono?: string }) => {
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) throw new Error("Usuario no autenticado");

  const { data, error } = await supabase
    .from("usuarios")
    .update(campos)
    .eq("id", user.id)
    .select()
    .single();

  if (error) throw error;
  return data;
};
