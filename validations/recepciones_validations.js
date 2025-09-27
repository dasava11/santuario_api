import Joi from "joi";

// Esquemas de validación para recepciones
const recepcionesSchemas = {
  // Validación para crear recepción
  createRecepcion: Joi.object({
    numero_factura: Joi.string().trim().min(1).max(100).required().messages({
      "string.base": "El número de factura debe ser una cadena de texto",
      "string.empty": "El número de factura es obligatorio",
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
              "number.precision":
                "La cantidad no puede tener más de 3 decimales",
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
              "number.positive":
                "El precio unitario debe ser un número positivo",
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
  }),
};

// Middleware genérico para validar con Joi
const validate = (schema) => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.body, {
      abortEarly: false, // Retorna todos los errores, no solo el primero
      stripUnknown: true, // Remueve propiedades no definidas en el schema
      convert: true, // Convierte tipos cuando es posible
    });

    if (error) {
      const details = error.details.map((detail) => ({
        field: detail.path.join("."),
        message: detail.message,
      }));

      return res.status(400).json({
        success: false,
        error: "Errores de validación",
        details,
      });
    }

    // Reemplazar req.body con el valor validado y limpio
    req.body = value;
    next();
  };
};

// Validación específica para ID de recepción
const validateRecepcionId = (req, res, next) => {
  const { id } = req.params;

  const schema = Joi.number().integer().positive().required().messages({
    "number.base": "El ID debe ser un número",
    "number.integer": "El ID debe ser un número entero",
    "number.positive": "El ID debe ser un número positivo",
    "any.required": "El ID es obligatorio",
  });

  const { error } = schema.validate(id);

  if (error) {
    return res.status(400).json({
      success: false,
      error: "ID de recepción inválido",
      details: [
        {
          field: "id",
          message: error.details[0].message,
        },
      ],
    });
  }

  next();
};

// Validación para query parameters de recepciones
const validateRecepcionesQuery = (req, res, next) => {
  const schema = Joi.object({
    fecha_inicio: Joi.date()
      .iso()
      .when("fecha_fin", {
        is: Joi.exist(),
        then: Joi.required(),
        otherwise: Joi.optional(),
      })
      .messages({
        "date.base": "La fecha de inicio debe ser una fecha válida",
        "date.format":
          "La fecha de inicio debe estar en formato ISO (YYYY-MM-DD)",
        "any.required":
          "La fecha de inicio es requerida cuando se especifica fecha fin",
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
      details,
    });
  }

  // Reemplazar req.query con los valores validados
  req.query = value;
  next();
};

export {
  validate,
  recepcionesSchemas,
  validateRecepcionId,
  validateRecepcionesQuery,
};
