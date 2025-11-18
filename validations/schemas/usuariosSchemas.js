// validations/schemas/usuariosSchemas.js
import Joi from "joi";

// =====================================================
// DEFINICIONES DE ESQUEMAS PARA USUARIOS
// =====================================================

/**
 * Esquema para crear usuario
 * Campos requeridos: username, password, password_confirmacion, email, nombre, apellido, rol
 */
export const createUsuario = Joi.object({
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
      "string.pattern.base": "El nombre solo puede contener letras y espacios",
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
    if (value.password_confirmacion !== value.password) {
      return helpers.error("custom.passwordNoCoincide");
    }
    return value;
  })
  .messages({
    "custom.passwordNoCoincide":
      "La confirmación de contraseña debe coincidir con la contraseña",
  });

/**
 * Esquema para actualizar usuario
 * Todos los campos opcionales, pero al menos uno requerido
 */
export const updateUsuario = Joi.object({
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
      "string.pattern.base": "El nombre solo puede contener letras y espacios",
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

  rol: Joi.string()
    .valid("administrador", "cajero", "dueño", "ayudande")
    .messages({
      "any.only":
        'El rol debe ser "administrador", "cajero", "dueño" o "ayudante"',
    }),

  activo: Joi.boolean().messages({
    "boolean.base": "El campo activo debe ser un valor booleano",
  }),
})
  .min(1)
  .custom((value, helpers) => {
    if (value.password && value.password_confirmacion !== value.password) {
      return helpers.error("custom.passwordNoCoincide");
    }
    return value;
  })
  .messages({
    "object.min": "Debe proporcionar al menos un campo para actualizar",
    "custom.passwordNoCoincide":
      "La confirmación de contraseña debe coincidir con la contraseña",
  });

/**
 * Esquema para resetear contraseña (solo administradores)
 */
export const resetPassword = Joi.object({
  password_nuevo: Joi.string()
    .min(8)
    .max(100)
    .pattern(new RegExp("^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)"))
    .required()
    .messages({
      "string.min": "La nueva contraseña debe tener al menos 8 caracteres",
      "string.max": "La nueva contraseña no puede tener más de 100 caracteres",
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
    if (value.password_confirmacion !== value.password_nuevo) {
      return helpers.error("custom.passwordNoCoincide");
    }
    return value;
  })
  .messages({
    "custom.passwordNoCoincide":
      "La confirmación de contraseña debe coincidir con la nueva contraseña",
  });

/**
 * Esquema para query parameters al obtener usuarios
 */
export const getUsuarios = Joi.object({
  rol: Joi.string()
    .valid("administrador", "cajero", "dueño", "ayudante")
    .messages({
      "any.only":
        'El filtro de rol debe ser "administrador", "cajero", "dueño" o "ayudante"',
    }),

  activo: Joi.string().valid("true", "false", "all").default("true").messages({
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

/**
 * Esquema para búsqueda de usuarios (dashboard administrativo)
 */
export const buscarUsuarios = Joi.object({
  termino: Joi.string().min(2).max(100).required().messages({
    "string.min": "El término de búsqueda debe tener al menos 2 caracteres",
    "string.max": "El término de búsqueda no puede exceder 100 caracteres",
    "string.empty": "El término de búsqueda es obligatorio",
    "any.required": "Debe proporcionar un término de búsqueda",
  }),

  limit: Joi.number().integer().min(1).max(50).default(10).messages({
    "number.base": "El límite debe ser un número",
    "number.integer": "El límite debe ser un número entero",
    "number.min": "El límite debe ser mayor a 0",
    "number.max": "El límite no puede ser mayor a 50",
  }),

  incluirInactivos: Joi.boolean().default(false).messages({
    "boolean.base": "El campo incluirInactivos debe ser verdadero o falso",
  }),
});

/**
 * Esquema para validar ID en params
 */
export const usuarioId = Joi.object({
  id: Joi.number().integer().positive().required().messages({
    "number.base": "El ID debe ser un número",
    "number.integer": "El ID debe ser un número entero",
    "number.positive": "El ID debe ser un número positivo",
    "any.required": "El ID es obligatorio",
  }),
});

// =====================================================
// EXPORTACIÓN AGRUPADA
// =====================================================

export const usuariosSchemas = {
  createUsuario,
  updateUsuario,
  resetPassword,
  getUsuarios,
  buscarUsuarios,
  usuarioId,
};

// =====================================================
// METADATA DE SCHEMAS (PARA DOCUMENTACIÓN)
// =====================================================

export const schemasInfo = {
  createUsuario: {
    description: "Validación para crear nuevo usuario",
    requiredFields: [
      "username",
      "password",
      "password_confirmacion",
      "email",
      "nombre",
      "apellido",
      "rol",
    ],
    optionalFields: ["activo"],
    source: "body",
  },

  updateUsuario: {
    description: "Validación para actualizar usuario existente",
    requiredFields: [],
    optionalFields: [
      "username",
      "password",
      "password_confirmacion",
      "email",
      "nombre",
      "apellido",
      "rol",
      "activo",
    ],
    source: "body",
  },

  resetPassword: {
    description: "Validación para resetear contraseña (solo administradores)",
    requiredFields: ["password_nuevo", "password_confirmacion"],
    optionalFields: [],
    source: "body",
  },

  getUsuarios: {
    description: "Validación para filtros al listar usuarios",
    defaultValues: {
      activo: "true",
      page: 1,
      limit: 20,
    },
    source: "query",
  },

  buscarUsuarios: {
    description: "Validación para búsqueda administrativa de usuarios",
    requiredFields: ["termino"],
    defaultValues: {
      limit: 10,
      incluirInactivos: false,
    },
    source: "query",
  },

  usuarioId: {
    description: "Validación para ID de usuario en parámetros",
    requiredFields: ["id"],
    source: "params",
  },
};
