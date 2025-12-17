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

  // ✅ NUEVO: Validar que si hay una fecha, debe haber ambas
  if ((fecha_inicio && !fecha_fin) || (fecha_fin && !fecha_inicio)) {
    return res.status(400).json({
      success: false,
      error: "Debes proporcionar tanto fecha_inicio como fecha_fin",
      details: {
        fecha_inicio: fecha_inicio || null,
        fecha_fin: fecha_fin || null,
      },
      sugerencia:
        "Usa ambas fechas para evitar consultas costosas sin límite temporal",
    });
  }

  // Si no hay fechas, continuar (query sin filtro de fechas es válido)
  if (!fecha_inicio && !fecha_fin) {
    return next();
  }

  // Si llegamos aquí, ambas fechas existen
  const inicio = new Date(fecha_inicio);
  const fin = new Date(fecha_fin);
  const hoy = new Date();
  hoy.setHours(23, 59, 59, 999); // Final del día de hoy

  // ✅ NUEVO: Validar formatos de fecha inválidos
  if (isNaN(inicio.getTime()) || isNaN(fin.getTime())) {
    return res.status(400).json({
      success: false,
      error: "Formato de fecha inválido",
      details: {
        fecha_inicio,
        fecha_fin,
        formato_esperado: "YYYY-MM-DD",
      },
      ejemplo: "2025-01-15",
    });
  }

  // ✅ NUEVO: Validar que inicio <= fin
  if (inicio > fin) {
    return res.status(400).json({
      success: false,
      error: "La fecha de inicio debe ser menor o igual a la fecha de fin",
      details: {
        fecha_inicio,
        fecha_fin,
        dias_diferencia: Math.ceil((inicio - fin) / (24 * 60 * 60 * 1000)),
      },
    });
  }

  // Validar que las fechas no sean futuras
  if (inicio > hoy || fin > hoy) {
    return res.status(400).json({
      success: false,
      error: "Las fechas no pueden ser futuras",
      details: {
        fecha_inicio,
        fecha_fin,
        fecha_actual: new Date().toISOString().split("T")[0],
      },
    });
  }

  // Validar que el rango no sea mayor a 1 año
  const unAnio = 365 * 24 * 60 * 60 * 1000;
  const rangoMs = fin - inicio;

  if (rangoMs > unAnio) {
    return res.status(400).json({
      success: false,
      error: "El rango de fechas no puede ser mayor a 1 año",
      details: {
        dias_solicitados: Math.ceil(rangoMs / (24 * 60 * 60 * 1000)),
        maximo_permitido: 365,
      },
      sugerencia: "Divide tu consulta en períodos más pequeños",
    });
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
