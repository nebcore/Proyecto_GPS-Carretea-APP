import { supabase } from "../supabase";
import { normalizarTelefono } from "../utils/telefono";

export const buscarUsuarioPorTelefono = async (telefono: string) => {
  const telefonoNormalizado = telefono ? normalizarTelefono(telefono) : "";
  if (!telefonoNormalizado) return { telefonoNormalizado: "", usuarioId: null };

  const { data } = await supabase
    .from("usuarios")
    .select("id")
    .eq("telefono", telefonoNormalizado)
    .maybeSingle();

  return {
    telefonoNormalizado,
    usuarioId: data?.id ?? null,
  };
};

export const getContactos = async () => {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("contactos")
    .select(
      `
      *,
      contactos_grupos(
        grupo_id,
        grupos_contacto(id, nombre)
      )
    `,
    )
    .eq("usuario_id", user.id)
    .or(`referencia_usuario_id.is.null,referencia_usuario_id.neq.${user.id}`)
    .order("nombre", { ascending: true });
  if (error) throw error;

  return data.map((c) => ({
    ...c,
    gruposAsignados: (c.contactos_grupos ?? [])
      .map((cg: any) => cg.grupos_contacto)
      .filter(Boolean),
  }));
};

export const createContacto = async (contacto: {
  nombre: string;
  telefono?: string;
  referencia_usuario_id?: string;
}) => {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const telefonoNormalizado = contacto.telefono
    ? normalizarTelefono(contacto.telefono)
    : undefined;

  const { data, error } = await supabase
    .from("contactos")
    .insert({
      ...contacto,
      telefono: telefonoNormalizado || null,
      usuario_id: user!.id,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
};

export const createContactoConGrupos = async (
  nombre: string,
  telefono: string,
  gruposIds: string[],
) => {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { telefonoNormalizado, usuarioId } =
    await buscarUsuarioPorTelefono(telefono);

  const { data: contacto, error } = await supabase
    .from("contactos")
    .insert({
      nombre,
      telefono: telefonoNormalizado || null,
      usuario_id: user!.id,
      referencia_usuario_id: usuarioId,
      es_temporal: !usuarioId,
    })
    .select()
    .single();
  if (error) throw error;

  if (gruposIds.length > 0) {
    const relaciones = gruposIds.map((grupo_id) => ({
      contacto_id: contacto.id,
      grupo_id,
    }));
    const { error: errorGrupos } = await supabase
      .from("contactos_grupos")
      .insert(relaciones);
    if (errorGrupos) throw errorGrupos;
  }

  return contacto;
};

export const getOrCreateContactoPropio = async () => {
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    throw new Error("Usuario no autenticado");
  }

  const { data: contactoExistente, error: errorBusqueda } = await supabase
    .from("contactos")
    .select("*")
    .eq("usuario_id", user.id)
    .eq("referencia_usuario_id", user.id)
    .maybeSingle();

  if (errorBusqueda) {
    throw errorBusqueda;
  }

  if (contactoExistente) {
    return contactoExistente;
  }

  const nombre =
    user.user_metadata?.nombre ||
    user.user_metadata?.name ||
    user.email ||
    "Yo";
  const telefono = user.phone ? normalizarTelefono(user.phone) : null;

  const { data: contactoCreado, error: errorCreacion } = await supabase
    .from("contactos")
    .insert({
      usuario_id: user.id,
      referencia_usuario_id: user.id,
      nombre,
      telefono,
      es_temporal: false,
    })
    .select()
    .single();

  if (errorCreacion) {
    throw errorCreacion;
  }

  return contactoCreado;
};

const validarContactoEditable = async (contactoId: string) => {
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    throw new Error("Usuario no autenticado");
  }

  const { data: contacto, error } = await supabase
    .from("contactos")
    .select("id, usuario_id, referencia_usuario_id")
    .eq("id", contactoId)
    .single();

  if (error) throw error;

  if (
    contacto.usuario_id === user.id &&
    contacto.referencia_usuario_id === user.id
  ) {
    throw new Error(
      "El contacto propio no se puede modificar desde la agenda.",
    );
  }
};

export const updateContactoConGrupos = async (
  contactoId: string,
  nombre: string,
  telefono: string,
  gruposIds: string[],
) => {
  await validarContactoEditable(contactoId);

  const { telefonoNormalizado, usuarioId } =
    await buscarUsuarioPorTelefono(telefono);

  const { error } = await supabase
    .from("contactos")
    .update({
      nombre,
      telefono: telefonoNormalizado || null,
      referencia_usuario_id: usuarioId,
      es_temporal: !usuarioId,
    })
    .eq("id", contactoId);
  if (error) throw error;

  await supabase
    .from("contactos_grupos")
    .delete()
    .eq("contacto_id", contactoId);

  if (gruposIds.length > 0) {
    const relaciones = gruposIds.map((grupo_id) => ({
      contacto_id: contactoId,
      grupo_id,
    }));
    const { error: errorGrupos } = await supabase
      .from("contactos_grupos")
      .insert(relaciones);
    if (errorGrupos) throw errorGrupos;
  }
};

export const deleteContacto = async (id: string) => {
  await validarContactoEditable(id);

  const { error } = await supabase.from("contactos").delete().eq("id", id);
  if (error) throw error;
};

export const deleteContactos = async (ids: string[]) => {
  await Promise.all(ids.map((id) => validarContactoEditable(id)));

  const { error } = await supabase.from("contactos").delete().in("id", ids);
  if (error) throw error;
};

export const getContactosParaInvitar = async () => {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("contactos")
    .select(
      `
      *,
      contactos_grupos(
        grupo_id,
        grupos_contacto(id, nombre)
      )
    `,
    )
    .eq("usuario_id", user.id)
    .or(`referencia_usuario_id.is.null,referencia_usuario_id.neq.${user.id}`)
    .order("nombre", { ascending: true });

  if (error) throw error;

  return (data || []).map((c) => ({
    ...c,
    gruposAsignados: (c.contactos_grupos ?? [])
      .map((cg: any) => cg.grupos_contacto)
      .filter(Boolean),
  }));
};
