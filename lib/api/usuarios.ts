import { supabase } from "@/lib/supabase";

const AVATARS_BUCKET = "avatars";
const GOOGLE_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID!;
const GOOGLE_CLIENT_SECRET = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_SECRET!;

type FotoPerfil = {
  uri: string;
  mimeType?: string | null;
  fileName?: string | null;
};

const obtenerExtensionFoto = (foto: FotoPerfil) => {
  const nombre = foto.fileName ?? foto.uri;
  const extension = nombre.split(".").pop()?.split("?")[0]?.toLowerCase();

  if (extension && extension.length <= 5) {
    return extension;
  }

  if (foto.mimeType?.includes("png")) return "png";
  if (foto.mimeType?.includes("webp")) return "webp";

  return "jpg";
};

export const subirFotoPerfil = async (foto: FotoPerfil) => {
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) throw new Error("Usuario no autenticado");

  const extension = obtenerExtensionFoto(foto);
  const storagePath = `${user.id}/avatar-${Date.now()}.${extension}`;
  const archivo = await fetch(foto.uri);
  const arrayBuffer = await archivo.arrayBuffer();

  const { error: uploadError } = await supabase.storage
    .from(AVATARS_BUCKET)
    .upload(storagePath, arrayBuffer, {
      contentType: foto.mimeType ?? "image/jpeg",
      upsert: false,
    });

  if (uploadError) throw uploadError;

  const { data: publicUrlData } = supabase.storage
    .from(AVATARS_BUCKET)
    .getPublicUrl(storagePath);

  const { data, error } = await supabase
    .from("usuarios")
    .update({ foto_url: publicUrlData.publicUrl })
    .eq("id", user.id)
    .select()
    .single();

  if (error) throw error;

  const { data: archivos, error: listError } = await supabase.storage
    .from(AVATARS_BUCKET)
    .list(user.id);

  if (listError) {
    console.log("No se pudieron listar las fotos de perfil:", listError);
  } else {
    const archivosABorrar = (archivos ?? [])
      .map((archivo) => `${user.id}/${archivo.name}`)
      .filter((path) => path !== storagePath);

    if (archivosABorrar.length > 0) {
      const { error: removeError } = await supabase.storage
        .from(AVATARS_BUCKET)
        .remove(archivosABorrar);

      if (removeError) {
        console.log(
          "No se pudieron borrar las fotos de perfil anteriores:",
          removeError,
        );
      }
    }
  }

  return data;
};

export const guardarGoogleToken = async (
  token: string,
  refreshToken?: string | null,
) => {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const updateData: Record<string, string> = {
    google_calendar_token: token,
  };
  if (refreshToken) {
    updateData.google_calendar_refresh_token = refreshToken;
  }

  const { error } = await supabase
    .from("usuarios")
    .update(updateData)
    .eq("id", user?.id);
  if (error) throw error;
};

const refrescarAccessTokenGoogle = async (
  refreshToken: string,
): Promise<string> => {
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }).toString(),
  });

  const data = await response.json();

  if (!response.ok) {
    console.log("Error al refrescar token de Google:", data);
    throw new Error(
      data.error_description ?? "No se pudo refrescar el token de Google.",
    );
  }

  return data.access_token;
};

export const obtenerGoogleToken = async () => {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from("usuarios")
    .select("google_calendar_token, google_calendar_refresh_token")
    .eq("id", user?.id)
    .single();
  if (error) throw error;

  const refreshToken = data?.google_calendar_refresh_token;

  // Si tenemos refresh_token, SIEMPRE pedimos un access_token fresco.
  // Esto evita depender de calcular cuándo vence el anterior.
  if (refreshToken) {
    try {
      const accessTokenNuevo = await refrescarAccessTokenGoogle(refreshToken);
      await supabase
        .from("usuarios")
        .update({ google_calendar_token: accessTokenNuevo })
        .eq("id", user?.id);
      return accessTokenNuevo;
    } catch (e) {
      console.log("No se pudo refrescar, se usa el token guardado:", e);
      return data?.google_calendar_token ?? null;
    }
  }

  // Sin refresh_token disponible: devolvemos lo que haya guardado (comportamiento anterior)
  return data?.google_calendar_token ?? null;
};

export const obtenerGoogleRefreshToken = async () => {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from("usuarios")
    .select("google_calendar_refresh_token")
    .eq("id", user?.id)
    .single();
  if (error) throw error;
  return data?.google_calendar_refresh_token;
};
