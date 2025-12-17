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
// =====================================================
// 📊 RATE LIMITER GENERAL PARA REPORTES
// =====================================================

/**
 * Rate limiter para consultas de reportes generales
 * Límite: 20 requests por 10 minutos por usuario
 */
export const reportLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
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

// =====================================================
// 🔐 RATE LIMITER PARA LOGIN
// =====================================================

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
// 💰 RATE LIMITERS PARA VENTAS
// =====================================================

/**
 * Rate limiter para CREAR VENTAS
 * Límite: 40 ventas por 10 minutos por usuario
 *
 * Contexto del negocio:
 * - 2 cajeros activos
 * - ~600 clientes/día = ~25 clientes/hora por cajero
 * - Picos de 40 clientes/hora en horas punta
 * - 40 ventas en 10 min = ritmo pico razonable
 */
export const ventasWriteLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutos
  max: 40, // 40 ventas (permite picos)
  message: {
    error: "Demasiadas ventas creadas en poco tiempo",
    tipo: "ventas_write_limit",
    retry_after_seconds: 600,
    sugerencia: "Espera unos minutos antes de procesar más ventas",
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    // Identificar por usuario (cajero)
    return req.user
      ? `ventas_write_user_${req.user.id}`
      : `ventas_ip_${req.ip}`;
  },
  handler: (req, res) => {
    console.warn(
      `⚠️ LÍMITE DE VENTAS EXCEDIDO:\n` +
        `   Cajero: ${req.user?.nombre} ${req.user?.apellido} (ID: ${req.user?.id})\n` +
        `   IP: ${req.ip}\n` +
        `   Intentó crear venta con ${
          req.body?.productos?.length || 0
        } productos\n` +
        `   Total: ${req.body?.total || "N/A"}\n` +
        `   Timestamp: ${new Date().toISOString()}`
    );

    res.status(429).json({
      error: "Límite de ventas excedido temporalmente",
      detalles:
        "Has creado demasiadas ventas en los últimos 10 minutos (máximo: 40)",
      retry_after_seconds: 600,
      tipo: "ventas_rate_limit",
      contexto: {
        limite: 40,
        ventana: "10 minutos",
        usuario: req.user?.id || null,
      },
    });
  },
  skip: (req) => {
    // Permitir ilimitado para procesos automáticos del sistema
    return req.user?.rol === "sistema";
  },
});

/**
 * Rate limiter CRÍTICO para ANULAR VENTAS
 * Límite: 10 anulaciones por 15 minutos por usuario
 *
 * Contexto del negocio:
 * - Anulaciones son operaciones sensibles
 * - Requieren autorización (solo admin/dueño)
 * - Revierten inventario (impacto crítico)
 * - 10 anulaciones en 15 min es un volumen alto inusual
 */
export const criticalVentaLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 10, // Solo 10 anulaciones
  message: {
    error: "Demasiadas anulaciones de ventas",
    tipo: "ventas_anulacion_limit",
    retry_after_seconds: 900,
    sugerencia:
      "Las anulaciones masivas requieren supervisión del administrador",
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    return req.user
      ? `ventas_anular_user_${req.user.id}`
      : `ventas_anular_ip_${req.ip}`;
  },
  handler: (req, res) => {
    const ventaId = req.params.id;
    const motivo = req.body?.motivo_anulacion;

    console.error(
      `🚨 ANULACIÓN DE VENTA BLOQUEADA POR RATE LIMIT:\n` +
        `   Usuario: ${req.user?.nombre} ${req.user?.apellido} (ID: ${req.user?.id}, Rol: ${req.user?.rol})\n` +
        `   IP: ${req.ip}\n` +
        `   Venta ID: ${ventaId}\n` +
        `   Motivo: ${motivo || "No proporcionado"}\n` +
        `   Timestamp: ${new Date().toISOString()}\n` +
        `   ⚠️ ALERTA: Posible patrón anormal de anulaciones`
    );

    res.status(429).json({
      error: "Límite de anulaciones de ventas excedido",
      detalles:
        "Solo se permiten 10 anulaciones cada 15 minutos por razones de seguridad",
      retry_after_seconds: 900,
      tipo: "critical_anulacion_limit",
      contexto: {
        limite: 10,
        ventana: "15 minutos",
        razon:
          "Prevención de errores masivos y auditoría de operaciones críticas",
      },
      sugerencia:
        "Si necesitas anular múltiples ventas, contacta al supervisor o administrador del sistema",
    });
  },
  skip: (req) => {
    // Permitir ilimitado solo para rol "sistema" (procesos automáticos)
    return req.user?.rol === "sistema";
  },
});

/**
 * Rate limiter para CONSULTAS DE RESUMEN DE VENTAS
 * Límite: 20 consultas por 5 minutos por usuario
 *
 * Contexto:
 * - Consultas de resumen son computacionalmente costosas
 * - Involucran agregaciones y joins complejos
 * - Previene abuso de reportes pesados
 */
export const ventasReportLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutos
  max: 20, // 20 consultas de reporte
  message: {
    error: "Demasiadas consultas de reportes de ventas",
    tipo: "ventas_report_limit",
    retry_after_seconds: 300,
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    return req.user
      ? `ventas_report_user_${req.user.id}`
      : `ventas_report_ip_${req.ip}`;
  },
  handler: (req, res) => {
    console.warn(
      `⚠️ LÍMITE DE REPORTES DE VENTAS EXCEDIDO:\n` +
        `   Usuario: ${req.user?.id}\n` +
        `   Endpoint: ${req.path}\n` +
        `   Filtros: ${JSON.stringify(req.query)}\n` +
        `   Timestamp: ${new Date().toISOString()}`
    );

    res.status(429).json({
      error: "Demasiadas consultas de reportes en poco tiempo",
      detalles: "Límite de 20 consultas cada 5 minutos",
      retry_after_seconds: 300,
      tipo: "report_rate_limit",
      sugerencia: "Espera unos minutos antes de generar más reportes",
    });
  },
});

// =====================================================
// 📝 DOCUMENTACIÓN DE LÍMITES POR CONTEXTO DE NEGOCIO
// =====================================================

/*
JUSTIFICACIÓN DE LÍMITES PARA SUPERMERCADO:

VENTAS (ventasWriteLimiter):
- 40 ventas / 10 min = 4 ventas/min por cajero
- Contexto: 600 clientes/día ÷ 12 horas = 50 clientes/hora = 0.83 clientes/min
- Permite picos de hasta 4x el promedio (razonable para horas punta)

ANULACIONES (criticalVentaLimiter):
- 10 anulaciones / 15 min = 0.66 anulaciones/min
- Contexto: Anulaciones son <1% de ventas normales
- Límite previene errores en cascada y requiere supervisión si se excede

REPORTES (ventasReportLimiter):
- 20 consultas / 5 min = 4 consultas/min
- Contexto: Reportes son para análisis, no operaciones en tiempo real
- Previene sobrecarga del servidor por dashboards mal configurados

INVENTARIO AJUSTES (criticalAdjustLimiter):
- 15 ajustes / 15 min = 1 ajuste/min
- Contexto: Ajustes son correcciones manuales, no operaciones rutinarias
- Límite razonable para auditoría sin bloquear operación normal
*/

// =====================================================
// 📦 RATE LIMITERS PARA RECEPCIONES
// =====================================================

/**
 * Rate limiter para CREAR RECEPCIONES
 * Límite: 30 recepciones por 10 minutos por usuario
 *
 * Contexto del negocio:
 * - Supermercado con ~100 proveedores
 * - Recepciones promedio: 2-5 por día = ~0.2 recepciones/hora
 * - 30 recepciones en 10 min permite entrada masiva sin saturar sistema
 * - Protege contra errores de entrada duplicada
 */
export const recepcionesWriteLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutos
  max: 30, // 30 recepciones
  message: {
    error: "Demasiadas recepciones creadas en poco tiempo",
    tipo: "recepciones_write_limit",
    retry_after_seconds: 600,
    sugerencia: "Espera unos minutos antes de crear más recepciones",
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    // Identificar por usuario (empleado responsable)
    return req.user
      ? `recepciones_write_user_${req.user.id}`
      : `recepciones_ip_${req.ip}`;
  },
  handler: (req, res) => {
    console.warn(
      `⚠️ LÍMITE DE RECEPCIONES EXCEDIDO:\n` +
        `   Usuario: ${req.user?.nombre} ${req.user?.apellido} (ID: ${req.user?.id})\n` +
        `   IP: ${req.ip}\n` +
        `   Intentó crear recepción con ${
          req.body?.productos?.length || 0
        } productos\n` +
        `   Total factura: ${req.body?.total || "N/A"}\n` +
        `   Proveedor ID: ${req.body?.proveedor_id || "N/A"}\n` +
        `   Timestamp: ${new Date().toISOString()}`
    );

    res.status(429).json({
      error: "Límite de recepciones excedido temporalmente",
      detalles:
        "Has creado demasiadas recepciones en los últimos 10 minutos (máximo: 30)",
      retry_after_seconds: 600,
      tipo: "recepciones_rate_limit",
      contexto: {
        limite: 30,
        ventana: "10 minutos",
        usuario: req.user?.id || null,
      },
      sugerencia: "Verifica si hay recepciones duplicadas antes de continuar",
    });
  },
  skip: (req) => {
    // Permitir ilimitado para procesos automáticos del sistema
    return req.user?.rol === "sistema";
  },
});

/**
 * Rate limiter CRÍTICO para PROCESAR RECEPCIONES
 * Límite: 15 procesamientos cada 15 minutos por usuario
 *
 * Contexto del negocio:
 * - Procesar recepción actualiza inventario masivamente (operación crítica)
 * - Requiere verificación física de mercancía
 * - 15 procesamientos en 15 min = ritmo razonable de verificación
 * - Protege contra procesamiento accidental múltiple
 */
export const criticalRecepcionLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 15, // Solo 15 procesamientos
  message: {
    error: "Demasiados procesamientos de recepciones",
    tipo: "recepciones_procesamiento_limit",
    retry_after_seconds: 900,
    sugerencia:
      "Los procesamientos masivos requieren supervisión del administrador",
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    return req.user
      ? `recepciones_procesar_user_${req.user.id}`
      : `recepciones_procesar_ip_${req.ip}`;
  },
  handler: (req, res) => {
    const recepcionId = req.params.id;
    const observaciones = req.body?.observaciones_proceso;
    const actualizarPrecios = req.body?.actualizar_precios;

    console.error(
      `🚨 PROCESAMIENTO DE RECEPCIÓN BLOQUEADO POR RATE LIMIT:\n` +
        `   Usuario: ${req.user?.nombre} ${req.user?.apellido} (ID: ${req.user?.id}, Rol: ${req.user?.rol})\n` +
        `   IP: ${req.ip}\n` +
        `   Recepción ID: ${recepcionId}\n` +
        `   Actualizar precios: ${
          actualizarPrecios !== false ? "Sí" : "No"
        }\n` +
        `   Observaciones: ${observaciones || "No proporcionadas"}\n` +
        `   Timestamp: ${new Date().toISOString()}\n` +
        `   ⚠️ ALERTA: Posible patrón anormal de procesamientos`
    );

    res.status(429).json({
      error: "Límite de procesamientos de recepciones excedido",
      detalles:
        "Solo se permiten 15 procesamientos cada 15 minutos por razones de seguridad",
      retry_after_seconds: 900,
      tipo: "critical_procesamiento_limit",
      contexto: {
        limite: 15,
        ventana: "15 minutos",
        razon:
          "Prevención de errores masivos en inventario y auditoría de operaciones críticas",
      },
      sugerencia:
        "Si necesitas procesar múltiples recepciones, contacta al supervisor o administrador del sistema",
    });
  },
  skip: (req) => {
    // Permitir ilimitado solo para rol "sistema" (procesos automáticos)
    return req.user?.rol === "sistema";
  },
});

/**
 * Rate limiter para CONSULTAS DE ESTADÍSTICAS DE RECEPCIONES
 * Límite: 20 consultas por 5 minutos por usuario
 *
 * Contexto:
 * - Consultas de estadísticas son computacionalmente costosas
 * - Involucran agregaciones y joins complejos (proveedores, productos)
 * - Previene abuso de reportes pesados
 */
export const recepcionesReportLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutos
  max: 20, // 20 consultas de reporte
  message: {
    error: "Demasiadas consultas de estadísticas de recepciones",
    tipo: "recepciones_report_limit",
    retry_after_seconds: 300,
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    return req.user
      ? `recepciones_report_user_${req.user.id}`
      : `recepciones_report_ip_${req.ip}`;
  },
  handler: (req, res) => {
    console.warn(
      `⚠️ LÍMITE DE REPORTES DE RECEPCIONES EXCEDIDO:\n` +
        `   Usuario: ${req.user?.id}\n` +
        `   Endpoint: ${req.path}\n` +
        `   Filtros: ${JSON.stringify(req.query)}\n` +
        `   Timestamp: ${new Date().toISOString()}`
    );

    res.status(429).json({
      error: "Demasiadas consultas de reportes en poco tiempo",
      detalles: "Límite de 20 consultas cada 5 minutos",
      retry_after_seconds: 300,
      tipo: "report_rate_limit",
      sugerencia: "Espera unos minutos antes de generar más reportes",
    });
  },
});

// =====================================================
// 📊 DOCUMENTACIÓN DE LÍMITES POR CONTEXTO DE NEGOCIO
// =====================================================

/*
JUSTIFICACIÓN DE LÍMITES PARA RECEPCIONES DE SUPERMERCADO:

CREAR RECEPCIONES (recepcionesWriteLimiter):
- 30 recepciones / 10 min = 3 recepciones/min
- Contexto: ~100 proveedores, 2-5 recepciones/día = 0.008 recepciones/min promedio
- Permite picos de hasta 375x el promedio (muy generoso para entrada masiva)
- Protege contra errores de duplicación accidental

PROCESAR RECEPCIONES (criticalRecepcionLimiter):
- 15 procesamientos / 15 min = 1 procesamiento/min
- Contexto: Procesamiento requiere verificación física de mercancía
- Actualiza inventario masivamente (operación crítica)
- Límite razonable para operación normal con supervisión

ESTADÍSTICAS (recepcionesReportLimiter):
- 20 consultas / 5 min = 4 consultas/min
- Contexto: Reportes son para análisis, no operaciones en tiempo real
- Previene sobrecarga del servidor por dashboards mal configurados
- Queries pesados con agregaciones y joins múltiples
*/

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
