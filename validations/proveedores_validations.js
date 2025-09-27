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

// Esquemas de validación para proveedores
export const proveedoresSchemas = {
  // Validación para crear proveedor
  createProveedor: Joi.object({
    nombre: Joi.string().min(2).max(200).required().messages({
      "string.min": "El nombre debe tener al menos 2 caracteres",
      "string.max": "El nombre no puede tener más de 200 caracteres",
      "any.required": "El nombre es obligatorio",
    }),

    contacto: Joi.string().max(200).allow("", null).messages({
      "string.max": "El contacto no puede tener más de 200 caracteres",
    }),

    telefono: Joi.string().max(20).allow("", null).messages({
      "string.max": "El teléfono no puede tener más de 20 caracteres",
    }),

    email: Joi.string().email().max(255).allow("", null).messages({
      "string.email": "El email debe tener un formato válido",
      "string.max": "El email no puede tener más de 255 caracteres",
    }),

    direccion: Joi.string().max(500).allow("", null).messages({
      "string.max": "La dirección no puede tener más de 500 caracteres",
    }),

    ciudad: Joi.string().max(100).allow("", null).messages({
      "string.max": "La ciudad no puede tener más de 100 caracteres",
    }),

    pais: Joi.string().max(100).allow("", null).messages({
      "string.max": "El país no puede tener más de 100 caracteres",
    }),

    activo: Joi.boolean().default(true).messages({
      "boolean.base": "El campo activo debe ser un valor booleano",
    }),
  }),

  // Validación para actualizar proveedor (campos opcionales)
  updateProveedor: Joi.object({
    nombre: Joi.string().min(2).max(200).messages({
      "string.min": "El nombre debe tener al menos 2 caracteres",
      "string.max": "El nombre no puede tener más de 200 caracteres",
    }),

    contacto: Joi.string().max(200).allow("", null).messages({
      "string.max": "El contacto no puede tener más de 200 caracteres",
    }),

    telefono: Joi.string().max(20).allow("", null).messages({
      "string.max": "El teléfono no puede tener más de 20 caracteres",
    }),

    email: Joi.string().email().max(255).allow("", null).messages({
      "string.email": "El email debe tener un formato válido",
      "string.max": "El email no puede tener más de 255 caracteres",
    }),

    direccion: Joi.string().max(500).allow("", null).messages({
      "string.max": "La dirección no puede tener más de 500 caracteres",
    }),

    ciudad: Joi.string().max(100).allow("", null).messages({
      "string.max": "La ciudad no puede tener más de 100 caracteres",
    }),

    pais: Joi.string().max(100).allow("", null).messages({
      "string.max": "El país no puede tener más de 100 caracteres",
    }),

    activo: Joi.boolean().messages({
      "boolean.base": "El campo activo debe ser un valor booleano",
    }),
  })
    .min(1) // Al menos un campo debe estar presente
    .messages({
      "object.min": "Debe proporcionar al menos un campo para actualizar",
    }),
};

// Middleware de validación específico para parámetros de ID
export const validateProveedorId = (req, res, next) => {
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
      error: "ID de proveedor inválido",
      details: errors,
    });
  }

  next();
};

// Middleware de validación para query parameters
export const validateProveedoresQuery = (req, res, next) => {
  const schema = Joi.object({
    search: Joi.string().max(200).messages({
      "string.max":
        "El término de búsqueda no puede tener más de 200 caracteres",
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

    limit: Joi.number().integer().min(1).max(100).default(20).messages({
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
