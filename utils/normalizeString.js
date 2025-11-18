/**
 * Normaliza strings para comparaciones consistentes.
 * - Convierte a minúsculas
 * - Elimina espacios extras
 * - Remueve acentos y diacríticos
 * - Opcionalmente elimina símbolos no alfanuméricos
 *
 * @param {string} str - Texto a normalizar
 * @param {Object} options - Configuración opcional
 * @param {boolean} options.removeSymbols - Si true, elimina símbolos no alfanuméricos
 * @returns {string} Texto normalizado
 */
const normalizeString = (str, options = {}) => {
  if (!str || typeof str !== "string") return "";

  let normalized = str
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ") // múltiples espacios → 1 espacio
    .normalize("NFD") // separa acentos
    .replace(/[\u0300-\u036f]/g, ""); // elimina diacríticos

  if (options.removeSymbols) {
    normalized = normalized.replace(/[^a-z0-9\s]/g, ""); // quita símbolos
  }

  return normalized;
};

export { normalizeString };
