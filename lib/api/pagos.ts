import { supabase } from "../supabase";

const COMPROBANTES_BUCKET = "comprobantes";

type ComprobantePago = {
  uri: string;
  mimeType?: string | null;
  fileName?: string | null;
};

export const obtenerPagosEvento = async (eventoId: string) => {
  const { data, error } = await supabase
    .from("pagos")
    .select("*")
    .eq("evento_id", eventoId)
    .order("creado_en", { ascending: false });

  if (error) throw error;
  return data;
};

const obtenerExtension = (comprobante: ComprobantePago) => {
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

const subirComprobantePago = async (
  eventoId: string,
  deudorId: string,
  comprobante: ComprobantePago,
) => {
  const extension = obtenerExtension(comprobante);
  const storagePath = `pagos/${eventoId}/${deudorId}/${Date.now()}.${extension}`;
  const archivo = await fetch(comprobante.uri);
  const arrayBuffer = await archivo.arrayBuffer();

  const { error } = await supabase.storage
    .from(COMPROBANTES_BUCKET)
    .upload(storagePath, arrayBuffer, {
      contentType: comprobante.mimeType ?? "image/jpeg",
      upsert: false,
    });

  if (error) throw error;

  return {
    storagePath,
    mimeType: comprobante.mimeType ?? "image/jpeg",
  };
};

export const reportarPago = async (
  eventoId: string,
  deudorId: string,
  acreedorId: string,
  monto: number,
  comprobante: ComprobantePago,
) => {
  const archivo = await subirComprobantePago(eventoId, deudorId, comprobante);

  const { data, error } = await supabase
    .from("pagos")
    .insert([
      {
        evento_id: eventoId,
        deudor_id: deudorId,
        acreedor_id: acreedorId,
        monto,
        estado: "reportado",
      },
    ])
    .select()
    .single();

  if (error) throw error;

  const { error: comprobanteError } = await supabase
    .from("comprobantes")
    .insert([
      {
        pago_id: data.id,
        storage_path: archivo.storagePath,
        mime_type: archivo.mimeType,
      },
    ]);

  if (comprobanteError) throw comprobanteError;

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
