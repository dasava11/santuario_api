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

// Esquemas de validación para inventario
export const inventarioSchemas = {
  // Validación para ajustar inventario
  ajustarInventario: Joi.object({
    producto_id: Joi.number().integer().positive().required().messages({
      "number.base": "El ID del producto debe ser un número",
      "number.integer": "El ID del producto debe ser un número entero",
      "number.positive": "El ID del producto debe ser un número positivo",
      "any.required": "El ID del producto es obligatorio",
    }),

    nuevo_stock: Joi.number().min(0).precision(3).required().messages({
      "number.base": "El nuevo stock debe ser un número",
      "number.min": "El nuevo stock no puede ser negativo",
      "number.precision": "El nuevo stock no puede tener más de 3 decimales",
      "any.required": "El nuevo stock es obligatorio",
    }),

    observaciones: Joi.string().max(1000).allow("", null).default("").messages({
      "string.max": "Las observaciones no pueden tener más de 1000 caracteres",
    }),
  })
    .custom((value, helpers) => {
      // Validación personalizada: verificar que el nuevo_stock sea un número válido
      if (isNaN(parseFloat(value.nuevo_stock))) {
        return helpers.error("custom.stockInvalido");
      }

      // Validar que el nuevo stock no sea extremadamente alto (más de 1 millón)
      if (parseFloat(value.nuevo_stock) > 1000000) {
        return helpers.error("custom.stockMuyAlto");
      }

      return value;
    })
    .messages({
      "custom.stockInvalido": "El nuevo stock debe ser un número válido",
      "custom.stockMuyAlto": "El nuevo stock no puede ser mayor a 1,000,000",
    }),

  // Validación para crear movimiento manual (si se implementa)
  crearMovimiento: Joi.object({
    producto_id: Joi.number().integer().positive().required().messages({
      "number.base": "El ID del producto debe ser un número",
      "number.integer": "El ID del producto debe ser un número entero",
      "number.positive": "El ID del producto debe ser un número positivo",
      "any.required": "El ID del producto es obligatorio",
    }),

    tipo_movimiento: Joi.string()
      .valid("entrada", "salida", "ajuste")
      .required()
      .messages({
        "any.only":
          'El tipo de movimiento debe ser "entrada", "salida" o "ajuste"',
        "any.required": "El tipo de movimiento es obligatorio",
      }),

    cantidad: Joi.number().positive().precision(3).required().messages({
      "number.base": "La cantidad debe ser un número",
      "number.positive": "La cantidad debe ser un número positivo",
      "number.precision": "La cantidad no puede tener más de 3 decimales",
      "any.required": "La cantidad es obligatoria",
    }),

    referencia_tipo: Joi.string()
      .valid("venta", "recepcion", "ajuste", "devolucion")
      .default("ajuste")
      .messages({
        "any.only":
          'El tipo de referencia debe ser "venta", "recepcion", "ajuste" o "devolucion"',
      }),

    referencia_id: Joi.number().integer().positive().allow(null).messages({
      "number.base": "El ID de referencia debe ser un número",
      "number.integer": "El ID de referencia debe ser un número entero",
      "number.positive": "El ID de referencia debe ser un número positivo",
    }),

    observaciones: Joi.string().max(1000).allow("", null).default("").messages({
      "string.max": "Las observaciones no pueden tener más de 1000 caracteres",
    }),
  }),
};

// Middleware de validación para parámetros de ID de producto
export const validateProductoId = (req, res, next) => {
  const schema = Joi.object({
    producto_id: Joi.number().integer().positive().required().messages({
      "number.base": "El ID del producto debe ser un número",
      "number.integer": "El ID del producto debe ser un número entero",
      "number.positive": "El ID del producto debe ser un número positivo",
      "any.required": "El ID del producto es obligatorio",
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

// Middleware de validación para query parameters de movimientos
export const validateMovimientosQuery = (req, res, next) => {
  const schema = Joi.object({
    producto_id: Joi.number().integer().positive().messages({
      "number.base": "El ID del producto debe ser un número",
      "number.integer": "El ID del producto debe ser un número entero",
      "number.positive": "El ID del producto debe ser un número positivo",
    }),

    tipo_movimiento: Joi.string()
      .valid("entrada", "salida", "ajuste")
      .messages({
        "any.only":
          'El tipo de movimiento debe ser "entrada", "salida" o "ajuste"',
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

    limit: Joi.number().integer().min(1).max(200).default(50).messages({
      "number.base": "El límite debe ser un número",
      "number.integer": "El límite debe ser un número entero",
      "number.min": "El límite debe ser mayor a 0",
      "number.max": "El límite no puede ser mayor a 200",
    }),
  })
    .with("fecha_inicio", "fecha_fin")
    .with("fecha_fin", "fecha_inicio")
    .messages({
      "object.with":
        "Si especifica fecha_inicio, también debe especificar fecha_fin y viceversa",
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

// Middleware de validación para query parameters de reporte por producto
export const validateReporteProductoQuery = (req, res, next) => {
  const schema = Joi.object({
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

    limit: Joi.number().integer().min(1).max(1000).default(100).messages({
      "number.base": "El límite debe ser un número",
      "number.integer": "El límite debe ser un número entero",
      "number.min": "El límite debe ser mayor a 0",
      "number.max": "El límite no puede ser mayor a 1000",
    }),
  })
    .with("fecha_inicio", "fecha_fin")
    .with("fecha_fin", "fecha_inicio")
    .messages({
      "object.with":
        "Si especifica fecha_inicio, también debe especificar fecha_fin y viceversa",
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

// Validación para rangos de fechas válidos
export const validateDateRange = (req, res, next) => {
  const { fecha_inicio, fecha_fin } = req.query;

  if (fecha_inicio && fecha_fin) {
    const inicio = new Date(fecha_inicio);
    const fin = new Date(fecha_fin);
    const hoy = new Date();

    // Validar que las fechas no sean futuras
    if (inicio > hoy || fin > hoy) {
      return res.status(400).json({
        success: false,
        error: "Las fechas no pueden ser futuras",
      });
    }

    // Validar que el rango no sea mayor a 1 año
    const unAño = 365 * 24 * 60 * 60 * 1000; // milliseconds
    if (fin - inicio > unAño) {
      return res.status(400).json({
        success: false,
        error: "El rango de fechas no puede ser mayor a 1 año",
      });
    }
  }

  next();
};

// Validación para verificar permisos de ajuste de inventario
export const validateInventoryAdjustmentPermissions = (req, res, next) => {
  const userRole = req.user.rol;
  const allowedRoles = ["administrador", "dueño"];

  if (!allowedRoles.includes(userRole)) {
    return res.status(403).json({
      success: false,
      error: "No tienes permisos para realizar ajustes de inventario",
    });
  }

  next();
};
