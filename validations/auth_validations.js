// validations/authValidations.js - Refactorizado: Sin Validaciones Duplicadas

import { validate, validateSource } from "../middleware/validation.js";
import {
  loginSchema,
  cambiarPasswordSchema,
  actualizarPerfilSchema,
  sessionValidationSchema,
  authSchemas,
} from "./schemas/authSchemas.js";
import {
  cacheGet,
  generateSimpleCacheKey,
  CACHE_PREFIXES,
} from "../services/cacheService.js";

// =====================================================
// MIDDLEWARES ESPECÍFICOS PARA AUTENTICACIÓN
// =====================================================

const validateLogin = validate(loginSchema);
const validateCambiarPassword = validate(cambiarPasswordSchema);
const validateActualizarPerfil = validate(actualizarPerfilSchema);
const validateSessionQuery = validateSource(sessionValidationSchema, "query", {
  abortEarly: false,
  stripUnknown: true,
  convert: true,
  allowUnknown: false,
});

// =====================================================
// VALIDACIONES DE NEGOCIO ADICIONALES
// =====================================================

/**
 * Validar reglas de negocio del perfil
 * Solo valida nombres - email se maneja en service
 * Contraseña se valida completamente en service layer
 */
const validateProfileBusinessRules = (req, res, next) => {
  const { nombre, apellido } = req.body;

  const namePattern = /^[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s]+$/;

  if (nombre && !namePattern.test(nombre)) {
    return res.status(400).json({
      success: false,
      error: "El nombre solo puede contener letras y espacios",
      details: [{ field: "nombre", message: "Formato inválido" }],
    });
  }

  if (apellido && !namePattern.test(apellido)) {
    return res.status(400).json({
      success: false,
      error: "El apellido solo puede contener letras y espacios",
      details: [{ field: "apellido", message: "Formato inválido" }],
    });
  }

  next();
};

/**
 * Validar límites de intentos de login
 * Previene ataques de fuerza bruta
 */
const validateLoginAttempts = async (req, res, next) => {
  const { username } = req.body;

  if (!username) return next();

  try {
    const attemptsKey = generateSimpleCacheKey(
      CACHE_PREFIXES.AUTH_ATTEMPTS,
      username.toLowerCase()
    );

    const attempts = await cacheGet(attemptsKey);

    if (attempts && attempts.count >= 5) {
      const timeLeft = Math.ceil((attempts.lockUntil - Date.now()) / 1000 / 60);

      if (timeLeft > 0) {
        return res.status(429).json({
          success: false,
          error: "Demasiados intentos de login fallidos",
          details: [
            {
              field: "username",
              message: `Cuenta bloqueada temporalmente. Intente nuevamente en ${timeLeft} minutos`,
            },
          ],
          retry_after: timeLeft * 60,
          // Debug info solo en desarrollo
          ...(process.env.NODE_ENV === "development" && {
            debug_info: {
              cache_key_used: attemptsKey,
              attempts_found: attempts,
            },
          }),
        });
      }
    }

    next();
  } catch (error) {
    console.error("Error validando intentos de login:", error);
    next(); // Continuar sin validación de intentos en caso de error
  }
};

// =====================================================
// MIDDLEWARES COMPUESTOS - SIMPLIFICADOS
// =====================================================

const validateCompleteLogin = [validateLogin];

// SIMPLIFICADO: Solo validación Joi - fortaleza se maneja en service
const validateCompleteCambiarPassword = [validateCambiarPassword];

const validateCompleteActualizarPerfil = [
  validateActualizarPerfil,
  validateProfileBusinessRules,
];

// =====================================================
// FUNCIÓN DE DEBUGGING (SOLO DESARROLLO)
// =====================================================

const debugAuthCacheKeys = async (username) => {
  if (process.env.NODE_ENV !== "development") return;

  try {
    const usernameNorm = username.toLowerCase();
    const correctKey = generateSimpleCacheKey(
      CACHE_PREFIXES.AUTH_ATTEMPTS,
      usernameNorm
    );

    console.log(`\nDEBUG: Verificando cache para usuario: ${username}`);
    console.log(`Clave correcta: ${correctKey}`);

    const value = await cacheGet(correctKey);
    console.log(`Valor encontrado:`, value);

    return { key: correctKey, value, exists: !!value };
  } catch (error) {
    console.error("Error en debugAuthCacheKeys:", error);
    return { error: error.message };
  }
};

// =====================================================
// EXPORTACIONES
// =====================================================

export {
  // Schemas
  authSchemas,

  // Middlewares específicos
  validateLogin,
  validateCambiarPassword,
  validateActualizarPerfil,
  validateSessionQuery,

  // Middlewares compuestos - SIMPLIFICADOS
  validateCompleteLogin,
  validateCompleteCambiarPassword, // AHORA SIN validatePasswordBusinessRules
  validateCompleteActualizarPerfil,

  // Validaciones de negocio - REDUCIDAS
  validateProfileBusinessRules,
  validateLoginAttempts,

  // Debugging (solo desarrollo)
  debugAuthCacheKeys,
};
