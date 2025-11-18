// validations/schemas/categoriasSchemas.js
import Joi from "joi";

// =====================================================
// 📋 DEFINICIONES DE ESQUEMAS PARA CATEGORÍAS
// =====================================================

/**
 * Esquema para crear categoría
 * Campos requeridos: nombre
 * Campos opcionales: descripcion
 */
export const createCategoria = Joi.object({
  nombre: Joi.string().trim().min(2).max(100).required().messages({
    "string.base": "El nombre debe ser una cadena de texto",
    "string.empty": "El nombre es obligatorio",
    "string.min": "El nombre debe tener al menos 2 caracteres",
    "string.max": "El nombre no puede exceder los 100 caracteres",
    "any.required": "El nombre es obligatorio",
  }),

  descripcion: Joi.string()
    .trim()
    .max(500)
    .allow(null, "")
    .optional()
    .messages({
      "string.base": "La descripción debe ser una cadena de texto",
      "string.max": "La descripción no puede exceder los 500 caracteres",
    }),
});

/**
 * Esquema para actualizar categoría
 * Todos los campos opcionales, pero al menos uno requerido
 */
export const updateCategoria = Joi.object({
  nombre: Joi.string().trim().min(2).max(100).optional().messages({
    "string.base": "El nombre debe ser una cadena de texto",
    "string.empty": "El nombre no puede estar vacío",
    "string.min": "El nombre debe tener al menos 2 caracteres",
    "string.max": "El nombre no puede exceder los 100 caracteres",
  }),

  descripcion: Joi.string()
    .trim()
    .max(500)
    .allow(null, "")
    .optional()
    .messages({
      "string.base": "La descripción debe ser una cadena de texto",
      "string.max": "La descripción no puede exceder los 500 caracteres",
    }),

  activo: Joi.boolean().optional().messages({
    "boolean.base": "El campo activo debe ser verdadero o falso",
  }),
})
  .min(1)
  .messages({
    "object.min": "Debe proporcionar al menos un campo para actualizar",
  });

/**
 * Esquema para query parameters al obtener categorías
 */
export const getCategorias = Joi.object({
  activo: Joi.string().valid("true", "false", "all").default("all").messages({
    "any.only": 'El parámetro "activo" debe ser "true", "false" o "all"',
  }),

  incluir_estadisticas: Joi.string()
    .valid("true", "false")
    .default("false")
    .messages({
      "any.only":
        'El parámetro "incluir_estadisticas" debe ser "true" o "false"',
    }),
});

/**
 * Esquema para query parameters al obtener categoría por ID
 */
export const getCategoriaById = Joi.object({
  incluir_productos: Joi.string()
    .valid("true", "false")
    .default("false")
    .messages({
      "any.only": 'El parámetro "incluir_productos" debe ser "true" o "false"',
    }),
});

/**
 * Esquema para validar ID en params
 */
export const categoriaId = Joi.object({
  id: Joi.number().integer().positive().required().messages({
    "number.base": "El ID debe ser un número",
    "number.integer": "El ID debe ser un número entero",
    "number.positive": "El ID debe ser un número positivo",
    "any.required": "El ID es obligatorio",
  }),
});

// =====================================================
// 📦 EXPORTACIÓN AGRUPADA (OPCIONAL)
// =====================================================

/**
 * Objeto que contiene todos los schemas agrupados
 * Útil para importaciones masivas o uso programático
 */
export const categoriasSchemas = {
  createCategoria,
  updateCategoria,
  getCategorias,
  getCategoriaById,
  categoriaId,
};

// =====================================================
// 📝 METADATA DE SCHEMAS (PARA DOCUMENTACIÓN)
// =====================================================

/**
 * Información sobre los schemas disponibles
 * Útil para generación automática de documentación
 */
export const schemasInfo = {
  createCategoria: {
    description: "Validación para crear nueva categoría",
    requiredFields: ["nombre"],
    optionalFields: ["descripcion"],
    source: "body",
  },

  updateCategoria: {
    description: "Validación para actualizar categoría existente",
    requiredFields: [], // Mínimo 1 campo requerido por .min(1)
    optionalFields: ["nombre", "descripcion", "activo"],
    source: "body",
  },

  getCategorias: {
    description: "Validación para filtros al listar categorías",
    defaultValues: { activo: "all", incluir_estadisticas: "false" },
    source: "query",
  },

  getCategoriaById: {
    description: "Validación para opciones al obtener categoría específica",
    defaultValues: { incluir_productos: "false" },
    source: "query",
  },

  categoriaId: {
    description: "Validación para ID de categoría en parámetros",
    requiredFields: ["id"],
    source: "params",
  },
};
