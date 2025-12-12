// services/recepcionesService.js - Lógica de Negocio Pura - PARTE 1
import { sequelize, Op } from "../config/database.js";
import db from "../models/index.js";
import {
  cacheGet,
  cacheSet,
  CACHE_TTL,
  CACHE_PREFIXES,
  invalidateRecepcionCache,
  invalidateRecepcionesListCache,
  invalidateRecepcionProcesadaCache,
  generateCacheKey, // ✅ REUTILIZADO del cacheService existente
} from "./cacheService.js";

import {
  actualizarStockAtomico,
  registrarMovimiento,
} from "./inventarioServices.js";

const {
  recepciones,
  detalle_recepciones,
  proveedores,
  usuarios,
  productos,
  movimientos_inventario,
} = db;

// =====================================================
// 🔍 OPERACIONES DE CONSULTA
// =====================================================

/**
 * Obtiene recepciones con filtros, búsqueda y paginación
 */
const obtenerRecepcionesFiltradas = async (filtros) => {
  const {
    fecha_inicio,
    fecha_fin,
    proveedor_id,
    estado = "all",
    page = 1,
    limit = 20,
    incluir_detalles,
  } = filtros;

  // Generar clave de caché
  const cacheKey = generateCacheKey(CACHE_PREFIXES.RECEPCIONES_LIST, filtros);
  const cached = await cacheGet(cacheKey);
  if (cached) return { ...cached, fromCache: true };

  // Construir filtros WHERE
  const where = {};

  if (fecha_inicio && fecha_fin) {
    where.fecha_recepcion = {
      [Op.between]: [fecha_inicio, fecha_fin],
    };
  }

  if (proveedor_id) {
    where.proveedor_id = proveedor_id;
  }

  if (estado !== "all") {
    where.estado = estado;
  }

  const offset = (parseInt(page) - 1) * parseInt(limit);

  // Configurar includes según opciones
  const includes = [
    {
      model: proveedores,
      as: "proveedor",
      attributes: ["id", "nombre", "telefono", "email"],
    },
    {
      model: usuarios,
      as: "usuario",
      attributes: ["id", "nombre", "apellido"],
    },
  ];

  // Incluir detalles si se solicita
  if (incluir_detalles === "true") {
    includes.push({
      model: detalle_recepciones,
      as: "detalle_recepciones",
      include: [
        {
          model: productos,
          as: "producto",
          attributes: ["id", "nombre", "codigo_barras"],
        },
      ],
    });
  }

  const { count, rows } = await recepciones.findAndCountAll({
    where,
    include: includes,
    order: [
      ["fecha_recepcion", "DESC"],
      ["fecha_creacion", "DESC"],
    ],
    limit: parseInt(limit),
    offset: parseInt(offset),
  });

  // Construir pagination
  const pagination = {
    page: parseInt(page),
    limit: parseInt(limit),
    total: count,
    pages: Math.ceil(count / limit),
  };

  // Metadata
  const metadata = {
    total_recepciones: count,
    con_detalles: incluir_detalles === "true",
    filtro_estado: estado,
    filtro_proveedor: proveedor_id || null,
    rango_fechas:
      fecha_inicio && fecha_fin
        ? { inicio: fecha_inicio, fin: fecha_fin }
        : null,
  };

  const result = {
    data: rows,
    metadata,
    pagination,
    fromCache: false,
  };

  const ttl =
    incluir_detalles === "true"
      ? CACHE_TTL.RECEPCION_CON_DETALLES
      : CACHE_TTL.RECEPCIONES_PAGINADOS;

  await cacheSet(cacheKey, result, ttl);

  return result;
};

/**
 * Obtiene una recepción específica por ID
 */
const obtenerRecepcionPorId = async (id, opciones = {}) => {
  const { incluir_productos = "true", incluir_movimientos = "false" } =
    opciones;

  // Generar clave de caché
  const cacheKey = generateCacheKey(`recepcion:${id}`, opciones);
  const cached = await cacheGet(cacheKey);

  if (cached) {
    return { data: cached.data, metadata: cached.metadata, fromCache: true };
  }

  // Configurar includes base
  const includes = [
    {
      model: proveedores,
      as: "proveedor",
      attributes: ["id", "nombre", "telefono", "email"],
    },
    {
      model: usuarios,
      as: "usuario",
      attributes: ["id", "nombre", "apellido"],
    },
  ];

  // Incluir productos si se solicita
  if (incluir_productos === "true") {
    includes.push({
      model: detalle_recepciones,
      as: "detalle_recepciones",
      include: [
        {
          model: productos,
          as: "producto",
          attributes: [
            "id",
            "nombre",
            "codigo_barras",
            "precio_compra",
            "precio_venta",
          ],
        },
      ],
    });
  }

  const recepcion = await recepciones.findByPk(id, {
    include: includes,
  });

  if (!recepcion) {
    return null;
  }

  // Incluir movimientos de inventario si se solicita
  let movimientos = null;
  if (incluir_movimientos === "true" && recepcion.estado === "procesada") {
    movimientos = await movimientos_inventario.findAll({
      where: {
        referencia_id: id,
        referencia_tipo: "recepcion",
      },
      include: [
        {
          model: productos,
          as: "producto",
          attributes: ["id", "nombre", "codigo_barras"],
        },
        {
          model: usuarios,
          as: "usuario",
          attributes: ["id", "nombre", "apellido"],
        },
      ],
      order: [["fecha_movimiento", "ASC"]],
    });
  }

  const metadata = {
    incluye_productos: incluir_productos === "true",
    incluye_movimientos: incluir_movimientos === "true",
    total_productos:
      incluir_productos === "true"
        ? recepcion.detalle_recepciones?.length || 0
        : null,
    total_movimientos: movimientos?.length || 0,
  };

  // Agregar movimientos a la respuesta si existen
  const recepcionData = recepcion.toJSON();
  if (movimientos) {
    recepcionData.movimientos_inventario = movimientos;
  }

  // Cachear resultado
  const ttl =
    incluir_productos === "true" || incluir_movimientos === "true"
      ? CACHE_TTL.RECEPCION_CON_DETALLES
      : CACHE_TTL.RECEPCION_INDIVIDUAL;

  const result = { data: recepcionData, metadata, fromCache: false };
  await cacheSet(cacheKey, result, ttl);

  return result;
};

// recepcionesService.js - PARTE 2 (Validaciones y Operaciones de Escritura)

// =====================================================
// ✨ OPERACIONES DE ESCRITURA
// =====================================================

/**
 * Valida que no exista una recepción con el mismo número de factura del mismo proveedor
 */
const validarFacturaUnica = async (
  numeroFactura,
  proveedorId,
  idExcluir = null
) => {
  const whereClause = {
    numero_factura: numeroFactura.trim(),
    proveedor_id: proveedorId,
  };

  // Excluir ID actual si es actualización
  if (idExcluir) {
    whereClause.id = { [Op.ne]: idExcluir };
  }

  const existing = await recepciones.findOne({ where: whereClause });

  return existing
    ? { valido: false, recepcionExistente: existing }
    : { valido: true };
};

/**
 * Valida que el proveedor exista y esté activo
 */
const validarProveedor = async (proveedorId, transaction = null) => {
  const proveedor = await proveedores.findOne({
    where: {
      id: proveedorId,
      activo: true,
    },
    transaction,
  });

  if (!proveedor) {
    throw new Error("PROVEEDOR_NOT_FOUND_OR_INACTIVE");
  }

  return proveedor;
};

/**
 * Valida que todos los productos existan y estén activos
 */
const validarProductos = async (productosRecepcion, transaction = null) => {
  const productosValidados = [];
  let total = 0;

  for (const item of productosRecepcion) {
    const producto = await productos.findOne({
      where: {
        id: item.producto_id,
        activo: true,
      },
      transaction,
    });

    if (!producto) {
      throw new Error(`PRODUCTO_NOT_FOUND:${item.producto_id}`);
    }

    const subtotal = parseFloat(
      (item.cantidad * item.precio_unitario).toFixed(2)
    );
    total += subtotal;

    productosValidados.push({
      ...item,
      producto,
      subtotal,
    });
  }

  return { productosValidados, total: parseFloat(total.toFixed(2)) };
};

/**
 * Crea nueva recepción con validaciones de negocio
 */
const crearRecepcion = async (datosRecepcion, usuarioId) => {
  const transaction = await sequelize.transaction();

  try {
    const {
      numero_factura,
      proveedor_id,
      fecha_recepcion,
      observaciones,
      productos: productosRecepcion,
    } = datosRecepcion;

    // Validar que el proveedor existe y está activo
    await validarProveedor(proveedor_id, transaction);

    // Validar que no existe una factura con el mismo número del mismo proveedor
    const validacionFactura = await validarFacturaUnica(
      numero_factura,
      proveedor_id
    );
    if (!validacionFactura.valido) {
      throw new Error(
        `DUPLICATE_INVOICE:${validacionFactura.recepcionExistente.numero_factura}`
      );
    }

    // Validar productos y calcular total
    const { productosValidados, total } = await validarProductos(
      productosRecepcion,
      transaction
    );

    // Crear la recepción
    const nuevaRecepcion = await recepciones.create(
      {
        numero_factura: numero_factura.trim(),
        proveedor_id,
        usuario_id: usuarioId,
        fecha_recepcion,
        total,
        observaciones: observaciones?.trim() || null,
        estado: "pendiente",
      },
      { transaction }
    );

    // Crear detalles de la recepción
    const detallesData = productosValidados.map((item) => ({
      recepcion_id: nuevaRecepcion.id,
      producto_id: item.producto_id,
      cantidad: item.cantidad,
      precio_unitario: item.precio_unitario,
      subtotal: item.subtotal,
    }));

    await detalle_recepciones.bulkCreate(detallesData, { transaction });

    await transaction.commit();

    // Invalidar caché
    await invalidateRecepcionesListCache();

    return nuevaRecepcion;
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
};

/**
 * Actualiza recepción existente (solo observaciones si está pendiente)
 */
const actualizarRecepcion = async (id, datosActualizacion) => {
  const transaction = await sequelize.transaction();

  try {
    // Verificar existencia y estado
    const recepcion = await recepciones.findByPk(id, { transaction });
    if (!recepcion) {
      throw new Error("RECEPCION_NOT_FOUND");
    }

    if (recepcion.estado !== "pendiente") {
      throw new Error("RECEPCION_NOT_EDITABLE");
    }

    // Actualizar solo observaciones
    const fieldsToUpdate = {};
    if (datosActualizacion.observaciones !== undefined) {
      fieldsToUpdate.observaciones =
        datosActualizacion.observaciones?.trim() || null;
    }

    await recepcion.update(fieldsToUpdate, { transaction });

    await transaction.commit();

    // Invalidar caché
    await invalidateRecepcionCache(id, recepcion.numero_factura);
    await invalidateRecepcionesListCache();

    return {
      recepcion,
      camposModificados: Object.keys(fieldsToUpdate),
    };
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
};

/**
 * Procesa recepción (actualiza inventario y crea movimientos)
 */
const procesarRecepcion = async (id, usuarioId, opciones = {}) => {
  const transaction = await sequelize.transaction();

  try {
    const { observaciones_proceso, actualizar_precios = true } = opciones;

    // Verificar que la recepción existe y está pendiente
    const recepcion = await recepciones.findOne({
      where: {
        id,
        estado: "pendiente",
      },
      transaction,
    });

    if (!recepcion) {
      throw new Error("RECEPCION_NOT_PROCESSABLE");
    }

    // Obtener detalles de la recepción
    const detalles = await detalle_recepciones.findAll({
      where: { recepcion_id: id },
      include: [
        {
          model: productos,
          as: "producto",
          attributes: ["id", "stock_actual", "precio_compra", "activo"],
        },
      ],
      transaction,
    });

    // ====================================================
    // ✅ REFACTORIZACIÓN: Usar funciones centralizadas
    // ====================================================

    // Procesar cada detalle
    for (const detalle of detalles) {
      const producto = detalle.producto;

      // ✅ NUEVA VALIDACIÓN: Revalidar estado activo del producto
      if (!producto.activo) {
        throw new Error(
          `PRODUCTO_INACTIVO_AL_PROCESAR:${producto.id}:${
            producto.nombre || "Desconocido"
          }`
        );
      }

      const cantidad = parseFloat(detalle.cantidad);
      const stockAnterior = parseFloat(producto.stock_actual) || 0;

      // 1️⃣ ✅ NUEVO: Actualizar stock de forma atómica
      const productoActualizado = await actualizarStockAtomico(
        detalle.producto_id,
        cantidad,
        "entrada", // Recepción = entrada
        transaction
      );

      // 2️⃣ Actualizar precio de compra si se solicita
      if (actualizar_precios) {
        await productos.update(
          { precio_compra: detalle.precio_unitario },
          {
            where: { id: detalle.producto_id },
            transaction,
          }
        );
      }

      // 3️⃣ ✅ NUEVO: Registrar movimiento de forma centralizada
      await registrarMovimiento(
        {
          producto_id: detalle.producto_id,
          tipo_movimiento: "entrada",
          cantidad: cantidad,
          stock_anterior: stockAnterior,
          stock_nuevo: productoActualizado.stock_actual,
          referencia_tipo: "recepcion",
          referencia_id: id,
          usuario_id: usuarioId,
          observaciones:
            observaciones_proceso ||
            `Recepción ${recepcion.numero_factura} - Proveedor ${recepcion.proveedor_id}`,
        },
        transaction
      );
    }

    // Actualizar estado de la recepción
    await recepcion.update({ estado: "procesada" }, { transaction });

    await transaction.commit();

    // Invalidar caché (incluye productos e inventario)
    await invalidateRecepcionProcesadaCache(id, recepcion.proveedor_id);

    return recepcion;
  } catch (error) {
    await transaction.rollback();

    // ✅ NUEVO: Manejo de error específico para productos inactivos
    if (error.message?.startsWith("PRODUCTO_INACTIVO_AL_PROCESAR:")) {
      const [, productoId, productoNombre] = error.message.split(":");
      throw new Error(
        `PRODUCTO_INACTIVO:El producto "${productoNombre}" (ID: ${productoId}) fue desactivado y no puede procesarse en la recepción`
      );
    }

    throw error;
  }
};

/**
 * Cancela recepción (solo si está pendiente)
 */
const cancelarRecepcion = async (id) => {
  const transaction = await sequelize.transaction();

  try {
    // Verificar que la recepción existe y está pendiente
    const recepcion = await recepciones.findOne({
      where: {
        id,
        estado: "pendiente",
      },
      transaction,
    });

    if (!recepcion) {
      throw new Error("RECEPCION_NOT_CANCELLABLE");
    }

    await recepcion.update({ estado: "cancelada" }, { transaction });

    await transaction.commit();

    // Invalidar caché
    await invalidateRecepcionCache(id, recepcion.numero_factura);
    await invalidateRecepcionesListCache();

    return recepcion;
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
};

// =====================================================
// 📊 OPERACIONES DE ANÁLISIS
// =====================================================

/**
 * Obtiene estadísticas completas de recepciones
 */
const obtenerEstadisticasCompletas = async (filtros = {}) => {
  const cacheKey = generateCacheKey(
    CACHE_PREFIXES.RECEPCIONES_ESTADISTICAS,
    filtros
  );
  const cached = await cacheGet(cacheKey);

  if (cached) {
    return { data: cached.data, metadata: cached.metadata, fromCache: true };
  }

  const { fecha_inicio, fecha_fin, proveedor_id } = filtros;

  // Construir filtros WHERE
  const where = {};
  if (fecha_inicio && fecha_fin) {
    where.fecha_recepcion = { [Op.between]: [fecha_inicio, fecha_fin] };
  }
  if (proveedor_id) {
    where.proveedor_id = proveedor_id;
  }

  // Query de estadísticas principales
  const estadisticasPrincipales = await recepciones.findAll({
    where,
    attributes: [
      [
        sequelize.fn("COUNT", sequelize.col("recepciones.id")),
        "total_recepciones",
      ],
      [
        sequelize.fn(
          "COUNT",
          sequelize.literal("CASE WHEN estado = 'pendiente' THEN 1 END")
        ),
        "recepciones_pendientes",
      ],
      [
        sequelize.fn(
          "COUNT",
          sequelize.literal("CASE WHEN estado = 'procesada' THEN 1 END")
        ),
        "recepciones_procesadas",
      ],
      [
        sequelize.fn(
          "COUNT",
          sequelize.literal("CASE WHEN estado = 'cancelada' THEN 1 END")
        ),
        "recepciones_canceladas",
      ],
      [
        sequelize.fn(
          "SUM",
          sequelize.literal(
            "CASE WHEN estado = 'procesada' THEN total ELSE 0 END"
          )
        ),
        "valor_total_procesadas",
      ],
      [sequelize.fn("AVG", sequelize.col("total")), "valor_promedio_recepcion"],
    ],
    raw: true,
  });

  // Estadísticas por proveedor (top 10)
  const estadisticasPorProveedor = await recepciones.findAll({
    where,
    include: [
      {
        model: proveedores,
        as: "proveedor",
        attributes: ["id", "nombre"],
      },
    ],
    attributes: [
      "proveedor_id",
      [
        sequelize.fn("COUNT", sequelize.col("recepciones.id")),
        "total_recepciones",
      ],
      [
        sequelize.fn(
          "SUM",
          sequelize.literal(
            "CASE WHEN estado = 'procesada' THEN total ELSE 0 END"
          )
        ),
        "valor_total",
      ],
    ],
    group: ["proveedor_id", "proveedor.id", "proveedor.nombre"],
    order: [[sequelize.literal("valor_total"), "DESC"]],
    limit: 10,
  });

  const result = {
    data: {
      resumen: estadisticasPrincipales[0],
      por_proveedor: estadisticasPorProveedor,
    },
    metadata: {
      periodo:
        fecha_inicio && fecha_fin
          ? { inicio: fecha_inicio, fin: fecha_fin }
          : "todo",
      proveedor_especifico: proveedor_id || null,
      generado_en: new Date().toISOString(),
    },
    fromCache: false,
  };

  await cacheSet(cacheKey, result, CACHE_TTL.RECEPCIONES_ESTADISTICAS);
  return result;
};

// =====================================================
// 📤 EXPORTACIONES
// =====================================================
export default {
  // Consultas
  obtenerRecepcionesFiltradas,
  obtenerRecepcionPorId,

  // Escritura
  crearRecepcion,
  actualizarRecepcion,
  procesarRecepcion,
  cancelarRecepcion,

  // Análisis
  obtenerEstadisticasCompletas,

  // Validaciones (para uso interno)
  validarFacturaUnica,
  validarProveedor,
  validarProductos,
};
