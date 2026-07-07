export const limpiarRut = (rut: string) =>
  rut.replace(/[^0-9kK]/g, "").toUpperCase();

export const formatearRut = (rut: string) => {
  const limpio = limpiarRut(rut);

  if (limpio.length <= 1) return limpio;

  const cuerpo = limpio.slice(0, -1);
  const dv = limpio.slice(-1);
  const cuerpoConPuntos = cuerpo.replace(/\B(?=(\d{3})+(?!\d))/g, ".");

  return `${cuerpoConPuntos}-${dv}`;
};
