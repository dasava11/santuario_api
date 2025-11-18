// validations/recepciones_validations.js - Reutilizando Utils Existentes
import { validate, validateSource } from "../middleware/validation.js";
import {
  createRecepcion,
  updateRecepcion,
  getRecepciones,
  getRecepcionById,
  recepcionId,
  procesarRecepcion,
  recepcionesSchemas,
} from "./schemas/recepcionesSchemas.js";

// =====================================================
// 🎯 MIDDLEWARES ESPECÍFICOS PARA RECEPCIONES
// =====================================================

/**
 * Validar datos para crear recepción
 * Reutiliza el middleware genérico existente
 */
const validateCreateRecepcion = validate(createRecepcion);

/**
 * Validar datos para actualizar recepción
 * Reutiliza el middleware genérico existente
 */
const validateUpdateRecepcion = validate(updateRecepcion);

/**
 * Validar ID de recepción en parámetros
 * Reutiliza validateSource para params
 */
const validateRecepcionId = validateSource(recepcionId, "params");

/**
 * Validar query parameters para obtener recepciones
 * Reutiliza validateSource para query con defaults
 * Incluye paginación y filtros de búsqueda
 */
const validateGetRecepcionesQuery = validateSource(getRecepciones, "query", {
  abortEarly: false,
  stripUnknown: true,
  convert: true,
  allowUnknown: false, // Rechazar parámetros no definidos
});

/**
 * Validar query parameters para obtener recepción por ID
 * Reutiliza validateSource para query con defaults
 */
const validateGetRecepcionByIdQuery = validateSource(getRecepcionById, "query");

/**
 * Validar datos para procesar recepción
 * Permite parámetros adicionales específicos del procesamiento
 */
const validateProcesarRecepcion = validate(procesarRecepcion);

// =====================================================
// 🔧 MIDDLEWARES COMPUESTOS (OPCIONAL)
// =====================================================

/**
 * Middleware compuesto para validar creación completa
 * Combina validación de datos + sanitización
 * Ejemplo de uso: router.post("/", validateCompleteRecepcionCreation, controller)
 */
const validateCompleteRecepcionCreation = [validateCreateRecepcion];

/**
 * Middleware compuesto para validar actualización completa
 * Combina validación de ID + datos de actualización
 */
const validateCompleteRecepcionUpdate = [
  validateRecepcionId,
  validateUpdateRecepcion,
];

/**
 * Middleware compuesto para obtener recepción específica
 * Combina validación de ID + query parameters
 */
const validateGetSpecificRecepcion = [
  validateRecepcionId,
  validateGetRecepcionByIdQuery,
];

/**
 * Middleware compuesto para procesar recepción
 * Combina validación de ID + parámetros de procesamiento
 */
const validateCompleteRecepcionProcessing = [
  validateRecepcionId,
  validateProcesarRecepcion,
];

/**
 * Middleware compuesto para cancelar recepción
 * Solo necesita validación de ID
 */
const validateRecepcionCancellation = [validateRecepcionId];

// =====================================================
// 🔍 VALIDACIONES DE NEGOCIO ADICIONALES (OPCIONAL)
// =====================================================

/**
 * Middleware personalizado para validar fechas de recepción
 * Valida reglas de negocio específicas adicionales
 */
const validateBusinessDateRules = (req, res, next) => {
  const { fecha_recepcion } = req.body;

  if (!fecha_recepcion) {
    return next(); // Ya validado por Joi
  }

  const fechaRecepcion = new Date(fecha_recepcion);
  const hoy = new Date();
  const hace30Dias = new Date();
  hace30Dias.setDate(hace30Dias.getDate() - 30);

  // Regla de negocio: No permitir recepciones muy antiguas (más de 30 días)
  if (fechaRecepcion < hace30Dias) {
    return res.status(400).json({
      success: false,
      error: "Regla de negocio violada",
      details: [
        {
          field: "fecha_recepcion",
          message:
            "No se pueden registrar recepciones con más de 30 días de antigüedad",
        },
      ],
    });
  }

  next();
};

/**
 * Middleware personalizado para validar productos en recepción
 * Valida que todos los productos tengan cantidades válidas
 */
const validateProductosBusinessRules = (req, res, next) => {
  const { productos } = req.body;

  if (!productos || !Array.isArray(productos)) {
    return next(); // Ya validado por Joi
  }

  // Regla de negocio: No permitir productos duplicados
  const productosIds = productos.map((p) => p.producto_id);
  const productosDuplicados = productosIds.filter(
    (id, index) => productosIds.indexOf(id) !== index
  );

  if (productosDuplicados.length > 0) {
    return res.status(400).json({
      success: false,
      error: "Regla de negocio violada",
      details: [
        {
          field: "productos",
          message: `Productos duplicados encontrados: ${productosDuplicados.join(
            ", "
          )}`,
        },
      ],
    });
  }

  // Regla de negocio: Validar que el subtotal calculado sea correcto
  const errores = [];
  productos.forEach((producto, index) => {
    const subtotalCalculado = parseFloat(
      (producto.cantidad * producto.precio_unitario).toFixed(2)
    );

    // Permitir pequeñas diferencias por redondeo (0.01)
    if (
      producto.subtotal &&
      Math.abs(producto.subtotal - subtotalCalculado) > 0.01
    ) {
      errores.push({
        field: `productos[${index}].subtotal`,
        message: `Subtotal incorrecto. Esperado: ${subtotalCalculado}, Recibido: ${producto.subtotal}`,
      });
    }
  });

  if (errores.length > 0) {
    return res.status(400).json({
      success: false,
      error: "Errores en cálculo de subtotales",
      details: errores,
    });
  }

  next();
};

// =====================================================
// 📤 EXPORTACIONES LIMPIAS
// =====================================================

export {
  // Schemas (para uso directo si necesario)
  recepcionesSchemas,

  // Middlewares específicos listos para rutas
  validateCreateRecepcion,
  validateUpdateRecepcion,
  validateRecepcionId,
  validateGetRecepcionesQuery,
  validateGetRecepcionByIdQuery,
  validateProcesarRecepcion,

  // Middlewares compuestos (opcional para rutas complejas)
  validateCompleteRecepcionCreation,
  validateCompleteRecepcionUpdate,
  validateGetSpecificRecepcion,
  validateCompleteRecepcionProcessing,
  validateRecepcionCancellation,

  // Validaciones de negocio adicionales (opcional)
  validateBusinessDateRules,
  validateProductosBusinessRules,
};
