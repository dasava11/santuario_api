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

// Esquemas de validación para usuarios
export const usuariosSchemas = {
  // Validación para crear usuario
  createUsuario: Joi.object({
    username: Joi.string().alphanum().min(3).max(50).required().messages({
      "string.alphanum":
        "El nombre de usuario solo puede contener letras y números",
      "string.min": "El nombre de usuario debe tener al menos 3 caracteres",
      "string.max": "El nombre de usuario no puede tener más de 50 caracteres",
      "string.empty": "El nombre de usuario no puede estar vacío",
      "any.required": "El nombre de usuario es obligatorio",
    }),

    password: Joi.string()
      .min(8)
      .max(100)
      .pattern(new RegExp("^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)"))
      .required()
      .messages({
        "string.min": "La contraseña debe tener al menos 8 caracteres",
        "string.max": "La contraseña no puede tener más de 100 caracteres",
        "string.pattern.base":
          "La contraseña debe contener al menos una minúscula, una mayúscula y un número",
        "string.empty": "La contraseña no puede estar vacía",
        "any.required": "La contraseña es obligatoria",
      }),

    password_confirmacion: Joi.string().required().messages({
      "string.empty": "La confirmación de contraseña no puede estar vacía",
      "any.required": "La confirmación de contraseña es obligatoria",
    }),

    email: Joi.string().email().min(5).max(100).required().messages({
      "string.email": "El email debe tener un formato válido",
      "string.min": "El email debe tener al menos 5 caracteres",
      "string.max": "El email no puede tener más de 100 caracteres",
      "string.empty": "El email no puede estar vacío",
      "any.required": "El email es obligatorio",
    }),

    nombre: Joi.string()
      .min(2)
      .max(50)
      .pattern(new RegExp("^[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\\s]+$"))
      .required()
      .messages({
        "string.min": "El nombre debe tener al menos 2 caracteres",
        "string.max": "El nombre no puede tener más de 50 caracteres",
        "string.pattern.base":
          "El nombre solo puede contener letras y espacios",
        "string.empty": "El nombre no puede estar vacío",
        "any.required": "El nombre es obligatorio",
      }),

    apellido: Joi.string()
      .min(2)
      .max(50)
      .pattern(new RegExp("^[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\\s]+$"))
      .required()
      .messages({
        "string.min": "El apellido debe tener al menos 2 caracteres",
        "string.max": "El apellido no puede tener más de 50 caracteres",
        "string.pattern.base":
          "El apellido solo puede contener letras y espacios",
        "string.empty": "El apellido no puede estar vacío",
        "any.required": "El apellido es obligatorio",
      }),

    rol: Joi.string()
      .valid("administrador", "cajero", "dueño")
      .required()
      .messages({
        "any.only": 'El rol debe ser "administrador", "cajero" o "dueño"',
        "any.required": "El rol es obligatorio",
      }),

    activo: Joi.boolean().default(true).messages({
      "boolean.base": "El campo activo debe ser un valor booleano",
    }),
  })
    .custom((value, helpers) => {
      // Validación personalizada: confirmación de contraseña
      if (value.password_confirmacion !== value.password) {
        return helpers.error("custom.passwordNoCoincide");
      }
      return value;
    })
    .messages({
      "custom.passwordNoCoincide":
        "La confirmación de contraseña debe coincidir con la contraseña",
    }),

  // Validación para actualizar usuario (campos opcionales)
  updateUsuario: Joi.object({
    username: Joi.string().alphanum().min(3).max(50).messages({
      "string.alphanum":
        "El nombre de usuario solo puede contener letras y números",
      "string.min": "El nombre de usuario debe tener al menos 3 caracteres",
      "string.max": "El nombre de usuario no puede tener más de 50 caracteres",
      "string.empty": "El nombre de usuario no puede estar vacío",
    }),

    password: Joi.string()
      .min(8)
      .max(100)
      .pattern(new RegExp("^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)"))
      .messages({
        "string.min": "La contraseña debe tener al menos 8 caracteres",
        "string.max": "La contraseña no puede tener más de 100 caracteres",
        "string.pattern.base":
          "La contraseña debe contener al menos una minúscula, una mayúscula y un número",
        "string.empty": "La contraseña no puede estar vacía",
      }),

    password_confirmacion: Joi.when("password", {
      is: Joi.exist(),
      then: Joi.string().required().messages({
        "string.empty": "La confirmación de contraseña no puede estar vacía",
        "any.required": "Si cambias la contraseña, debes confirmarla",
      }),
      otherwise: Joi.forbidden(),
    }),

    email: Joi.string().email().min(5).max(100).messages({
      "string.email": "El email debe tener un formato válido",
      "string.min": "El email debe tener al menos 5 caracteres",
      "string.max": "El email no puede tener más de 100 caracteres",
      "string.empty": "El email no puede estar vacío",
    }),

    nombre: Joi.string()
      .min(2)
      .max(50)
      .pattern(new RegExp("^[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\\s]+$"))
      .messages({
        "string.min": "El nombre debe tener al menos 2 caracteres",
        "string.max": "El nombre no puede tener más de 50 caracteres",
        "string.pattern.base":
          "El nombre solo puede contener letras y espacios",
        "string.empty": "El nombre no puede estar vacío",
      }),

    apellido: Joi.string()
      .min(2)
      .max(50)
      .pattern(new RegExp("^[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\\s]+$"))
      .messages({
        "string.min": "El apellido debe tener al menos 2 caracteres",
        "string.max": "El apellido no puede tener más de 50 caracteres",
        "string.pattern.base":
          "El apellido solo puede contener letras y espacios",
        "string.empty": "El apellido no puede estar vacío",
      }),

    rol: Joi.string().valid("administrador", "cajero", "dueño").messages({
      "any.only": 'El rol debe ser "administrador", "cajero" o "dueño"',
    }),

    activo: Joi.boolean().messages({
      "boolean.base": "El campo activo debe ser un valor booleano",
    }),
  })
    .min(1) // Al menos un campo debe estar presente
    .custom((value, helpers) => {
      // Validación personalizada: confirmación de contraseña si se cambió
      if (value.password && value.password_confirmacion !== value.password) {
        return helpers.error("custom.passwordNoCoincide");
      }
      return value;
    })
    .messages({
      "object.min": "Debe proporcionar al menos un campo para actualizar",
      "custom.passwordNoCoincide":
        "La confirmación de contraseña debe coincidir con la contraseña",
    }),

  // Validación para resetear contraseña (solo para administradores)
  resetPassword: Joi.object({
    password_nuevo: Joi.string()
      .min(8)
      .max(100)
      .pattern(new RegExp("^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)"))
      .required()
      .messages({
        "string.min": "La nueva contraseña debe tener al menos 8 caracteres",
        "string.max":
          "La nueva contraseña no puede tener más de 100 caracteres",
        "string.pattern.base":
          "La nueva contraseña debe contener al menos una minúscula, una mayúscula y un número",
        "string.empty": "La nueva contraseña no puede estar vacía",
        "any.required": "La nueva contraseña es obligatoria",
      }),

    password_confirmacion: Joi.string().required().messages({
      "string.empty": "La confirmación de contraseña no puede estar vacía",
      "any.required": "La confirmación de contraseña es obligatoria",
    }),
  })
    .custom((value, helpers) => {
      // Validación personalizada: confirmación de contraseña
      if (value.password_confirmacion !== value.password_nuevo) {
        return helpers.error("custom.passwordNoCoincide");
      }
      return value;
    })
    .messages({
      "custom.passwordNoCoincide":
        "La confirmación de contraseña debe coincidir con la nueva contraseña",
    }),
};

// Middleware de validación específico para parámetros de ID de usuario
export const validateUsuarioId = (req, res, next) => {
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
      error: "ID de usuario inválido",
      details: errors,
    });
  }

  next();
};

// Middleware de validación para query parameters de usuarios
export const validateUsuariosQuery = (req, res, next) => {
  const schema = Joi.object({
    rol: Joi.string().valid("administrador", "cajero", "dueño").messages({
      "any.only":
        'El filtro de rol debe ser "administrador", "cajero" o "dueño"',
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

// Validación personalizada para verificar que no sea el mismo usuario
export const validateNotSelfUser = (req, res, next) => {
  const targetUserId = parseInt(req.params.id);
  const currentUserId = req.user.id;

  if (targetUserId === currentUserId) {
    return res.status(400).json({
      success: false,
      error: "No puedes realizar esta acción sobre tu propia cuenta",
    });
  }

  next();
};
