import { describe, expect, it, vi } from "vitest";

// mock supabase module used by lib/api/gastos.ts
vi.mock("../supabase", () => {
  return {
    supabase: {
      from: (table: string) => {
        return {
          select: (sel?: string) => ({
            eq: (col: string, val: string) => ({
              order: (colName: string, opts?: any) => {
                const mockData = [
                  {
                    id: "g1",
                    evento_id: val,
                    descripcion: "Comida",
                    categoria: "comida",
                    monto_total: 100,
                    fecha: new Date().toISOString(),
                    tipo_division: "equitativo",
                    gastos_pagadores: [
                      { contacto_id: "a", monto_aportado: 100 },
                    ],
                    gastos_consumidores: [
                      { contacto_id: "a", parte: 50 },
                      { contacto_id: "b", parte: 50 },
                    ],
                  },
                ];

                return Promise.resolve({ data: mockData, error: null });
              },
            }),
          }),
        };
      },
    },
  };
});

import { getGastosByEvento } from "./gastos";

describe("getGastosByEvento", () => {
  it("devuelve gastos con pagadores y consumidores", async () => {
    const eventoId = "evt-123";
    const data = await getGastosByEvento(eventoId);
    expect(Array.isArray(data)).toBe(true);
    expect(data[0]).toHaveProperty("gastos_pagadores");
    expect(data[0]).toHaveProperty("gastos_consumidores");
    expect(data[0].evento_id).toBe(eventoId);
  });
});
