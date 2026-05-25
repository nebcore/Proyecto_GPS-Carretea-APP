import { z } from "zod";
import { supabase } from "../supabase";

export const gastoSchema = z.object({
  id: z.string(),
  evento_id: z.string().uuid(),
  descripcion: z.string().min(1, "La descripción es obligatoria"),
  categoria: z.string().min(1, "La categoría es obligatoria"),
  monto_total: z.coerce.number().positive("El monto total debe ser mayor a cero"),
  fecha: z.string().optional(),
  tipo_division: z.enum([
    "equitativo",
    "montos_exactos"
  ]),

  gastos_pagadores: z.array(
    z.object({
      id: z.string().optional(),
      gasto_id: z.string().optional(),
      contacto_id: z.string().uuid(),
      monto_aportado: z.coerce.number().positive("El monto aportado debe ser mayor a cero")
    })
  ).min(1, "Debe haber al menos un pagador"),

  gastos_consumidores: z.array(
    z.object({
      contacto_id: z.string().uuid(),
      gasto_id: z.string().optional(),
      parte: z.coerce.number().positive("La parte debe ser mayor a cero")
    })
  ).min(1, "Debe haber al menos un consumidor")
});

export type GastoFormData = z.infer<typeof gastoSchema>;

export async function crearGasto(data: GastoFormData) {
  const validado = gastoSchema.parse(data);

  const {gastos_pagadores, gastos_consumidores, ...gasto} = validado;

  const {data: nuevoGasto, error: errorGasto} = await supabase
    .from("gastos")
    .insert({
      evento_id: gasto.evento_id,
      descripcion: gasto.descripcion,
      categoria: gasto.categoria,
      monto_total: gasto.monto_total,
      fecha: gasto.fecha || new Date().toISOString(),
      tipo_division: gasto.tipo_division
    })
    .select()
    .single();

  if (errorGasto) throw errorGasto;

  const gastoId = nuevoGasto.id;

  const {error: errorPagadores} = await supabase
    .from("gastos_pagadores")
    .insert(
      gastos_pagadores.map((pagador) => ({
        gasto_id: gastoId,
        contacto_id: pagador.contacto_id,
        monto_aportado : pagador.monto_aportado,
      }))
    );

  if (errorPagadores) throw errorPagadores;

  const {error: errorConsumidores} = await supabase
  .from("gastos_consumidores")
  .insert(
    gastos_consumidores.map((consumidor) => ({
      gasto_id: gastoId,
      contacto_id: consumidor.contacto_id,
      parte: consumidor.parte,
    }))
  );

  if (errorConsumidores) throw errorConsumidores;

  return nuevoGasto;
}

export async function obtenerParticipantesEvento(eventoId: string){
  const {data, error} = await supabase
    .from("participantes_evento")
    .select(`
      evento_id,
      contacto_id,
      rol,
      contactos (
        id,
        nombre,
        telefono,
        referencia_usuario_id
        )
      `).eq("evento_id", eventoId);

  if (error) throw error;

  return data;
}


/*
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
*/
