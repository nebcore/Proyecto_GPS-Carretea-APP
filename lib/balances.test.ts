import { describe, expect, it } from "vitest";

import { calcularBalances, simplificarDeudas } from "./balances";

describe("calcularBalances", () => {
  it("calcula saldos netos con un pagador y varios consumidores", () => {
    const balances = calcularBalances(
      [{ contacto_id: "a", monto_aportado: 100 }],
      [
        { contacto_id: "a", parte: 25 },
        { contacto_id: "b", parte: 75 },
      ],
    );

    expect(balances).toEqual([
      { contactoId: "a", balance: 75 },
      { contactoId: "b", balance: -75 },
    ]);
  });

  it("acumula aportes y consumos repetidos por contacto", () => {
    const balances = calcularBalances(
      [
        { contacto_id: "a", monto_aportado: 40 },
        { contacto_id: "a", monto_aportado: 10 },
        { contacto_id: "c", monto_aportado: 30 },
      ],
      [
        { contacto_id: "b", parte: 35 },
        { contacto_id: "b", parte: 5 },
        { contacto_id: "c", parte: 15 },
      ],
    );

    expect(balances).toEqual([
      { contactoId: "a", balance: 50 },
      { contactoId: "b", balance: -40 },
      { contactoId: "c", balance: 15 },
    ]);
  });
});

describe("simplificarDeudas", () => {
  it("genera transferencias mínimas entre deudores y acreedores", () => {
    const deudas = simplificarDeudas([
      { contactoId: "a", balance: 75 },
      { contactoId: "b", balance: -25 },
      { contactoId: "c", balance: -50 },
    ]);

    expect(deudas).toEqual([
      { deudorId: "c", acreedorId: "a", monto: 50 },
      { deudorId: "b", acreedorId: "a", monto: 25 },
    ]);
  });

  it("no genera deudas cuando el balance ya está saldado", () => {
    expect(
      simplificarDeudas([
        { contactoId: "a", balance: 0 },
        { contactoId: "b", balance: 0 },
      ]),
    ).toEqual([]);
  });
});
