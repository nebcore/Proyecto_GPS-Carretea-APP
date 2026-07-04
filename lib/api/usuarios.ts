import { supabase } from "@/lib/supabase";

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

export const obtenerGoogleToken = async () => {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from("usuarios")
    .select("google_calendar_token")
    .eq("id", user?.id)
    .single();
  if (error) throw error;
  return data?.google_calendar_token;
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
