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
// 📦 RATE LIMITERS PARA PRODUCTOS
// =====================================================

/**
 * Rate limiter para CREAR/ACTUALIZAR PRODUCTOS
 * Límite: 30 operaciones cada 10 minutos por usuario
 *
 * Contexto del negocio:
 * - Supermercado con ~3000 productos
 * - Alta rotación: ~200 productos nuevos/mes
 * - Actualizaciones frecuentes de precios
 * - 30 operaciones en 10 min = ritmo razonable de gestión de catálogo
 */
export const productosWriteLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutos
  max: 30, // 30 operaciones de escritura
  message: {
    error: "Demasiadas operaciones de productos en poco tiempo",
    tipo: "productos_write_limit",
    retry_after_seconds: 600,
    sugerencia: "Espera unos minutos antes de realizar más cambios",
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    // Identificar por usuario (admin/dueño)
    return req.user
      ? `productos_write_user_${req.user.id}`
      : `productos_ip_${req.ip}`;
  },
  handler: (req, res) => {
    console.warn(
      `⚠️ LÍMITE DE OPERACIONES DE PRODUCTOS EXCEDIDO:\n` +
        `   Usuario: ${req.user?.nombre} ${req.user?.apellido} (ID: ${req.user?.id})\n` +
        `   IP: ${req.ip}\n` +
        `   Operación: ${req.method} ${req.path}\n` +
        `   Timestamp: ${new Date().toISOString()}`
    );

    res.status(429).json({
      error: "Límite de operaciones de productos excedido temporalmente",
      detalles:
        "Has realizado demasiadas operaciones en los últimos 10 minutos (máximo: 30)",
      retry_after_seconds: 600,
      tipo: "productos_rate_limit",
      contexto: {
        limite: 30,
        ventana: "10 minutos",
        usuario: req.user?.id || null,
      },
    });
  },
  skip: (req) => {
    // Permitir ilimitado para rol "sistema" (procesos automáticos)
    return req.user?.rol === "sistema";
  },
});

/**
 * Rate limiter CRÍTICO para ELIMINAR PRODUCTOS (desactivación lógica)
 * Límite: 10 eliminaciones cada 15 minutos por usuario
 *
 * Contexto del negocio:
 * - Eliminaciones son operaciones sensibles
 * - Requieren autorización (solo admin/dueño)
 * - Impactan inventario y reportes
 * - 10 eliminaciones en 15 min es un volumen alto inusual
 */
export const criticalProductLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 10, // Solo 10 eliminaciones
  message: {
    error: "Demasiadas eliminaciones de productos",
    tipo: "productos_eliminacion_limit",
    retry_after_seconds: 900,
    sugerencia:
      "Las eliminaciones masivas requieren supervisión del administrador",
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    return req.user
      ? `productos_delete_user_${req.user.id}`
      : `productos_delete_ip_${req.ip}`;
  },
  handler: (req, res) => {
    const productoId = req.params.id;

    console.error(
      `🚨 ELIMINACIÓN DE PRODUCTO BLOQUEADA POR RATE LIMIT:\n` +
        `   Usuario: ${req.user?.nombre} ${req.user?.apellido} (ID: ${req.user?.id}, Rol: ${req.user?.rol})\n` +
        `   IP: ${req.ip}\n` +
        `   Producto ID: ${productoId}\n` +
        `   Timestamp: ${new Date().toISOString()}\n` +
        `   ⚠️ ALERTA: Posible patrón anormal de eliminaciones`
    );

    res.status(429).json({
      error: "Límite de eliminaciones de productos excedido",
      detalles:
        "Solo se permiten 10 eliminaciones cada 15 minutos por razones de seguridad",
      retry_after_seconds: 900,
      tipo: "critical_eliminacion_limit",
      contexto: {
        limite: 10,
        ventana: "15 minutos",
        razon:
          "Prevención de errores masivos y auditoría de operaciones críticas",
      },
      sugerencia:
        "Si necesitas eliminar múltiples productos, contacta al supervisor o administrador del sistema",
    });
  },
  skip: (req) => {
    // Permitir ilimitado solo para rol "sistema" (procesos automáticos)
    return req.user?.rol === "sistema";
  },
});

/**
 * Rate limiter para BÚSQUEDAS DE PRODUCTOS (con LIKE)
 * Límite: 60 búsquedas cada 5 minutos por usuario
 *
 * Contexto del negocio:
 * - Búsquedas con LIKE son costosas en MySQL
 * - POS realiza búsquedas frecuentes por código de barras (más eficientes)
 * - Búsquedas por nombre/descripción son menos frecuentes
 * - 60 búsquedas en 5 min = 12 búsquedas/min (razonable para gestión manual)
 */
export const productosSearchLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutos
  max: 60, // 60 búsquedas
  message: {
    error: "Demasiadas búsquedas de productos en poco tiempo",
    tipo: "productos_search_limit",
    retry_after_seconds: 300,
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    return req.user
      ? `productos_search_user_${req.user.id}`
      : `productos_search_ip_${req.ip}`;
  },
  handler: (req, res) => {
    console.warn(
      `⚠️ LÍMITE DE BÚSQUEDAS DE PRODUCTOS EXCEDIDO:\n` +
        `   Usuario: ${req.user?.id}\n` +
        `   Query: ${JSON.stringify(req.query)}\n` +
        `   Timestamp: ${new Date().toISOString()}`
    );

    res.status(429).json({
      error: "Demasiadas búsquedas en poco tiempo",
      detalles: "Límite de 60 búsquedas cada 5 minutos",
      retry_after_seconds: 300,
      tipo: "search_rate_limit",
      sugerencia: "Espera unos minutos antes de realizar más búsquedas",
    });
  },
  // Sin skip: Aplicar a todos los usuarios (incluido sistema)
});

// =====================================================
// 📊 DOCUMENTACIÓN DE LÍMITES POR CONTEXTO DE NEGOCIO
// =====================================================

/*
JUSTIFICACIÓN DE LÍMITES PARA PRODUCTOS DE SUPERMERCADO:

CREAR/ACTUALIZAR (productosWriteLimiter):
- 30 operaciones / 10 min = 3 operaciones/min
- Contexto: ~200 productos nuevos/mes = 6.6 productos/día = 0.27 productos/hora
- Permite picos de hasta 180x el promedio (muy generoso para actualizaciones masivas)

ELIMINAR (criticalProductLimiter):
- 10 eliminaciones / 15 min = 0.66 eliminaciones/min
- Contexto: Eliminaciones son raras (<1% de operaciones normales)
- Límite previene errores en cascada y requiere supervisión si se excede

BÚSQUEDAS (productosSearchLimiter):
- 60 búsquedas / 5 min = 12 búsquedas/min
- Contexto: Búsquedas con LIKE son costosas en MySQL
- Búsquedas por código de barras (más eficientes) NO están limitadas
- Límite razonable para gestión manual sin bloquear operación normal
*/

// =====================================================
// 📦 RATE LIMITERS PARA PROVEEDORES
// =====================================================

/**
 * Rate limiter para CREAR/ACTUALIZAR PROVEEDORES
 * Límite: 20 operaciones cada 10 minutos por usuario
 * 
 * Contexto del negocio:
 * - ~100 proveedores totales
 * - Operaciones infrecuentes (nuevos proveedores: ~2-5/mes)
 * - Solo 2 roles pueden modificar (admin/dueño)
 * - 20 operaciones en 10 min es muy generoso
 */
export const proveedoresWriteLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutos
  max: 20, // 20 operaciones
  message: {
    error: "Demasiadas operaciones de proveedores en poco tiempo",
    tipo: "proveedores_write_limit",
    retry_after_seconds: 600,
    sugerencia: "Espera unos minutos antes de realizar más cambios",
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    return req.user
      ? `proveedores_write_user_${req.user.id}`
      : `proveedores_ip_${req.ip}`;
  },
  handler: (req, res) => {
    console.warn(
      `⚠️ LÍMITE DE OPERACIONES DE PROVEEDORES EXCEDIDO:\n` +
        `   Usuario: ${req.user?.nombre} ${req.user?.apellido} (ID: ${req.user?.id})\n` +
        `   IP: ${req.ip}\n` +
        `   Operación: ${req.method} ${req.path}\n` +
        `   Timestamp: ${new Date().toISOString()}`
    );

    res.status(429).json({
      error: "Límite de operaciones de proveedores excedido temporalmente",
      detalles:
        "Has realizado demasiadas operaciones en los últimos 10 minutos (máximo: 20)",
      retry_after_seconds: 600,
      tipo: "proveedores_rate_limit",
      contexto: {
        limite: 20,
        ventana: "10 minutos",
        usuario: req.user?.id || null,
      },
    });
  },
  skip: (req) => {
    // Permitir ilimitado para rol "sistema" (procesos automáticos)
    return req.user?.rol === "sistema";
  },
});

/**
 * Rate limiter CRÍTICO para DESACTIVAR PROVEEDORES
 * Límite: 5 desactivaciones cada 15 minutos
 * 
 * Contexto del negocio:
 * - Desactivar proveedor es operación sensible
 * - Puede afectar recepciones activas
 * - Requiere validación de impacto
 * - 5 desactivaciones en 15 min es razonable
 */
export const criticalProveedorLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 5, // Solo 5 desactivaciones
  message: {
    error: "Demasiadas desactivaciones de proveedores",
    tipo: "proveedores_delete_limit",
    retry_after_seconds: 900,
    sugerencia:
      "Las desactivaciones masivas requieren supervisión del administrador",
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    return req.user
      ? `proveedores_delete_user_${req.user.id}`
      : `proveedores_delete_ip_${req.ip}`;
  },
  handler: (req, res) => {
    const proveedorId = req.params.id;

    console.error(
      `🚨 DESACTIVACIÓN DE PROVEEDOR BLOQUEADA POR RATE LIMIT:\n` +
        `   Usuario: ${req.user?.nombre} ${req.user?.apellido} (ID: ${req.user?.id}, Rol: ${req.user?.rol})\n` +
        `   IP: ${req.ip}\n` +
        `   Proveedor ID: ${proveedorId}\n` +
        `   Timestamp: ${new Date().toISOString()}\n` +
        `   ⚠️ ALERTA: Posible patrón anormal de desactivaciones`
    );

    res.status(429).json({
      error: "Límite de desactivaciones de proveedores excedido",
      detalles:
        "Solo se permiten 5 desactivaciones cada 15 minutos por razones de seguridad",
      retry_after_seconds: 900,
      tipo: "critical_delete_limit",
      contexto: {
        limite: 5,
        ventana: "15 minutos",
        razon:
          "Prevención de errores masivos y auditoría de operaciones críticas",
      },
      sugerencia:
        "Si necesitas desactivar múltiples proveedores, contacta al supervisor o administrador del sistema",
    });
  },
  skip: (req) => {
    return req.user?.rol === "sistema";
  },
});

/**
 * Rate limiter para CONSULTAS DE ESTADÍSTICAS
 * Límite: 15 consultas cada 5 minutos
 * 
 * Contexto:
 * - Consultas computacionalmente costosas (joins complejos)
 * - Previene abuso de reportes pesados
 */
export const proveedoresReportLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutos
  max: 15, // 15 consultas
  message: {
    error: "Demasiadas consultas de estadísticas de proveedores",
    tipo: "proveedores_report_limit",
    retry_after_seconds: 300,
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    return req.user
      ? `proveedores_report_user_${req.user.id}`
      : `proveedores_report_ip_${req.ip}`;
  },
  handler: (req, res) => {
    console.warn(
      `⚠️ LÍMITE DE REPORTES DE PROVEEDORES EXCEDIDO:\n` +
        `   Usuario: ${req.user?.id}\n` +
        `   Endpoint: ${req.path}\n` +
        `   Filtros: ${JSON.stringify(req.query)}\n` +
        `   Timestamp: ${new Date().toISOString()}`
    );

    res.status(429).json({
      error: "Demasiadas consultas de reportes en poco tiempo",
      detalles: "Límite de 15 consultas cada 5 minutos",
      retry_after_seconds: 300,
      tipo: "report_rate_limit",
      sugerencia: "Espera unos minutos antes de generar más reportes",
    });
  },
});

// =====================================================
// 📦 RATE LIMITERS PARA USUARIOS (rateLimiters.js)
// =====================================================
// Agregar esto al archivo middleware/rateLimiters.js

/**
 * Rate limiter para CREAR/ACTUALIZAR USUARIOS
 * Límite: 20 operaciones cada 15 minutos por usuario administrador
 * 
 * Contexto del negocio:
 * - Solo 6 empleados totales
 * - Operaciones de usuarios son infrecuentes (1-2/mes normalmente)
 * - 20 operaciones en 15 min permite retrabajos por errores humanos
 * - Más estricto que otras entidades por seguridad
 */
export const usuariosWriteLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 20, // 20 operaciones de escritura
  message: {
    error: "Demasiadas operaciones de usuarios en poco tiempo",
    tipo: "usuarios_write_limit",
    retry_after_seconds: 900,
    sugerencia: "Espera unos minutos antes de realizar más cambios",
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    // Identificar por usuario administrador
    return req.user
      ? `usuarios_write_user_${req.user.id}`
      : `usuarios_ip_${req.ip}`;
  },
  handler: (req, res) => {
    console.warn(
      `⚠️ LÍMITE DE OPERACIONES DE USUARIOS EXCEDIDO:\n` +
        `   Usuario: ${req.user?.nombre} ${req.user?.apellido} (ID: ${req.user?.id})\n` +
        `   IP: ${req.ip}\n` +
        `   Operación: ${req.method} ${req.path}\n` +
        `   Timestamp: ${new Date().toISOString()}`
    );

    res.status(429).json({
      error: "Límite de operaciones de usuarios excedido temporalmente",
      detalles:
        "Has realizado demasiadas operaciones en los últimos 15 minutos (máximo: 20)",
      retry_after_seconds: 900,
      tipo: "usuarios_rate_limit",
      contexto: {
        limite: 20,
        ventana: "15 minutos",
        razon: "Protección contra errores masivos y abuso del sistema",
        usuario: req.user?.id || null,
      },
      sugerencia: "Si necesitas hacer cambios masivos, contacta al administrador del sistema",
    });
  },
  skip: (req) => {
    // Permitir ilimitado para rol "sistema" (procesos automáticos)
    return req.user?.rol === "sistema";
  },
});

/**
 * Rate limiter CRÍTICO para operaciones sensibles
 * - Toggle estado (activar/desactivar usuarios)
 * - Resetear contraseñas
 * 
 * Límite: 10 operaciones cada 15 minutos
 * 
 * Contexto:
 * - Operaciones críticas que afectan acceso al sistema
 * - Requieren auditoría estricta
 * - 10 operaciones es suficiente incluso con errores
 */
export const criticalUsuarioLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 10, // Solo 10 operaciones críticas
  message: {
    error: "Demasiadas operaciones críticas de usuarios",
    tipo: "usuarios_critical_limit",
    retry_after_seconds: 900,
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    return req.user
      ? `usuarios_critical_user_${req.user.id}`
      : `usuarios_critical_ip_${req.ip}`;
  },
  handler: (req, res) => {
    const operacion = req.path.includes("toggle")
      ? "Toggle estado"
      : req.path.includes("resetear")
      ? "Resetear contraseña"
      : "Operación crítica";

    console.error(
      `🚨 OPERACIÓN CRÍTICA DE USUARIO BLOQUEADA POR RATE LIMIT:\n` +
        `   Usuario: ${req.user?.nombre} ${req.user?.apellido} (ID: ${req.user?.id}, Rol: ${req.user?.rol})\n` +
        `   IP: ${req.ip}\n` +
        `   Operación: ${operacion}\n` +
        `   Usuario objetivo ID: ${req.params.id}\n` +
        `   Timestamp: ${new Date().toISOString()}\n` +
        `   ⚠️ ALERTA: Posible patrón anormal de operaciones críticas`
    );

    res.status(429).json({
      error: "Límite de operaciones críticas excedido",
      detalles:
        "Solo se permiten 10 operaciones críticas cada 15 minutos por razones de seguridad",
      retry_after_seconds: 900,
      tipo: "critical_usuarios_limit",
      contexto: {
        limite: 10,
        ventana: "15 minutos",
        razon:
          "Prevención de errores masivos y auditoría de operaciones que afectan acceso al sistema",
      },
      sugerencia:
        "Si necesitas realizar múltiples operaciones críticas, contacta al supervisor o administrador del sistema",
    });
  },
  skip: (req) => {
    // Permitir ilimitado solo para rol "sistema"
    return req.user?.rol === "sistema";
  },
});

/**
 * Rate limiter para BÚSQUEDAS DE USUARIOS
 * Límite: 30 búsquedas cada 5 minutos
 * 
 * Contexto:
 * - Búsquedas con LIKE son costosas en MySQL
 * - Con solo 6 empleados, 30 búsquedas en 5 min es muy generoso
 * - Previene enumeración de cuentas
 */
export const usuariosSearchLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutos
  max: 30, // 30 búsquedas
  message: {
    error: "Demasiadas búsquedas de usuarios en poco tiempo",
    tipo: "usuarios_search_limit",
    retry_after_seconds: 300,
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    return req.user
      ? `usuarios_search_user_${req.user.id}`
      : `usuarios_search_ip_${req.ip}`;
  },
  handler: (req, res) => {
    console.warn(
      `⚠️ LÍMITE DE BÚSQUEDAS DE USUARIOS EXCEDIDO:\n` +
        `   Usuario: ${req.user?.id}\n` +
        `   Query: ${JSON.stringify(req.query)}\n` +
        `   Timestamp: ${new Date().toISOString()}`
    );

    res.status(429).json({
      error: "Demasiadas búsquedas en poco tiempo",
      detalles: "Límite de 30 búsquedas cada 5 minutos",
      retry_after_seconds: 300,
      tipo: "search_rate_limit",
      sugerencia: "Espera unos minutos antes de realizar más búsquedas",
    });
  },
});

// =====================================================
// 📊 JUSTIFICACIÓN DE LÍMITES POR CONTEXTO DE NEGOCIO
// =====================================================

/*
LÍMITES PARA GESTIÓN DE USUARIOS EN SUPERMERCADO:

CREAR/ACTUALIZAR (usuariosWriteLimiter):
- 20 operaciones / 15 min = 1.33 operaciones/min
- Contexto: Solo 6 empleados, cambios infrecuentes (1-2/mes)
- Permite retrabajos por errores humanos (ej: typo en email, rol incorrecto)
- Más estricto que Proveedores (20 vs 20) pero igual ventana por seguridad

OPERACIONES CRÍTICAS (criticalUsuarioLimiter):
- 10 operaciones / 15 min = 0.66 operaciones/min
- Contexto: Toggle estado y reset password son operaciones sensibles
- Afectan directamente el acceso al sistema
- 10 es suficiente incluso con varios errores consecutivos

BÚSQUEDAS (usuariosSearchLimiter):
- 30 búsquedas / 5 min = 6 búsquedas/min
- Contexto: Solo 6 empleados, búsquedas son rápidas
- Previene enumeración de cuentas (ataque de seguridad)
- Similar a productos pero más estricto por datos sensibles

COMPARACIÓN CON OTRAS ENTIDADES:
- Ventas: 40/10min (alta frecuencia transaccional)
- Productos: 30/10min (catálogo grande, cambios frecuentes)
- Proveedores: 20/10min (cambios infrecuentes)
- Usuarios: 20/15min (MÁS ESTRICTO por seguridad + ventana más larga)

FILOSOFÍA: Seguridad > Conveniencia para gestión de usuarios
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
