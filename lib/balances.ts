export interface Deuda {
  deudorId: string;
  acreedorId: string;
  monto: number;
}

export interface BalanceParticipante {
  contactoId: string;
  balance: number; // positivo = le deben, negativo = debe
}

/**
 * Calcula el balance neto de cada participante a partir de los gastos del evento.
 * Retorna array con cuánto debe o le deben a cada uno.
 */
export const calcularBalances = (
  gastosPagadores: { contacto_id: string; monto_aportado: number }[],
  gastosConsumidores: { contacto_id: string; parte: number }[],
): BalanceParticipante[] => {
  // Implementar

  return [];
};

/**
 * Toma los balances netos y genera la lista mínima de transferencias
 * para saldar todas las deudas (algoritmo de simplificación de saldos).
 */
export const simplificarDeudas = (balances: BalanceParticipante[]): Deuda[] => {
  // Implementar

  return [];
};
