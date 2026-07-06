import { supabase } from "@/lib/supabase";

const GOOGLE_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID!;
const GOOGLE_CLIENT_SECRET = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_SECRET!;

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
