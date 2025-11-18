/**
 * Utilidades para respuestas estandarizadas de controladores
 * Maneja el formato común de respuestas API y logging
 */

/**
 * Construye respuesta exitosa estándar
 * @param {*} data - Datos de respuesta
 * @param {Object} metadata - Metadatos adicionales
 * @param {boolean} fromCache - Indica si viene del caché
 * @returns {Object} Respuesta estandarizada
 */
export const buildSuccessResponse = (
  data,
  metadata = {},
  fromCache = false
) => {
  const response = {
    success: true,
    data,
    metadata: {
      timestamp: new Date().toISOString(),
      ...metadata,
    },
  };

  if (fromCache) {
    response.cache_info = {
      from_cache: true,
      cache_timestamp: new Date().toISOString(),
    };
  }

  return response;
};

/**
 * Construye respuesta de error estándar para controladores
 * @param {string} message - Mensaje de error principal
 * @param {number} statusCode - Código de estado HTTP
 * @param {Object} details - Detalles adicionales del error
 * @returns {Object} Respuesta de error estandarizada
 */
export const buildErrorResponse = (
  message,
  statusCode = 500,
  details = {}
) => ({
  success: false,
  error: {
    message,
    code: statusCode,
    timestamp: new Date().toISOString(),
    ...details,
  },
});

/**
 * Construye respuesta de error de negocio (400-level errors)
 * @param {string} message - Mensaje de error de negocio
 * @param {Object} businessDetails - Detalles específicos del negocio
 * @returns {Object} Respuesta de error de negocio
 */
export const buildBusinessErrorResponse = (message, businessDetails = {}) => ({
  success: false,
  error: {
    message,
    code: 400,
    type: "business_rule_violation",
    timestamp: new Date().toISOString(),
    details: businessDetails,
  },
});

/**
 * Logger estandarizado para controladores
 * @param {string} module - Nombre del módulo/controlador
 * @returns {Object} Objeto logger con métodos específicos
 */
export const createControllerLogger = (module) => ({
  info: (message, data = {}) =>
    console.log(`ℹ️ [${module.toUpperCase()}] ${message}`, data),

  error: (message, error = {}) =>
    console.error(`❌ [${module.toUpperCase()}] ${message}`, error),

  cache: (action, key, time = null) => {
    const timeStr = time ? ` (${time}ms)` : "";
    console.log(`💾 [CACHE] ${action}: ${key}${timeStr}`);
  },

  business: (action, details = {}) =>
    console.log(`🏢 [${module.toUpperCase()}] ${action}`, details),
});

/**
 * Maneja errores de Sequelize y los convierte a respuestas estándar
 * @param {Error} error - Error de Sequelize
 * @param {string} operation - Operación que falló
 * @returns {Object} Respuesta de error formateada
 */
export const handleSequelizeError = (error, operation = "operación") => {
  switch (error.name) {
    case "SequelizeUniqueConstraintError":
      return buildBusinessErrorResponse(
        `Violación de restricción única durante ${operation}`,
        {
          constraint: error.fields,
          type: "unique_constraint",
        }
      );

    case "SequelizeValidationError":
      return buildBusinessErrorResponse(
        `Errores de validación en ${operation}`,
        {
          validation_errors: error.errors.map((e) => ({
            field: e.path,
            message: e.message,
          })),
          type: "validation_error",
        }
      );

    case "SequelizeForeignKeyConstraintError":
      return buildBusinessErrorResponse(
        `Violación de clave foránea durante ${operation}`,
        {
          constraint: error.fields,
          type: "foreign_key_constraint",
        }
      );

    default:
      return buildErrorResponse(`Error interno durante ${operation}`, 500, {
        ...(process.env.NODE_ENV === "development" && { debug: error.message }),
        type: "database_error",
      });
  }
};

/**
 * Construye metadatos para operaciones CRUD
 * @param {string} operation - Tipo de operación (crear, actualizar, etc.)
 * @param {string|number} resourceId - ID del recurso
 * @param {Object} additionalMeta - Metadatos adicionales
 * @returns {Object} Metadatos estructurados
 */
export const buildOperationMetadata = (
  operation,
  resourceId = null,
  additionalMeta = {}
) => ({
  operacion: operation,
  ...(resourceId && { resource_id: resourceId }),
  ...additionalMeta,
});

/**
 * Wrapper para manejo de errores en controladores async
 * @param {Function} controllerFn - Función del controlador
 * @param {string} operationName - Nombre de la operación para logging
 * @returns {Function} Controlador con manejo de errores
 */
export const asyncControllerWrapper = (controllerFn, operationName) => {
  return async (req, res, next) => {
    const startTime = performance.now();

    try {
      await controllerFn(req, res, next);
    } catch (error) {
      const queryTime = (performance.now() - startTime).toFixed(2);

      console.error(`❌ Error en ${operationName} (${queryTime}ms):`, error);

      // Si ya se envió una respuesta, no enviar otra
      if (res.headersSent) {
        return;
      }

      const errorResponse = handleSequelizeError(error, operationName);
      res.status(errorResponse.error.code).json(errorResponse);
    }
  };
};

/**
 * Genera mensaje de éxito personalizado para operaciones CRUD
 * @param {string} operation - Operación realizada
 * @param {string} resourceName - Nombre del recurso
 * @param {string} resourceIdentifier - Identificador del recurso
 * @returns {string} Mensaje formateado
 */
export const generateSuccessMessage = (
  operation,
  resourceName,
  resourceIdentifier
) => {
  const operations = {
    crear: "creado",
    actualizar: "actualizado",
    eliminar: "eliminado",
    desactivar: "desactivado",
    activar: "activado",
  };

  const action = operations[operation] || operation;
  return `${resourceName} "${resourceIdentifier}" ${action} exitosamente`;
};
