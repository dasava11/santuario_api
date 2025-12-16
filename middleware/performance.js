// middleware/performance.js

// =====================================================
// 📊 PERFORMANCE MONITORING MIDDLEWARE
// =====================================================

/**
 * Middleware para trackear performance de requests
 * - Mide tiempo de ejecución
 * - Registra queries lentas
 * - Genera logs estructurados
 */
export const trackPerformance = (req, res, next) => {
  // Iniciar timer
  req.startTime = performance.now();
  req.startDate = new Date();

  // Capturar información del request
  const requestInfo = {
    method: req.method,
    url: req.originalUrl || req.url,
    path: req.path,
    user_id: req.user?.id || null,
    user_role: req.user?.rol || null,
    ip: req.ip || req.connection.remoteAddress,
  };

  // Hook en el evento 'finish' (cuando se envía la respuesta)
  res.on("finish", () => {
    const duration = (performance.now() - req.startTime).toFixed(2);
    const statusCode = res.statusCode;

    // Clasificar performance
    const performanceLevel = classifyPerformance(duration, req.method);

    // Log estructurado
    const logData = {
      ...requestInfo,
      duration_ms: parseFloat(duration),
      status_code: statusCode,
      performance_level: performanceLevel,
      timestamp: req.startDate.toISOString(),
    };

    // Logging según nivel
    if (performanceLevel === "SLOW" || performanceLevel === "CRITICAL") {
      console.warn(
        `⚠️ [PERF ${performanceLevel}] ${logData.method} ${logData.path} - ${duration}ms`,
        logData
      );
    } else if (process.env.NODE_ENV === "development") {
      console.log(
        `✅ [PERF ${performanceLevel}] ${logData.method} ${logData.path} - ${duration}ms`
      );
    }

    // Alertas críticas
    if (performanceLevel === "CRITICAL") {
      console.error(
        `🚨 PERFORMANCE CRÍTICA DETECTADA:\n` +
          `   Endpoint: ${req.method} ${req.path}\n` +
          `   Duración: ${duration}ms\n` +
          `   Usuario: ${req.user?.id || "anónimo"}\n` +
          `   Status: ${statusCode}\n` +
          `   Timestamp: ${new Date().toISOString()}`
      );

      // TODO: Aquí puedes enviar notificación (email, Slack, etc.)
      // sendAlert({ type: "critical_performance", data: logData });
    }

    // Métricas agregadas (opcional: guardar en Redis/DB)
    updateMetrics(logData);
  });

  next();
};

/**
 * Clasifica la performance según umbrales
 */
function classifyPerformance(duration, method) {
  const durationNum = parseFloat(duration);

  // Umbrales según tipo de operación
  const thresholds = {
    GET: { fast: 100, normal: 500, slow: 1000 },
    POST: { fast: 200, normal: 800, slow: 2000 },
    PATCH: { fast: 200, normal: 800, slow: 2000 },
    PUT: { fast: 200, normal: 800, slow: 2000 },
    DELETE: { fast: 150, normal: 600, slow: 1500 },
  };

  const threshold = thresholds[method] || thresholds.GET;

  if (durationNum <= threshold.fast) return "FAST";
  if (durationNum <= threshold.normal) return "NORMAL";
  if (durationNum <= threshold.slow) return "SLOW";
  return "CRITICAL";
}

/**
 * Actualiza métricas agregadas (en memoria)
 * En producción: usar Redis o DB
 */
const metrics = {
  total_requests: 0,
  total_duration: 0,
  by_endpoint: {},
  by_status: {},
  slow_requests: [],
};

function updateMetrics(logData) {
  metrics.total_requests++;
  metrics.total_duration += logData.duration_ms;

  // Por endpoint
  const endpoint = `${logData.method} ${logData.path}`;
  if (!metrics.by_endpoint[endpoint]) {
    metrics.by_endpoint[endpoint] = { count: 0, total_duration: 0, avg: 0 };
  }
  metrics.by_endpoint[endpoint].count++;
  metrics.by_endpoint[endpoint].total_duration += logData.duration_ms;
  metrics.by_endpoint[endpoint].avg = (
    metrics.by_endpoint[endpoint].total_duration /
    metrics.by_endpoint[endpoint].count
  ).toFixed(2);

  // Por status code
  const status = `${Math.floor(logData.status_code / 100)}xx`;
  metrics.by_status[status] = (metrics.by_status[status] || 0) + 1;

  // Guardar requests lentos (últimos 50)
  if (
    logData.performance_level === "SLOW" ||
    logData.performance_level === "CRITICAL"
  ) {
    metrics.slow_requests.unshift(logData);
    if (metrics.slow_requests.length > 50) {
      metrics.slow_requests.pop();
    }
  }
}

/**
 * Endpoint para ver métricas (agregar a tus rutas)
 * GET /api/metrics
 */
export const getMetrics = (req, res) => {
  const avgDuration =
    metrics.total_requests > 0
      ? (metrics.total_duration / metrics.total_requests).toFixed(2)
      : 0;

  // Top 10 endpoints más lentos
  const slowestEndpoints = Object.entries(metrics.by_endpoint)
    .sort((a, b) => parseFloat(b[1].avg) - parseFloat(a[1].avg))
    .slice(0, 10)
    .map(([endpoint, data]) => ({ endpoint, ...data }));

  res.json({
    success: true,
    data: {
      resumen: {
        total_requests: metrics.total_requests,
        promedio_duracion_ms: parseFloat(avgDuration),
        requests_lentos: metrics.slow_requests.length,
      },
      por_status: metrics.by_status,
      endpoints_mas_lentos: slowestEndpoints,
      ultimos_requests_lentos: metrics.slow_requests.slice(0, 10),
    },
    metadata: {
      timestamp: new Date().toISOString(),
      nota: "Métricas en memoria, se resetean al reiniciar servidor",
    },
  });
};

/**
 * Resetear métricas (útil para testing)
 */
export const resetMetrics = () => {
  metrics.total_requests = 0;
  metrics.total_duration = 0;
  metrics.by_endpoint = {};
  metrics.by_status = {};
  metrics.slow_requests = [];
};

// =====================================================
// 📈 LOGGER MEJORADO (OPCIONAL)
// =====================================================

/**
 * Logger estructurado con niveles
 * Alternativa profesional a console.log
 */
export const logger = {
  info: (message, data = {}) => {
    console.log(
      JSON.stringify({
        level: "INFO",
        message,
        data,
        timestamp: new Date().toISOString(),
      })
    );
  },

  warn: (message, data = {}) => {
    console.warn(
      JSON.stringify({
        level: "WARN",
        message,
        data,
        timestamp: new Date().toISOString(),
      })
    );
  },

  error: (message, error = {}) => {
    console.error(
      JSON.stringify({
        level: "ERROR",
        message,
        error: {
          message: error.message,
          stack: error.stack,
          ...(error.code && { code: error.code }),
        },
        timestamp: new Date().toISOString(),
      })
    );
  },

  perf: (endpoint, duration, statusCode) => {
    console.log(
      JSON.stringify({
        level: "PERF",
        endpoint,
        duration_ms: duration,
        status_code: statusCode,
        timestamp: new Date().toISOString(),
      })
    );
  },
};
