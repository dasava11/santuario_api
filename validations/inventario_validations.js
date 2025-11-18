// validations/inventario_validations.js
import { validate, validateSource } from "../middleware/validation.js";
import {
  ajustarInventario,
  actualizarStock,
  getMovimientos,
  getReporteProducto,
  getEstadisticas,
  productoId,
  stockId,
  inventarioSchemas,
} from "./schemas/inventarioSchemas.js";

// =====================================================
// MIDDLEWARES ESPECÍFICOS PARA INVENTARIO
// =====================================================

/**
 * Validar datos para ajustar inventario
 * Corrección directa de stock (solo administradores/dueños)
 */
const validateAjustarInventario = validate(ajustarInventario);

/**
 * Validar datos para actualizar stock
 * Movimientos normales de entrada/salida
 */
const validateActualizarStock = validate(actualizarStock);

/**
 * Validar ID de producto en parámetros (producto_id)
 */
const validateProductoId = validateSource(productoId, "params");

/**
 * Validar ID en parámetros (id)
 */
const validateStockId = validateSource(stockId, "params");

/**
 * Validar query parameters para obtener movimientos
 * Incluye paginación y filtros (producto, tipo, fechas)
 */
const validateGetMovimientosQuery = validateSource(getMovimientos, "query", {
  abortEarly: false,
  stripUnknown: true,
  convert: true,
  allowUnknown: false,
});

/**
 * Validar query parameters para reporte por producto
 * Incluye fechas y límite
 */
const validateGetReporteProductoQuery = validateSource(
  getReporteProducto,
  "query",
  {
    abortEarly: false,
    stripUnknown: true,
    convert: true,
    allowUnknown: false,
  }
);

/**
 * Validar query parameters para estadísticas
 * Incluye período en días
 */
const validateGetEstadisticasQuery = validateSource(getEstadisticas, "query", {
  abortEarly: false,
  stripUnknown: true,
  convert: true,
  allowUnknown: false,
});

// =====================================================
// MIDDLEWARES DE VALIDACIÓN DE NEGOCIO
// =====================================================

/**
 * Middleware para validar rangos de fechas
 * Evita fechas futuras y rangos mayores a 1 año
 */
const validateDateRange = (req, res, next) => {
  const { fecha_inicio, fecha_fin } = req.query;

  if (fecha_inicio && fecha_fin) {
    const inicio = new Date(fecha_inicio);
    const fin = new Date(fecha_fin);
    const hoy = new Date();

    // Validar que las fechas no sean futuras
    if (inicio > hoy || fin > hoy) {
      return res.status(400).json({
        success: false,
        error: "Las fechas no pueden ser futuras",
        details: {
          fecha_inicio: fecha_inicio,
          fecha_fin: fecha_fin,
          fecha_actual: hoy.toISOString().split("T")[0],
        },
      });
    }

    // Validar que el rango no sea mayor a 1 año
    const unAnio = 365 * 24 * 60 * 60 * 1000;
    if (fin - inicio > unAnio) {
      return res.status(400).json({
        success: false,
        error: "El rango de fechas no puede ser mayor a 1 año",
        details: {
          dias_solicitados: Math.ceil((fin - inicio) / (24 * 60 * 60 * 1000)),
          maximo_permitido: 365,
        },
      });
    }
  }

  next();
};

// =====================================================
// MIDDLEWARES COMPUESTOS (OPCIONAL)
// =====================================================

/**
 * Middleware compuesto para ajuste de inventario completo
 */
const validateCompleteInventoryAdjustment = [validateAjustarInventario];

/**
 * Middleware compuesto para actualización de stock completa
 */
const validateCompleteStockUpdate = [validateStockId, validateActualizarStock];

/**
 * Middleware compuesto para consulta de movimientos con validación de fechas
 */
const validateCompleteMovimientosQuery = [
  validateGetMovimientosQuery,
  validateDateRange,
];

/**
 * Middleware compuesto para reporte por producto con validación de fechas
 */
const validateCompleteReporteProducto = [
  validateProductoId,
  validateGetReporteProductoQuery,
  validateDateRange,
];

// =====================================================
// EXPORTACIONES LIMPIAS
// =====================================================

export {
  // Schemas (para uso directo si necesario)
  inventarioSchemas,

  // Middlewares específicos listos para rutas
  validateAjustarInventario,
  validateActualizarStock,
  validateProductoId,
  validateStockId,
  validateGetMovimientosQuery,
  validateGetReporteProductoQuery,
  validateGetEstadisticasQuery,

  // Middlewares de validación de negocio
  validateDateRange,

  // Middlewares compuestos (opcional para rutas complejas)
  validateCompleteInventoryAdjustment,
  validateCompleteStockUpdate,
  validateCompleteMovimientosQuery,
  validateCompleteReporteProducto,
};
