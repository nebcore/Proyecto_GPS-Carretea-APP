import { supabase } from "@/lib/supabase";

export const guardarGoogleToken = async (token: string) => {
  const { data: { user } } = await supabase.auth.getUser();
  const { error } = await supabase
    .from('usuarios')
    .update({ google_calendar_token: token })
    .eq('id', user?.id);
  if (error) throw error;
};

export const obtenerGoogleToken = async () => {
  const { data: { user } } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from('usuarios')
    .select('google_calendar_token')
    .eq('id', user?.id)
    .single();
  if (error) throw error;
  return data?.google_calendar_token;
};