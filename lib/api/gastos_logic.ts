export type TipoDivision = "equitativo" | "montos_exactos" | "porcentual" | "por_cuotas";

export type CalculoConsumidor = {
    contacto_id: string,
    parte: number
};

export function CalculoDivision(params: {
    monto_total: number,
    consumidoresID: string[],
    tipo_division: TipoDivision,
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

    if (tipo_division === "equitativo"){
        const PartexPersona = monto_total / consumidoresID.length;

        return consumidoresID.map((contacto_id) => ({
            contacto_id,
            parte: Number(PartexPersona.toFixed(4)),
        }));
    }

    if (tipo_division === "montos_exactos") {
        const consumidores = consumidoresID.map((contacto_id) => ({
            contacto_id,
            parte: Number(montosExactos[contacto_id] || 0),
        }));

        const sumaPartes = consumidores.reduce(
            (total, consumidor) => total + consumidor.parte,
            0
        );

        if (Number(sumaPartes.toFixed(2)) !== Number(monto_total.toFixed(2))) {
            throw new Error("La suma de las partes no coincide con el monto total");
        }

        return consumidores;
    }

    if (tipo_division === "porcentual") {
        // montosExactos contains percentages per contacto_id
        const consumidores = consumidoresID.map((contacto_id) => ({
            contacto_id,
            porcentaje: Number(montosExactos[contacto_id] || 0),
        } as any));

        const sumaPct = consumidores.reduce((t: any, c: any) => t + c.porcentaje, 0);
        if (Math.round(sumaPct) !== 100) {
            throw new Error("La suma de los porcentajes debe ser 100%");
        }

        // calcular montos y ajustar por redondeo
        const resultados: CalculoConsumidor[] = consumidores.map((c: any) => ({
            contacto_id: c.contacto_id,
            parte: Number(((monto_total * c.porcentaje) / 100).toFixed(4)),
        }));

        // ajustar diferencia por redondeo en el último participante
        const sumaAsignada = resultados.reduce((s, r) => s + r.parte, 0);
        const diff = Number((monto_total - sumaAsignada).toFixed(4));
        if (Math.abs(diff) >= 0.0001) {
            resultados[resultados.length - 1].parte = Number(
                (resultados[resultados.length - 1].parte + diff).toFixed(4),
            );
        }

        return resultados;
    }

    if (tipo_division === "por_cuotas") {
        // montosExactos contains integer "partes" per contacto_id
        const consumidores = consumidoresID.map((contacto_id) => ({
            contacto_id,
            partes: Number(montosExactos[contacto_id] || 0),
        } as any));

        const totalPartes = consumidores.reduce((t: any, c: any) => t + c.partes, 0);
        if (totalPartes <= 0) {
            throw new Error("Debe asignarse al menos una parte en por_cuotas");
        }

        const resultados: CalculoConsumidor[] = consumidores.map((c: any) => ({
            contacto_id: c.contacto_id,
            parte: Number(((monto_total * c.partes) / totalPartes).toFixed(4)),
        }));

        const sumaAsignada = resultados.reduce((s, r) => s + r.parte, 0);
        const diff = Number((monto_total - sumaAsignada).toFixed(4));
        if (Math.abs(diff) >= 0.0001) {
            resultados[resultados.length - 1].parte = Number(
                (resultados[resultados.length - 1].parte + diff).toFixed(4),
            );
        }

        return resultados;
    }

    throw new Error("Tipo de división no reconocido");
}
