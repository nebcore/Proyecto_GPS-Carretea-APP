import { supabase } from "../supabase";

export const getContactos = async () => {
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
  const { data, error } = await supabase
    .from("contactos")
    .insert({ ...contacto, usuario_id: user!.id })
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

  const { data: contacto, error } = await supabase
    .from("contactos")
    .insert({ nombre, telefono: telefono || null, usuario_id: user!.id })
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

export const updateContactoConGrupos = async (
  contactoId: string,
  nombre: string,
  telefono: string,
  gruposIds: string[],
) => {
  const { error } = await supabase
    .from("contactos")
    .update({ nombre, telefono: telefono || null })
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
  const { error } = await supabase.from("contactos").delete().eq("id", id);
  if (error) throw error;
};

export const deleteContactos = async (ids: string[]) => {
  const { error } = await supabase.from("contactos").delete().in("id", ids);
  if (error) throw error;
};
