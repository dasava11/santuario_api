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

// Esquemas de validación para autenticación
export const authSchemas = {
  // Validación para login
  login: Joi.object({
    username: Joi.string().alphanum().min(3).max(50).required().messages({
      "string.alphanum":
        "El nombre de usuario solo puede contener letras y números",
      "string.min": "El nombre de usuario debe tener al menos 3 caracteres",
      "string.max": "El nombre de usuario no puede tener más de 50 caracteres",
      "any.required": "El nombre de usuario es obligatorio",
    }),

    password: Joi.string().min(6).max(100).required().messages({
      "string.min": "La contraseña debe tener al menos 6 caracteres",
      "string.max": "La contraseña no puede tener más de 100 caracteres",
      "any.required": "La contraseña es obligatoria",
    }),
  }),

  // Validación para cambiar contraseña
  cambiarPassword: Joi.object({
    password_actual: Joi.string().min(1).max(100).required().messages({
      "string.min": "La contraseña actual es requerida",
      "string.max": "La contraseña actual no puede tener más de 100 caracteres",
      "string.empty": "La contraseña actual no puede estar vacía",
      "any.required": "La contraseña actual es obligatoria",
    }),

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
      // Validación: confirmación debe coincidir con la nueva contraseña
      if (value.password_confirmacion !== value.password_nuevo) {
        return helpers.error("custom.passwordNoCoincide");
      }

      // Validación: la nueva contraseña debe ser diferente a la actual
      if (value.password_actual === value.password_nuevo) {
        return helpers.error("custom.passwordIgual");
      }

      return value;
    })
    .messages({
      "custom.passwordNoCoincide":
        "La confirmación de contraseña debe coincidir con la nueva contraseña",
      "custom.passwordIgual":
        "La nueva contraseña debe ser diferente a la actual",
    }),

  // Validación para registro (si se implementa en el futuro)
  register: Joi.object({
    username: Joi.string().alphanum().min(3).max(50).required().messages({
      "string.alphanum":
        "El nombre de usuario solo puede contener letras y números",
      "string.min": "El nombre de usuario debe tener al menos 3 caracteres",
      "string.max": "El nombre de usuario no puede tener más de 50 caracteres",
      "any.required": "El nombre de usuario es obligatorio",
    }),

    email: Joi.string().email().max(100).required().messages({
      "string.email": "El email debe tener un formato válido",
      "string.max": "El email no puede tener más de 100 caracteres",
      "any.required": "El email es obligatorio",
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
        "any.required": "La contraseña es obligatoria",
      }),

    password_confirmacion: Joi.string()
      .valid(Joi.ref("password"))
      .required()
      .messages({
        "any.only":
          "La confirmación de contraseña debe coincidir con la contraseña",
        "any.required": "La confirmación de contraseña es obligatoria",
      }),

    nombre: Joi.string().min(2).max(50).required().messages({
      "string.min": "El nombre debe tener al menos 2 caracteres",
      "string.max": "El nombre no puede tener más de 50 caracteres",
      "any.required": "El nombre es obligatorio",
    }),

    apellido: Joi.string().min(2).max(50).required().messages({
      "string.min": "El apellido debe tener al menos 2 caracteres",
      "string.max": "El apellido no puede tener más de 50 caracteres",
      "any.required": "El apellido es obligatorio",
    }),

    rol: Joi.string()
      .valid("administrador", "cajero", "dueño")
      .default("cajero")
      .messages({
        "any.only": 'El rol debe ser "administrador", "cajero" o "dueño"',
      }),

    activo: Joi.boolean().default(true).messages({
      "boolean.base": "El campo activo debe ser un valor booleano",
    }),
  }),

  // Validación para recuperar contraseña (si se implementa)
  forgotPassword: Joi.object({
    email: Joi.string().email().max(100).required().messages({
      "string.email": "El email debe tener un formato válido",
      "string.max": "El email no puede tener más de 100 caracteres",
      "any.required": "El email es obligatorio",
    }),
  }),

  // Validación para resetear contraseña (si se implementa)
  resetPassword: Joi.object({
    token: Joi.string().min(10).max(500).required().messages({
      "string.min": "El token debe tener al menos 10 caracteres",
      "string.max": "El token no puede tener más de 500 caracteres",
      "any.required": "El token es obligatorio",
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
        "any.required": "La contraseña es obligatoria",
      }),

    password_confirmacion: Joi.string()
      .valid(Joi.ref("password"))
      .required()
      .messages({
        "any.only":
          "La confirmación de contraseña debe coincidir con la contraseña",
        "any.required": "La confirmación de contraseña es obligatoria",
      }),
  }),
};

// Middleware específico para validar headers de autorización
export const validateAuthHeader = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({
      success: false,
      error: "Token de acceso requerido",
    });
  }

  if (!authHeader.startsWith("Bearer ")) {
    return res.status(401).json({
      success: false,
      error: "Formato de token inválido. Use 'Bearer <token>'",
    });
  }

  const token = authHeader.substring(7);

  if (!token) {
    return res.status(401).json({
      success: false,
      error: "Token de acceso requerido",
    });
  }

  req.token = token;
  next();
};

// Middleware de validación para parámetros de usuario (si se necesita)
export const validateUserId = (req, res, next) => {
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
