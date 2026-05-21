import { supabase } from "../supabase";

export const getGastosByEvento = async (eventoId: string) => {
  const { data, error } = await supabase
    .from("gastos")
    .select("*, gastos_pagadores(*), gastos_consumidores(*)")
    .eq("evento_id", eventoId)
    .order("fecha", { ascending: false });
  if (error) throw error;
  return data;
};

export const createGasto = async (gasto: {
  evento_id: string;
  descripcion: string;
  categoria?: string;
  monto_total: number;
  fecha: string;
  tipo_division: "equitativo" | "porcentual" | "montos_exactos" | "por_cuotas";
}) => {
  const { data, error } = await supabase
    .from("gastos")
    .insert(gasto)
    .select()
    .single();
  if (error) throw error;
  return data;
};
