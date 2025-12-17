// controllers/recepcionesControlador.js - Solo Orquestación y Respuestas
import recepcionesService from "../services/recepcionesService.js";
import {
  buildSuccessResponse,
  buildBusinessErrorResponse,
  createControllerLogger,
  handleSequelizeError,
  buildOperationMetadata,
  generateSuccessMessage,
  asyncControllerWrapper,
} from "../utils/controllerResponseUtils.js";

const logger = createControllerLogger("recepciones");

// =====================================================
// 📊 OBTENER RECEPCIONES
// =====================================================
const obtenerRecepciones = asyncControllerWrapper(async (req, res) => {
  const result = await recepcionesService.obtenerRecepcionesFiltradas(
    req.query
  );

  const metadata = buildOperationMetadata("consulta", null, {
    ...result.metadata,
    tiempo_consulta_ms: performance.now() - req.startTime,
  });

  if (result.fromCache) {
    logger.cache("HIT", "recepciones:list");
  } else {
    logger.cache("MISS → SET", "recepciones:list");
  }

  res.json(
    buildSuccessResponse(
      {
        recepciones: result.data,
        pagination: result.pagination,
      },
      metadata,
      result.fromCache
    )
  );
}, "consulta de recepciones");

// =====================================================
// 📄 OBTENER RECEPCIÓN POR ID
// =====================================================
const obtenerRecepcionPorId = asyncControllerWrapper(async (req, res) => {
  const { id } = req.params;
  const result = await recepcionesService.obtenerRecepcionPorId(id, req.query);

  if (!result) {
    return res.status(404).json(
      buildBusinessErrorResponse("Recepción no encontrada", {
        recepcion_id: id,
      })
    );
  }

  const metadata = buildOperationMetadata(
    "consulta_individual",
    id,
    result.metadata
  );

  if (result.fromCache) {
    logger.cache("HIT", `recepcion:${id}`);
  } else {
    logger.cache("MISS → SET", `recepcion:${id}`);
  }

  res.json(buildSuccessResponse(result.data, metadata, result.fromCache));
}, "consulta de recepción");

// =====================================================
// ✨ CREAR RECEPCIÓN
// =====================================================
const crearRecepcion = asyncControllerWrapper(async (req, res) => {
  try {
    const nuevaRecepcion = await recepcionesService.crearRecepcion(
      req.body,
      req.user.id
    );

    const metadata = buildOperationMetadata("creacion", nuevaRecepcion.id);

    logger.business("Recepción creada", {
      id: nuevaRecepcion.id,
      numero_factura: nuevaRecepcion.numero_factura,
      proveedor_id: nuevaRecepcion.proveedor_id,
      total: nuevaRecepcion.total,
    });

    const mensaje = generateSuccessMessage(
      "crear",
      "Recepción",
      nuevaRecepcion.numero_factura
    );

    res.status(201).json(
      buildSuccessResponse(
        {
          mensaje,
          recepcion: {
            id: nuevaRecepcion.id,
            numero_factura: nuevaRecepcion.numero_factura,
            proveedor_id: nuevaRecepcion.proveedor_id,
            fecha_recepcion: nuevaRecepcion.fecha_recepcion,
            total: nuevaRecepcion.total,
            estado: nuevaRecepcion.estado,
            fecha_creacion: nuevaRecepcion.fecha_creacion,
          },
        },
        metadata
      )
    );
  } catch (error) {
    // Manejo de errores de negocio específicos
    if (error.message === "PROVEEDOR_NOT_FOUND_OR_INACTIVE") {
      return res.status(400).json(
        buildBusinessErrorResponse("Proveedor no encontrado o inactivo", {
          proveedor_id: req.body.proveedor_id,
        })
      );
    }

    if (error.message.startsWith("DUPLICATE_INVOICE:")) {
      const [, numeroFactura] = error.message.split(":");
      return res.status(400).json(
        buildBusinessErrorResponse(
          "Ya existe una recepción con este número de factura para este proveedor",
          {
            numero_factura: numeroFactura,
            proveedor_id: req.body.proveedor_id,
          }
        )
      );
    }

    if (error.message.startsWith("PRODUCTO_NOT_FOUND:")) {
      const [, productoId] = error.message.split(":");
      return res.status(400).json(
        buildBusinessErrorResponse("Producto no encontrado o inactivo", {
          producto_id: parseInt(productoId),
        })
      );
    }

    if (error.name?.startsWith("Sequelize")) {
      const errorResponse = handleSequelizeError(
        error,
        "creación de recepción"
      );
      return res.status(errorResponse.error.code).json(errorResponse);
    }

    throw error; // Re-throw para manejo genérico
  }
}, "creación de recepción");

// =====================================================
// 🔄 ACTUALIZAR RECEPCIÓN
// =====================================================
const actualizarRecepcion = asyncControllerWrapper(async (req, res) => {
  const { id } = req.params;

  try {
    const result = await recepcionesService.actualizarRecepcion(id, req.body);

    const metadata = buildOperationMetadata("actualizacion", id, {
      campos_modificados: result.camposModificados,
    });

    logger.business("Recepción actualizada", {
      id,
      campos: result.camposModificados,
    });

    const mensaje = generateSuccessMessage(
      "actualizar",
      "Recepción",
      result.recepcion.numero_factura
    );

    res.json(
      buildSuccessResponse(
        {
          mensaje,
          cambios_realizados: result.camposModificados,
        },
        metadata
      )
    );
  } catch (error) {
    // Manejo de errores de negocio específicos
    if (error.message === "RECEPCION_NOT_FOUND") {
      return res.status(404).json(
        buildBusinessErrorResponse("Recepción no encontrada", {
          recepcion_id: id,
        })
      );
    }

    if (error.message === "RECEPCION_NOT_EDITABLE") {
      return res.status(400).json(
        buildBusinessErrorResponse(
          "Solo se pueden modificar recepciones en estado pendiente",
          {
            recepcion_id: id,
          }
        )
      );
    }

    if (error.name?.startsWith("Sequelize")) {
      const errorResponse = handleSequelizeError(
        error,
        "actualización de recepción"
      );
      return res.status(errorResponse.error.code).json(errorResponse);
    }

    throw error; // Re-throw para manejo genérico
  }
}, "actualización de recepción");

// =====================================================
// ⚡ PROCESAR RECEPCIÓN
// =====================================================
const procesarRecepcion = asyncControllerWrapper(async (req, res) => {
  const { id } = req.params;

  try {
    const recepcion = await recepcionesService.procesarRecepcion(
      id,
      req.user.id,
      req.body
    );

    const metadata = buildOperationMetadata("procesamiento", id, {
      fecha_procesamiento: new Date().toISOString(),
      usuario_proceso: req.user.id,
    });

    logger.business("Recepción procesada", {
      id,
      numero_factura: recepcion.numero_factura,
      usuario: req.user.id,
      // Incluir información de advertencias
      ...(resultado.advertencias && {
        advertencias: resultado.advertencias,
      }),
    });

    //  Log mejorado con contexto de advertencias
    logger.business("Recepción procesada", {
      id,
      numero_factura: resultado.recepcion.numero_factura,
      usuario: req.user.id,
      // Incluir advertencias en log
      ...(resultado.advertencias && {
        productos_inactivos: resultado.advertencias.productos_inactivos.length,
      }),
    });

    const mensaje = generateSuccessMessage(
      "procesar",
      "Recepción",
      recepcion.numero_factura
    );

    // Respuesta con advertencias si existen
    const responseData = {
      mensaje,
      recepcion: {
        id: resultado.recepcion.id,
        numero_factura: resultado.recepcion.numero_factura,
        estado: resultado.recepcion.estado,
      },
      // Incluir advertencias en respuesta
      ...(resultado.advertencias && {
        advertencias: {
          tipo: "productos_inactivos",
          mensaje: resultado.advertencias.mensaje,
          productos: resultado.advertencias.productos_inactivos,
          accion_recomendada:
            "Revisar inventario y considerar reactivar productos si hay stock disponible",
        },
      }),
    };

    res.json(
      buildSuccessResponse(
        {
          mensaje,
          recepcion: {
            id: recepcion.id,
            numero_factura: recepcion.numero_factura,
            estado: recepcion.estado,
          },
        },
        metadata
      )
    );
  } catch (error) {
    // Manejador existente
    if (error.message === "RECEPCION_NOT_PROCESSABLE") {
      return res.status(400).json(
        buildBusinessErrorResponse(
          "Recepción no encontrada o no se puede procesar",
          {
            recepcion_id: id,
            razon:
              "La recepción debe estar en estado 'pendiente' para procesarse",
          }
        )
      );
    }

    if (error.name?.startsWith("Sequelize")) {
      const errorResponse = handleSequelizeError(
        error,
        "procesamiento de recepción"
      );
      return res.status(errorResponse.error.code).json(errorResponse);
    }

    throw error;
  }
}, "procesamiento de recepción");

// =====================================================
// 🗑️ CANCELAR RECEPCIÓN
// =====================================================
const cancelarRecepcion = asyncControllerWrapper(async (req, res) => {
  const { id } = req.params;

  try {
    const recepcion = await recepcionesService.cancelarRecepcion(id);

    const metadata = buildOperationMetadata("cancelacion", id, {
      fecha_cancelacion: new Date().toISOString(),
    });

    logger.business("Recepción cancelada", {
      id,
      numero_factura: recepcion.numero_factura,
    });

    const mensaje = generateSuccessMessage(
      "cancelar",
      "Recepción",
      recepcion.numero_factura
    );

    res.json(
      buildSuccessResponse(
        {
          mensaje,
          recepcion: {
            id: recepcion.id,
            numero_factura: recepcion.numero_factura,
            estado: recepcion.estado,
          },
        },
        metadata
      )
    );
  } catch (error) {
    // Manejo de errores de negocio específicos
    if (error.message === "RECEPCION_NOT_CANCELLABLE") {
      return res.status(400).json(
        buildBusinessErrorResponse(
          "Recepción no encontrada o no se puede cancelar",
          {
            recepcion_id: id,
            razon: "Solo se pueden cancelar recepciones en estado 'pendiente'",
          }
        )
      );
    }

    if (error.name?.startsWith("Sequelize")) {
      const errorResponse = handleSequelizeError(
        error,
        "cancelación de recepción"
      );
      return res.status(errorResponse.error.code).json(errorResponse);
    }

    throw error; // Re-throw para manejo genérico
  }
}, "cancelación de recepción");

// =====================================================
// 📊 ESTADÍSTICAS DE RECEPCIONES
// =====================================================
const obtenerEstadisticasRecepciones = asyncControllerWrapper(
  async (req, res) => {
    const result = await recepcionesService.obtenerEstadisticasCompletas(
      req.query
    );

    const metadata = buildOperationMetadata(
      "estadisticas_completas",
      null,
      result.metadata
    );

    if (result.fromCache) {
      logger.cache("HIT", "recepciones:estadisticas");
    } else {
      logger.cache("MISS → SET", "recepciones:estadisticas");
    }

    res.json(buildSuccessResponse(result.data, metadata, result.fromCache));
  },
  "consulta de estadísticas"
);

// =====================================================
// 📤 EXPORTACIONES
// =====================================================
export {
  obtenerRecepciones,
  obtenerRecepcionPorId,
  crearRecepcion,
  actualizarRecepcion,
  procesarRecepcion,
  cancelarRecepcion,
  obtenerEstadisticasRecepciones,
};
