// validations/schemas/inventarioSchemas.js
import Joi from "joi";

// =====================================================
// DEFINICIONES DE ESQUEMAS PARA INVENTARIO
// =====================================================

/**
 * Esquema para ajustar inventario (corrección directa de stock)
 */
export const ajustarInventario = Joi.object({
  producto_id: Joi.number().integer().positive().required().messages({
    "number.base": "El ID del producto debe ser un número",
    "number.integer": "El ID del producto debe ser un número entero",
    "number.positive": "El ID del producto debe ser un número positivo",
    "any.required": "El ID del producto es obligatorio",
  }),

  nuevo_stock: Joi.number()
    .min(0)
    .max(1000000)
    .custom((value, helpers) => {
      const decimals = (value.toString().split(".")[1] || "").length;
      if (decimals > 3) {
        return helpers.error("number.precision", { limit: 3 });
      }
      return value;
    })
    .required()
    .messages({
      "number.base": "El nuevo stock debe ser un número",
      "number.min": "El nuevo stock no puede ser negativo",
      "number.max": "El nuevo stock no puede ser mayor a 1,000,000",
      "number.precision": "El nuevo stock no puede tener más de 3 decimales",
      "any.required": "El nuevo stock es obligatorio",
    }),

  observaciones: Joi.string().max(1000).allow("", null).default("").messages({
    "string.max": "Las observaciones no pueden tener más de 1000 caracteres",
  }),
});

/**
 * Esquema para actualizar stock (movimientos normales)
 * Usado internamente pero puede exponerse si se requiere endpoint manual
 */
export const actualizarStock = Joi.object({
  cantidad: Joi.number().positive().precision(3).required().messages({
    "number.base": "La cantidad debe ser un número",
    "number.positive": "La cantidad debe ser un número positivo",
    "number.precision": "La cantidad no puede tener más de 3 decimales",
    "any.required": "La cantidad es obligatoria",
  }),

  tipo_movimiento: Joi.string()
    .valid("entrada", "salida", "ajuste")
    .required()
    .messages({
      "any.only":
        'El tipo de movimiento debe ser "entrada", "salida" o "ajuste"',
      "any.required": "El tipo de movimiento es obligatorio",
    }),

  observaciones: Joi.string().max(1000).allow("", null).default("").messages({
    "string.max": "Las observaciones no pueden tener más de 1000 caracteres",
  }),

  referencia_id: Joi.number().integer().positive().allow(null).messages({
    "number.base": "El ID de referencia debe ser un número",
    "number.integer": "El ID de referencia debe ser un número entero",
    "number.positive": "El ID de referencia debe ser un número positivo",
  }),

  referencia_tipo: Joi.string()
    .valid("venta", "recepcion", "ajuste")
    .default("ajuste")
    .messages({
      "any.only":
        'El tipo de referencia debe ser "venta", "recepcion" o "ajuste"',
    }),
});

/**
 * Esquema para query parameters de movimientos
 */
export const getMovimientos = Joi.object({
  producto_id: Joi.number().integer().positive().messages({
    "number.base": "El ID del producto debe ser un número",
    "number.integer": "El ID del producto debe ser un número entero",
    "number.positive": "El ID del producto debe ser un número positivo",
  }),

  tipo_movimiento: Joi.string().valid("entrada", "salida", "ajuste").messages({
    "any.only": 'El tipo de movimiento debe ser "entrada", "salida" o "ajuste"',
  }),

  fecha_inicio: Joi.date().iso().messages({
    "date.base": "La fecha de inicio debe ser una fecha válida",
    "date.format": "La fecha de inicio debe tener formato ISO (YYYY-MM-DD)",
  }),

  fecha_fin: Joi.date().iso().min(Joi.ref("fecha_inicio")).messages({
    "date.base": "La fecha de fin debe ser una fecha válida",
    "date.format": "La fecha de fin debe tener formato ISO (YYYY-MM-DD)",
    "date.min":
      "La fecha de fin debe ser posterior o igual a la fecha de inicio",
  }),

  page: Joi.number().integer().min(1).default(1).messages({
    "number.base": "La página debe ser un número",
    "number.integer": "La página debe ser un número entero",
    "number.min": "La página debe ser mayor a 0",
  }),

  limit: Joi.number().integer().min(1).max(200).default(20).messages({
    "number.base": "El límite debe ser un número",
    "number.integer": "El límite debe ser un número entero",
    "number.min": "El límite debe ser mayor a 0",
    "number.max": "El límite no puede ser mayor a 200",
  }),
});

/**
 * Esquema para query de reporte por producto
 */
export const getReporteProducto = Joi.object({
  fecha_inicio: Joi.date().iso().messages({
    "date.base": "La fecha de inicio debe ser una fecha válida",
    "date.format": "La fecha de inicio debe tener formato ISO (YYYY-MM-DD)",
  }),

  fecha_fin: Joi.date().iso().min(Joi.ref("fecha_inicio")).messages({
    "date.base": "La fecha de fin debe ser una fecha válida",
    "date.format": "La fecha de fin debe tener formato ISO (YYYY-MM-DD)",
    "date.min":
      "La fecha de fin debe ser posterior o igual a la fecha de inicio",
  }),

  limit: Joi.number().integer().min(1).max(500).default(50).messages({
    "number.base": "El límite debe ser un número",
    "number.integer": "El límite debe ser un número entero",
    "number.min": "El límite debe ser mayor a 0",
    "number.max":
      "El límite no puede ser mayor a 500 (para reportes grandes usa paginación)",
  }),
});

/**
 * Esquema para query de estadísticas
 */
export const getEstadisticas = Joi.object({
  dias: Joi.number().integer().min(1).max(365).default(30).messages({
    "number.base": "Los días deben ser un número",
    "number.integer": "Los días deben ser un número entero",
    "number.min": "Los días deben ser mayor a 0",
    "number.max": "Los días no pueden ser mayor a 365",
  }),
});

/**
 * Esquema para validar ID de producto en params
 */
export const productoId = Joi.object({
  producto_id: Joi.number().integer().positive().required().messages({
    "number.base": "El ID del producto debe ser un número",
    "number.integer": "El ID del producto debe ser un número entero",
    "number.positive": "El ID del producto debe ser un número positivo",
    "any.required": "El ID del producto es obligatorio",
  }),
});

/**
 * Esquema para validar ID en params (ruta /:id)
 */
export const stockId = Joi.object({
  id: Joi.number().integer().positive().required().messages({
    "number.base": "El ID debe ser un número",
    "number.integer": "El ID debe ser un número entero",
    "number.positive": "El ID debe ser un número positivo",
    "any.required": "El ID es obligatorio",
  }),
});

// =====================================================
// EXPORTACIÓN AGRUPADA
// =====================================================

export const inventarioSchemas = {
  ajustarInventario,
  actualizarStock,
  getMovimientos,
  getReporteProducto,
  getEstadisticas,
  productoId,
  stockId,
};

// =====================================================
// METADATA DE SCHEMAS (PARA DOCUMENTACIÓN)
// =====================================================

export const schemasInfo = {
  ajustarInventario: {
    description: "Validación para ajuste directo de inventario",
    requiredFields: ["producto_id", "nuevo_stock"],
    optionalFields: ["observaciones"],
    businessRules: ["nuevo_stock >= 0", "nuevo_stock <= 1,000,000"],
    source: "body",
  },

  actualizarStock: {
    description: "Validación para movimientos de stock",
    requiredFields: ["cantidad", "tipo_movimiento"],
    optionalFields: ["observaciones", "referencia_id", "referencia_tipo"],
    businessRules: ["cantidad > 0", "stock suficiente en salidas"],
    source: "body",
  },

  getMovimientos: {
    description: "Validación para listar movimientos con filtros",
    defaultValues: {
      page: 1,
      limit: 20,
    },
    notes: "fecha_inicio y fecha_fin deben usarse juntas",
    source: "query",
  },

  getReporteProducto: {
    description: "Validación para reporte de movimientos por producto",
    defaultValues: {
      limit: 50,
    },
    source: "query",
  },

  getEstadisticas: {
    description: "Validación para estadísticas de rotación",
    defaultValues: {
      dias: 30,
    },
    source: "query",
  },

  productoId: {
    description: "Validación para producto_id en parámetros",
    requiredFields: ["producto_id"],
    source: "params",
  },

  stockId: {
    description: "Validación para id en parámetros de rutas de stock",
    requiredFields: ["id"],
    source: "params",
  },
};
