/**
 * Normaliza un teléfono al formato E.164 que exige Twilio/Supabase.
 * Asume Chile (+56) cuando el número viene sin código de país.
 *
 * Ejemplos:
 *   "9 1234 5678"   -> "+56912345678"
 *   "912345678"     -> "+56912345678"
 *   "56912345678"   -> "+56912345678"
 *   "+56912345678"  -> "+56912345678"
 */
export function normalizarTelefono(input: string): string {
  // Deja solo dígitos y el signo +
  let limpio = input.trim().replace(/[^\d+]/g, "");
  if (!limpio) return limpio;

  // Si ya viene en formato internacional, lo dejamos tal cual
  if (limpio.startsWith("+")) return limpio;

  // Quita ceros iniciales (ej. 09... -> 9...)
  limpio = limpio.replace(/^0+/, "");

  // Si ya trae el código de país de Chile
  if (limpio.startsWith("56")) return "+" + limpio;

  // Número nacional: anteponemos el código de Chile
  return "+56" + limpio;
}

/**
 * Valida que el teléfono ya normalizado tenga una pinta razonable de E.164.
 */
export function esTelefonoValido(e164: string): boolean {
  return /^\+[1-9]\d{7,14}$/.test(e164);
}
