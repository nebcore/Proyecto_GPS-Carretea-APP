import { describe, expect, it, vi } from "vitest";

// mock getGastosByEvento to return controlled gastos
vi.mock("../api/gastos", () => ({
  getGastosByEvento: async (eventoId: string) => {
    return [
      {
        id: "g1",
        evento_id: eventoId,
        gastos_pagadores: [{ contacto_id: "u1", monto_aportado: 90 }],
        gastos_consumidores: [
          { contacto_id: "u1", parte: 30 },
          { contacto_id: "u2", parte: 30 },
          { contacto_id: "u3", parte: 30 },
        ],
      },
      {
        id: "g2",
        evento_id: eventoId,
        gastos_pagadores: [{ contacto_id: "u2", monto_aportado: 60 }],
        gastos_consumidores: [
          { contacto_id: "u1", parte: 20 },
          { contacto_id: "u2", parte: 20 },
          { contacto_id: "u3", parte: 20 },
        ],
      },
    ];
  },
}));

import { getGastosByEvento } from "../api/gastos";
import { calcularBalances, simplificarDeudas } from "../balances";

describe("pipeline balances (similar a useBalancesEvento)", () => {
  it("calcula balances y simplifica deudas a partir de gastos", async () => {
    const eventoId = "evt-42";
    const gastos = await getGastosByEvento(eventoId);

    // extraer participaciones
    const pagadores: { contacto_id: string; monto_aportado: number }[] = [];
    const consumidores: { contacto_id: string; parte: number }[] = [];

    for (const g of gastos) {
      if (g.gastos_pagadores?.length) pagadores.push(...g.gastos_pagadores);
      if (g.gastos_consumidores?.length)
        consumidores.push(...g.gastos_consumidores);
    }

    const balances = calcularBalances(pagadores, consumidores);
    const deudas = simplificarDeudas(balances);

    // verificar saldos esperados
    // Calculamos rápidamente: aportes: u1:90, u2:60 => total aportes 150
    // consumos totales: g1 consumidores sum 90, g2 sum 60 => cada participante:
    // u1 consumption: 30+20=50 -> balance = 90 -50 = 40
    // u2 consumption: 30+20=50 -> balance = 60 -50 = 10
    // u3 consumption: 30+20=50 -> balance = 0 -50 = -50

    expect(balances).toEqual(
      expect.arrayContaining([
        { contactoId: "u1", balance: 40 },
        { contactoId: "u2", balance: 10 },
        { contactoId: "u3", balance: -50 },
      ]),
    );

    // simplificación: u3 debe 50 -> lo paga a u1 y u2
    expect(deudas).toEqual(
      expect.arrayContaining([
        { deudorId: "u3", acreedorId: "u1", monto: 40 },
        { deudorId: "u3", acreedorId: "u2", monto: 10 },
      ]),
    );
  });
});
