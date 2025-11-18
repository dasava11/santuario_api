// validations/schemas/authSchemas.js
import Joi from "joi";

// =====================================================
// 🔐 DEFINICIONES DE ESQUEMAS PARA AUTENTICACIÓN
// =====================================================

/**
 * Esquema para login de usuario
 * Campos requeridos: username, password
 */
export const loginSchema = Joi.object({
  username: Joi.string().trim().min(3).max(50).required().messages({
    "string.base": "El nombre de usuario debe ser una cadena de texto",
    "string.empty": "El nombre de usuario es obligatorio",
    "string.min": "El nombre de usuario debe tener al menos 3 caracteres",
    "string.max": "El nombre de usuario no puede exceder los 50 caracteres",
    "any.required": "El nombre de usuario es obligatorio",
  }),

  password: Joi.string().min(1).max(255).required().messages({
    "string.base": "La contraseña debe ser una cadena de texto",
    "string.empty": "La contraseña es obligatoria",
    "string.min": "Debe proporcionar una contraseña",
    "string.max": "La contraseña es demasiado larga",
    "any.required": "La contraseña es obligatoria",
  }),
});

/**
 * Esquema para cambio de contraseña del usuario autenticado
 * Requiere contraseña actual y nueva contraseña
 */
export const cambiarPasswordSchema = Joi.object({
  password_actual: Joi.string().min(1).required().messages({
    "string.base": "La contraseña actual debe ser una cadena de texto",
    "string.empty": "La contraseña actual es obligatoria",
    "string.min": "La contraseña actual es obligatoria",
    "any.required": "La contraseña actual es obligatoria",
  }),

  password_nuevo: Joi.string().min(6).max(255).required().messages({
    "string.base": "La nueva contraseña debe ser una cadena de texto",
    "string.empty": "La nueva contraseña es obligatoria",
    "string.min": "La nueva contraseña debe tener al menos 6 caracteres",
    "string.max": "La nueva contraseña es demasiado larga",
    "any.required": "La nueva contraseña es obligatoria",
  }),

  password_confirmacion: Joi.string()
    .valid(Joi.ref("password_nuevo"))
    .required()
    .messages({
      "any.only": "La confirmación de contraseña no coincide",
      "any.required": "La confirmación de contraseña es obligatoria",
    }),
});

/**
 * Esquema para actualizar perfil del usuario autenticado
 * Solo permite actualizar datos básicos, no críticos como username/password
 */
export const actualizarPerfilSchema = Joi.object({
  nombre: Joi.string().trim().min(2).max(100).optional().messages({
    "string.base": "El nombre debe ser una cadena de texto",
    "string.min": "El nombre debe tener al menos 2 caracteres",
    "string.max": "El nombre no puede exceder los 100 caracteres",
  }),

  apellido: Joi.string().trim().min(2).max(100).optional().messages({
    "string.base": "El apellido debe ser una cadena de texto",
    "string.min": "El apellido debe tener al menos 2 caracteres",
    "string.max": "El apellido no puede exceder los 100 caracteres",
  }),

  email: Joi.string().email().trim().max(100).optional().messages({
    "string.email": "El email debe tener un formato válido",
    "string.max": "El email no puede exceder los 100 caracteres",
  }),
})
  .min(1)
  .messages({
    "object.min": "Debe proporcionar al menos un campo para actualizar",
  });

/**
 * Esquema para validar token en headers
 * Se usa en middleware pero útil para validaciones específicas
 */
export const tokenHeaderSchema = Joi.object({
  authorization: Joi.string()
    .pattern(/^Bearer\s[\w-]+\.[\w-]+\.[\w-]+$/)
    .required()
    .messages({
      "string.pattern.base": "Token de autorización inválido",
      "any.required": "Token de autorización requerido",
    }),
});

/**
 * Esquema para validar parámetros de verificación de sesión
 * Para endpoints que requieren validación adicional de sesión
 */
export const sessionValidationSchema = Joi.object({
  include_permissions: Joi.string()
    .valid("true", "false")
    .default("false")
    .messages({
      "any.only":
        'El parámetro "include_permissions" debe ser "true" o "false"',
    }),

  refresh_cache: Joi.string().valid("true", "false").default("false").messages({
    "any.only": 'El parámetro "refresh_cache" debe ser "true" o "false"',
  }),
});

// =====================================================
// 🔦 EXPORTACIÓN AGRUPADA
// =====================================================

/**
 * Objeto que contiene todos los schemas agrupados
 * Útil para importaciones masivas o uso programático
 */
export const authSchemas = {
  loginSchema,
  cambiarPasswordSchema,
  actualizarPerfilSchema,
  tokenHeaderSchema,
  sessionValidationSchema,
};

// =====================================================
// 📄 METADATA DE SCHEMAS (PARA DOCUMENTACIÓN)
// =====================================================

/**
 * Información sobre los schemas disponibles
 * Útil para generación automática de documentación
 */
export const schemasInfo = {
  loginSchema: {
    description: "Validación para login de usuario",
    requiredFields: ["username", "password"],
    optionalFields: [],
    source: "body",
    businessRules: [
      "Username mínimo 3 caracteres",
      "Password obligatorio",
      "Campos trimmed automáticamente",
    ],
  },

  cambiarPasswordSchema: {
    description: "Validación para cambio de contraseña del usuario autenticado",
    requiredFields: [
      "password_actual",
      "password_nuevo",
      "password_confirmacion",
    ],
    optionalFields: [],
    source: "body",
    businessRules: [
      "Requiere contraseña actual para validación",
      "Nueva contraseña mínimo 6 caracteres",
      "Confirmación debe coincidir exactamente",
      "Se validará fortaleza en service layer",
    ],
  },

  actualizarPerfilSchema: {
    description: "Validación para actualizar perfil del usuario logueado",
    requiredFields: [],
    optionalFields: ["nombre", "apellido", "email"],
    source: "body",
    businessRules: [
      "Mínimo 1 campo requerido por .min(1)",
      "No permite cambiar username/password/rol",
      "Email debe ser único (validado en service)",
      "Campos sensibles requieren endpoints específicos",
    ],
  },

  tokenHeaderSchema: {
    description: "Validación para token JWT en headers",
    requiredFields: ["authorization"],
    source: "headers",
    businessRules: [
      "Debe seguir formato Bearer JWT",
      "Token debe tener estructura válida",
      "Validación adicional en service layer",
    ],
  },

  sessionValidationSchema: {
    description: "Validación para parámetros de validación de sesión",
    defaultValues: {
      include_permissions: "false",
      refresh_cache: "false",
    },
    source: "query",
    businessRules: [
      "include_permissions carga permisos adicionales",
      "refresh_cache fuerza actualización de cache",
    ],
  },
};
