export type TipoDivision = "equitativo" | "montos_exactos";

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

    throw new Error("Tipo de división no reconocido");
}
