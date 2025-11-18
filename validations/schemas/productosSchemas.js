// validations/schemas/productosSchemas.js
import Joi from "joi";

// =====================================================
// DEFINICIONES DE ESQUEMAS PARA PRODUCTOS
// =====================================================

/**
 * Esquema para crear producto
 * Campos requeridos: nombre, categoria_id, precio_compra, precio_venta
 */
export const createProducto = Joi.object({
  codigo_barras: Joi.string().max(50).allow("", null).messages({
    "string.max": "El código de barras no puede tener más de 50 caracteres",
  }),

  nombre: Joi.string().min(2).max(200).required().messages({
    "string.min": "El nombre debe tener al menos 2 caracteres",
    "string.max": "El nombre no puede tener más de 200 caracteres",
    "string.empty": "El nombre no puede estar vacío",
    "any.required": "El nombre es obligatorio",
  }),

  descripcion: Joi.string().max(1000).allow("", null).messages({
    "string.max": "La descripción no puede tener más de 1000 caracteres",
  }),

  categoria_id: Joi.number().integer().positive().required().messages({
    "number.base": "El ID de categoría debe ser un número",
    "number.integer": "El ID de categoría debe ser un número entero",
    "number.positive": "El ID de categoría debe ser un número positivo",
    "any.required": "El ID de categoría es obligatorio",
  }),

  precio_compra: Joi.number().positive().precision(2).required().messages({
    "number.base": "El precio de compra debe ser un número",
    "number.positive": "El precio de compra debe ser un número positivo",
    "number.precision": "El precio de compra no puede tener más de 2 decimales",
    "any.required": "El precio de compra es obligatorio",
  }),

  precio_venta: Joi.number().positive().precision(2).required().messages({
    "number.base": "El precio de venta debe ser un número",
    "number.positive": "El precio de venta debe ser un número positivo",
    "number.precision": "El precio de venta no puede tener más de 2 decimales",
    "any.required": "El precio de venta es obligatorio",
  }),

  tipo_medida: Joi.string().valid("unidad", "peso").default("unidad").messages({
    "any.only": 'El tipo de medida debe ser "unidad" o "peso"',
  }),

  stock_actual: Joi.number().min(0).precision(3).default(0).messages({
    "number.base": "El stock actual debe ser un número",
    "number.min": "El stock actual no puede ser negativo",
    "number.precision": "El stock actual no puede tener más de 3 decimales",
  }),

  stock_minimo: Joi.number().min(0).precision(3).default(0).messages({
    "number.base": "El stock mínimo debe ser un número",
    "number.min": "El stock mínimo no puede ser negativo",
    "number.precision": "El stock mínimo no puede tener más de 3 decimales",
  }),

  activo: Joi.boolean().default(true).messages({
    "boolean.base": "El campo activo debe ser un valor booleano",
  }),
})
  .custom((value, helpers) => {
    // Validación: precio de venta debe ser mayor al precio de compra
    if (value.precio_venta <= value.precio_compra) {
      return helpers.error("custom.precioVentaInvalido");
    }

    // Warning si está activo sin stock (no bloqueante)
    if (value.stock_actual === 0 && value.activo === true) {
      value._warning = "Producto activo creado sin stock";
    }

    return value;
  })
  .messages({
    "custom.precioVentaInvalido":
      "El precio de venta debe ser mayor al precio de compra",
  });

/**
 * Esquema para actualizar producto
 * Todos los campos opcionales, pero al menos uno requerido
 */
export const updateProducto = Joi.object({
  codigo_barras: Joi.string().max(50).allow("", null).messages({
    "string.max": "El código de barras no puede tener más de 50 caracteres",
  }),

  nombre: Joi.string().min(2).max(200).messages({
    "string.min": "El nombre debe tener al menos 2 caracteres",
    "string.max": "El nombre no puede tener más de 200 caracteres",
    "string.empty": "El nombre no puede estar vacío",
  }),

  descripcion: Joi.string().max(1000).allow("", null).messages({
    "string.max": "La descripción no puede tener más de 1000 caracteres",
  }),

  categoria_id: Joi.number().integer().positive().messages({
    "number.base": "El ID de categoría debe ser un número",
    "number.integer": "El ID de categoría debe ser un número entero",
    "number.positive": "El ID de categoría debe ser un número positivo",
  }),

  precio_compra: Joi.number().positive().precision(2).messages({
    "number.base": "El precio de compra debe ser un número",
    "number.positive": "El precio de compra debe ser un número positivo",
    "number.precision": "El precio de compra no puede tener más de 2 decimales",
  }),

  precio_venta: Joi.number().positive().precision(2).messages({
    "number.base": "El precio de venta debe ser un número",
    "number.positive": "El precio de venta debe ser un número positivo",
    "number.precision": "El precio de venta no puede tener más de 2 decimales",
  }),

  tipo_medida: Joi.string().valid("unidad", "peso").messages({
    "any.only": 'El tipo de medida debe ser "unidad" o "peso"',
  }),

  stock_minimo: Joi.number().min(0).precision(3).messages({
    "number.base": "El stock mínimo debe ser un número",
    "number.min": "El stock mínimo no puede ser negativo",
    "number.precision": "El stock mínimo no puede tener más de 3 decimales",
  }),

  activo: Joi.boolean().messages({
    "boolean.base": "El campo activo debe ser un valor booleano",
  }),
})
  .min(1)
  .messages({
    "object.min": "Debe proporcionar al menos un campo para actualizar",
  });

/**
 * Esquema para query parameters al obtener productos
 */
export const getProductos = Joi.object({
  categoria_id: Joi.number().integer().positive().messages({
    "number.base": "El ID de categoría debe ser un número",
    "number.integer": "El ID de categoría debe ser un número entero",
    "number.positive": "El ID de categoría debe ser un número positivo",
  }),

  search: Joi.string().max(200).messages({
    "string.max": "El término de búsqueda no puede tener más de 200 caracteres",
  }),

  codigo_barras: Joi.string().max(50).messages({
    "string.max": "El código de barras no puede tener más de 50 caracteres",
  }),

  activo: Joi.string().valid("true", "false", "all").default("all").messages({
    "any.only": 'El filtro activo debe ser "true", "false" o "all"',
  }),

  page: Joi.number().integer().min(1).default(1).messages({
    "number.base": "La página debe ser un número",
    "number.integer": "La página debe ser un número entero",
    "number.min": "La página debe ser mayor a 0",
  }),

  limit: Joi.number().integer().min(1).max(100).default(50).messages({
    "number.base": "El límite debe ser un número",
    "number.integer": "El límite debe ser un número entero",
    "number.min": "El límite debe ser mayor a 0",
    "number.max": "El límite no puede ser mayor a 100",
  }),
});

/**
 * Esquema para validar ID en params
 */
export const productoId = Joi.object({
  id: Joi.number().integer().positive().required().messages({
    "number.base": "El ID debe ser un número",
    "number.integer": "El ID debe ser un número entero",
    "number.positive": "El ID debe ser un número positivo",
    "any.required": "El ID es obligatorio",
  }),
});

/**
 * Esquema para validar código de barras en params
 */
export const codigoBarras = Joi.object({
  codigo: Joi.string().min(1).max(50).required().messages({
    "string.min": "El código de barras no puede estar vacío",
    "string.max": "El código de barras no puede tener más de 50 caracteres",
    "string.empty": "El código de barras es obligatorio",
    "any.required": "El código de barras es obligatorio",
  }),
});

// =====================================================
// EXPORTACIÓN AGRUPADA
// =====================================================

export const productosSchemas = {
  createProducto,
  updateProducto,
  getProductos,
  productoId,
  codigoBarras,
};

// =====================================================
// METADATA DE SCHEMAS (PARA DOCUMENTACIÓN)
// =====================================================

export const schemasInfo = {
  createProducto: {
    description: "Validación para crear nuevo producto",
    requiredFields: ["nombre", "categoria_id", "precio_compra", "precio_venta"],
    optionalFields: [
      "codigo_barras",
      "descripcion",
      "tipo_medida",
      "stock_actual",
      "stock_minimo",
      "activo",
    ],
    customValidations: ["precio_venta > precio_compra"],
    source: "body",
  },

  updateProducto: {
    description: "Validación para actualizar producto existente",
    requiredFields: [],
    optionalFields: [
      "codigo_barras",
      "nombre",
      "descripcion",
      "categoria_id",
      "precio_compra",
      "precio_venta",
      "tipo_medida",
      "stock_minimo",
      "activo",
    ],
    notes: "El stock_actual NO se actualiza aquí (usar módulo inventario)",
    source: "body",
  },

  getProductos: {
    description: "Validación para filtros al listar productos",
    defaultValues: {
      activo: "all",
      page: 1,
      limit: 50,
    },
    source: "query",
  },

  productoId: {
    description: "Validación para ID de producto en parámetros",
    requiredFields: ["id"],
    source: "params",
  },

  codigoBarras: {
    description: "Validación para código de barras en parámetros",
    requiredFields: ["codigo"],
    source: "params",
  },
};
