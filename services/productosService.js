// services/productosService.js
import { sequelize, Op } from "../config/database.js";
import db from "../models/index.js";
import {
  cacheGet,
  cacheSet,
  CACHE_TTL,
  CACHE_PREFIXES,
  invalidateProductCache,
  invalidateProductsListCache,
  invalidateProductCategoryCache,
  generateCacheKey,
} from "./cacheService.js";

const { productos, categorias, movimientos_inventario } = db;

// =====================================================
// OPERACIONES DE CONSULTA
// =====================================================

/**
 * Obtiene productos con filtros y paginación
 */
const obtenerProductosFiltrados = async (filtros) => {
  const {
    categoria_id,
    search,
    codigo_barras,
    activo = "all",
    page = 1,
    limit = 50,
  } = filtros;

  // Generar clave de caché
  const cacheKey = generateCacheKey(CACHE_PREFIXES.PRODUCTOS_LIST, filtros);
  const cached = await cacheGet(cacheKey);
  if (cached) return { ...cached, fromCache: true };

  // Construir filtros WHERE
  const where = {};

  if (activo !== "all") {
    where.activo = activo === "true";
  }

  if (categoria_id) {
    where.categoria_id = categoria_id;
  }

  if (codigo_barras) {
    where.codigo_barras = codigo_barras;
  }

  // Búsqueda por nombre o descripción
  if (search) {
    where[Op.or] = [
      { nombre: { [Op.like]: `%${search}%` } },
      { descripcion: { [Op.like]: `%${search}%` } },
    ];
  }

  const offset = (parseInt(page) - 1) * parseInt(limit);

  // Consulta con paginación
  const { count, rows: productosData } = await productos.findAndCountAll({
    where,
    include: [
      {
        model: categorias,
        as: "categoria",
        attributes: ["id", "nombre"],
      },
    ],
    limit: parseInt(limit),
    offset: parseInt(offset),
    order: [["nombre", "ASC"]],
    distinct: true,
  });

  const result = {
    data: productosData,
    metadata: {
      total_productos: count,
      filtro_categoria: categoria_id || null,
      filtro_activo: activo,
      filtro_busqueda: search || null,
    },
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total: count,
      pages: Math.ceil(count / limit),
    },
    fromCache: false,
  };

  await cacheSet(cacheKey, result, CACHE_TTL.PRODUCTOS_PAGINADOS);
  return result;
};

/**
 * Obtiene un producto específico por ID
 */
const obtenerProductoPorId = async (id) => {
  const cacheKey = generateCacheKey(CACHE_PREFIXES.PRODUCTO_ID, {
    productoId: id,
  });
  const cached = await cacheGet(cacheKey);
  if (cached) return { ...cached, fromCache: true };

  const producto = await productos.findOne({
    where: { id },
    include: [
      {
        model: categorias,
        as: "categoria",
        attributes: ["id", "nombre"],
      },
    ],
  });

  if (!producto) return null;

  const result = {
    data: producto,
    metadata: {},
    fromCache: false,
  };

  await cacheSet(cacheKey, result, CACHE_TTL.PRODUCTO_INDIVIDUAL);
  return result;
};

/**
 * Busca producto por código de barras (para POS)
 */
const obtenerProductoPorCodigoBarras = async (codigo) => {
  const cacheKey = generateCacheKey(CACHE_PREFIXES.PRODUCTO_BARCODE, {
    codigoBarras: codigo,
  });
  const cached = await cacheGet(cacheKey);
  if (cached) return { ...cached, fromCache: true };

  const producto = await productos.findOne({
    where: {
      codigo_barras: codigo,
      activo: true,
    },
    include: [
      {
        model: categorias,
        as: "categoria",
        attributes: ["id", "nombre"],
      },
    ],
  });

  if (!producto) return null;

  const result = {
    data: producto,
    metadata: {},
    fromCache: false,
  };

  // TTL más largo para búsquedas por código (más estables)
  await cacheSet(cacheKey, result, CACHE_TTL.PRODUCTO_BARCODE);
  return result;
};

// =====================================================
// OPERACIONES DE ESCRITURA
// =====================================================

/**
 * Crea nuevo producto con validaciones de unicidad
 */
const crearProducto = async (datosProducto, usuarioId) => {
  const transaction = await sequelize.transaction();

  try {
    const {
      codigo_barras,
      nombre,
      descripcion,
      categoria_id,
      precio_compra,
      precio_venta,
      tipo_medida,
      stock_actual,
      stock_minimo,
      activo,
    } = datosProducto;

    // Validar nombre único (case-insensitive)
    const nombreNormalizado = nombre.trim().toLowerCase();
    const existingByName = await productos.findOne({
      where: sequelize.where(
        sequelize.fn("LOWER", sequelize.col("nombre")),
        nombreNormalizado
      ),
      transaction,
    });

    if (existingByName) {
      throw new Error(`NOMBRE_DUPLICADO:${nombre.trim()}`);
    }

    // Validar código de barras único si se proporciona
    if (codigo_barras?.trim()) {
      const existingByCode = await productos.findOne({
        where: { codigo_barras: codigo_barras.trim() },
        transaction,
      });

      if (existingByCode) {
        throw new Error(`CODIGO_BARRAS_DUPLICADO:${codigo_barras.trim()}`);
      }
    }

    // Validar que la categoría existe
    const categoria = await categorias.findByPk(categoria_id, { transaction });
    if (!categoria) {
      throw new Error("CATEGORIA_NOT_FOUND");
    }

    // Crear producto
    const nuevoProducto = await productos.create(
      {
        codigo_barras: codigo_barras?.trim() || null,
        nombre: nombre.trim(),
        descripcion: descripcion?.trim() || null,
        categoria_id,
        precio_compra: Number(precio_compra),
        precio_venta: Number(precio_venta),
        tipo_medida,
        stock_actual: stock_actual || 0,
        stock_minimo: stock_minimo || 0,
        activo: activo ?? true,
      },
      { transaction }
    );

    // Crear movimiento de inventario inicial si hay stock
    if (stock_actual > 0) {
      await movimientos_inventario.create(
        {
          producto_id: nuevoProducto.id,
          tipo_movimiento: "entrada",
          cantidad: stock_actual,
          stock_anterior: 0,
          stock_nuevo: stock_actual,
          referencia_tipo: "ajuste",
          usuario_id: usuarioId,
          observaciones: "Stock inicial al crear producto",
        },
        { transaction }
      );
    }

    await transaction.commit();

    // NOTA: Después de este punto, cualquier modificación de stock
    // debe hacerse a través del módulo de inventario:
    // - actualizarStock(): para movimientos de entrada/salida
    // - ajustarInventario(): para correcciones directas

    // Invalidar caché
    await invalidateProductsListCache();

    return nuevoProducto;
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
};

/**
 * Actualiza producto existente
 */
const actualizarProducto = async (id, datosActualizacion) => {
  const transaction = await sequelize.transaction();

  try {
    const producto = await productos.findByPk(id, { transaction });
    if (!producto) {
      throw new Error("PRODUCTO_NOT_FOUND");
    }

    const fieldsToUpdate = {};

    // Validar nombre único si cambió (case-insensitive)
    if (
      datosActualizacion.nombre &&
      datosActualizacion.nombre.trim().toLowerCase() !==
        producto.nombre.toLowerCase()
    ) {
      const nombreNormalizado = datosActualizacion.nombre.trim().toLowerCase();

      const existingByName = await productos.findOne({
        where: {
          [Op.and]: [
            sequelize.where(
              sequelize.fn("LOWER", sequelize.col("nombre")),
              nombreNormalizado
            ),
            { id: { [Op.ne]: id } },
          ],
        },
        transaction,
      });

      if (existingByName) {
        throw new Error(`NOMBRE_DUPLICADO:${datosActualizacion.nombre.trim()}`);
      }

      fieldsToUpdate.nombre = datosActualizacion.nombre.trim();
    }

    // Validar código de barras único si cambió
    if (datosActualizacion.codigo_barras !== undefined) {
      const codigoNormalizado =
        datosActualizacion.codigo_barras?.trim() || null;

      if (codigoNormalizado && codigoNormalizado !== producto.codigo_barras) {
        const existingByCode = await productos.findOne({
          where: {
            codigo_barras: codigoNormalizado,
            id: { [Op.ne]: id },
          },
          transaction,
        });

        if (existingByCode) {
          throw new Error(`CODIGO_BARRAS_DUPLICADO:${codigoNormalizado}`);
        }
      }

      fieldsToUpdate.codigo_barras = codigoNormalizado;
    }

    // Validar categoría si cambió
    if (
      datosActualizacion.categoria_id &&
      datosActualizacion.categoria_id !== producto.categoria_id
    ) {
      const categoria = await categorias.findByPk(
        datosActualizacion.categoria_id,
        { transaction }
      );

      if (!categoria) {
        throw new Error("CATEGORIA_NOT_FOUND");
      }

      fieldsToUpdate.categoria_id = datosActualizacion.categoria_id;
    }

    // Otros campos (sin validaciones especiales)
    if (datosActualizacion.descripcion !== undefined) {
      fieldsToUpdate.descripcion =
        datosActualizacion.descripcion?.trim() || null;
    }

    if (datosActualizacion.precio_compra !== undefined) {
      fieldsToUpdate.precio_compra = Number(datosActualizacion.precio_compra);
    }

    if (datosActualizacion.precio_venta !== undefined) {
      fieldsToUpdate.precio_venta = Number(datosActualizacion.precio_venta);
    }

    if (datosActualizacion.tipo_medida) {
      fieldsToUpdate.tipo_medida = datosActualizacion.tipo_medida;
    }

    if (datosActualizacion.stock_minimo !== undefined) {
      fieldsToUpdate.stock_minimo = Number(datosActualizacion.stock_minimo);
    }

    if (datosActualizacion.activo !== undefined) {
      fieldsToUpdate.activo = datosActualizacion.activo;
    }

    // IMPORTANTE: stock_actual NO se actualiza aquí (se maneja en inventario)
    // Usar módulo de inventario:
    // - POST /inventario/:id/stock (actualizarStock)
    // - POST /inventario/ajustar (ajustarInventario)
    delete fieldsToUpdate.stock_actual;

    await producto.update(fieldsToUpdate, { transaction });
    await transaction.commit();

    // Invalidar caché
    await invalidateProductCache(id, producto.codigo_barras);
    await invalidateProductsListCache();

    // Si cambió categoría, invalidar caché específico
    if (fieldsToUpdate.categoria_id) {
      await invalidateProductCategoryCache(id, fieldsToUpdate.categoria_id);
    }

    return {
      producto: await producto.reload(),
      camposModificados: Object.keys(fieldsToUpdate),
    };
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
};

/**
 * Elimina producto (desactivación lógica)
 */
const eliminarProducto = async (id) => {
  const transaction = await sequelize.transaction();

  try {
    const producto = await productos.findByPk(id, { transaction });
    if (!producto) {
      throw new Error("PRODUCTO_NOT_FOUND");
    }

    await producto.update({ activo: false }, { transaction });
    await transaction.commit();

    // Invalidar caché
    await invalidateProductCache(id, producto.codigo_barras);
    await invalidateProductsListCache();

    return producto;
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
};

// =====================================================
// EXPORTACIONES
// =====================================================
export default {
  obtenerProductosFiltrados,
  obtenerProductoPorId,
  obtenerProductoPorCodigoBarras,
  crearProducto,
  actualizarProducto,
  eliminarProducto,
};
