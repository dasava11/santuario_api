import Joi from "joi";

// Middleware para validación
export const validate = (schema) => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true,
      convert: true,
    });

    if (error) {
      const details = error.details.map((detail) => ({
        field: detail.path.join("."),
        message: detail.message,
      }));

      return res.status(400).json({
        success: false,
        error: "Errores de validación",
        details: details,
      });
    }

    // Reemplazar req.body con el valor validado y limpio
    req.body = value;
    next();
  };
};

// Esquemas de validación para ventas
export const ventasSchemas = {
  // Validación para crear venta
  createVenta: Joi.object({
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
              "number.precision":
                "La cantidad no puede tener más de 3 decimales",
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
              "number.positive":
                "El precio unitario debe ser un número positivo",
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
  }),

  // Validación para consulta de resumen
  resumenQuery: Joi.object({
    fecha_inicio: Joi.date().iso().max("now").optional().messages({
      "date.base": "La fecha de inicio debe ser una fecha válida",
      "date.format":
        "La fecha de inicio debe estar en formato ISO (YYYY-MM-DD)",
      "date.max": "La fecha de inicio no puede ser posterior a hoy",
    }),

    fecha_fin: Joi.date()
      .iso()
      .max("now")
      .min(Joi.ref("fecha_inicio"))
      .optional()
      .messages({
        "date.base": "La fecha fin debe ser una fecha válida",
        "date.format": "La fecha fin debe estar en formato ISO (YYYY-MM-DD)",
        "date.max": "La fecha fin no puede ser posterior a hoy",
        "date.min":
          "La fecha fin debe ser posterior o igual a la fecha de inicio",
      }),
  }),
};

// Middleware de validación específico para parámetros de ID de venta
export const validateVentaId = (req, res, next) => {
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
    const details = error.details.map((detail) => ({
      field: detail.path.join("."),
      message: detail.message,
    }));

    return res.status(400).json({
      success: false,
      error: "ID de venta inválido",
      details: details,
    });
  }

  next();
};

// Middleware de validación para query parameters de ventas
export const validateVentasQuery = (req, res, next) => {
  const schema = Joi.object({
    fecha_inicio: Joi.date().iso().max("now").default("2000-01-01").messages({
      "date.base": "La fecha de inicio debe ser una fecha válida",
      "date.format":
        "La fecha de inicio debe estar en formato ISO (YYYY-MM-DD)",
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

  const { error, value } = schema.validate(req.query, {
    stripUnknown: true,
    convert: true,
  });

  if (error) {
    const details = error.details.map((detail) => ({
      field: detail.path.join("."),
      message: detail.message,
    }));

    return res.status(400).json({
      success: false,
      error: "Parámetros de consulta inválidos",
      details: details,
    });
  }

  // Reemplazar req.query con los valores validados
  req.query = value;
  next();
};

// Middleware de validación para query parameters del resumen
export const validateResumenQuery = (req, res, next) => {
  const schema = Joi.object({
    fecha_inicio: Joi.date()
      .iso()
      .max("now")
      .default(new Date().toISOString().split("T")[0])
      .messages({
        "date.base": "La fecha de inicio debe ser una fecha válida",
        "date.format":
          "La fecha de inicio debe estar en formato ISO (YYYY-MM-DD)",
        "date.max": "La fecha de inicio no puede ser posterior a hoy",
      }),

    fecha_fin: Joi.date()
      .iso()
      .max("now")
      .min(Joi.ref("fecha_inicio"))
      .optional()
      .messages({
        "date.base": "La fecha fin debe ser una fecha válida",
        "date.format": "La fecha fin debe estar en formato ISO (YYYY-MM-DD)",
        "date.max": "La fecha fin no puede ser posterior a hoy",
        "date.min":
          "La fecha fin debe ser posterior o igual a la fecha de inicio",
      }),
  });

  const { error, value } = schema.validate(req.query, {
    stripUnknown: true,
    convert: true,
  });

  if (error) {
    const details = error.details.map((detail) => ({
      field: detail.path.join("."),
      message: detail.message,
    }));

    return res.status(400).json({
      success: false,
      error: "Parámetros de consulta inválidos para resumen",
      details: details,
    });
  }

  // Reemplazar req.query con los valores validados
  req.query = value;
  next();
};
