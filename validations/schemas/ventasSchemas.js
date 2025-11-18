// validations/schemas/ventasSchemas.js
import Joi from "joi";

// =====================================================
// 📋 DEFINICIONES DE ESQUEMAS PARA VENTAS
// =====================================================

/**
 * Esquema para crear venta
 * Campos requeridos: productos (array con producto_id y cantidad)
 * Campos opcionales: metodo_pago, precio_unitario por producto
 */
export const createVenta = Joi.object({
  metodo_pago: Joi.string()
    .valid("efectivo", "tarjeta", "transferencia")
    .default("efectivo")
    .messages({
      "any.only":
        'El método de pago debe ser "efectivo", "tarjeta" o "transferencia"',
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
          .optional()
          .messages({
            "number.base": "El precio unitario debe ser un número",
            "number.positive": "El precio unitario debe ser un número positivo",
            "number.precision":
              "El precio unitario no puede tener más de 2 decimales",
            "number.max":
              "El precio unitario excede el límite máximo permitido",
          }),
      })
    )
    .min(1)
    .required()
    .messages({
      "array.base": "Los productos deben ser un arreglo",
      "array.min": "Debe incluir al menos un producto en la venta",
      "any.required": "Los productos son obligatorios",
    }),
});

/**
 * Esquema para query parameters al obtener ventas
 */
export const getVentas = Joi.object({
  fecha_inicio: Joi.date().iso().max("now").default("2000-01-01").messages({
    "date.base": "La fecha de inicio debe ser una fecha válida",
    "date.format": "La fecha de inicio debe estar en formato ISO (YYYY-MM-DD)",
    "date.max": "La fecha de inicio no puede ser posterior a hoy",
  }),

  fecha_fin: Joi.date()
    .iso()
    .max("now")
    .min(Joi.ref("fecha_inicio"))
    .default("2100-12-31")
    .messages({
      "date.base": "La fecha fin debe ser una fecha válida",
      "date.format": "La fecha fin debe estar en formato ISO (YYYY-MM-DD)",
      "date.max": "La fecha fin no puede ser posterior a hoy",
      "date.min":
        "La fecha fin debe ser posterior o igual a la fecha de inicio",
    }),

  usuario_id: Joi.number().integer().positive().optional().messages({
    "number.base": "El ID del usuario debe ser un número",
    "number.integer": "El ID del usuario debe ser un número entero",
    "number.positive": "El ID del usuario debe ser un número positivo",
  }),

  metodo_pago: Joi.string()
    .valid("efectivo", "tarjeta", "transferencia")
    .optional()
    .messages({
      "any.only":
        'El método de pago debe ser "efectivo", "tarjeta" o "transferencia"',
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
});

/**
 * Esquema para query parameters al obtener resumen de ventas
 * ⚠️ SIN validación circular: fecha_inicio NO requiere fecha_fin
 */
export const getResumenVentas = Joi.object({
  fecha_inicio: Joi.date().iso().max("now").optional().messages({
    "date.base": "La fecha de inicio debe ser una fecha válida",
    "date.format": "La fecha de inicio debe estar en formato ISO (YYYY-MM-DD)",
    "date.max": "La fecha de inicio no puede ser posterior a hoy",
  }),

  fecha_fin: Joi.date()
    .iso()
    .max("now")
    .when("fecha_inicio", {
      is: Joi.exist(),
      then: Joi.date().min(Joi.ref("fecha_inicio")),
      otherwise: Joi.optional(),
    })
    .messages({
      "date.base": "La fecha fin debe ser una fecha válida",
      "date.format": "La fecha fin debe estar en formato ISO (YYYY-MM-DD)",
      "date.max": "La fecha fin no puede ser posterior a hoy",
      "date.min":
        "La fecha fin debe ser posterior o igual a la fecha de inicio",
    }),
});

/**
 * Esquema para validar ID en params
 */
export const ventaId = Joi.object({
  id: Joi.number().integer().positive().required().messages({
    "number.base": "El ID debe ser un número",
    "number.integer": "El ID debe ser un número entero",
    "number.positive": "El ID debe ser un número positivo",
    "any.required": "El ID es obligatorio",
  }),
});

/**
 * Esquema para anular venta (Opción C - Eliminación lógica)
 * Requiere motivo de anulación para auditoría
 */
export const anularVenta = Joi.object({
  motivo_anulacion: Joi.string().trim().min(10).max(500).required().messages({
    "string.base": "El motivo de anulación debe ser una cadena de texto",
    "string.empty": "El motivo de anulación es obligatorio",
    "string.min": "El motivo debe tener al menos 10 caracteres",
    "string.max": "El motivo no puede exceder los 500 caracteres",
    "any.required": "El motivo de anulación es obligatorio",
  }),
});

// =====================================================
// 📦 EXPORTACIÓN AGRUPADA
// =====================================================

/**
 * Objeto que contiene todos los schemas agrupados
 * Útil para importaciones masivas o uso programático
 */
export const ventasSchemas = {
  createVenta,
  getVentas,
  getResumenVentas,
  ventaId,
  anularVenta,
};

// =====================================================
// 📄 METADATA DE SCHEMAS (PARA DOCUMENTACIÓN)
// =====================================================

/**
 * Información sobre los schemas disponibles
 * Útil para generación automática de documentación
 */
export const schemasInfo = {
  createVenta: {
    description: "Validación para crear nueva venta",
    requiredFields: ["productos"],
    optionalFields: ["metodo_pago", "precio_unitario (por producto)"],
    source: "body",
    businessRules: [
      "Debe incluir al menos un producto",
      "Cantidad máxima de 3 decimales",
      "Precio máximo de 2 decimales",
      "Si no se proporciona precio_unitario, se usa precio_venta del producto",
    ],
  },

  getVentas: {
    description: "Validación para filtros al listar ventas",
    defaultValues: {
      fecha_inicio: "2000-01-01",
      fecha_fin: "2100-12-31",
      page: 1,
      limit: 20,
    },
    source: "query",
    businessRules: [
      "fecha_fin debe ser posterior o igual a fecha_inicio",
      "Máximo 100 registros por página",
    ],
  },

  getResumenVentas: {
    description: "Validación para consulta de resumen de ventas",
    defaultValues: {
      fecha_inicio: "opcional (se calcula en service)",
    },
    source: "query",
    businessRules: [
      "Si se proporciona fecha_inicio pero no fecha_fin, se usa fecha_inicio como fecha_fin",
      "fecha_fin solo se valida si existe fecha_inicio",
      "Fechas no pueden ser posteriores a hoy",
      "SIN validación circular para evitar errores de Joi",
    ],
  },

  ventaId: {
    description: "Validación para ID de venta en parámetros",
    requiredFields: ["id"],
    source: "params",
  },
};
