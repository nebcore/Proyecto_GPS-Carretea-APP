export type TipoDivision =
  | "equitativo"
  | "montos_exactos"
  | "porcentual"
  | "por_cuotas";

export type CalculoConsumidor = {
  contacto_id: string;
  parte: number;
};

export function CalculoDivision(params: {
  monto_total: number;
  consumidoresID: string[];
  tipo_division: TipoDivision;
  montosExactos?: Record<string, number>;
}): CalculoConsumidor[] {
  const {
    monto_total,
    consumidoresID,
    tipo_division,
    montosExactos = {},
  } = params;

  if (consumidoresID.length === 0) {
    throw new Error("Debe haber al menos un consumidor");
  }

  if (tipo_division === "equitativo") {
    // trabajar en centavos para evitar errores de redondeo
    const totalCents = Math.round(monto_total * 100);
    const n = consumidoresID.length;
    const base = Math.floor(totalCents / n);
    let remainder = totalCents - base * n;

    return consumidoresID.map((contacto_id) => {
      const asignado = base + (remainder > 0 ? 1 : 0);
      if (remainder > 0) remainder -= 1;
      return { contacto_id, parte: Number((asignado / 100).toFixed(2)) };
    });
  }

  if (tipo_division === "montos_exactos") {
    // redondear montos exactos a centavos y ajustar diferencia mínima
    const totalCents = Math.round(monto_total * 100);
    const consumidores = consumidoresID.map((contacto_id) => ({
      contacto_id,
      cents: Math.round((montosExactos[contacto_id] || 0) * 100),
    }));

    const sumaCents = consumidores.reduce((s, c) => s + c.cents, 0);
    if (sumaCents !== totalCents) {
      throw new Error("La suma de las partes no coincide con el monto total");
    }

    return consumidores.map((c) => ({
      contacto_id: c.contacto_id,
      parte: Number((c.cents / 100).toFixed(2)),
    }));
  }

  if (tipo_division === "porcentual") {
    // montosExactos contains percentages per contacto_id
    const consumidores = consumidoresID.map((contacto_id) => ({
      contacto_id,
      porcentaje: Number(montosExactos[contacto_id] || 0),
    }));

    const sumaPct = consumidores.reduce((t, c) => t + c.porcentaje, 0);
    if (Math.round(sumaPct) !== 100) {
      throw new Error("La suma de los porcentajes debe ser 100%");
    }

    const totalCents = Math.round(monto_total * 100);
    // calcular asignaciones en centavos usando la técnica de partes fraccionarias
    const raw = consumidores.map((c) => {
      const exact = (totalCents * c.porcentaje) / 100;
      const floored = Math.floor(exact);
      return {
        contacto_id: c.contacto_id,
        exact,
        floored,
        frac: exact - floored,
      };
    });

    let assigned = raw.reduce((s, r) => s + r.floored, 0);
    let diff = totalCents - assigned; // cuantos centavos faltan

    // ordenar por fracción descendente para distribuir centavos restantes
    raw.sort((a, b) => b.frac - a.frac);
    for (let i = 0; i < raw.length && diff > 0; i += 1) {
      raw[i].floored += 1;
      diff -= 1;
    }

    // devolver en el orden original consumidoresID
    const asignMap: Record<string, number> = {};
    raw.forEach((r) => (asignMap[r.contacto_id] = r.floored));

    return consumidoresID.map((contacto_id) => ({
      contacto_id,
      parte: Number((asignMap[contacto_id] / 100).toFixed(2)),
    }));
  }

  if (tipo_division === "por_cuotas") {
    const consumidores = consumidoresID.map((contacto_id) => ({
      contacto_id,
      partes: Number(montosExactos[contacto_id] || 0),
    }));

    const totalPartes = consumidores.reduce((t, c) => t + c.partes, 0);
    if (totalPartes <= 0) {
      throw new Error("Debe asignarse al menos una parte en por_cuotas");
    }

    const totalCents = Math.round(monto_total * 100);
    const raw = consumidores.map((c) => {
      const exact = (totalCents * c.partes) / totalPartes;
      const floored = Math.floor(exact);
      return {
        contacto_id: c.contacto_id,
        exact,
        floored,
        frac: exact - floored,
      };
    });

    let assigned = raw.reduce((s, r) => s + r.floored, 0);
    let diff = totalCents - assigned;
    raw.sort((a, b) => b.frac - a.frac);
    for (let i = 0; i < raw.length && diff > 0; i += 1) {
      raw[i].floored += 1;
      diff -= 1;
    }

    const asignMap: Record<string, number> = {};
    raw.forEach((r) => (asignMap[r.contacto_id] = r.floored));

    return consumidoresID.map((contacto_id) => ({
      contacto_id,
      parte: Number((asignMap[contacto_id] / 100).toFixed(2)),
    }));
  }

  throw new Error("Tipo de división no reconocido");
}
