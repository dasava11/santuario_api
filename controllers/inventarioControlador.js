// controllers/inventarioControlador.js
import inventarioService from "../services/inventarioService.js";
import {
  buildSuccessResponse,
  createControllerLogger,
  buildOperationMetadata,
  buildBusinessErrorResponse,
  generateSuccessMessage,
  asyncControllerWrapper,
} from "../utils/controllerResponseUtils.js";

const logger = createControllerLogger("inventario");

// =====================================================
// CONSULTAS - MOVIMIENTOS
// =====================================================

/**
 * Obtener movimientos de inventario con filtros
 */
const obtenerMovimientos = asyncControllerWrapper(async (req, res) => {
  const result = await inventarioService.obtenerMovimientosFiltrados(req.query);

  const metadata = buildOperationMetadata("consulta_movimientos", null, {
    ...result.metadata,
    tiempo_consulta_ms: performance.now() - req.startTime,
  });

  if (result.fromCache) {
    logger.cache("HIT", "movimientos:list");
  } else {
    logger.cache("MISS → SET", "movimientos:list");
  }

  res.json(
    buildSuccessResponse(
      {
        movimientos: result.data,
        pagination: result.pagination,
      },
      metadata,
      result.fromCache
    )
  );
}, "consulta de movimientos");

// =====================================================
// CONSULTAS - STOCK BAJO Y ALERTAS
// =====================================================

/**
 * Obtener productos con stock bajo
 */
const obtenerProductosStockBajo = asyncControllerWrapper(async (req, res) => {
  const result = await inventarioService.obtenerProductosStockBajo();

  const metadata = buildOperationMetadata("consulta_stock_bajo", null, {
    timestamp: new Date().toISOString(),
  });

  if (result.fromCache) {
    logger.cache("HIT", "inventario:stock_bajo");
  } else {
    logger.cache("MISS → SET", "inventario:stock_bajo");
  }

  res.json(buildSuccessResponse(result.data, metadata, result.fromCache));
}, "consulta de productos con stock bajo");

/**
 * Obtener alertas críticas de inventario
 */
const obtenerAlertasCriticas = asyncControllerWrapper(async (req, res) => {
  const result = await inventarioService.obtenerAlertasCriticas();

  const metadata = buildOperationMetadata("consulta_alertas_criticas", null, {
    timestamp: new Date().toISOString(),
  });

  if (result.fromCache) {
    logger.cache("HIT", "inventario:alertas");
  } else {
    logger.cache("MISS → SET", "inventario:alertas");
  }

  res.json(buildSuccessResponse(result.data, metadata, result.fromCache));
}, "consulta de alertas críticas");

// =====================================================
// CONSULTAS - RESUMEN Y VALOR
// =====================================================

/**
 * Obtener resumen general del inventario
 */
const obtenerResumenInventario = asyncControllerWrapper(async (req, res) => {
  const result = await inventarioService.obtenerResumenInventario();

  const metadata = buildOperationMetadata("consulta_resumen", null, {
    ...result.metadata,
    tiempo_consulta_ms: performance.now() - req.startTime,
  });

  if (result.fromCache) {
    logger.cache("HIT", "inventario:resumen");
  } else {
    logger.cache("MISS → SET", "inventario:resumen");
  }

  res.json(buildSuccessResponse(result.data, metadata, result.fromCache));
}, "consulta de resumen de inventario");

/**
 * Obtener valor total del inventario
 */
const obtenerValorInventario = asyncControllerWrapper(async (req, res) => {
  const result = await inventarioService.obtenerValorInventario();

  const metadata = buildOperationMetadata("consulta_valor", null, {
    timestamp: new Date().toISOString(),
  });

  if (result.fromCache) {
    logger.cache("HIT", "inventario:valor");
  } else {
    logger.cache("MISS → SET", "inventario:valor");
  }

  res.json(buildSuccessResponse(result.data, metadata, result.fromCache));
}, "consulta de valor de inventario");

// =====================================================
// CONSULTAS - ESTADÍSTICAS Y REPORTES
// =====================================================

/**
 * Obtener estadísticas de movimientos
 */
const obtenerEstadisticasMovimientos = asyncControllerWrapper(
  async (req, res) => {
    const { dias } = req.query;
    const result = await inventarioService.obtenerEstadisticasMovimientos(dias);

    const metadata = buildOperationMetadata("consulta_estadisticas", null, {
      ...result.metadata,
    });

    if (result.fromCache) {
      logger.cache("HIT", `inventario:estadisticas:${dias}`);
    } else {
      logger.cache("MISS → SET", `inventario:estadisticas:${dias}`);
    }

    res.json(buildSuccessResponse(result.data, metadata, result.fromCache));
  },
  "consulta de estadísticas de movimientos"
);

/**
 * Obtener reporte de movimientos por producto
 */
const obtenerReporteMovimientosPorProducto = asyncControllerWrapper(
  async (req, res) => {
    const { producto_id } = req.params;

    try {
      const result =
        await inventarioService.obtenerReporteMovimientosPorProducto(
          producto_id,
          req.query
        );

      const metadata = buildOperationMetadata(
        "consulta_reporte_producto",
        producto_id,
        result.metadata
      );

      if (result.fromCache) {
        logger.cache("HIT", `inventario:reporte:${producto_id}`);
      } else {
        logger.cache("MISS → SET", `inventario:reporte:${producto_id}`);
      }

      res.json(buildSuccessResponse(result.data, metadata, result.fromCache));
    } catch (error) {
      if (error.message === "PRODUCTO_NOT_FOUND") {
        return res.status(404).json(
          buildBusinessErrorResponse("Producto no encontrado", {
            producto_id,
          })
        );
      }
      throw error;
    }
  },
  "consulta de reporte por producto"
);

// =====================================================
// OPERACIONES - ACTUALIZAR STOCK
// =====================================================

/**
 * Actualizar stock de producto (movimiento normal)
 */
const actualizarStock = asyncControllerWrapper(async (req, res) => {
  const { id } = req.params;

  try {
    const result = await inventarioService.actualizarStock(
      id,
      req.body,
      req.user.id
    );

    const metadata = buildOperationMetadata("actualizacion_stock", id, {
      stock_anterior: result.stock_anterior,
      stock_nuevo: result.stock_nuevo,
      tipo_movimiento: result.tipo_movimiento,
    });

    logger.business("Stock actualizado", {
      producto_id: id,
      tipo: result.tipo_movimiento,
      cantidad: result.movimiento,
      usuario_id: req.user.id,
    });

    const mensaje = `Stock actualizado exitosamente: ${result.tipo_movimiento} de ${result.movimiento} unidades`;

    res.json(
      buildSuccessResponse(
        {
          mensaje,
          stock_anterior: result.stock_anterior,
          stock_nuevo: result.stock_nuevo,
          movimiento: result.movimiento,
          tipo_movimiento: result.tipo_movimiento,
        },
        metadata
      )
    );
  } catch (error) {
    if (error.message === "PRODUCTO_NOT_FOUND") {
      return res.status(404).json(
        buildBusinessErrorResponse("Producto no encontrado", {
          producto_id: id,
        })
      );
    }

    if (error.message === "STOCK_INSUFICIENTE") {
      return res.status(400).json(
        buildBusinessErrorResponse(
          "Stock insuficiente para realizar la operación",
          {
            tipo_error: "stock_insuficiente",
            sugerencia: "Verifique la cantidad disponible antes de la salida",
          }
        )
      );
    }

    if (error.message === "TIPO_MOVIMIENTO_INVALIDO") {
      return res.status(400).json(
        buildBusinessErrorResponse("Tipo de movimiento inválido", {
          tipos_validos: ["entrada", "salida", "ajuste"],
        })
      );
    }

    throw error;
  }
}, "actualización de stock");

// =====================================================
// OPERACIONES - AJUSTAR INVENTARIO
// =====================================================

/**
 * Ajustar inventario (corrección directa de stock)
 */

const ajustarInventario = asyncControllerWrapper(async (req, res) => {
  const { producto_id, nuevo_stock, observaciones } = req.body;

  try {
    const result = await inventarioService.ajustarInventario(
      producto_id,
      nuevo_stock,
      observaciones,
      req.user.id
    );

    const metadata = buildOperationMetadata("ajuste_inventario", producto_id, {
      stock_anterior: result.stock_anterior,
      stock_nuevo: result.stock_nuevo,
      diferencia: result.diferencia,
      diferencia_porcentaje: result.diferencia_porcentaje,
      tipo_ajuste: result.tipo_ajuste,
    });

    logger.business("Inventario ajustado", {
      producto_id,
      producto_nombre: result.producto.nombre,
      tipo_ajuste: result.tipo_ajuste,
      diferencia: Math.abs(result.diferencia),
      usuario_id: req.user.id,
    });

    const mensaje = `Ajuste de inventario realizado exitosamente: ${
      result.tipo_ajuste
    } de ${Math.abs(result.diferencia).toFixed(3)} unidades (${
      result.diferencia_porcentaje
    }% cambio)`;

    // ✅ NUEVO: Incluir advertencia si queda stock bajo
    const responseData = {
      mensaje,
      stock_anterior: result.stock_anterior,
      stock_nuevo: result.stock_nuevo,
      diferencia: result.diferencia,
      diferencia_porcentaje: result.diferencia_porcentaje,
      tipo_ajuste: result.tipo_ajuste,
      producto: result.producto,
    };

    if (result.alerta_stock_bajo) {
      responseData.advertencia = `⚠️ El stock del producto quedó por debajo del mínimo (${result.stock_nuevo} <= ${result.producto.stock_minimo})`;
    }

    res.json(buildSuccessResponse(responseData, metadata));
  } catch (error) {
    // ===== MANEJO DE ERRORES EXISTENTES =====
    if (error.message === "PRODUCTO_NOT_FOUND") {
      return res.status(404).json(
        buildBusinessErrorResponse("Producto no encontrado o inactivo", {
          producto_id,
        })
      );
    }

    if (error.message === "STOCK_SIN_CAMBIOS") {
      return res.status(400).json(
        buildBusinessErrorResponse("El nuevo stock es igual al stock actual", {
          tipo_error: "sin_cambios",
          sugerencia: "Proporcione un valor diferente al actual",
        })
      );
    }

    // ===== NUEVOS MANEJADORES DE ERRORES =====

    // ✅ NUEVO: Stock negativo
    if (error.message === "STOCK_NO_PUEDE_SER_NEGATIVO") {
      return res.status(400).json(
        buildBusinessErrorResponse("El stock no puede ser negativo", {
          tipo_error: "stock_negativo",
          valor_enviado: nuevo_stock,
          sugerencia: "Ingrese un valor mayor o igual a 0",
        })
      );
    }

    // ✅ NUEVO: Stock excesivo
    if (error.message.startsWith("STOCK_EXCESIVO:")) {
      const [, maxStock, mensaje] = error.message.split(":");
      return res.status(400).json(
        buildBusinessErrorResponse(mensaje, {
          tipo_error: "stock_excesivo",
          valor_enviado: nuevo_stock,
          maximo_permitido: parseInt(maxStock),
          sugerencia: "Verifique que haya ingresado el valor correcto",
        })
      );
    }

    // ✅ NUEVO: Ajuste crítico sin justificación
    if (error.message.startsWith("AJUSTE_CRITICO_REQUIERE_JUSTIFICACION:")) {
      const [, porcentaje, mensaje] = error.message.split(":");
      return res.status(400).json(
        buildBusinessErrorResponse(mensaje, {
          tipo_error: "ajuste_critico_sin_justificacion",
          cambio_porcentaje: parseFloat(porcentaje),
          observaciones_actuales: observaciones || null,
          sugerencia:
            "Proporcione observaciones detalladas (mínimo 20 caracteres) explicando el motivo del ajuste",
          ejemplo:
            "Inventario físico realizado el 18/01/2025, encontradas diferencias por mermas de productos vencidos",
        })
      );
    }

    throw error;
  }
}, "ajuste de inventario");

// =====================================================
// EXPORTACIONES
// =====================================================
export {
  // Consultas - Movimientos
  obtenerMovimientos,

  // Consultas - Stock Bajo y Alertas
  obtenerProductosStockBajo,
  obtenerAlertasCriticas,

  // Consultas - Resumen y Valor
  obtenerResumenInventario,
  obtenerValorInventario,

  // Consultas - Estadísticas y Reportes
  obtenerEstadisticasMovimientos,
  obtenerReporteMovimientosPorProducto,

  // Operaciones
  actualizarStock,
  ajustarInventario,
};
