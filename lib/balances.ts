export interface Deuda {
  deudorId: string;
  acreedorId: string;
  monto: number;
}

export interface BalanceParticipante {
  contactoId: string;
  balance: number; // positivo = le deben, negativo = debe
}

const PRECISION = 10000;
const UMBRAL_CERO = 1 / PRECISION;

const normalizarMonto = (valor: number) =>
  Math.round((valor + Number.EPSILON) * PRECISION) / PRECISION;

const esCero = (valor: number) => Math.abs(valor) < UMBRAL_CERO;

/**
 * Calcula el balance neto de cada participante a partir de los gastos del evento.
 * Retorna array con cuánto debe o le deben a cada uno.
 */
export const calcularBalances = (
  gastosPagadores: { contacto_id: string; monto_aportado: number }[],
  gastosConsumidores: { contacto_id: string; parte: number }[],
): BalanceParticipante[] => {
  const balances = new Map<string, number>();

  for (const pagador of gastosPagadores) {
    const balanceActual = balances.get(pagador.contacto_id) ?? 0;
    balances.set(
      pagador.contacto_id,
      normalizarMonto(balanceActual + pagador.monto_aportado),
    );
  }

  for (const consumidor of gastosConsumidores) {
    const balanceActual = balances.get(consumidor.contacto_id) ?? 0;
    balances.set(
      consumidor.contacto_id,
      normalizarMonto(balanceActual - consumidor.parte),
    );
  }

  return Array.from(balances.entries())
    .map(([contactoId, balance]) => ({
      contactoId,
      balance: normalizarMonto(balance),
    }))
    .sort((izquierda, derecha) =>
      izquierda.contactoId.localeCompare(derecha.contactoId),
    );
};

/**
 * Toma los balances netos y genera la lista mínima de transferencias
 * para saldar todas las deudas (algoritmo de simplificación de saldos).
 */
export const simplificarDeudas = (balances: BalanceParticipante[]): Deuda[] => {
  const acreedores = balances
    .map((balance) => ({
      contactoId: balance.contactoId,
      balance: normalizarMonto(balance.balance),
    }))
    .filter((balance) => balance.balance > 0)
    .sort((izquierda, derecha) => {
      if (derecha.balance !== izquierda.balance) {
        return derecha.balance - izquierda.balance;
      }

      return izquierda.contactoId.localeCompare(derecha.contactoId);
    });

  const deudores = balances
    .map((balance) => ({
      contactoId: balance.contactoId,
      balance: normalizarMonto(balance.balance),
    }))
    .filter((balance) => balance.balance < 0)
    .sort((izquierda, derecha) => {
      if (izquierda.balance !== derecha.balance) {
        return izquierda.balance - derecha.balance;
      }

      return izquierda.contactoId.localeCompare(derecha.contactoId);
    });

  const deudas: Deuda[] = [];
  let indiceDeudor = 0;
  let indiceAcreedor = 0;

  while (indiceDeudor < deudores.length && indiceAcreedor < acreedores.length) {
    const deudor = deudores[indiceDeudor];
    const acreedor = acreedores[indiceAcreedor];
    const monto = normalizarMonto(
      Math.min(Math.abs(deudor.balance), acreedor.balance),
    );

    if (!esCero(monto)) {
      deudas.push({
        deudorId: deudor.contactoId,
        acreedorId: acreedor.contactoId,
        monto,
      });
    }

    deudor.balance = normalizarMonto(deudor.balance + monto);
    acreedor.balance = normalizarMonto(acreedor.balance - monto);

    if (esCero(deudor.balance)) {
      indiceDeudor += 1;
    }

    if (esCero(acreedor.balance)) {
      indiceAcreedor += 1;
    }
  }

  return deudas;
};
