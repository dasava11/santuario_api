// services/inventarioService.js
import { sequelize, Op } from "../config/database.js";
import db from "../models/index.js";
import {
  cacheGet,
  cacheSet,
  CACHE_TTL,
  CACHE_PREFIXES,
  invalidateStockUpdateCache,
  invalidateInventoryCache,
  invalidateMovimientosListCache,
  generateCacheKey,
} from "./cacheService.js";

const { movimientos_inventario, productos, categorias, usuarios } = db;

// =====================================================
// OPERACIONES DE CONSULTA - MOVIMIENTOS
// =====================================================

/**
 * Obtiene movimientos de inventario con filtros y paginación
 */
const obtenerMovimientosFiltrados = async (filtros) => {
  const {
    producto_id,
    tipo_movimiento,
    fecha_inicio,
    fecha_fin,
    page = 1,
    limit = 20,
  } = filtros;

  const cacheKey = generateCacheKey(CACHE_PREFIXES.MOVIMIENTOS_LIST, filtros);
  const cached = await cacheGet(cacheKey);
  if (cached) return { ...cached, fromCache: true };

  const where = {};

  if (producto_id) where.producto_id = producto_id;
  if (tipo_movimiento) where.tipo_movimiento = tipo_movimiento;

  // Filtro de fecha
  if (fecha_inicio && fecha_fin) {
    where.fecha_movimiento = {
      [Op.between]: [
        new Date(fecha_inicio + " 00:00:00"),
        new Date(fecha_fin + " 23:59:59"),
      ],
    };
  } else if (fecha_inicio) {
    where.fecha_movimiento = { [Op.gte]: new Date(fecha_inicio + " 00:00:00") };
  } else if (fecha_fin) {
    where.fecha_movimiento = { [Op.lte]: new Date(fecha_fin + " 23:59:59") };
  }

  const offset = (parseInt(page) - 1) * parseInt(limit);

  const { count, rows: movimientos } =
    await movimientos_inventario.findAndCountAll({
      where,
      include: [
        {
          model: productos,
          as: "producto",
          attributes: ["id", "nombre", "codigo_barras", "tipo_medida"],
          include: [
            {
              model: categorias,
              as: "categoria",
              attributes: ["nombre"],
            },
          ],
        },
        {
          model: usuarios,
          as: "usuario",
          attributes: ["id", "nombre", "apellido"],
        },
      ],
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [["fecha_movimiento", "DESC"]],
      distinct: true,
    });

  const result = {
    data: movimientos,
    metadata: {
      total_movimientos: count,
      filtros_aplicados: Object.keys(where).length,
    },
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total: count,
      pages: Math.ceil(count / limit),
    },
    fromCache: false,
  };

  await cacheSet(cacheKey, result, CACHE_TTL.MOVIMIENTOS_PAGINADOS);
  return result;
};

// =====================================================
// OPERACIONES DE CONSULTA - STOCK BAJO Y ALERTAS
// =====================================================

/**
 * Obtiene productos con stock bajo
 */
const obtenerProductosStockBajo = async () => {
  const cacheKey = generateCacheKey(CACHE_PREFIXES.INVENTARIO_STOCK_BAJO, {});
  const cached = await cacheGet(cacheKey);
  if (cached) return { ...cached, fromCache: true };

  const productosStockBajo = await productos.findAll({
    where: {
      [Op.and]: [
        sequelize.where(
          sequelize.col("stock_actual"),
          "<=",
          sequelize.col("stock_minimo")
        ),
        { activo: true },
      ],
    },
    include: [
      {
        model: categorias,
        as: "categoria",
        attributes: ["id", "nombre"],
      },
    ],
    attributes: [
      "id",
      "nombre",
      "codigo_barras",
      "stock_actual",
      "stock_minimo",
      "precio_venta",
      "tipo_medida",
      [
        sequelize.literal(
          "CASE WHEN stock_actual <= 0 THEN 999 ELSE (stock_actual - stock_minimo) END"
        ),
        "criticidad",
      ],
    ],
    order: [
      [sequelize.literal("criticidad"), "ASC"],
      ["nombre", "ASC"],
    ],
  });

  const clasificacion = {
    sin_stock: productosStockBajo.filter((p) => p.stock_actual <= 0),
    critico: productosStockBajo.filter(
      (p) => p.stock_actual > 0 && p.stock_actual < p.stock_minimo * 0.5
    ),
    bajo: productosStockBajo.filter(
      (p) =>
        p.stock_actual >= p.stock_minimo * 0.5 &&
        p.stock_actual <= p.stock_minimo
    ),
  };

  const result = {
    data: {
      productos_stock_bajo: productosStockBajo,
      clasificacion,
      resumen: {
        total_productos_criticos: productosStockBajo.length,
        sin_stock: clasificacion.sin_stock.length,
        critico: clasificacion.critico.length,
        bajo: clasificacion.bajo.length,
      },
    },
    metadata: {},
    fromCache: false,
  };

  await cacheSet(cacheKey, result, CACHE_TTL.INVENTARIO_STOCK_BAJO);
  return result;
};

/**
 * Obtiene alertas críticas de inventario
 */
const obtenerAlertasCriticas = async () => {
  const cacheKey = generateCacheKey(CACHE_PREFIXES.INVENTARIO_ALERTAS, {});
  const cached = await cacheGet(cacheKey);
  if (cached) return { ...cached, fromCache: true };

  const alertas = await productos.findAll({
    where: {
      [Op.and]: [
        { activo: true },
        sequelize.where(
          sequelize.col("stock_actual"),
          "<=",
          sequelize.literal("stock_minimo * 0.3")
        ),
      ],
    },
    include: [
      {
        model: categorias,
        as: "categoria",
        attributes: ["nombre"],
      },
    ],
    attributes: [
      "id",
      "nombre",
      "codigo_barras",
      "stock_actual",
      "stock_minimo",
      "precio_venta",
      "tipo_medida",
      [
        sequelize.literal(`CASE 
          WHEN stock_actual <= 0 THEN "SIN_STOCK" 
          WHEN stock_actual <= stock_minimo * 0.1 THEN "CRITICO"
          WHEN stock_actual <= stock_minimo * 0.3 THEN "URGENTE"
          ELSE "NORMAL" 
        END`),
        "nivel_alerta",
      ],
    ],
    order: [
      [sequelize.literal("stock_actual"), "ASC"],
      ["nombre", "ASC"],
    ],
    limit: 50,
  });

  const clasificacion = {
    sin_stock: alertas.filter((p) => p.dataValues.nivel_alerta === "SIN_STOCK"),
    critico: alertas.filter((p) => p.dataValues.nivel_alerta === "CRITICO"),
    urgente: alertas.filter((p) => p.dataValues.nivel_alerta === "URGENTE"),
  };

  const result = {
    data: {
      alertas,
      clasificacion,
      resumen: {
        total_alertas: alertas.length,
        sin_stock: clasificacion.sin_stock.length,
        critico: clasificacion.critico.length,
        urgente: clasificacion.urgente.length,
      },
    },
    metadata: {
      para_supermercado: "Alertas críticas para reposición inmediata",
    },
    fromCache: false,
  };

  await cacheSet(cacheKey, result, CACHE_TTL.INVENTARIO_ALERTAS);
  return result;
};

// =====================================================
// OPERACIONES DE CONSULTA - RESUMEN Y VALOR
// =====================================================

/**
 * Obtiene resumen general del inventario
 */
const obtenerResumenInventario = async () => {
  const cacheKey = generateCacheKey(CACHE_PREFIXES.INVENTARIO_RESUMEN, {});
  const cached = await cacheGet(cacheKey);
  if (cached) return { ...cached, fromCache: true };

  const [
    totalProductos,
    productosStockBajo,
    productosSinStock,
    valorInventario,
    categoriasResumen,
    movimientosRecientes,
  ] = await Promise.all([
    productos.count({ where: { activo: true } }),

    productos.count({
      where: {
        [Op.and]: [
          sequelize.where(
            sequelize.col("stock_actual"),
            "<=",
            sequelize.col("stock_minimo")
          ),
          { activo: true },
        ],
      },
    }),

    productos.count({
      where: { activo: true, stock_actual: { [Op.lte]: 0 } },
    }),

    productos.findOne({
      attributes: [
        [
          sequelize.fn(
            "COALESCE",
            sequelize.fn(
              "SUM",
              sequelize.literal("stock_actual * precio_compra")
            ),
            0
          ),
          "valor_compra",
        ],
        [
          sequelize.fn(
            "COALESCE",
            sequelize.fn(
              "SUM",
              sequelize.literal("stock_actual * precio_venta")
            ),
            0
          ),
          "valor_venta",
        ],
        [sequelize.fn("SUM", sequelize.col("stock_actual")), "total_unidades"],
      ],
      where: { activo: true },
      raw: true,
    }),

    categorias.findAll({
      attributes: [
        "id",
        "nombre",
        [
          sequelize.fn("COUNT", sequelize.col("productos.id")),
          "total_productos",
        ],
        [
          sequelize.fn(
            "COALESCE",
            sequelize.fn("SUM", sequelize.col("productos.stock_actual")),
            0
          ),
          "total_stock",
        ],
        [
          sequelize.fn(
            "COALESCE",
            sequelize.fn(
              "SUM",
              sequelize.literal(
                "productos.stock_actual * productos.precio_venta"
              )
            ),
            0
          ),
          "valor_categoria",
        ],
      ],
      include: [
        {
          model: productos,
          as: "productos",
          where: { activo: true },
          attributes: [],
          required: false,
        },
      ],
      where: { activo: true },
      group: ["categorias.id", "categorias.nombre"],
      order: [[sequelize.literal("total_productos"), "DESC"]],
      limit: 10,
      raw: true,
    }),

    (() => {
      const fechaInicio = new Date();
      fechaInicio.setDate(fechaInicio.getDate() - 7);

      return movimientos_inventario.findAll({
        attributes: [
          "tipo_movimiento",
          [sequelize.fn("COUNT", "*"), "cantidad"],
          [sequelize.fn("DATE", sequelize.col("fecha_movimiento")), "fecha"],
          [sequelize.fn("SUM", sequelize.col("cantidad")), "total_cantidad"],
        ],
        where: { fecha_movimiento: { [Op.gte]: fechaInicio } },
        group: [
          "tipo_movimiento",
          sequelize.fn("DATE", sequelize.col("fecha_movimiento")),
        ],
        order: [
          [sequelize.fn("DATE", sequelize.col("fecha_movimiento")), "DESC"],
          ["tipo_movimiento", "ASC"],
        ],
        raw: true,
      });
    })(),
  ]);

  const metricas = {
    rotacion_promedio:
      totalProductos > 0
        ? (
            movimientosRecientes.reduce(
              (acc, mov) =>
                mov.tipo_movimiento === "salida"
                  ? acc + parseInt(mov.cantidad)
                  : acc,
              0
            ) / totalProductos
          ).toFixed(2)
        : 0,

    porcentaje_stock_bajo:
      totalProductos > 0
        ? ((productosStockBajo / totalProductos) * 100).toFixed(1)
        : 0,

    porcentaje_sin_stock:
      totalProductos > 0
        ? ((productosSinStock / totalProductos) * 100).toFixed(1)
        : 0,
  };

  const result = {
    data: {
      resumen_general: {
        total_productos: totalProductos,
        productos_stock_bajo: productosStockBajo,
        productos_sin_stock: productosSinStock,
        valor_inventario: valorInventario,
        metricas,
      },
      categorias_resumen: categoriasResumen,
      movimientos_recientes: movimientosRecientes,
      periodo_analisis: "7 días",
    },
    metadata: {},
    fromCache: false,
  };

  await cacheSet(cacheKey, result, CACHE_TTL.INVENTARIO_RESUMEN);
  return result;
};

/**
 * Obtiene valor total del inventario con breakdown por categoría
 */
const obtenerValorInventario = async () => {
  const cacheKey = generateCacheKey(CACHE_PREFIXES.INVENTARIO_VALOR, {});
  const cached = await cacheGet(cacheKey);
  if (cached) return { ...cached, fromCache: true };

  const valorPorCategoria = await productos.findAll({
    attributes: [
      "categoria_id",
      [sequelize.fn("COUNT", sequelize.col("productos.id")), "total_productos"],
      [
        sequelize.fn("SUM", sequelize.literal("precio_compra * stock_actual")),
        "valor_compra",
      ],
      [
        sequelize.fn("SUM", sequelize.literal("precio_venta * stock_actual")),
        "valor_venta",
      ],
      [sequelize.fn("SUM", sequelize.col("stock_actual")), "stock_total"],
    ],
    include: [
      {
        model: categorias,
        as: "categoria",
        attributes: ["nombre"],
      },
    ],
    where: { activo: true, stock_actual: { [Op.gt]: 0 } },
    group: ["categoria_id"],
    order: [[sequelize.literal("valor_venta"), "DESC"]],
  });

  const totales = valorPorCategoria.reduce(
    (acc, item) => {
      acc.valor_compra_total += parseFloat(item.dataValues.valor_compra || 0);
      acc.valor_venta_total += parseFloat(item.dataValues.valor_venta || 0);
      acc.productos_total += parseInt(item.dataValues.total_productos || 0);
      acc.stock_total += parseFloat(item.dataValues.stock_total || 0);
      return acc;
    },
    {
      valor_compra_total: 0,
      valor_venta_total: 0,
      productos_total: 0,
      stock_total: 0,
    }
  );

  totales.margen_potencial =
    totales.valor_venta_total - totales.valor_compra_total;
  totales.porcentaje_margen =
    totales.valor_compra_total > 0
      ? ((totales.margen_potencial / totales.valor_compra_total) * 100).toFixed(
          2
        )
      : 0;

  const result = {
    data: {
      por_categoria: valorPorCategoria,
      totales,
    },
    metadata: {},
    fromCache: false,
  };

  await cacheSet(cacheKey, result, CACHE_TTL.INVENTARIO_VALOR);
  return result;
};

// =====================================================
// OPERACIONES DE CONSULTA - ESTADÍSTICAS Y REPORTES
// =====================================================

/**
 * Obtiene estadísticas de movimientos y rotación
 */
const obtenerEstadisticasMovimientos = async (dias = 30) => {
  const cacheKey = generateCacheKey(CACHE_PREFIXES.INVENTARIO_ESTADISTICAS, {
    dias,
  });
  const cached = await cacheGet(cacheKey);
  if (cached) return { ...cached, fromCache: true };

  const fechaLimite = new Date();
  fechaLimite.setDate(fechaLimite.getDate() - parseInt(dias));

  const [productosMasVendidos, productosMenosMovidos] = await Promise.all([
    movimientos_inventario.findAll({
      attributes: [
        "producto_id",
        [sequelize.fn("SUM", sequelize.col("cantidad")), "total_vendido"],
        [
          sequelize.fn("COUNT", sequelize.col("movimientos_inventario.id")),
          "num_movimientos",
        ],
      ],
      include: [
        {
          model: productos,
          as: "producto",
          attributes: [
            "nombre",
            "codigo_barras",
            "precio_venta",
            "stock_actual",
          ],
          include: [
            {
              model: categorias,
              as: "categoria",
              attributes: ["nombre"],
            },
          ],
        },
      ],
      where: {
        tipo_movimiento: "salida",
        fecha_movimiento: { [Op.gte]: fechaLimite },
      },
      group: ["producto_id"],
      order: [[sequelize.literal("total_vendido"), "DESC"]],
      limit: 10,
    }),

    productos.findAll({
      attributes: [
        "id",
        "nombre",
        "codigo_barras",
        "stock_actual",
        "precio_venta",
        [
          sequelize.fn(
            "COALESCE",
            sequelize.fn(
              "SUM",
              sequelize.col("movimientos_inventarios.cantidad")
            ),
            0
          ),
          "movimientos_recientes",
        ],
      ],
      include: [
        {
          model: movimientos_inventario,
          as: "movimientos_inventarios",
          attributes: [],
          where: {
            tipo_movimiento: "salida",
            fecha_movimiento: { [Op.gte]: fechaLimite },
          },
          required: false,
        },
        {
          model: categorias,
          as: "categoria",
          attributes: ["nombre"],
        },
      ],
      where: {
        activo: true,
        stock_actual: { [Op.gt]: 0 },
      },
      group: ["productos.id"],
      having: sequelize.where(
        sequelize.fn(
          "COALESCE",
          sequelize.fn(
            "SUM",
            sequelize.col("movimientos_inventarios.cantidad")
          ),
          0
        ),
        { [Op.lte]: 2 }
      ),
      order: [[sequelize.literal("movimientos_recientes"), "ASC"]],
      limit: 10,
    }),
  ]);

  const result = {
    data: {
      mas_vendidos: productosMasVendidos,
      menos_movidos: productosMenosMovidos,
      periodo_dias: parseInt(dias),
      fecha_desde: fechaLimite.toISOString(),
    },
    metadata: {},
    fromCache: false,
  };

  await cacheSet(cacheKey, result, CACHE_TTL.INVENTARIO_ESTADISTICAS);
  return result;
};

/**
 * Obtiene reporte de movimientos por producto específico
 */
const obtenerReporteMovimientosPorProducto = async (productoId, opciones) => {
  const { fecha_inicio, fecha_fin, limit = 50 } = opciones;

  const cacheKey = generateCacheKey(CACHE_PREFIXES.INVENTARIO_REPORTE, {
    productoId,
    fecha_inicio: fecha_inicio || "all",
    fecha_fin: fecha_fin || "all",
    limit,
  });

  const cached = await cacheGet(cacheKey);
  if (cached) return { ...cached, fromCache: true };

  const producto = await productos.findByPk(productoId, {
    attributes: [
      "id",
      "nombre",
      "codigo_barras",
      "stock_actual",
      "stock_minimo",
    ],
    include: [
      {
        model: categorias,
        as: "categoria",
        attributes: ["id", "nombre"],
      },
    ],
  });

  if (!producto) {
    throw new Error("PRODUCTO_NOT_FOUND");
  }

  const where = { producto_id: productoId };

  if (fecha_inicio && fecha_fin) {
    where.fecha_movimiento = {
      [Op.between]: [
        new Date(fecha_inicio + " 00:00:00"),
        new Date(fecha_fin + " 23:59:59"),
      ],
    };
  }

  const [movimientos, estadisticas] = await Promise.all([
    movimientos_inventario.findAll({
      where,
      include: [
        {
          model: usuarios,
          as: "usuario",
          attributes: ["id", "nombre", "apellido"],
        },
      ],
      order: [["fecha_movimiento", "DESC"]],
      limit: parseInt(limit),
    }),

    movimientos_inventario.findOne({
      attributes: [
        [sequelize.fn("COUNT", "*"), "total_movimientos"],
        [
          sequelize.fn(
            "SUM",
            sequelize.literal(
              `CASE WHEN tipo_movimiento = 'entrada' THEN cantidad ELSE 0 END`
            )
          ),
          "total_entradas",
        ],
        [
          sequelize.fn(
            "SUM",
            sequelize.literal(
              `CASE WHEN tipo_movimiento = 'salida' THEN cantidad ELSE 0 END`
            )
          ),
          "total_salidas",
        ],
        [
          sequelize.fn(
            "SUM",
            sequelize.literal(
              `CASE WHEN tipo_movimiento = 'ajuste' THEN cantidad ELSE 0 END`
            )
          ),
          "total_ajustes",
        ],
      ],
      where,
      raw: true,
    }),
  ]);

  const result = {
    data: {
      producto,
      movimientos,
      estadisticas: {
        ...estadisticas,
        rotacion:
          estadisticas.total_salidas > 0 && producto.stock_actual > 0
            ? (estadisticas.total_salidas / producto.stock_actual).toFixed(2)
            : 0,
      },
      filtros_aplicados: {
        fecha_inicio: fecha_inicio || null,
        fecha_fin: fecha_fin || null,
        limite: parseInt(limit),
      },
    },
    metadata: {},
    fromCache: false,
  };

  await cacheSet(cacheKey, result, CACHE_TTL.INVENTARIO_REPORTE);
  return result;
};

// =====================================================
// OPERACIONES DE ESCRITURA
// =====================================================

/**
 * Función auxiliar atómica para actualizar stock
 * Usa queries SQL atómicas para evitar race conditions
 *
 * @param {number} productId - ID del producto
 * @param {number} cantidad - Cantidad a modificar
 * @param {string} tipoMovimiento - "entrada" | "salida" | "ajuste"
 * @param {Transaction} transaction - Transacción de Sequelize
 * @returns {Promise<Object>} Producto actualizado con nuevo stock
 * @throws {Error} TIPO_MOVIMIENTO_INVALIDO, STOCK_INSUFICIENTE
 */
const actualizarStockAtomico = async (
  productId,
  cantidad,
  tipoMovimiento,
  transaction
) => {
  // 🔒 SEGURIDAD: Validar y sanitizar cantidad
  const cantidadSanitizada = parseFloat(cantidad);

  if (isNaN(cantidadSanitizada) || cantidadSanitizada <= 0) {
    throw new Error("CANTIDAD_INVALIDA");
  }

  let updateQuery;
  let whereCondition = { id: productId };

  switch (tipoMovimiento) {
    case "entrada":
      // ✅ CORRECCIÓN: Usar sequelize.escape() para prevenir SQL injection
      updateQuery = {
        stock_actual: sequelize.literal(
          `stock_actual + ${sequelize.escape(cantidadSanitizada)}`
        ),
      };
      break;

    case "salida":
      // ✅ CORRECCIÓN: Usar sequelize.escape() + validación atómica
      updateQuery = {
        stock_actual: sequelize.literal(
          `stock_actual - ${sequelize.escape(cantidadSanitizada)}`
        ),
      };

      // 🔐 CRÍTICO: Validar stock suficiente en la misma operación SQL
      // Esto previene race conditions entre múltiples operaciones concurrentes
      whereCondition.stock_actual = {
        [Op.gte]: cantidadSanitizada,
      };
      break;

    case "ajuste":
      // ✅ CORRECCIÓN: Ajuste directo con escape
      updateQuery = {
        stock_actual: sequelize.escape(cantidadSanitizada),
      };
      break;

    default:
      throw new Error("TIPO_MOVIMIENTO_INVALIDO");
  }

  // Ejecutar actualización atómica
  const [affectedRows] = await productos.update(updateQuery, {
    where: whereCondition,
    transaction,
  });

  // 🚨 VALIDACIÓN: Si no se actualizó ninguna fila en "salida", significa stock insuficiente
  if (affectedRows === 0 && tipoMovimiento === "salida") {
    // Obtener stock actual para mensaje de error detallado
    const producto = await productos.findByPk(productId, {
      attributes: ["nombre", "stock_actual"],
      transaction,
    });

    throw new Error(
      `STOCK_INSUFICIENTE:${producto.nombre}:${producto.stock_actual}:${cantidadSanitizada}`
    );
  }

  // 🚨 VALIDACIÓN: Si no se encontró el producto
  if (affectedRows === 0) {
    throw new Error("PRODUCTO_NOT_FOUND_OR_INACTIVE");
  }

  // Retornar producto actualizado
  return await productos.findByPk(productId, {
    transaction,
    attributes: ["id", "stock_actual", "codigo_barras", "nombre"],
  });
};

/**
 * Actualizar stock de producto con movimiento normal
 */
const actualizarStock = async (productoId, datosStock, usuarioId) => {
  const transaction = await sequelize.transaction();

  try {
    const {
      cantidad,
      tipo_movimiento,
      observaciones,
      referencia_id,
      referencia_tipo,
    } = datosStock;

    // Validar que el producto existe
    const producto = await productos.findByPk(productoId, { transaction });
    if (!producto) {
      throw new Error("PRODUCTO_NOT_FOUND");
    }

    const stockAnterior = parseFloat(producto.stock_actual);

    // Actualizar stock de forma atómica
    const productoActualizado = await actualizarStockAtomico(
      productoId,
      parseFloat(cantidad),
      tipo_movimiento,
      transaction
    );

    const nuevoStock = parseFloat(productoActualizado.stock_actual);

    // Registrar movimiento de inventario
    await movimientos_inventario.create(
      {
        producto_id: productoId,
        tipo_movimiento,
        cantidad: parseFloat(cantidad),
        stock_anterior: stockAnterior,
        stock_nuevo: nuevoStock,
        referencia_tipo: referencia_tipo || "ajuste",
        referencia_id: referencia_id || null,
        usuario_id: usuarioId,
        observaciones: observaciones || "",
      },
      { transaction }
    );

    await transaction.commit();

    // CRÍTICO: Invalidar caché usando función de cacheService
    await invalidateStockUpdateCache(
      productoId,
      productoActualizado.codigo_barras
    );

    return {
      stock_anterior: stockAnterior,
      stock_nuevo: nuevoStock,
      movimiento: parseFloat(cantidad),
      tipo_movimiento,
    };
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
};

/**
 * Ajustar inventario (corrección directa de stock)
 * 🔒 SEGURIDAD: Validaciones múltiples para prevenir errores humanos
 * 📊 AUDITORÍA: Logs detallados de ajustes significativos
 *
 * @param {number} productoId - ID del producto
 * @param {number} nuevoStock - Nuevo valor de stock deseado
 * @param {string} observaciones - Justificación del ajuste
 * @param {number} usuarioId - ID del usuario que realiza el ajuste
 * @returns {Promise<Object>} Resultado del ajuste con detalles
 * @throws {Error} PRODUCTO_NOT_FOUND, STOCK_NEGATIVO, STOCK_SIN_CAMBIOS, AJUSTE_EXCESIVO
 */

const ajustarInventario = async (
  productoId,
  nuevoStock,
  observaciones,
  usuarioId
) => {
  const transaction = await sequelize.transaction();

  try {
    // ====================================================
    // 1️⃣ VALIDACIONES INICIALES
    // ====================================================

    // Validar que el producto existe y está activo
    const producto = await productos.findByPk(productoId, {
      transaction,
      where: { activo: true },
      include: [
        {
          model: categorias,
          as: "categoria",
          attributes: ["nombre"],
        },
      ],
    });

    if (!producto) {
      throw new Error("PRODUCTO_NOT_FOUND");
    }

    const stockAnterior = parseFloat(producto.stock_actual);
    const nuevoStockFloat = parseFloat(nuevoStock);

    // ====================================================
    // 2️⃣ VALIDACIONES DE NEGOCIO CRÍTICAS
    // ====================================================

    // ✅ NUEVA: Validar que el nuevo stock no sea negativo
    if (nuevoStockFloat < 0) {
      throw new Error("STOCK_NO_PUEDE_SER_NEGATIVO");
    }

    // Calcular diferencia
    const diferencia = nuevoStockFloat - stockAnterior;
    const diferenciaPorcentaje =
      stockAnterior > 0 ? Math.abs((diferencia / stockAnterior) * 100) : 100;

    // Validación de negocio existente
    if (diferencia === 0) {
      throw new Error("STOCK_SIN_CAMBIOS");
    }

    // ✅ NUEVA: Validar ajustes excesivos (regla de negocio para supermercado)
    const UMBRAL_AJUSTE_SIGNIFICATIVO = 50; // 50% de cambio
    const UMBRAL_AJUSTE_CRITICO = 100; // 100% (duplicar o reducir a la mitad)
    const MAX_STOCK_RAZONABLE = 10000; // Máximo stock permitido por producto

    // Validar stock máximo razonable
    if (nuevoStockFloat > MAX_STOCK_RAZONABLE) {
      throw new Error(
        `STOCK_EXCESIVO:${MAX_STOCK_RAZONABLE}:El stock no puede superar ${MAX_STOCK_RAZONABLE} unidades`
      );
    }

    // ✅ NUEVA: Validar ajustes que excedan umbrales críticos
    if (diferenciaPorcentaje > UMBRAL_AJUSTE_CRITICO && stockAnterior > 0) {
      // Si el ajuste es extremo (>100%), requerir observaciones detalladas
      if (!observaciones || observaciones.trim().length < 20) {
        throw new Error(
          `AJUSTE_CRITICO_REQUIERE_JUSTIFICACION:${diferenciaPorcentaje.toFixed(
            1
          )}:` +
            `Ajustes mayores al ${UMBRAL_AJUSTE_CRITICO}% requieren observaciones detalladas (mínimo 20 caracteres)`
        );
      }
    }

    // ✅ NUEVA: Advertencia para ajustes significativos (log, no bloquea)
    if (
      diferenciaPorcentaje > UMBRAL_AJUSTE_SIGNIFICATIVO &&
      stockAnterior > 0
    ) {
      console.warn(
        `⚠️ AJUSTE SIGNIFICATIVO DETECTADO:\n` +
          `   Producto: ${producto.nombre} (ID: ${productoId})\n` +
          `   Stock anterior: ${stockAnterior}\n` +
          `   Stock nuevo: ${nuevoStockFloat}\n` +
          `   Cambio: ${diferenciaPorcentaje.toFixed(1)}%\n` +
          `   Usuario: ${usuarioId}\n` +
          `   Observaciones: ${observaciones || "Sin observaciones"}`
      );
    }

    // ====================================================
    // 3️⃣ ACTUALIZAR STOCK
    // ====================================================

    await producto.update(
      {
        stock_actual: nuevoStockFloat,
      },
      { transaction }
    );

    // ====================================================
    // 4️⃣ REGISTRAR MOVIMIENTO DE INVENTARIO
    // ====================================================

    // Descripción automática mejorada
    const tipoAjusteDescriptivo = diferencia > 0 ? "incremento" : "reducción";
    const descripcionAjuste = observaciones
      ? observaciones.trim()
      : `Ajuste de inventario: ${tipoAjusteDescriptivo} de ${Math.abs(
          diferencia
        ).toFixed(3)} unidades (${diferenciaPorcentaje.toFixed(1)}% cambio)`;

    await movimientos_inventario.create(
      {
        producto_id: productoId,
        tipo_movimiento: "ajuste",
        cantidad: Math.abs(diferencia),
        stock_anterior: stockAnterior,
        stock_nuevo: nuevoStockFloat,
        referencia_tipo: "ajuste",
        referencia_id: null,
        usuario_id: usuarioId,
        observaciones: descripcionAjuste,
      },
      { transaction }
    );

    await transaction.commit();

    // ====================================================
    // 5️⃣ INVALIDAR CACHÉ
    // ====================================================

    await invalidateStockUpdateCache(productoId, producto.codigo_barras);

    // ✅ NUEVA: Si el stock queda bajo, invalidar cache de alertas
    if (nuevoStockFloat <= producto.stock_minimo) {
      await invalidateInventoryCache(); // Invalida alertas y stock bajo
    }

    // ====================================================
    // 6️⃣ LOG DE AUDITORÍA
    // ====================================================

    console.log(
      `✅ AJUSTE DE INVENTARIO EXITOSO:\n` +
        `   Producto: ${producto.nombre} (${producto.categoria.nombre})\n` +
        `   Stock: ${stockAnterior} → ${nuevoStockFloat} (${
          diferencia > 0 ? "+" : ""
        }${diferencia.toFixed(3)})\n` +
        `   Usuario: ${usuarioId}\n` +
        `   Fecha: ${new Date().toISOString()}`
    );

    // ====================================================
    // 7️⃣ RETORNAR RESULTADO DETALLADO
    // ====================================================

    return {
      stock_anterior: stockAnterior,
      stock_nuevo: nuevoStockFloat,
      diferencia: diferencia,
      diferencia_porcentaje: diferenciaPorcentaje.toFixed(2),
      tipo_ajuste: diferencia > 0 ? "incremento" : "reduccion",
      producto: {
        id: producto.id,
        nombre: producto.nombre,
        categoria: producto.categoria.nombre,
        codigo_barras: producto.codigo_barras,
      },
      alerta_stock_bajo: nuevoStockFloat <= producto.stock_minimo,
    };
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
};

/**
 * Registra movimiento de inventario de forma centralizada
 * 🎯 OBJETIVO: Eliminar duplicación de código entre módulos
 * 📊 AUDITORÍA: Punto único de registro para todos los movimientos
 *
 * @param {Object} datos - Datos del movimiento
 * @param {number} datos.producto_id - ID del producto
 * @param {string} datos.tipo_movimiento - "entrada" | "salida" | "ajuste"
 * @param {number} datos.cantidad - Cantidad del movimiento
 * @param {number} datos.stock_anterior - Stock antes del movimiento
 * @param {number} datos.stock_nuevo - Stock después del movimiento
 * @param {string} datos.referencia_tipo - "venta" | "recepcion" | "ajuste"
 * @param {number} datos.referencia_id - ID de la venta/recepción (null para ajustes)
 * @param {number} datos.usuario_id - ID del usuario que realiza el movimiento
 * @param {string} datos.observaciones - Observaciones opcionales
 * @param {Transaction} transaction - Transacción de Sequelize
 * @returns {Promise<Object>} Movimiento creado
 */

const registrarMovimiento = async (datos, transaction) => {
  const {
    producto_id,
    tipo_movimiento,
    cantidad,
    stock_anterior,
    stock_nuevo,
    referencia_tipo,
    referencia_id = null,
    usuario_id,
    observaciones = "",
  } = datos;

  // Validaciones de consistencia
  if (!["entrada", "salida", "ajuste"].includes(tipo_movimiento)) {
    throw new Error(`TIPO_MOVIMIENTO_INVALIDO:${tipo_movimiento}`);
  }

  if (!["venta", "recepcion", "ajuste"].includes(referencia_tipo)) {
    throw new Error(`REFERENCIA_TIPO_INVALIDA:${referencia_tipo}`);
  }

  // Crear movimiento
  const movimiento = await movimientos_inventario.create(
    {
      producto_id,
      tipo_movimiento,
      cantidad: parseFloat(cantidad),
      stock_anterior: parseFloat(stock_anterior),
      stock_nuevo: parseFloat(stock_nuevo),
      referencia_tipo,
      referencia_id,
      usuario_id,
      observaciones: observaciones.trim(),
    },
    { transaction }
  );

  // Log de auditoría
  console.log(
    `📝 MOVIMIENTO REGISTRADO:\n` +
      `   Tipo: ${tipo_movimiento.toUpperCase()}\n` +
      `   Producto ID: ${producto_id}\n` +
      `   Cantidad: ${cantidad}\n` +
      `   Stock: ${stock_anterior} → ${stock_nuevo}\n` +
      `   Referencia: ${referencia_tipo} #${referencia_id || "N/A"}\n` +
      `   Usuario: ${usuario_id}`
  );

  return movimiento;
};

// =====================================================
// EXPORTACIONES
// =====================================================
export {
  // Función atómica (para uso interno y desde otros módulos)
  actualizarStockAtomico,
  registrarMovimiento,
};

export default {
  // Consultas - Movimientos
  obtenerMovimientosFiltrados,

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
