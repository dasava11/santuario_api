// validations/categoriasValidations.js - Versión Correcta Reutilizando Utils
import { validate, validateSource } from "../middleware/validation.js";
import {
  createCategoria,
  updateCategoria,
  getCategorias,
  getCategoriaById,
  categoriaId,
  categoriasSchemas,
} from "./schemas/categoriasSchemas.js";

// =====================================================
// 🎯 MIDDLEWARES ESPECÍFICOS PARA CATEGORÍAS
// =====================================================

/**
 * Validar datos para crear categoría
 * Reutiliza el middleware genérico existente
 */
const validateCreateCategoria = validate(createCategoria);

/**
 * Validar datos para actualizar categoría
 * Reutiliza el middleware genérico existente
 */
const validateUpdateCategoria = validate(updateCategoria);

/**
 * Validar ID de categoría en parámetros
 * Reutiliza validateSource para params
 */
const validateCategoriaId = validateSource(categoriaId, "params");

/**
 * Validar query parameters para obtener categorías
 * Reutiliza validateSource para query con defaults
 */
const validateGetCategoriasQuery = validateSource(getCategorias, "query");

/**
 * Validar query parameters para obtener categoría por ID
 * Reutiliza validateSource para query con defaults
 */
const validateGetCategoriaByIdQuery = validateSource(getCategoriaById, "query");

// =====================================================
// 📤 EXPORTACIONES LIMPIAS
// =====================================================

export {
  // Schemas (para uso directo si necesario)
  categoriasSchemas,

  // Middlewares específicos listos para rutas
  validateCreateCategoria,
  validateUpdateCategoria,
  validateCategoriaId,
  validateGetCategoriasQuery,
  validateGetCategoriaByIdQuery,
};
