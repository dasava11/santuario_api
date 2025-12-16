// middleware/rateLimiters.js
import rateLimit from "express-rate-limit";

// =====================================================
// 🛡️ RATE LIMITERS ESPECÍFICOS
// =====================================================

/**
 * Rate limiter GENERAL para todas las rutas API
 * Límite: 100 requests por 15 minutos por IP
 */
export const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100, // 100 requests
  message: {
    error:
      "Demasiadas solicitudes desde esta IP, intenta nuevamente en 15 minutos",
    retry_after_seconds: 900,
  },
  standardHeaders: true, // Retorna rate limit info en headers `RateLimit-*`
  legacyHeaders: false, // Desactiva headers `X-RateLimit-*`
  // Identificar usuario por IP + user_id si está autenticado
  keyGenerator: (req) => {
    return req.user ? `user_${req.user.id}` : req.ip;
  },
});

/**
 * Rate limiter para operaciones de ESCRITURA en inventario
 * Límite: 30 requests por 10 minutos por usuario
 * Uso: POST, PATCH, PUT en inventario
 */
export const inventoryWriteLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutos
  max: 30, // 30 operaciones de escritura
  message: {
    error: "Demasiadas operaciones de inventario, intenta en 10 minutos",
    tipo: "write_limit_exceeded",
    retry_after_seconds: 600,
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    // Identificar por usuario autenticado (más estricto)
    return req.user ? `inventory_write_user_${req.user.id}` : req.ip;
  },
  // Handler personalizado cuando se excede el límite
  handler: (req, res) => {
    console.warn(
      `⚠️ RATE LIMIT EXCEDIDO: Usuario ${req.user?.id || req.ip} en ${req.path}`
    );
    res.status(429).json({
      error: "Demasiadas operaciones de inventario",
      detalles: "Has excedido el límite de 30 operaciones en 10 minutos",
      retry_after_seconds: 600,
      sugerencia: "Espera unos minutos antes de realizar más cambios",
    });
  },
});

/**
 * Rate limiter CRÍTICO para ajustes de inventario
 * Límite: 10 ajustes por 15 minutos por usuario
 * Uso: POST /inventario/ajustar (operación más sensible)
 */
export const criticalAdjustLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 15, // Solo 15 ajustes críticos
  message: {
    error: "Demasiados ajustes de inventario, intenta en 15 minutos",
    tipo: "critical_adjust_limit",
    retry_after_seconds: 900,
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    // Identificar por usuario (admin/dueño)
    return req.user ? `adjust_user_${req.user.id}` : req.ip;
  },
  handler: (req, res) => {
    console.error(
      `🚨 AJUSTE CRÍTICO BLOQUEADO:\n` +
        `   Usuario: ${req.user?.id} (${req.user?.nombre} ${req.user?.apellido})\n` +
        `   IP: ${req.ip}\n` +
        `   Intentó: ${
          req.body?.producto_id
            ? `Ajustar producto ${req.body.producto_id}`
            : "Ajuste masivo"
        }\n` +
        `   Timestamp: ${new Date().toISOString()}`
    );

    res.status(429).json({
      error: "Límite de ajustes de inventario excedido",
      detalles: "Solo se permiten 10 ajustes cada 15 minutos",
      retry_after_seconds: 900,
      tipo: "critical_operation_limit",
      sugerencia:
        "Si necesitas hacer ajustes masivos, contacta al administrador del sistema",
    });
  },
  // Skip para usuarios con rol específico (opcional)
  skip: (req) => {
    // Ejemplo: Permitir ilimitado para rol "sistema" (procesos automáticos)
    return req.user?.rol === "sistema";
  },
});

/**
 * Rate limiter para consultas de reportes
 * Límite: 20 requests por 5 minutos por usuario
 * Uso: GET endpoints que generan reportes complejos
 */
export const reportLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutos
  max: 20,
  message: {
    error: "Demasiadas consultas de reportes, intenta en 10 minutos",
    retry_after_seconds: 600,
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    return req.user ? `report_user_${req.user.id}` : req.ip;
  },
});

/**
 * Rate limiter para login (prevenir fuerza bruta)
 * Límite: 5 intentos por 15 minutos por IP
 */
export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: {
    error: "Demasiados intentos de inicio de sesión, intenta en 15 minutos",
    tipo: "login_attempts_exceeded",
    retry_after_seconds: 900,
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // Solo cuenta intentos fallidos
});

// =====================================================
// 🎯 CONFIGURACIÓN AVANZADA (OPCIONAL)
// =====================================================

/**
 * Store de Redis para rate limiting distribuido
 * Útil si tienes múltiples instancias del servidor
 * Requiere: npm install rate-limit-redis
 */
/*
import RedisStore from "rate-limit-redis";
import redisClient from "../config/redis.js";

export const distributedLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  store: new RedisStore({
    client: redisClient,
    prefix: "rl:", // Prefijo para keys de rate limit
  }),
});
*/
