// validations/schemas/recepcionesSchemas.js
import Joi from "joi";

// =====================================================
// 📋 DEFINICIONES DE ESQUEMAS PARA RECEPCIONES
// =====================================================

/**
 * Esquema para crear recepción
 * Campos requeridos: numero_factura, proveedor_id, fecha_recepcion, productos
 * Campos opcionales: observaciones
 */
export const createRecepcion = Joi.object({
  numero_factura: Joi.string().trim().min(1).max(100).required().messages({
    "string.base": "El número de factura debe ser una cadena de texto",
    "string.empty": "El número de factura es obligatorio",
    "string.min": "El número de factura debe tener al menos 1 carácter",
    "string.max": "El número de factura no puede exceder los 100 caracteres",
    "any.required": "El número de factura es obligatorio",
  }),

  proveedor_id: Joi.number().integer().positive().required().messages({
    "number.base": "El ID del proveedor debe ser un número",
    "number.integer": "El ID del proveedor debe ser un número entero",
    "number.positive": "El ID del proveedor debe ser un número positivo",
    "any.required": "El ID del proveedor es obligatorio",
  }),

  fecha_recepcion: Joi.date().iso().max("now").required().messages({
    "date.base": "La fecha de recepción debe ser una fecha válida",
    "date.format":
      "La fecha de recepción debe estar en formato ISO (YYYY-MM-DD)",
    "date.max": "La fecha de recepción no puede ser posterior a hoy",
    "any.required": "La fecha de recepción es obligatoria",
  }),

  observaciones: Joi.string()
    .trim()
    .max(1000)
    .allow(null, "")
    .optional()
    .messages({
      "string.base": "Las observaciones deben ser una cadena de texto",
      "string.max": "Las observaciones no pueden exceder los 1000 caracteres",
    }),

  productos: Joi.array()
    .items(
      Joi.object({
        producto_id: Joi.number().integer().positive().required().messages({
          "number.base": "El ID del producto debe ser un número",
          "number.integer": "El ID del producto debe ser un número entero",
          "number.positive": "El ID del producto debe ser un número positivo",
          "any.required": "El ID del producto es obligatorio",
        }),

        cantidad: Joi.number()
          .positive()
          .precision(3)
          .max(99999999.999)
          .required()
          .messages({
            "number.base": "La cantidad debe ser un número",
            "number.positive": "La cantidad debe ser un número positivo",
            "number.precision": "La cantidad no puede tener más de 3 decimales",
            "number.max": "La cantidad excede el límite máximo permitido",
            "any.required": "La cantidad es obligatoria",
          }),

        precio_unitario: Joi.number()
          .positive()
          .precision(2)
          .max(99999999.99)
          .required()
          .messages({
            "number.base": "El precio unitario debe ser un número",
            "number.positive": "El precio unitario debe ser un número positivo",
            "number.precision":
              "El precio unitario no puede tener más de 2 decimales",
            "number.max":
              "El precio unitario excede el límite máximo permitido",
            "any.required": "El precio unitario es obligatorio",
          }),
      })
    )
    .min(1)
    .required()
    .messages({
      "array.base": "Los productos deben ser un arreglo",
      "array.min": "Debe incluir al menos un producto",
      "any.required": "Los productos son obligatorios",
    }),
});

/**
 * Esquema para actualizar recepción
 * Solo permite actualizar observaciones si está en estado 'pendiente'
 */
export const updateRecepcion = Joi.object({
  observaciones: Joi.string()
    .trim()
    .max(1000)
    .allow(null, "")
    .optional()
    .messages({
      "string.base": "Las observaciones deben ser una cadena de texto",
      "string.max": "Las observaciones no pueden exceder los 1000 caracteres",
    }),
})
  .min(1)
  .messages({
    "object.min": "Debe proporcionar al menos un campo para actualizar",
  });

/**
 * Esquema para query parameters al obtener recepciones
 */
export const getRecepciones = Joi.object({
  fecha_inicio: Joi.date().iso().optional().messages({
    "date.base": "La fecha de inicio debe ser una fecha válida",
    "date.format": "La fecha de inicio debe estar en formato ISO (YYYY-MM-DD)",
  }),

  fecha_fin: Joi.date()
    .iso()
    .min(Joi.ref("fecha_inicio"))
    .when("fecha_inicio", {
      is: Joi.exist(),
      then: Joi.required(),
      otherwise: Joi.optional(),
    })
    .messages({
      "date.base": "La fecha fin debe ser una fecha válida",
      "date.format": "La fecha fin debe estar en formato ISO (YYYY-MM-DD)",
      "date.min":
        "La fecha fin debe ser posterior o igual a la fecha de inicio",
      "any.required":
        "La fecha fin es requerida cuando se especifica fecha de inicio",
    }),

  proveedor_id: Joi.number().integer().positive().optional().messages({
    "number.base": "El ID del proveedor debe ser un número",
    "number.integer": "El ID del proveedor debe ser un número entero",
    "number.positive": "El ID del proveedor debe ser un número positivo",
  }),

  estado: Joi.string()
    .valid("pendiente", "procesada", "cancelada", "all")
    .default("all")
    .messages({
      "any.only":
        'El estado debe ser "pendiente", "procesada", "cancelada" o "all"',
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

  incluir_detalles: Joi.string()
    .valid("true", "false")
    .default("false")
    .messages({
      "any.only": 'El parámetro "incluir_detalles" debe ser "true" o "false"',
    }),
});

/**
 * Esquema para query parameters al obtener recepción por ID
 */
export const getRecepcionById = Joi.object({
  incluir_productos: Joi.string()
    .valid("true", "false")
    .default("true")
    .messages({
      "any.only": 'El parámetro "incluir_productos" debe ser "true" o "false"',
    }),

  incluir_movimientos: Joi.string()
    .valid("true", "false")
    .default("false")
    .messages({
      "any.only":
        'El parámetro "incluir_movimientos" debe ser "true" o "false"',
    }),
});

/**
 * Esquema para validar ID en params
 */
export const recepcionId = Joi.object({
  id: Joi.number().integer().positive().required().messages({
    "number.base": "El ID debe ser un número",
    "number.integer": "El ID debe ser un número entero",
    "number.positive": "El ID debe ser un número positivo",
    "any.required": "El ID es obligatorio",
  }),
});

/**
 * Esquema para procesar recepción
 * Permite observaciones adicionales al procesar
 */
export const procesarRecepcion = Joi.object({
  observaciones_proceso: Joi.string()
    .trim()
    .max(500)
    .allow(null, "")
    .optional()
    .messages({
      "string.base":
        "Las observaciones del proceso deben ser una cadena de texto",
      "string.max":
        "Las observaciones del proceso no pueden exceder los 500 caracteres",
    }),

  actualizar_precios: Joi.boolean().default(true).optional().messages({
    "boolean.base": "El campo actualizar_precios debe ser verdadero o falso",
  }),
});

// =====================================================
// 📦 EXPORTACIÓN AGRUPADA
// =====================================================

/**
 * Objeto que contiene todos los schemas agrupados
 * Útil para importaciones masivas o uso programático
 */
export const recepcionesSchemas = {
  createRecepcion,
  updateRecepcion,
  getRecepciones,
  getRecepcionById,
  recepcionId,
  procesarRecepcion,
};

// =====================================================
// 📄 METADATA DE SCHEMAS (PARA DOCUMENTACIÓN)
// =====================================================

/**
 * Información sobre los schemas disponibles
 * Útil para generación automática de documentación
 */
export const schemasInfo = {
  createRecepcion: {
    description: "Validación para crear nueva recepción",
    requiredFields: [
      "numero_factura",
      "proveedor_id",
      "fecha_recepcion",
      "productos",
    ],
    optionalFields: ["observaciones"],
    source: "body",
    businessRules: [
      "Fecha de recepción no puede ser posterior a hoy",
      "Debe incluir al menos un producto",
      "Cantidad máxima de 3 decimales",
      "Precio máximo de 2 decimales",
    ],
  },

  updateRecepcion: {
    description: "Validación para actualizar recepción existente",
    requiredFields: [],
    optionalFields: ["observaciones"],
    source: "body",
    businessRules: [
      "Solo se puede actualizar si está en estado 'pendiente'",
      "Mínimo 1 campo requerido por .min(1)",
    ],
  },

  getRecepciones: {
    description: "Validación para filtros al listar recepciones",
    defaultValues: {
      estado: "all",
      page: 1,
      limit: 20,
      incluir_detalles: "false",
    },
    source: "query",
    businessRules: [
      "Si se especifica fecha_inicio, fecha_fin es requerida y viceversa",
      "fecha_fin debe ser posterior o igual a fecha_inicio",
    ],
  },

  getRecepcionById: {
    description: "Validación para opciones al obtener recepción específica",
    defaultValues: {
      incluir_productos: "true",
      incluir_movimientos: "false",
    },
    source: "query",
  },

  recepcionId: {
    description: "Validación para ID de recepción en parámetros",
    requiredFields: ["id"],
    source: "params",
  },

  procesarRecepcion: {
    description: "Validación para procesar recepción",
    requiredFields: [],
    optionalFields: ["observaciones_proceso", "actualizar_precios"],
    source: "body",
    businessRules: [
      "Solo se pueden procesar recepciones en estado 'pendiente'",
      "actualizar_precios por defecto es true",
    ],
  },
};
