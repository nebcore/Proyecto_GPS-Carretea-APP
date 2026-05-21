import { supabase } from "../supabase";

export const getPagosByEvento = async (eventoId: string) => {
  const { data, error } = await supabase
    .from("pagos")
    .select("*")
    .eq("evento_id", eventoId);
  if (error) throw error;
  return data;
};

export const reportarPago = async (pagoId: string) => {
  const { data, error } = await supabase
    .from("pagos")
    .update({ estado: "reportado" })
    .eq("id", pagoId)
    .select()
    .single();
  if (error) throw error;
  return data;
};

export const confirmarPago = async (pagoId: string) => {
  const { data, error } = await supabase
    .from("pagos")
    .update({ estado: "saldado", confirmado_en: new Date().toISOString() })
    .eq("id", pagoId)
    .select()
    .single();
  if (error) throw error;
  return data;
};
