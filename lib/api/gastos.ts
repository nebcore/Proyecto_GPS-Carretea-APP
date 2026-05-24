import { z } from "zod";
import { supabase } from "../supabase";

export const gastoSchema = z.object({
  id: z.string(),
  evento_id: z.string(),
  descripcion: z.string().min(1, "La descripción no puede estar vacía"),
  categoria: z.string().min(1, "La categoría no puede estar vacía"),
  monto_total: z.number().positive("El monto total debe ser mayor a cero"),
  fecha: z.string().min(1, "La fecha es requerida"),
  tipo_division: z.enum([
    "equitativo",
    "montos_exactos"
  ]),

  gastos_pagadores: z.array(
    z.object({
      id: z.string(),
      gasto_id: z.string(),
      contacto_id: z.string(),
      monto_aportado: z.number()
    })
  ).min(1, "Debe haber al menos un pagador"),

  gastos_consumidores: z.array(
    z.object({
      contacto_id: z.string(),
      gasto_id: z.string(),
      parte: z.number().positive("La parte debe ser mayor a cero")
    })
  ).min(1, "Debe haber al menos un consumidor")
});

export type GastoFormData = z.infer<typeof gastoSchema>;

export async function crearGasto(data: GastoFormData) {
  const validado = gastoSchema.safeParse(data);

  const {gastos_pagadores, gastos_consumidores, ...gasto} = validado.data;

  const {data: nuevoGasto, error: errorGasto} = await supabase
    .from("gastos")
    .insert(gasto)
    .select()
    .single();

  if (errorGasto) throw errorGasto;

  const gastoId = nuevoGasto.id;

  const pagadoresData = gastos_pagadores.map((p)=> ({
    gasto_id: gastoId,
    contacto_id: p.contacto_id,
    monto_aportado: p.monto_aportado,
  }));

  const consumidoresData = gastos_consumidores.map((c) => ({
    gastos_id: gastoId,
    contacto_id: c.contacto_id,
    parte: c.parte,
  }));

  const {error: errorPagadores} = await supabase
    .from("gastos_pagadores")
    .insert(pagadoresData);
  
  if(errorPagadores) throw errorPagadores;

  const {error: errorConsumidores} = await supabase
    .from("gastos_consumidores")
    .insert(consumidoresData);

  if(errorConsumidores) throw errorConsumidores;

  return nuevoGasto;
}



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
