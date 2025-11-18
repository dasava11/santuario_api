// services/authService.js - Lógica de Negocio Pura para Autenticación
import jwt from "jsonwebtoken";
import { sequelize, Op } from "../config/database.js";
import db from "../models/index.js";
import {
  hashPassword,
  comparePassword,
  validatePasswordStrength,
} from "../utils/passwordUtils.js";
import {
  cacheGet,
  cacheSet,
  CACHE_TTL,
  CACHE_PREFIXES,
  invalidateAuthCache,
  invalidateLoginAttemptsCache,
  invalidateUserProfilesCache,
  generateCacheKey,
  generateSimpleCacheKey,
} from "../services/cacheService.js";

const { usuarios } = db;

// =====================================================
// 🔐 OPERACIONES DE AUTENTICACIÓN
// =====================================================

/**
 * Autentica usuario y genera token JWT
 * @param {Object} credentials - { username, password }
 * @returns {Object} { success, data: { token, user }, fromCache }
 */
const autenticarUsuario = async (credentials) => {
  const { username, password } = credentials;
  const usernameNorm = username.toLowerCase().trim();

  try {
    // Verificar intentos de login fallidos
    const attemptsKey = generateSimpleCacheKey(
      CACHE_PREFIXES.AUTH_ATTEMPTS,
      usernameNorm
    );
    const attempts = await cacheGet(attemptsKey);

    if (attempts && attempts.count >= 5 && attempts.lockUntil > Date.now()) {
      throw new Error("ACCOUNT_LOCKED");
    }

    // Buscar usuario activo
    const usuario = await usuarios.findOne({
      where: {
        [Op.or]: [{ username: usernameNorm }, { email: usernameNorm }],
        activo: true,
      },
    });

    if (!usuario) {
      await registrarIntentoFallido(usernameNorm);
      throw new Error("INVALID_CREDENTIALS");
    }

    // Verificar contraseña
    const isValidPassword = await comparePassword(password, usuario.password);

    if (!isValidPassword) {
      await registrarIntentoFallido(usernameNorm);
      throw new Error("INVALID_CREDENTIALS");
    }

    // Login exitoso - limpiar intentos fallidos
    await invalidateLoginAttemptsCache(usernameNorm);

    // Generar JWT
    const tokenPayload = {
      userId: usuario.id,
      username: usuario.username,
      rol: usuario.rol,
      email: usuario.email,
    };

    const token = jwt.sign(tokenPayload, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRES_IN || "24h",
    });

    // Preparar respuesta sin contraseña
    const userResponse = {
      id: usuario.id,
      username: usuario.username,
      email: usuario.email,
      nombre: usuario.nombre,
      apellido: usuario.apellido,
      rol: usuario.rol,
      activo: usuario.activo,
      fecha_creacion: usuario.fecha_creacion,
    };

    // Cachear información del usuario por un tiempo corto
    const cacheKey = generateCacheKey("auth:user", { userId: usuario.id });
    await cacheSet(cacheKey, userResponse, CACHE_TTL.AUTH_SESSION_VALIDATION);

    return {
      success: true,
      data: {
        token,
        user: userResponse,
      },
      metadata: {
        login_timestamp: new Date().toISOString(),
        user_agent: null, // Se podría pasar desde el controlador
      },
    };
  } catch (error) {
    // Re-throw errores de negocio manteniendo el mensaje
    if (["ACCOUNT_LOCKED", "INVALID_CREDENTIALS"].includes(error.message)) {
      throw error;
    }

    console.error("Error en autenticación:", error);
    throw new Error("AUTH_SERVICE_ERROR");
  }
};

/**
 * Valida token JWT y retorna información del usuario
 * @param {string} token - Token JWT
 * @returns {Object} { valid, user, metadata }
 */
const validarToken = async (token) => {
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Verificar en cache primero
    const cacheKey = generateCacheKey("auth:user", { userId: decoded.userId });
    let usuario = await cacheGet(cacheKey);

    if (!usuario) {
      // Si no está en cache, consultar BD
      usuario = await usuarios.findOne({
        where: {
          id: decoded.userId,
          activo: true,
        },
        attributes: [
          "id",
          "username",
          "email",
          "nombre",
          "apellido",
          "rol",
          "activo",
          "fecha_creacion",
          "fecha_actualizacion",
        ],
      });

      if (!usuario) {
        throw new Error("USER_NOT_FOUND");
      }

      // Cachear para futuras validaciones
      await cacheSet(cacheKey, usuario, CACHE_TTL.AUTH_TOKEN_VALIDATION);
    }

    return {
      valid: true,
      user: usuario,
      token_info: {
        issued_at: new Date(decoded.iat * 1000),
        expires_at: new Date(decoded.exp * 1000),
        user_id: decoded.userId,
      },
    };
  } catch (error) {
    if (error.name === "JsonWebTokenError") {
      throw new Error("INVALID_TOKEN");
    }
    if (error.name === "TokenExpiredError") {
      throw new Error("EXPIRED_TOKEN");
    }
    if (error.message === "USER_NOT_FOUND") {
      throw error;
    }

    console.error("Error validando token:", error);
    throw new Error("TOKEN_VALIDATION_ERROR");
  }
};

// =====================================================
// 👤 OPERACIONES DE PERFIL
// =====================================================

/**
 * Obtiene perfil completo del usuario autenticado
 * @param {number} userId - ID del usuario
 * @returns {Object} { data, fromCache, metadata }
 */
const obtenerPerfilUsuario = async (userId) => {
  const cacheKey = generateCacheKey("auth:profile", { userId });
  const cached = await cacheGet(cacheKey);

  if (cached) {
    return { data: cached, fromCache: true };
  }

  const usuario = await usuarios.findByPk(userId, {
    attributes: [
      "id",
      "username",
      "email",
      "nombre",
      "apellido",
      "rol",
      "activo",
      "fecha_creacion",
      "fecha_actualizacion",
    ],
  });

  if (!usuario) {
    throw new Error("USER_NOT_FOUND");
  }

  const result = usuario.toJSON();

  // Cachear perfil
  await cacheSet(cacheKey, result, CACHE_TTL.AUTH_USER_PROFILE);

  return {
    data: result,
    fromCache: false,
    metadata: {
      last_updated: usuario.fecha_actualizacion,
    },
  };
};

/**
 * Actualiza perfil del usuario autenticado
 * @param {number} userId - ID del usuario
 * @param {Object} datosActualizacion - Campos a actualizar
 * @returns {Object} { usuario, camposModificados }
 */
const actualizarPerfilUsuario = async (userId, datosActualizacion) => {
  const transaction = await sequelize.transaction();

  try {
    const usuario = await usuarios.findByPk(userId, { transaction });

    if (!usuario) {
      throw new Error("USER_NOT_FOUND");
    }

    // Validar email único si se está cambiando
    if (
      datosActualizacion.email &&
      datosActualizacion.email.toLowerCase() !== usuario.email.toLowerCase()
    ) {
      const existingUser = await usuarios.findOne({
        where: {
          email: datosActualizacion.email.toLowerCase(),
          id: { [Op.ne]: userId },
        },
        transaction,
      });

      if (existingUser) {
        throw new Error("EMAIL_ALREADY_EXISTS");
      }
    }

    // Preparar campos para actualización
    const fieldsToUpdate = {};

    if (datosActualizacion.nombre) {
      fieldsToUpdate.nombre = datosActualizacion.nombre.trim();
    }
    if (datosActualizacion.apellido) {
      fieldsToUpdate.apellido = datosActualizacion.apellido.trim();
    }
    if (datosActualizacion.email) {
      fieldsToUpdate.email = datosActualizacion.email.trim().toLowerCase();
    }

    fieldsToUpdate.fecha_actualizacion = new Date();

    await usuario.update(fieldsToUpdate, { transaction });
    await transaction.commit();

    // Invalidar caches relacionados
    await invalidateAuthCache(userId, usuario.username);
    await invalidateUserProfilesCache();

    return {
      usuario: await usuario.reload(),
      camposModificados: Object.keys(fieldsToUpdate),
    };
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
};

// =====================================================
// 🔒 OPERACIONES DE CONTRASEÑA
// =====================================================

/**
 * Cambia contraseña del usuario autenticado
 * @param {number} userId - ID del usuario
 * @param {Object} passwords - { passwordActual, passwordNuevo }
 * @returns {Object} { success, metadata }
 */
const cambiarPasswordUsuario = async (userId, passwords) => {
  const { passwordActual, passwordNuevo } = passwords;
  const transaction = await sequelize.transaction();

  try {
    const usuario = await usuarios.findByPk(userId, { transaction });

    if (!usuario || !usuario.activo) {
      throw new Error("USER_NOT_FOUND_OR_INACTIVE");
    }

    // Verificar contraseña actual
    const isValidCurrent = await comparePassword(
      passwordActual,
      usuario.password
    );

    if (!isValidCurrent) {
      throw new Error("INVALID_CURRENT_PASSWORD");
    }

    // Verificar que la nueva contraseña sea diferente
    const isSamePassword = await comparePassword(
      passwordNuevo,
      usuario.password
    );

    if (isSamePassword) {
      throw new Error("SAME_PASSWORD");
    }

    // Validar fortaleza de la nueva contraseña
    const validation = validatePasswordStrength(passwordNuevo);

    if (!validation.isValid) {
      throw new Error("WEAK_PASSWORD");
    }

    // Hashear nueva contraseña
    const hashedPassword = await hashPassword(passwordNuevo);

    // Actualizar contraseña
    await usuario.update(
      {
        password: hashedPassword,
        fecha_actualizacion: new Date(),
      },
      { transaction }
    );

    await transaction.commit();

    // Invalidar caches de autenticación
    await invalidateAuthCache(userId, usuario.username);

    return {
      success: true,
      metadata: {
        password_changed_at: new Date().toISOString(),
        password_strength: validation.strength,
      },
    };
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
};

// =====================================================
// 📊 FUNCIONES AUXILIARES
// =====================================================

/**
 * Registra intento de login fallido
 * @param {string} identifier - Username o email
 */
const registrarIntentoFallido = async (identifier) => {
  const attemptsKey = generateSimpleCacheKey(
    CACHE_PREFIXES.AUTH_ATTEMPTS,
    identifier
  );

  try {
    let attempts = await cacheGet(attemptsKey);

    if (!attempts) {
      attempts = { count: 0, firstAttempt: Date.now() };
    }

    attempts.count += 1;
    attempts.lastAttempt = Date.now();

    // Bloquear después de 5 intentos por 15 minutos
    if (attempts.count >= 5) {
      attempts.lockUntil = Date.now() + 15 * 60 * 1000; // 15 minutos
    }

    await cacheSet(attemptsKey, attempts, CACHE_TTL.AUTH_LOGIN_ATTEMPTS);

    console.warn(
      `Intento de login fallido para: ${identifier} (${attempts.count}/5)`
    );
  } catch (error) {
    console.error("Error registrando intento fallido:", error);
  }
};

/**
 * Obtiene estadísticas de sesiones activas (opcional para dashboard)
 * @returns {Object} { active_sessions, recent_logins }
 */
const obtenerEstadisticasSesiones = async () => {
  try {
    // Esta función es opcional y puede expandirse para dashboards administrativos
    const cacheKey = generateCacheKey("auth:session_stats", {});
    const cached = await cacheGet(cacheKey);

    if (cached) {
      return { data: cached, fromCache: true };
    }

    // Consulta básica de usuarios activos en las últimas 24 horas
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    const activeUsers = await usuarios.count({
      where: {
        activo: true,
        fecha_actualizacion: { [Op.gte]: yesterday },
      },
    });

    const stats = {
      active_users: activeUsers,
      generated_at: new Date().toISOString(),
      period: "24h",
    };

    await cacheSet(cacheKey, stats, 300); // 5 minutos de cache

    return { data: stats, fromCache: false };
  } catch (error) {
    console.error("Error obteniendo estadísticas de sesiones:", error);
    return {
      data: {
        active_users: 0,
        error: "No disponible",
        generated_at: new Date().toISOString(),
      },
      fromCache: false,
    };
  }
};

/**
 * Limpia sesiones y cache expirado (función de mantenimiento)
 * @returns {Object} { cleaned_entries, execution_time }
 */
const limpiarSesionesExpiradas = async () => {
  const startTime = performance.now();
  let cleanedEntries = 0;

  try {
    // Esta función puede ser llamada por un cron job
    const { invalidateByPattern } = await import("../services/cacheService.js");

    // Limpiar intentos de login antiguos
    cleanedEntries += await invalidateByPattern("auth:attempts:*");

    // Limpiar cache de validaciones muy antiguo
    cleanedEntries += await invalidateByPattern("auth:token_validation:*");

    const executionTime = performance.now() - startTime;

    console.log(
      `Limpieza de sesiones completada: ${cleanedEntries} entradas en ${executionTime.toFixed(
        2
      )}ms`
    );

    return {
      cleaned_entries: cleanedEntries,
      execution_time: executionTime.toFixed(2),
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    console.error("Error limpiando sesiones expiradas:", error);
    return {
      cleaned_entries: cleanedEntries,
      error: error.message,
      timestamp: new Date().toISOString(),
    };
  }
};

// =====================================================
// 📤 EXPORTACIONES
// =====================================================
export default {
  // Autenticación principal
  autenticarUsuario,
  validarToken,

  // Gestión de perfil
  obtenerPerfilUsuario,
  actualizarPerfilUsuario,

  // Gestión de contraseñas
  cambiarPasswordUsuario,

  // Funciones auxiliares (para uso interno o administrativo)
  registrarIntentoFallido,
  obtenerEstadisticasSesiones,
  limpiarSesionesExpiradas,
};
