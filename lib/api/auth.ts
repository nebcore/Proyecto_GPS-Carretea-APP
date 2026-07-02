import { supabase } from "../supabase";
import { normalizarTelefono } from "../utils/telefono";

export const signUpWithEmail = async (
  email: string,
  password: string,
  nombre: string,
  telefono: string,
) => {
  const telefonoNormalizado = normalizarTelefono(telefono);

  // 1. Crear usuario con email y contraseña
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { nombre, telefono: telefonoNormalizado } },
  });
  if (error) throw error;

  // 2. Iniciar sesión para obtener el token
  const { error: signInError } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  if (signInError) throw signInError;

  // 3. Enviar OTP al teléfono
  const { error: otpError } = await supabase.auth.updateUser({
    phone: telefonoNormalizado,
  });
  if (otpError) throw otpError;

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

// Verificación de email desacoplada del toggle "Confirm email" de Supabase
// (ese toggle bloquea la sesión hasta que se confirma, lo que rompe el
// flujo de teléfono). Se guarda en user_metadata, no en una tabla, para no
// requerir cambios de esquema.
export const getEstadoEmail = async () => {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error) throw error;
  return {
    email: user?.email ?? null,
    verificado: Boolean(user?.user_metadata?.email_verificado),
  };
};

export const enviarCodigoVerificacionEmail = async (email: string) => {
  const { error } = await supabase.auth.signInWithOtp({ email });
  if (error) throw error;
};

export const verificarCodigoEmail = async (email: string, codigo: string) => {
  const { error } = await supabase.auth.verifyOtp({
    email,
    token: codigo,
    type: "email",
  });
  if (error) throw error;

  const { error: updateError } = await supabase.auth.updateUser({
    data: { email_verificado: true },
  });
  if (updateError) throw updateError;
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

export const verificarDuplicados = async (email: string, telefono: string) => {
  const { data, error } = await supabase.rpc('verificar_duplicados', {
    p_email: email,
    p_telefono: telefono,
  });
  if (error) throw error;
  return data;
};

export const updateUsuarioPerfil = async (campos: { nombre?: string; telefono?: string }) => {
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) throw new Error("Usuario no autenticado");

  const camposNormalizados = {
    ...campos,
    ...(campos.telefono !== undefined
      ? { telefono: normalizarTelefono(campos.telefono) || null }
      : {}),
  };

  const { data, error } = await supabase
    .from("usuarios")
    .update(camposNormalizados)
    .eq("id", user.id)
    .select()
    .single();

  if (error) throw error;
  return data;
};
