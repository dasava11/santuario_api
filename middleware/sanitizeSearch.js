// middleware/sanitizeSearch.js
// Middleware reutilizable para sanitizar campos de búsqueda y otros strings
// Importar con: import { sanitizeSearch, sanitizeString } from "../middleware/sanitizeSearch.js";

const defaultOptions = {
  queryFields: ["search"], // campos a sanitizar en req.query
  bodyFields: [], // campos a sanitizar en req.body
  paramFields: [], // campos a sanitizar en req.params
  allBodyStrings: false, // si true: sanitiza todos los campos string del body
  escapeWildcards: true, // escapar % _ y \
  removeDangerousChars: true, // eliminar <> " ' (previene inserciones no esperadas)
  maxLength: 200, // truncar longitud para evitar abuse
};

/**
 * Sanitiza un string según opciones.
 */
export const sanitizeString = (value, opts = {}) => {
  if (value === null || value === undefined) return value;
  let s = String(value);

  if (opts.escapeWildcards) {
    // Escapa % _ y backslash para que LIKE sea literal
    s = s.replace(/([%_\\])/g, "\\$1");
  }

  if (opts.removeDangerousChars) {
    // Elimina caracteres que suelen causar problemas en YAML/HTML/SQL displayed text
    s = s.replace(/[<>\"'`]/g, "");
  }

  // Normalizar espacios, acentos si se desea (opcional)
  s = s.trim();

  if (opts.maxLength && s.length > opts.maxLength) {
    s = s.substring(0, opts.maxLength);
  }

  return s;
};

/**
 * Middleware factory: devuelve un middleware personalizado según opciones.
 * Uso: router.get("/", sanitizeSearch(), handler)
 * o: router.post("/", sanitizeSearch({ bodyFields: ["nombre","descripcion"], allBodyStrings: true }), handler)
 */
export const sanitizeSearch = (options = {}) => {
  const opts = { ...defaultOptions, ...options };

  return (req, res, next) => {
    try {
      // SANITIZAR req.query campos concretos
      if (req.query && typeof req.query === "object") {
        for (const field of opts.queryFields) {
          if (
            Object.prototype.hasOwnProperty.call(req.query, field) &&
            req.query[field] != null
          ) {
            req.query[field] = sanitizeString(req.query[field], opts);
          }
        }
      }

      // SANITIZAR req.params
      if (req.params && typeof req.params === "object") {
        for (const field of opts.paramFields) {
          if (
            Object.prototype.hasOwnProperty.call(req.params, field) &&
            req.params[field] != null
          ) {
            req.params[field] = sanitizeString(req.params[field], opts);
          }
        }
      }

      // SANITIZAR req.body
      if (req.body && typeof req.body === "object") {
        if (opts.allBodyStrings) {
          // sanitizar recursivamente todos los strings del body (cuidado con objetos grandes)
          const walk = (obj) => {
            for (const k of Object.keys(obj)) {
              const v = obj[k];
              if (typeof v === "string") obj[k] = sanitizeString(v, opts);
              else if (v && typeof v === "object" && !Array.isArray(v)) walk(v);
            }
          };
          walk(req.body);
        } else {
          for (const field of opts.bodyFields) {
            if (
              Object.prototype.hasOwnProperty.call(req.body, field) &&
              req.body[field] != null
            ) {
              req.body[field] = sanitizeString(req.body[field], opts);
            }
          }
        }
      }

      return next();
    } catch (err) {
      // Nunca lanzar error por sanitización: fallback seguro
      console.warn("sanitizeSearch middleware error:", err);
      return next();
    }
  };
};

export default sanitizeSearch;
