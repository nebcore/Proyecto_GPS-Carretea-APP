import { supabase } from "../supabase";
import { getOrCreateContactoPropio } from "./contactos";

export const obtenerPagosEvento = async (eventoId: string) => {
  const { data, error } = await supabase
    .from("pagos")
    .select("*")
    .eq("evento_id", eventoId)
    .order("creado_en", { ascending: false });

  if (error) throw error;
  return data;
};

export const reportarPago = async (
  eventoId: string,
  acreedorId: string,
  monto: number,
) => {
  const contactoPropio = await getOrCreateContactoPropio();

  const { data, error } = await supabase
    .from("pagos")
    .insert([
      {
        evento_id: eventoId,
        deudor_id: contactoPropio.id,
        acreedor_id: acreedorId,
        monto,
        estado: "reportado",
      },
    ])
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
