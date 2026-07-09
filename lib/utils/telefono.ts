/**
 * Normaliza un telefono al formato E.164 que exige Twilio/Supabase.
 * Asume Chile (+56) cuando el numero viene sin codigo de pais.
 *
 * Ejemplos:
 *   "9 1234 5678"   -> "+56912345678"
 *   "912345678"     -> "+56912345678"
 *   "56912345678"   -> "+56912345678"
 *   "+56 9 1234 5678" -> "+56912345678"
 *   "+56912345678"  -> "+56912345678"
 */
export function normalizarTelefono(input: string): string {
  const tienePrefijoInternacional = input.trim().startsWith("+");
  let limpio = input.trim().replace(/\D/g, "");
  if (!limpio) return limpio;

  // Quita ceros iniciales (ej. 09... -> 9...).
  limpio = limpio.replace(/^0+/, "");

  // Si ya trae el codigo de pais de Chile.
  if (limpio.startsWith("56")) return "+" + limpio;

  // Respeta numeros internacionales no chilenos que ya venian con "+".
  if (tienePrefijoInternacional) return "+" + limpio;

  // Numero nacional: anteponemos el codigo de Chile.
  return "+56" + limpio;
}

/**
 * Valida que el telefono ya normalizado tenga una pinta razonable de E.164.
 */
export function esTelefonoValido(e164: string): boolean {
  return /^\+[1-9]\d{7,14}$/.test(e164);
}
