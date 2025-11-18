// validations/schemas/proveedoresSchemas.js
import Joi from "joi";

// =====================================================
// 📋 DEFINICIONES DE ESQUEMAS PARA PROVEEDORES
// =====================================================

/**
 * Esquema para crear proveedor
 * Campos requeridos: nombre
 * Campos opcionales: contacto, telefono, email, direccion, ciudad, pais, activo
 */
export const createProveedor = Joi.object({
  nombre: Joi.string().trim().min(2).max(200).required().messages({
    "string.base": "El nombre debe ser una cadena de texto",
    "string.empty": "El nombre es obligatorio",
    "string.min": "El nombre debe tener al menos 2 caracteres",
    "string.max": "El nombre no puede exceder los 200 caracteres",
    "any.required": "El nombre es obligatorio",
  }),

  contacto: Joi.string().trim().max(100).allow(null, "").optional().messages({
    "string.base": "El contacto debe ser una cadena de texto",
    "string.max": "El contacto no puede exceder los 100 caracteres",
  }),

  telefono: Joi.string().trim().max(20).allow(null, "").optional().messages({
    "string.base": "El teléfono debe ser una cadena de texto",
    "string.max": "El teléfono no puede exceder los 20 caracteres",
  }),

  email: Joi.string()
    .trim()
    .email({ minDomainSegments: 2, tlds: { allow: true } })
    .max(100)
    .allow(null, "")
    .optional()
    .messages({
      "string.base": "El email debe ser una cadena de texto",
      "string.email": "El email debe tener un formato válido",
      "string.max": "El email no puede exceder los 100 caracteres",
    }),

  direccion: Joi.string().trim().max(500).allow(null, "").optional().messages({
    "string.base": "La dirección debe ser una cadena de texto",
    "string.max": "La dirección no puede exceder los 500 caracteres",
  }),

  ciudad: Joi.string().trim().max(100).allow(null, "").optional().messages({
    "string.base": "La ciudad debe ser una cadena de texto",
    "string.max": "La ciudad no puede exceder los 100 caracteres",
  }),

  pais: Joi.string()
    .trim()
    .max(100)
    .allow(null, "")
    .default("Colombia")
    .optional()
    .messages({
      "string.base": "El país debe ser una cadena de texto",
      "string.max": "El país no puede exceder los 100 caracteres",
    }),

  activo: Joi.boolean().default(true).optional().messages({
    "boolean.base": "El campo activo debe ser verdadero o falso",
  }),
});

/**
 * Esquema para actualizar proveedor
 * Todos los campos opcionales, pero al menos uno requerido
 */
export const updateProveedor = Joi.object({
  nombre: Joi.string().trim().min(2).max(200).optional().messages({
    "string.base": "El nombre debe ser una cadena de texto",
    "string.empty": "El nombre no puede estar vacío",
    "string.min": "El nombre debe tener al menos 2 caracteres",
    "string.max": "El nombre no puede exceder los 200 caracteres",
  }),

  contacto: Joi.string().trim().max(100).allow(null, "").optional().messages({
    "string.base": "El contacto debe ser una cadena de texto",
    "string.max": "El contacto no puede exceder los 100 caracteres",
  }),

  telefono: Joi.string().trim().max(20).allow(null, "").optional().messages({
    "string.base": "El teléfono debe ser una cadena de texto",
    "string.max": "El teléfono no puede exceder los 20 caracteres",
  }),

  email: Joi.string()
    .trim()
    .email({ minDomainSegments: 2, tlds: { allow: true } })
    .max(100)
    .allow(null, "")
    .optional()
    .messages({
      "string.base": "El email debe ser una cadena de texto",
      "string.email": "El email debe tener un formato válido",
      "string.max": "El email no puede exceder los 100 caracteres",
    }),

  direccion: Joi.string().trim().max(500).allow(null, "").optional().messages({
    "string.base": "La dirección debe ser una cadena de texto",
    "string.max": "La dirección no puede exceder los 500 caracteres",
  }),

  ciudad: Joi.string().trim().max(100).allow(null, "").optional().messages({
    "string.base": "La ciudad debe ser una cadena de texto",
    "string.max": "La ciudad no puede exceder los 100 caracteres",
  }),

  pais: Joi.string().trim().max(100).allow(null, "").optional().messages({
    "string.base": "El país debe ser una cadena de texto",
    "string.max": "El país no puede exceder los 100 caracteres",
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
 * Esquema para query parameters al obtener proveedores
 */
export const getProveedores = Joi.object({
  search: Joi.string().trim().max(200).optional().messages({
    "string.base": "La búsqueda debe ser una cadena de texto",
    "string.max": "El término de búsqueda no puede exceder los 200 caracteres",
  }),

  activo: Joi.string().valid("true", "false", "all").default("true").messages({
    "any.only": 'El parámetro "activo" debe ser "true", "false" o "all"',
  }),

  page: Joi.number().integer().min(1).default(1).messages({
    "number.base": "La página debe ser un número",
    "number.integer": "La página debe ser un número entero",
    "number.min": "La página debe ser mayor a 0",
  }),

  limit: Joi.number().integer().min(1).max(100).default(20).messages({
    "number.base": "El límite debe ser un número",
    "number.integer": "El límite debe ser un número entero",
    "number.min": "El límite debe ser mayor a 0",
    "number.max": "El límite no puede ser mayor a 100",
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
 * Esquema para query parameters al obtener proveedor por ID
 */
export const getProveedorById = Joi.object({
  incluir_recepciones: Joi.string()
    .valid("true", "false")
    .default("false")
    .messages({
      "any.only":
        'El parámetro "incluir_recepciones" debe ser "true" o "false"',
    }),
});

/**
 * Esquema para validar ID en params
 */
export const proveedorId = Joi.object({
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
export const proveedoresSchemas = {
  createProveedor,
  updateProveedor,
  getProveedores,
  getProveedorById,
  proveedorId,
};

// =====================================================
// 📄 METADATA DE SCHEMAS (PARA DOCUMENTACIÓN)
// =====================================================

/**
 * Información sobre los schemas disponibles
 * Útil para generación automática de documentación
 */
export const schemasInfo = {
  createProveedor: {
    description: "Validación para crear nuevo proveedor",
    requiredFields: ["nombre"],
    optionalFields: [
      "contacto",
      "telefono",
      "email",
      "direccion",
      "ciudad",
      "pais",
      "activo",
    ],
    source: "body",
  },

  updateProveedor: {
    description: "Validación para actualizar proveedor existente",
    requiredFields: [], // Mínimo 1 campo requerido por .min(1)
    optionalFields: [
      "nombre",
      "contacto",
      "telefono",
      "email",
      "direccion",
      "ciudad",
      "pais",
      "activo",
    ],
    source: "body",
  },

  getProveedores: {
    description: "Validación para filtros al listar proveedores",
    defaultValues: {
      activo: "true",
      page: 1,
      limit: 20,
      incluir_estadisticas: "false",
    },
    source: "query",
  },

  getProveedorById: {
    description: "Validación para opciones al obtener proveedor específico",
    defaultValues: { incluir_recepciones: "false" },
    source: "query",
  },

  proveedorId: {
    description: "Validación para ID de proveedor en parámetros",
    requiredFields: ["id"],
    source: "params",
  },
};
