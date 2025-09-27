import Joi from "joi";

// Middleware para validación
export const validate = (schema) => {
  return (req, res, next) => {
    const { error } = schema.validate(req.body, { abortEarly: false });

    if (error) {
      const errors = error.details.map((detail) => ({
        field: detail.path.join("."),
        message: detail.message,
      }));

      return res.status(400).json({
        success: false,
        error: "Datos de entrada inválidos",
        details: errors,
      });
    }

    next();
  };
};

// Esquemas de validación para productos
export const productosSchemas = {
  // Validación para crear producto
  createProducto: Joi.object({
    codigo_barras: Joi.string().max(50).allow("", null).messages({
      "string.max": "El código de barras no puede tener más de 50 caracteres",
    }),

    nombre: Joi.string().min(2).max(200).required().messages({
      "string.min": "El nombre debe tener al menos 2 caracteres",
      "string.max": "El nombre no puede tener más de 200 caracteres",
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
      "number.precision":
        "El precio de compra no puede tener más de 2 decimales",
      "any.required": "El precio de compra es obligatorio",
    }),

    precio_venta: Joi.number().positive().precision(2).required().messages({
      "number.base": "El precio de venta debe ser un número",
      "number.positive": "El precio de venta debe ser un número positivo",
      "number.precision":
        "El precio de venta no puede tener más de 2 decimales",
      "any.required": "El precio de venta es obligatorio",
    }),

    tipo_medida: Joi.string()
      .valid("unidad", "peso")
      .default("unidad")
      .messages({
        "any.only": 'El tipo de medida debe ser "unidad" o "peso"',
      }),

    stock_actual: Joi.number().integer().min(0).default(0).messages({
      "number.base": "El stock actual debe ser un número",
      "number.integer": "El stock actual debe ser un número entero",
      "number.min": "El stock actual no puede ser negativo",
    }),

    stock_minimo: Joi.number().integer().min(0).default(0).messages({
      "number.base": "El stock mínimo debe ser un número",
      "number.integer": "El stock mínimo debe ser un número entero",
      "number.min": "El stock mínimo no puede ser negativo",
    }),

    activo: Joi.boolean().default(true).messages({
      "boolean.base": "El campo activo debe ser un valor booleano",
    }),
  })
    .custom((value, helpers) => {
      // Validación personalizada: precio de venta debe ser mayor al precio de compra
      if (value.precio_venta <= value.precio_compra) {
        return helpers.error("custom.precioVentaInvalido");
      }

      // Validación: Si no hay stock, no puede estar activo
      if (value.stock_actual === 0 && value.activo === true) {
        return helpers.error("custom.stockVacioActivo");
      }

      return value;
    })
    .messages({
      "custom.precioVentaInvalido":
        "El precio de venta debe ser mayor al precio de compra",
      "custom.stockVacioActivo":
        "El producto no puede estar activo sin stock en inventario",
    }),

  // Validación para actualizar producto (campos opcionales)
  updateProducto: Joi.object({
    codigo_barras: Joi.string().max(50).allow("", null).messages({
      "string.max": "El código de barras no puede tener más de 50 caracteres",
    }),

    nombre: Joi.string().min(2).max(200).messages({
      "string.min": "El nombre debe tener al menos 2 caracteres",
      "string.max": "El nombre no puede tener más de 200 caracteres",
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
      "number.precision":
        "El precio de compra no puede tener más de 2 decimales",
    }),

    precio_venta: Joi.number().positive().precision(2).messages({
      "number.base": "El precio de venta debe ser un número",
      "number.positive": "El precio de venta debe ser un número positivo",
      "number.precision":
        "El precio de venta no puede tener más de 2 decimales",
    }),

    tipo_medida: Joi.string().valid("unidad", "peso").messages({
      "any.only": 'El tipo de medida debe ser "unidad" o "peso"',
    }),

    stock_minimo: Joi.number().integer().min(0).messages({
      "number.base": "El stock mínimo debe ser un número",
      "number.integer": "El stock mínimo debe ser un número entero",
      "number.min": "El stock mínimo no puede ser negativo",
    }),

    activo: Joi.boolean().messages({
      "boolean.base": "El campo activo debe ser un valor booleano",
    }),
  })
    .min(1) // Al menos un campo debe estar presente
    .messages({
      "object.min": "Debe proporcionar al menos un campo para actualizar",
    }),

  // Validación para actualizar stock
  updateStock: Joi.object({
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
  }),
};

// Middleware de validación específico para parámetros de ID
export const validateProductoId = (req, res, next) => {
  const schema = Joi.object({
    id: Joi.number().integer().positive().required().messages({
      "number.base": "El ID debe ser un número",
      "number.integer": "El ID debe ser un número entero",
      "number.positive": "El ID debe ser un número positivo",
      "any.required": "El ID es obligatorio",
    }),
  });

  const { error } = schema.validate(req.params);

  if (error) {
    const errors = error.details.map((detail) => ({
      field: detail.path.join("."),
      message: detail.message,
    }));

    return res.status(400).json({
      success: false,
      error: "ID de producto inválido",
      details: errors,
    });
  }

  next();
};

// Middleware de validación para código de barras
export const validateCodigoBarras = (req, res, next) => {
  const schema = Joi.object({
    codigo: Joi.string().min(1).max(50).required().messages({
      "string.min": "El código de barras no puede estar vacío",
      "string.max": "El código de barras no puede tener más de 50 caracteres",
      "any.required": "El código de barras es obligatorio",
    }),
  });

  const { error } = schema.validate(req.params);

  if (error) {
    const errors = error.details.map((detail) => ({
      field: detail.path.join("."),
      message: detail.message,
    }));

    return res.status(400).json({
      success: false,
      error: "Código de barras inválido",
      details: errors,
    });
  }

  next();
};

// Middleware de validación para query parameters
export const validateProductosQuery = (req, res, next) => {
  const schema = Joi.object({
    categoria_id: Joi.number().integer().positive().messages({
      "number.base": "El ID de categoría debe ser un número",
      "number.integer": "El ID de categoría debe ser un número entero",
      "number.positive": "El ID de categoría debe ser un número positivo",
    }),

    search: Joi.string().max(200).messages({
      "string.max":
        "El término de búsqueda no puede tener más de 200 caracteres",
    }),

    codigo_barras: Joi.string().max(50).messages({
      "string.max": "El código de barras no puede tener más de 50 caracteres",
    }),

    activo: Joi.string()
      .valid("true", "false", "all")
      .default("true")
      .messages({
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

  const { error, value } = schema.validate(req.query);

  if (error) {
    const errors = error.details.map((detail) => ({
      field: detail.path.join("."),
      message: detail.message,
    }));

    return res.status(400).json({
      success: false,
      error: "Parámetros de consulta inválidos",
      details: errors,
    });
  }

  // Asignar valores validados y con defaults
  req.query = value;
  next();
};
