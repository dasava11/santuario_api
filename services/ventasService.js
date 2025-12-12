// services/ventasService.js - Lógica de Negocio Pura
import { sequelize, Op, fn, col } from "../config/database.js";
import db from "../models/index.js";
import {
  cacheGet,
  cacheSet,
  CACHE_TTL,
  CACHE_PREFIXES,
  invalidateVentaCache,
  invalidateVentasListCache,
  invalidateVentaProcesadaCache,
  invalidateVentaAnuladaCache,
  generateCacheKey,
} from "./cacheService.js";

import {
  registrarMovimiento,
  actualizarStockAtomico,
} from "./inventarioServices.js";

const { ventas, detalle_ventas, usuarios, productos, movimientos_inventario } =
  db;

// =====================================================
// OPERACIONES DE CONSULTA
// =====================================================

/**
 * Obtiene ventas con filtros, búsqueda y paginación
 */
const obtenerVentasFiltradas = async (filtros) => {
  const {
    fecha_inicio = "2000-01-01",
    fecha_fin = "2100-12-31",
    usuario_id,
    metodo_pago,
    page = 1,
    limit = 20,
  } = filtros;

  // Generar clave de caché
  const cacheKey = generateCacheKey(CACHE_PREFIXES.VENTAS_LIST, filtros);
  const cached = await cacheGet(cacheKey);
  if (cached) return { ...cached, fromCache: true };

  // Construir filtros WHERE
  const where = {
    fecha_venta: {
      [Op.between]: [fecha_inicio, fecha_fin],
    },
    estado: "activa", // Solo ventas activas por defecto
  };

  if (usuario_id) {
    where.usuario_id = usuario_id;
  }

  if (metodo_pago) {
    where.metodo_pago = metodo_pago;
  }

  const offset = (parseInt(page) - 1) * parseInt(limit);

  const { count, rows } = await ventas.findAndCountAll({
    where,
    include: [
      {
        model: usuarios,
        as: "usuario",
        attributes: ["id", "nombre", "apellido"],
      },
    ],
    order: [
      ["fecha_venta", "DESC"],
      ["id", "DESC"],
    ],
    limit: parseInt(limit),
    offset: parseInt(offset),
    distinct: true,
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
    total_ventas: count,
    filtro_metodo_pago: metodo_pago || null,
    filtro_usuario: usuario_id || null,
    rango_fechas: { inicio: fecha_inicio, fin: fecha_fin },
  };

  const result = {
    data: rows,
    metadata,
    pagination,
    fromCache: false,
  };

  await cacheSet(cacheKey, result, CACHE_TTL.VENTAS_PAGINADOS);

  return result;
};

/**
 * Obtiene una venta específica por ID
 */
const obtenerVentaPorId = async (id) => {
  // Generar clave de caché
  const cacheKey = generateCacheKey(CACHE_PREFIXES.VENTA, { ventaId: id });
  const cached = await cacheGet(cacheKey);

  if (cached) {
    return { data: cached.data, metadata: cached.metadata, fromCache: true };
  }

  const venta = await ventas.findOne({
    where: { id },
    include: [
      {
        model: usuarios,
        as: "usuario",
        attributes: ["id", "nombre", "apellido"],
      },
      {
        model: usuarios,
        as: "usuario_anulacion",
        attributes: ["id", "nombre", "apellido"],
      },
      {
        model: detalle_ventas,
        as: "detalle_venta",
        include: [
          {
            model: productos,
            as: "producto",
            attributes: ["id", "nombre", "codigo_barras", "descripcion"],
          },
        ],
      },
    ],
  });

  if (!venta) {
    return null;
  }

  const metadata = {
    total_productos: venta.detalle_venta?.length || 0,
    estado: venta.estado,
    anulada: venta.estado === "anulada",
  };

  const result = { data: venta, metadata, fromCache: false };
  await cacheSet(cacheKey, result, CACHE_TTL.VENTA_INDIVIDUAL);

  return result;
};

// =====================================================
// OPERACIONES DE ESCRITURA
// =====================================================

/**
 * Valida productos y calcula stock disponible
 */
const validarProductosYStock = async (productosVenta, transaction) => {
  const productosValidados = [];
  let total = 0;

  for (const item of productosVenta) {
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

    const stockActual = parseFloat(producto.stock_actual) || 0;
    const cantidadRequerida = parseFloat(item.cantidad);

    if (stockActual < cantidadRequerida) {
      throw new Error(
        `STOCK_INSUFICIENTE:${producto.nombre}:${stockActual}:${cantidadRequerida}`
      );
    }

    const precioUnitario = parseFloat(
      item.precio_unitario || producto.precio_venta
    );
    const subtotal = parseFloat(
      (cantidadRequerida * precioUnitario).toFixed(2)
    );
    total += subtotal;

    productosValidados.push({
      ...item,
      producto,
      precio_unitario: precioUnitario,
      subtotal,
      stock_actual: stockActual,
    });
  }

  return { productosValidados, total: parseFloat(total.toFixed(2)) };
};

/**
 * Genera número de venta único
 */
const generarNumeroVenta = () => {
  const fecha = new Date();
  return `V${fecha.getFullYear()}${String(fecha.getMonth() + 1).padStart(
    2,
    "0"
  )}${String(fecha.getDate()).padStart(2, "0")}-${Date.now()}`;
};

/**
 * Crea nueva venta con validaciones de negocio
 */
const crearVenta = async (datosVenta, usuarioId) => {
  const transaction = await sequelize.transaction();

  try {
    const { productos: productosVenta, metodo_pago = "efectivo" } = datosVenta;

    // Validar productos y stock
    const { productosValidados, total } = await validarProductosYStock(
      productosVenta,
      transaction
    );

    // Generar número de venta único
    const numeroVenta = generarNumeroVenta();

    // Crear la venta
    const nuevaVenta = await ventas.create(
      {
        numero_venta: numeroVenta,
        usuario_id: usuarioId,
        total,
        metodo_pago,
        estado: "activa",
      },
      { transaction }
    );

    // ====================================================
    // ✅ REFACTORIZACIÓN: Usar funciones centralizadas
    // ====================================================

    // Procesar cada producto de la venta
    for (const item of productosValidados) {
      // 1️⃣ Crear detalle de venta
      await detalle_ventas.create(
        {
          venta_id: nuevaVenta.id,
          producto_id: item.producto_id,
          cantidad: parseFloat(item.cantidad),
          precio_unitario: item.precio_unitario,
          subtotal: item.subtotal,
        },
        { transaction }
      );

      // 2️⃣ ✅ NUEVO: Actualizar stock de forma atómica
      // Esto reemplaza el productos.update() anterior que NO era atómico
      const productoActualizado = await actualizarStockAtomico(
        item.producto_id,
        parseFloat(item.cantidad),
        "salida", // tipo_movimiento
        transaction
      );

      // 3️⃣ ✅ NUEVO: Registrar movimiento de forma centralizada
      await registrarMovimiento(
        {
          producto_id: item.producto_id,
          tipo_movimiento: "salida",
          cantidad: parseFloat(item.cantidad),
          stock_anterior: item.stock_actual, // Del validarProductosYStock
          stock_nuevo: productoActualizado.stock_actual,
          referencia_tipo: "venta",
          referencia_id: nuevaVenta.id,
          usuario_id: usuarioId,
          observaciones: `Venta ${numeroVenta} - ${item.producto.nombre}`,
        },
        transaction
      );
    }

    await transaction.commit();

    // Invalidar caché (cascada)
    await invalidateVentaProcesadaCache(nuevaVenta.id, numeroVenta);

    return nuevaVenta;
  } catch (error) {
    await transaction.rollback();

    // ✅ MEJORAR: Manejo de errores más específico
    if (error.message?.startsWith("STOCK_INSUFICIENTE:")) {
      // El error ya viene formateado desde actualizarStockAtomico
      throw error;
    }

    throw error;
  }
};

/**
 * Anula venta con reversión de stock (eliminación lógica)
 */
const anularVenta = async (id, usuarioAnulacionId, motivoAnulacion) => {
  const transaction = await sequelize.transaction();

  try {
    // Buscar la venta con sus detalles
    const venta = await ventas.findOne({
      where: { id, estado: "activa" },
      include: [
        {
          model: detalle_ventas,
          as: "detalle_venta",
          include: [
            {
              model: productos,
              as: "producto",
              attributes: ["id", "nombre", "stock_actual"],
            },
          ],
        },
      ],
      transaction,
    });

    if (!venta) {
      throw new Error("VENTA_NOT_FOUND_OR_ALREADY_ANULADA");
    }

    // Validar que la venta se pueda anular (máximo 24 horas)
    const fechaVenta = new Date(venta.fecha_venta);
    const ahora = new Date();
    const horasTranscurridas = (ahora - fechaVenta) / (1000 * 60 * 60);

    if (horasTranscurridas > 24) {
      throw new Error("VENTA_ANULACION_TIME_EXCEEDED");
    }

    // ====================================================
    // ✅ REFACTORIZACIÓN: Usar funciones centralizadas
    // ====================================================

    // Revertir stock de todos los productos
    for (const detalle of venta.detalle_venta) {
      const producto = detalle.producto;
      const cantidadADevolver = parseFloat(detalle.cantidad);
      const stockActual = parseFloat(producto.stock_actual);

      // 1️⃣ ✅ NUEVO: Actualizar stock de forma atómica (entrada por devolución)
      const productoActualizado = await actualizarStockAtomico(
        producto.id,
        cantidadADevolver,
        "entrada", // Devolución = entrada
        transaction
      );

      // 2️⃣ ✅ NUEVO: Registrar movimiento de reversión
      await registrarMovimiento(
        {
          producto_id: producto.id,
          tipo_movimiento: "entrada",
          cantidad: cantidadADevolver,
          stock_anterior: stockActual,
          stock_nuevo: productoActualizado.stock_actual,
          referencia_tipo: "venta",
          referencia_id: venta.id,
          usuario_id: usuarioAnulacionId,
          observaciones: `Anulación de venta ${venta.numero_venta}: ${motivoAnulacion}`,
        },
        transaction
      );
    }

    // Marcar la venta como anulada
    await venta.update(
      {
        estado: "anulada",
        fecha_anulacion: new Date(),
        usuario_anulacion_id: usuarioAnulacionId,
        motivo_anulacion: motivoAnulacion,
      },
      { transaction }
    );

    await transaction.commit();

    // Invalidar caché (cascada)
    await invalidateVentaAnuladaCache(venta.id, venta.numero_venta);

    return venta;
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
};

// =====================================================
// OPERACIONES DE ANÁLISIS
// =====================================================

/**
 * Obtiene resumen de ventas por período
 */
const obtenerResumenVentas = async (filtros = {}) => {
  let { fecha_inicio, fecha_fin } = filtros;

  // Si no se proporciona fecha_inicio, usar hoy
  if (!fecha_inicio) {
    fecha_inicio = new Date().toISOString().split("T")[0];
  }

  // Si no se proporciona fecha_fin, usar fecha_inicio
  if (!fecha_fin) {
    fecha_fin = fecha_inicio;
  }

  const cacheKey = generateCacheKey(CACHE_PREFIXES.VENTAS_RESUMEN, {
    fecha_inicio,
    fecha_fin,
  });
  const cached = await cacheGet(cacheKey);

  if (cached) {
    return { data: cached.data, metadata: cached.metadata, fromCache: true };
  }

  // Total de ventas del período
  const totalVentas = await ventas.findOne({
    where: {
      fecha_venta: {
        [Op.between]: [fecha_inicio, fecha_fin],
      },
      estado: "activa",
    },
    attributes: [
      [fn("COUNT", col("id")), "cantidad_ventas"],
      [fn("COALESCE", fn("SUM", col("total")), 0), "total_ventas"],
    ],
    raw: true,
  });

  // Ventas por método de pago
  const ventasPorMetodo = await ventas.findAll({
    where: {
      fecha_venta: {
        [Op.between]: [fecha_inicio, fecha_fin],
      },
      estado: "activa",
    },
    attributes: [
      "metodo_pago",
      [fn("COUNT", col("id")), "cantidad"],
      [fn("COALESCE", fn("SUM", col("total")), 0), "total"],
    ],
    group: ["metodo_pago"],
    raw: true,
  });

  // Productos más vendidos
  const productosMasVendidos = await detalle_ventas.findAll({
    include: [
      {
        model: ventas,
        as: "ventum",
        where: {
          fecha_venta: {
            [Op.between]: [fecha_inicio, fecha_fin],
          },
          estado: "activa",
        },
        attributes: [],
      },
      {
        model: productos,
        as: "producto",
        attributes: ["nombre"],
      },
    ],
    attributes: [
      [fn("SUM", col("cantidad")), "cantidad_vendida"],
      [fn("SUM", col("subtotal")), "total_vendido"],
    ],
    group: ["producto_id", "producto.nombre"],
    order: [[fn("SUM", col("cantidad")), "DESC"]],
    limit: 10,
    raw: true,
  });

  const result = {
    data: {
      fecha_inicio,
      fecha_fin,
      total_ventas: totalVentas,
      ventas_por_metodo: ventasPorMetodo,
      productos_mas_vendidos: productosMasVendidos,
    },
    metadata: {
      generado_en: new Date().toISOString(),
    },
    fromCache: false,
  };

  await cacheSet(cacheKey, result, CACHE_TTL.VENTAS_RESUMEN);
  return result;
};

// =====================================================
// EXPORTACIONES
// =====================================================
export default {
  // Consultas
  obtenerVentasFiltradas,
  obtenerVentaPorId,

  // Escritura
  crearVenta,
  anularVenta,

  // Análisis
  obtenerResumenVentas,

  // Utilidades (para uso interno)
  validarProductosYStock,
  generarNumeroVenta,
};
