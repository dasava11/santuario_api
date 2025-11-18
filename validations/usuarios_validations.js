// validations/usuarios_validations.js
import { validate, validateSource } from "../middleware/validation.js";
import {
  createUsuario,
  updateUsuario,
  resetPassword,
  getUsuarios,
  buscarUsuarios,
  usuarioId,
  usuariosSchemas,
} from "./schemas/usuariosSchemas.js";

// =====================================================
// 🎯 MIDDLEWARES ESPECÍFICOS PARA USUARIOS
// =====================================================

/**
 * Validar datos para crear usuario
 * Incluye validación de password_confirmacion
 */
const validateCreateUsuario = validate(createUsuario);

/**
 * Validar datos para actualizar usuario
 * Password y password_confirmacion son opcionales
 */
const validateUpdateUsuario = validate(updateUsuario);

/**
 * Validar ID de usuario en parámetros
 */
const validateUsuarioId = validateSource(usuarioId, "params");

/**
 * Validar query parameters para obtener usuarios
 * Incluye paginación y filtros (rol, activo)
 */
const validateGetUsuariosQuery = validateSource(getUsuarios, "query", {
  abortEarly: false,
  stripUnknown: true,
  convert: true,
  allowUnknown: false,
});

/**
 * Validar query parameters para buscar usuarios
 * Incluye término de búsqueda y opciones
 */
const validateBuscarUsuariosQuery = validateSource(buscarUsuarios, "query", {
  abortEarly: false,
  stripUnknown: true,
  convert: true,
});

/**
 * Validar datos para resetear contraseña
 * Solo para administradores
 */
const validateResetPassword = validate(resetPassword);

// =====================================================
// 🔧 MIDDLEWARES COMPUESTOS (OPCIONAL)
// =====================================================

/**
 * Middleware compuesto para validar creación completa
 */
const validateCompleteUsuarioCreation = [validateCreateUsuario];

/**
 * Middleware compuesto para validar actualización completa
 */
const validateCompleteUsuarioUpdate = [
  validateUsuarioId,
  validateUpdateUsuario,
];

/**
 * Middleware compuesto para operaciones que requieren ID
 */
const validateUsuarioOperation = [validateUsuarioId];

/**
 * Middleware compuesto para reseteo de contraseña
 */
const validateCompletePasswordReset = [
  validateUsuarioId,
  validateResetPassword,
];

// =====================================================
// 📤 EXPORTACIONES LIMPIAS
// =====================================================

export {
  // Schemas (para uso directo si necesario)
  usuariosSchemas,

  // Middlewares específicos listos para rutas
  validateCreateUsuario,
  validateUpdateUsuario,
  validateUsuarioId,
  validateGetUsuariosQuery,
  validateBuscarUsuariosQuery,
  validateResetPassword,

  // Middlewares compuestos (opcional para rutas complejas)
  validateCompleteUsuarioCreation,
  validateCompleteUsuarioUpdate,
  validateUsuarioOperation,
  validateCompletePasswordReset,
};
