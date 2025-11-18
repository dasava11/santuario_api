// controllers/ventasControlador.js - Solo Orquestación y Respuestas
import ventasService from "../services/ventasService.js";
import {
  buildSuccessResponse,
  buildBusinessErrorResponse,
  createControllerLogger,
  handleSequelizeError,
  buildOperationMetadata,
  generateSuccessMessage,
  asyncControllerWrapper,
} from "../utils/controllerResponseUtils.js";

const logger = createControllerLogger("ventas");

// =====================================================
// OBTENER VENTAS
// =====================================================
const obtenerVentas = asyncControllerWrapper(async (req, res) => {
  const result = await ventasService.obtenerVentasFiltradas(req.query);

  const metadata = buildOperationMetadata("consulta", null, {
    ...result.metadata,
    tiempo_consulta_ms: performance.now() - req.startTime,
  });

  if (result.fromCache) {
    logger.cache("HIT", "ventas:list");
  } else {
    logger.cache("MISS → SET", "ventas:list");
  }

  res.json(
    buildSuccessResponse(
      {
        ventas: result.data,
        pagination: result.pagination,
      },
      metadata,
      result.fromCache
    )
  );
}, "consulta de ventas");

// =====================================================
// OBTENER VENTA POR ID
// =====================================================
const obtenerVentaPorId = asyncControllerWrapper(async (req, res) => {
  const { id } = req.params;
  const result = await ventasService.obtenerVentaPorId(id);

  if (!result) {
    return res.status(404).json(
      buildBusinessErrorResponse("Venta no encontrada", {
        venta_id: id,
      })
    );
  }

  const metadata = buildOperationMetadata(
    "consulta_individual",
    id,
    result.metadata
  );

  if (result.fromCache) {
    logger.cache("HIT", `venta:${id}`);
  } else {
    logger.cache("MISS → SET", `venta:${id}`);
  }

  res.json(buildSuccessResponse(result.data, metadata, result.fromCache));
}, "consulta de venta");

// =====================================================
// CREAR VENTA
// =====================================================
const crearVenta = asyncControllerWrapper(async (req, res) => {
  try {
    const nuevaVenta = await ventasService.crearVenta(req.body, req.user.id);

    const metadata = buildOperationMetadata("creacion", nuevaVenta.id);

    logger.business("Venta creada", {
      id: nuevaVenta.id,
      numero_venta: nuevaVenta.numero_venta,
      total: nuevaVenta.total,
      usuario: req.user.id,
    });

    const mensaje = generateSuccessMessage(
      "crear",
      "Venta",
      nuevaVenta.numero_venta
    );

    res.status(201).json(
      buildSuccessResponse(
        {
          mensaje,
          venta: {
            id: nuevaVenta.id,
            numero_venta: nuevaVenta.numero_venta,
            total: nuevaVenta.total,
            metodo_pago: nuevaVenta.metodo_pago,
            estado: nuevaVenta.estado,
            fecha_venta: nuevaVenta.fecha_venta,
          },
        },
        metadata
      )
    );
  } catch (error) {
    // Manejo de errores de negocio específicos
    if (error.message.startsWith("PRODUCTO_NOT_FOUND:")) {
      const [, productoId] = error.message.split(":");
      return res.status(400).json(
        buildBusinessErrorResponse("Producto no encontrado o inactivo", {
          producto_id: parseInt(productoId),
        })
      );
    }

    if (error.message.startsWith("STOCK_INSUFICIENTE:")) {
      const [, nombre, stockActual, cantidadRequerida] =
        error.message.split(":");
      return res.status(400).json(
        buildBusinessErrorResponse("Stock insuficiente", {
          producto: nombre,
          stock_actual: parseFloat(stockActual),
          cantidad_requerida: parseFloat(cantidadRequerida),
          mensaje: `Stock insuficiente para ${nombre}. Stock actual: ${stockActual}, requerido: ${cantidadRequerida}`,
        })
      );
    }

    if (error.name?.startsWith("Sequelize")) {
      const errorResponse = handleSequelizeError(error, "creación de venta");
      return res.status(errorResponse.error.code).json(errorResponse);
    }

    throw error; // Re-throw para manejo genérico
  }
}, "creación de venta");

// =====================================================
// ANULAR VENTA
// =====================================================
const eliminarVenta = asyncControllerWrapper(async (req, res) => {
  const { id } = req.params;
  const { motivo_anulacion } = req.body;

  try {
    const venta = await ventasService.anularVenta(
      id,
      req.user.id,
      motivo_anulacion
    );

    const metadata = buildOperationMetadata("anulacion", id, {
      fecha_anulacion: venta.fecha_anulacion,
      usuario_anulacion: req.user.id,
    });

    logger.business("Venta anulada", {
      id,
      numero_venta: venta.numero_venta,
      motivo: motivo_anulacion,
      usuario: req.user.id,
    });

    const mensaje = `Venta ${venta.numero_venta} anulada exitosamente y stock revertido`;

    res.json(
      buildSuccessResponse(
        {
          mensaje,
          venta: {
            id: venta.id,
            numero_venta: venta.numero_venta,
            estado: venta.estado,
            fecha_anulacion: venta.fecha_anulacion,
          },
        },
        metadata
      )
    );
  } catch (error) {
    // Manejo de errores de negocio específicos
    if (error.message === "VENTA_NOT_FOUND_OR_ALREADY_ANULADA") {
      return res.status(404).json(
        buildBusinessErrorResponse(
          "Venta no encontrada o ya fue anulada previamente",
          {
            venta_id: id,
          }
        )
      );
    }

    if (error.message === "VENTA_ANULACION_TIME_EXCEEDED") {
      return res.status(400).json(
        buildBusinessErrorResponse(
          "No se puede anular una venta con más de 24 horas de antigüedad",
          {
            venta_id: id,
            razon:
              "Solo se pueden anular ventas dentro de las 24 horas posteriores a su creación",
          }
        )
      );
    }

    if (error.name?.startsWith("Sequelize")) {
      const errorResponse = handleSequelizeError(error, "anulación de venta");
      return res.status(errorResponse.error.code).json(errorResponse);
    }

    throw error; // Re-throw para manejo genérico
  }
}, "anulación de venta");

// =====================================================
// OBTENER RESUMEN DE VENTAS
// =====================================================
const obtenerResumenVentas = asyncControllerWrapper(async (req, res) => {
  const result = await ventasService.obtenerResumenVentas(req.query);

  const metadata = buildOperationMetadata("resumen_ventas", null, {
    ...result.metadata,
  });

  if (result.fromCache) {
    logger.cache("HIT", "ventas:resumen");
  } else {
    logger.cache("MISS → SET", "ventas:resumen");
  }

  res.json(buildSuccessResponse(result.data, metadata, result.fromCache));
}, "consulta de resumen de ventas");

// =====================================================
// EXPORTACIONES
// =====================================================
export {
  obtenerVentas,
  obtenerVentaPorId,
  crearVenta,
  eliminarVenta,
  obtenerResumenVentas,
};
