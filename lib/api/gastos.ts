import { z } from "zod";
import { supabase } from "../supabase";
import { getOrCreateContactoPropio } from "./contactos";
import { crearNotificacionEvento } from "./notificaciones";

export const gastoFormSchema = z.object({
  evento_id: z.string().uuid(),
  descripcion: z.string().min(1, "La descripción es obligatoria"),
  categoria: z.string().optional(),
  monto_total: z.coerce
    .number()
    .positive("El monto total debe ser mayor a cero"),
  fecha: z.string().optional(),
  tipo_division: z.enum([
    "equitativo",
    "montos_exactos",
    "porcentual",
    "por_cuotas",
  ]),
});

export const gastoSchema = gastoFormSchema.extend({
  id: z.string().optional(),

  gastos_pagadores: z
    .array(
      z.object({
        id: z.string().optional(),
        gasto_id: z.string().optional(),
        contacto_id: z.string().uuid(),
        monto_aportado: z.coerce
          .number()
          .positive("El monto aportado debe ser mayor a cero"),
      }),
    )
    .min(1, "Debe haber al menos un pagador"),

  gastos_consumidores: z
    .array(
      z.object({
        contacto_id: z.string().uuid(),
        gasto_id: z.string().optional(),
        parte: z.coerce.number().positive("La parte debe ser mayor a cero"),
      }),
    )
    .min(1, "Debe haber al menos un consumidor"),
});

export type GastoFormValues = z.infer<typeof gastoFormSchema>;
export type GastoFormInput = z.input<typeof gastoFormSchema>;
export type GastoFormData = z.infer<typeof gastoSchema>;

const COMPROBANTES_BUCKET = "comprobantes";

export type ComprobanteArchivo = {
  uri: string;
  mimeType?: string | null;
  fileName?: string | null;
};

const obtenerExtensionComprobante = (comprobante: ComprobanteArchivo) => {
  const nombre = comprobante.fileName ?? comprobante.uri;
  const extension = nombre.split(".").pop()?.split("?")[0]?.toLowerCase();

  if (extension && extension.length <= 5) {
    return extension;
  }

  if (comprobante.mimeType?.includes("png")) {
    return "png";
  }

  if (comprobante.mimeType?.includes("webp")) {
    return "webp";
  }

  return "jpg";
};

const subirArchivoComprobante = async (
  storagePath: string,
  comprobante: ComprobanteArchivo,
) => {
  const archivo = await fetch(comprobante.uri);
  const arrayBuffer = await archivo.arrayBuffer();
  const mimeType = comprobante.mimeType ?? "image/jpeg";

  const { error } = await supabase.storage
    .from(COMPROBANTES_BUCKET)
    .upload(storagePath, arrayBuffer, {
      contentType: mimeType,
      upsert: false,
    });

  if (error) throw error;

  return {
    storagePath,
    mimeType,
  };
};

const crearUrlFirmadaComprobante = async (storagePath: string) => {
  const { data, error } = await supabase.storage
    .from(COMPROBANTES_BUCKET)
    .createSignedUrl(storagePath, 60 * 10);

  if (error) throw error;
  return data.signedUrl;
};

async function asegurarParticipacionDelCreador(eventoId: string) {
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    throw new Error("Usuario no autenticado");
  }

  const contactoPropio = await getOrCreateContactoPropio();

  const { data: participacion, error: errorParticipacion } = await supabase
    .from("participantes_evento")
    .select("contacto_id")
    .eq("evento_id", eventoId)
    .eq("contacto_id", contactoPropio.id)
    .maybeSingle();

  if (errorParticipacion) throw errorParticipacion;
  if (participacion) return;

  const { data: evento, error: errorEvento } = await supabase
    .from("eventos")
    .select("creador_id")
    .eq("id", eventoId)
    .single();

  if (errorEvento) throw errorEvento;

  if (evento.creador_id !== user.id) {
    return;
  }

  const { error: errorInsertarParticipante } = await supabase
    .from("participantes_evento")
    .insert({
      evento_id: eventoId,
      contacto_id: contactoPropio.id,
      rol: "creador",
    });

  if (errorInsertarParticipante?.code === "23505") return;
  if (errorInsertarParticipante) throw errorInsertarParticipante;
}

export async function crearGasto(data: GastoFormData) {
  const validado = gastoSchema.parse(data);

  const { gastos_pagadores, gastos_consumidores, ...gasto } = validado;

  await asegurarParticipacionDelCreador(gasto.evento_id);

  // Validaciones servidor adicionales
  const sumaPagadores = (gastos_pagadores || []).reduce(
    (s, p) => s + Number(p.monto_aportado || 0),
    0,
  );
  if (sumaPagadores <= 0) {
    throw new Error("La suma de aportes de pagadores debe ser mayor a cero.");
  }
  if (gasto.monto_total && Math.abs(sumaPagadores - gasto.monto_total) > 1) {
    throw new Error(
      `La suma de aportes (${sumaPagadores}) no coincide con el monto total (${gasto.monto_total}).`,
    );
  }

  // Validaciones según tipo_division
  if (gasto.tipo_division === "porcentual") {
    const sumaPartes = (gastos_consumidores || []).reduce(
      (s, c) => s + Number(c.parte || 0),
      0,
    );
    if (gasto.monto_total && Math.abs(sumaPartes - gasto.monto_total) > 1) {
      throw new Error(
        `La suma de partes calculadas (${sumaPartes}) no coincide con el monto total (${gasto.monto_total}).`,
      );
    }
  }

  if (gasto.tipo_division === "por_cuotas") {
    const sumaParts = (gastos_consumidores || []).reduce(
      (s, c) => s + Number(c.parte || 0),
      0,
    );
    if (gasto.monto_total && Math.abs(sumaParts - gasto.monto_total) > 1) {
      throw new Error(
        `La suma de partes calculadas (${sumaParts}) no coincide con el monto total (${gasto.monto_total}).`,
      );
    }
  }

  if (gasto.tipo_division === "montos_exactos") {
    const sumaMontos = (gastos_consumidores || []).reduce(
      (s, c) => s + Number(c.parte || 0),
      0,
    );
    if (gasto.monto_total && Math.abs(sumaMontos - gasto.monto_total) > 1) {
      throw new Error(
        `La suma de montos exactos (${sumaMontos}) no coincide con el monto total (${gasto.monto_total}).`,
      );
    }
  }

  const { data: nuevoGasto, error: errorGasto } = await supabase
    .from("gastos")
    .insert({
      evento_id: gasto.evento_id,
      descripcion: gasto.descripcion,
      monto_total: gasto.monto_total,
      fecha: gasto.fecha || new Date().toISOString(),
      tipo_division: gasto.tipo_division,
    })
    .select()
    .single();

  if (errorGasto) throw errorGasto;

  const gastoId = nuevoGasto.id;

  const { error: errorPagadores } = await supabase
    .from("gastos_pagadores")
    .insert(
      gastos_pagadores.map((pagador) => ({
        gasto_id: gastoId,
        contacto_id: pagador.contacto_id,
        monto_aportado: pagador.monto_aportado,
      })),
    );

  if (errorPagadores) throw errorPagadores;

  const { error: errorConsumidores } = await supabase
    .from("gastos_consumidores")
    .insert(
      gastos_consumidores.map((consumidor) => ({
        gasto_id: gastoId,
        contacto_id: consumidor.contacto_id,
        parte: consumidor.parte,
      })),
    );

  await crearNotificacionEvento({
    eventoId: gasto.evento_id,
    tipo: "gasto_creado",
    titulo: "Nuevo gasto registrado",
    cuerpo: `${gasto.descripcion} por $${Number(gasto.monto_total).toLocaleString("es-CL")} fue agregado al evento.`,
  });
  if (errorConsumidores) throw errorConsumidores;

  return nuevoGasto;
}

export async function obtenerParticipantesEvento(eventoId: string) {
  const { data, error } = await supabase
    .from("participantes_evento")
    .select(
      `
      evento_id,
      contacto_id,
      rol,
      contactos (
        id,
        nombre,
        telefono,
        referencia_usuario_id
        )
      `,
    )
    .eq("evento_id", eventoId);

  if (error) throw error;

  const participantes = data ?? [];
  const usuarioIds = Array.from(
    new Set(
      participantes
        .map((participante: any) => {
          const contacto = Array.isArray(participante.contactos)
            ? participante.contactos[0]
            : participante.contactos;

          return contacto?.referencia_usuario_id;
        })
        .filter(Boolean),
    ),
  );

  if (usuarioIds.length === 0) {
    return participantes.map((participante: any) => ({
      ...participante,
      foto_url: null,
      datos_bancarios: null,
    }));
  }

  const [
    { data: datosBancarios, error: errorDatosBancarios },
    { data: usuarios, error: errorUsuarios },
  ] = await Promise.all([
    supabase
      .from("datos_bancarios")
      .select("id, usuario_id, banco, tipo_cuenta, numero_cuenta, rut")
      .in("usuario_id", usuarioIds),
    supabase
      .from("usuarios")
      .select("id, foto_url, nombre")
      .in("id", usuarioIds),
  ]);

  if (errorDatosBancarios) throw errorDatosBancarios;
  if (errorUsuarios) throw errorUsuarios;

  const datosPorUsuarioId = new Map(
    (datosBancarios ?? []).map((datos: any) => [datos.usuario_id, datos]),
  );
  const fotosPorUsuarioId = new Map(
    (usuarios ?? []).map((usuario: any) => [usuario.id, usuario.foto_url]),
  );

  const nombresPorUsuarioId = new Map(
    (usuarios ?? []).map((usuario: any) => [usuario.id, usuario.nombre]),
  );

  return participantes.map((participante: any) => {
    const contacto = Array.isArray(participante.contactos)
      ? participante.contactos[0]
      : participante.contactos;

    return {
      ...participante,
      foto_url: fotosPorUsuarioId.get(contacto?.referencia_usuario_id) ?? null,
      usuario_nombre_real:
        nombresPorUsuarioId.get(contacto?.referencia_usuario_id) ?? null,
      datos_bancarios:
        datosPorUsuarioId.get(contacto?.referencia_usuario_id) ?? null,
    };
  });
}

export async function obtenerGastosxEvento(eventoId: string) {
  const { data, error } = await supabase
    .from("gastos")
    .select("*")
    .eq("evento_id", eventoId)
    .order("fecha", { ascending: false });

  if (error) throw error;
  return data;
}

export const getGastosByEvento = async (eventoId: string) => {
  const { data, error } = await supabase
    .from("gastos")
    .select(`*, gastos_pagadores(*), gastos_consumidores(*)`)
    .eq("evento_id", eventoId)
    .order("fecha", { ascending: false });

  if (error) throw error;

  return data;
};

export const borrarGasto = async (gastoId: string) => {
  const gastoIdValido = z.string().uuid().parse(gastoId);
  const { data, error } = await supabase
    .from("gastos")
    .delete()
    .select(`*, gastos_pagadores(*), gastos_consumidores(*)`)
    .eq("id", gastoIdValido)
    .maybeSingle();

  if (error) throw error;
  return data;
};

//Discutir con el grupo si es necesario Actualizar los gastos
//Igualmente pondre la funcion para no tener que hacerlo en el futuro
/*
export async function actualizarGasto(fastoId: string, data: GastoFormData){
  const validado = gastoSchema.parse(data);

  const(gastos_pagadores, gastos_consumidores, ...gasto) = validado;

  const(data: gastoActualizado, error: errorGasto) = await supabase
    .from("gastos")
    .update({
      evento_id: gasto.evento_id,
      descripcion: gasto.descripcion,
      categoria: gasto.categoria,
      monto_total: gasto.monto_total,
      fecha: gasto.fecha || new.Date().toISOString(),
      tipo_division: gasto.tipo_division
    }).eq("id", gastoId)
    .select()
    .single();

    if (errorGasto) throw errorGasto;

    const{error: errorBorrarPagadores} = await supabase
    .from("gastos_pagadores")
    .delete()
    .eq("gasto_id", gastoId);

    if (errorBorrarPagadores) throw errrorBorrarPagadores;

    const{error: errorBorrarConsumidores} = await supabase
    .from("gastos_consumidores")
    .delete()
    .eq("gasto_id", gastoId);

    if (errorBorrarConsumidores) throw errorBorrarConsumidores;

    const{error: errorInsertarPagadores} = await supabase
      .from("gastos_pagadores")
      .insert(gastos_pagadores.map((pagador)=> ({
        gasto_id: gastoId,
        contacto_id: pagador.contacto_id,
        monto_aportado: pagador.monto_aportado,
        }))
      );
    
    if (errorInsertarPagadores) throw errorInsertarPagadores;

    const{error: errorInsertarConsumidores} = await supabase
      .from("gastos_consumidores")
      .insert(gastos_consumidores.map((consumidor)=> ({
        gasto_id: gastoId,
        contacto_id: consumidor.contacto_id,
        parte: consumidor.parte,
        }))
      );
    
    if (errorInsertarConsumidores) throw errorInsertarConsumidores;

  return gastoActualizado;
}
*/

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

export const getActividadReciente = async (limit = 8) => {
  const { data, error } = await supabase
    .from("gastos")
    .select(
      `
      id,
      evento_id,
      descripcion,
      monto_total,
      fecha,
      eventos(titulo),
      gastos_pagadores(
        contacto_id,
        monto_aportado,
        contactos(id, nombre, referencia_usuario_id)
      )
    `,
    )
    .order("fecha", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []).map((gasto: any) => {
    const pagadorData = gasto.gastos_pagadores?.[0];
    const pagadorContacto = pagadorData?.contactos;

    return {
      ...gasto,
      pagador_info: pagadorContacto, // Pasamos toda la info del contacto
    };
  });
};

export const getTotalGastos = async () => {
  const { data, error } = await supabase.from("gastos").select("monto_total");
  if (error) throw error;
  return (data ?? []).reduce(
    (acc: number, g: any) => acc + (g.monto_total ?? 0),
    0,
  );
};

export const getGastosConPagador = async (eventoId: string) => {
  const { data, error } = await supabase
    .from("gastos")
    .select(
      `
      *,
      gastos_pagadores(
        contacto_id,
        monto_aportado,
        contactos(id, nombre)
      )
    `,
    )
    .eq("evento_id", eventoId)
    .order("fecha", { ascending: false });
  if (error) throw error;
  return data;
};

export const agregarComprobanteGasto = async (
  gastoId: string,
  comprobante: ComprobanteArchivo,
) => {
  const extension = obtenerExtensionComprobante(comprobante);
  const storagePath = `gastos/${gastoId}/${Date.now()}.${extension}`;
  const archivo = await subirArchivoComprobante(storagePath, comprobante);

  const { data, error } = await supabase
    .from("comprobantes")
    .insert([
      {
        gasto_id: gastoId,
        storage_path: archivo.storagePath,
        mime_type: archivo.mimeType,
      },
    ])
    .select()
    .single();

  if (error) throw error;

  return data;
};

export const obtenerComprobantesGasto = async (gastoId: string) => {
  const { data, error } = await supabase
    .from("comprobantes")
    .select("*")
    .eq("gasto_id", gastoId)
    .order("creado_en", { ascending: false });

  if (error) throw error;

  return Promise.all(
    (data ?? []).map(async (comprobante) => ({
      ...comprobante,
      url: await crearUrlFirmadaComprobante(comprobante.storage_path),
    })),
  );
};
