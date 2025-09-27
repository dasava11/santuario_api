import Joi from "joi";

// Esquemas de validación para categorías
const categoriasSchemas = {
  // Validación para crear categoría
  createCategoria: Joi.object({
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
  }),

  // Validación para actualizar categoría
  updateCategoria: Joi.object({
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
  })
    .min(1)
    .messages({
      "object.min": "Debe proporcionar al menos un campo para actualizar",
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

// Validación específica para ID de categoría
const validateCategoriaId = (req, res, next) => {
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
      error: "ID de categoría inválido",
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

// Validación para query parameters de categorías
const validateCategoriasQuery = (req, res, next) => {
  const schema = Joi.object({
    activo: Joi.string()
      .valid("true", "false", "all")
      .default("true")
      .messages({
        "any.only": 'El parámetro "activo" debe ser "true", "false" o "all"',
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
  categoriasSchemas,
  validateCategoriaId,
  validateCategoriasQuery,
};
