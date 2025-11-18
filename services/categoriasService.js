// services/categoriasService.js - Lógica de Negocio Pura
import { sequelize, Op } from "../config/database.js";
import db from "../models/index.js";
import { normalizeString } from "../utils/normalizeString.js";
import {
  cacheGet,
  cacheSet,
  CACHE_TTL,
  CACHE_PREFIXES,
  invalidateCategoryCache,
  generateCacheKey,
} from "./cacheService.js";

const { categorias, productos } = db;

// =====================================================
// 🔍 OPERACIONES DE CONSULTA
// =====================================================

/**
 * Obtiene categorías con filtros y estadísticas opcionales
 */
const obtenerCategoriasFiltradas = async (filtros) => {
  const { activo, incluir_estadisticas } = filtros;

  // Generar clave de caché
  const cacheKey = generateCacheKey(CACHE_PREFIXES.CATEGORIAS_LIST, filtros);
  const cached = await cacheGet(cacheKey);

  if (cached) {
    return { data: cached.data, metadata: cached.metadata, fromCache: true };
  }

  // Construir filtros WHERE
  const where = {};
  if (activo !== "all") {
    where.activo = activo === "true";
  }

  // Query base
  let queryOptions = {
    where,
    order: [["nombre", "ASC"]],
  };

  // Agregar estadísticas si se solicita
  if (incluir_estadisticas === "true") {
    queryOptions = {
      ...queryOptions,
      include: [
        {
          model: productos,
          as: "productos",
          attributes: [],
          required: false,
        },
      ],
      attributes: [
        ...Object.keys(categorias.rawAttributes),
        [
          sequelize.fn("COUNT", sequelize.col("productos.id")),
          "total_productos",
        ],
        [
          sequelize.fn(
            "SUM",
            sequelize.case().when(sequelize.col("productos.activo"), 1).else(0)
          ),
          "productos_activos",
        ],
        [
          sequelize.fn(
            "COALESCE",
            sequelize.fn(
              "SUM",
              sequelize.literal(
                "productos.precio_venta * productos.stock_actual"
              )
            ),
            0
          ),
          "valor_inventario",
        ],
      ],
      group: ["categorias.id"],
      order: [
        [sequelize.literal("productos_activos"), "DESC"],
        ["nombre", "ASC"],
      ],
    };
  }

  const categoriasData = await categorias.findAll(queryOptions);

  // Construir metadata
  const metadata = {
    total_categorias: categoriasData.length,
    con_estadisticas: incluir_estadisticas === "true",
    filtro_activo: activo,
  };

  // Cachear resultado
  const ttl =
    incluir_estadisticas === "true"
      ? CACHE_TTL.ESTADISTICAS
      : CACHE_TTL.CATEGORIAS_LIST;

  const result = { data: categoriasData, metadata, fromCache: false };
  await cacheSet(cacheKey, result, ttl);

  return result;
};

/**
 * Obtiene una categoría específica por ID
 */
const obtenerCategoriaPorId = async (id, opciones = {}) => {
  const { incluir_productos } = opciones;

  // Generar clave de caché
  const cacheKey = generateCacheKey(`categoria:${id}`, opciones);
  const cached = await cacheGet(cacheKey);

  if (cached) {
    return { data: cached.data, metadata: cached.metadata, fromCache: true };
  }

  let queryOptions = { where: { id } };

  // Incluir productos si se solicita
  if (incluir_productos === "true") {
    queryOptions.include = [
      {
        model: productos,
        as: "productos",
        where: { activo: true },
        required: false,
        attributes: [
          "id",
          "nombre",
          "codigo_barras",
          "precio_venta",
          "stock_actual",
        ],
      },
    ];
  }

  const categoria = await categorias.findOne(queryOptions);

  if (!categoria) {
    return null;
  }

  const metadata = {
    incluye_productos: incluir_productos === "true",
    total_productos:
      incluir_productos === "true" ? categoria.productos?.length || 0 : null,
  };

  // Cachear resultado
  const ttl =
    incluir_productos === "true"
      ? CACHE_TTL.CATEGORIA_CON_PRODUCTOS
      : CACHE_TTL.CATEGORIA_INDIVIDUAL;

  const result = { data: categoria, metadata, fromCache: false };
  await cacheSet(cacheKey, result, ttl);

  return result;
};

// =====================================================
// ✨ OPERACIONES DE ESCRITURA
// =====================================================

/**
 * Valida que no exista una categoría con nombre similar
 */
const validarNombreUnico = async (nombre, idExcluir = null) => {
  const nombreNormalizado = normalizeString(nombre);

  const whereClause = {
    [Op.and]: [
      sequelize.where(
        sequelize.fn("LOWER", sequelize.fn("TRIM", sequelize.col("nombre"))),
        nombreNormalizado
      ),
    ],
  };

  // Excluir ID actual si es actualización
  if (idExcluir) {
    whereClause[Op.and].push({ id: { [Op.ne]: idExcluir } });
  }

  const existing = await categorias.findOne({ where: whereClause });

  return existing
    ? { valido: false, categoriaExistente: existing }
    : { valido: true };
};

/**
 * Crea nueva categoría con validaciones de negocio
 */
const crearCategoria = async (datosCategoria) => {
  const { nombre, descripcion } = datosCategoria;

  // Validar nombre único
  const validacionNombre = await validarNombreUnico(nombre);
  if (!validacionNombre.valido) {
    throw new Error(
      `DUPLICATE_NAME:${validacionNombre.categoriaExistente.nombre}`
    );
  }

  // Crear categoría
  const nuevaCategoria = await categorias.create({
    nombre: nombre.trim(),
    descripcion: descripcion?.trim() || null,
    activo: true,
  });

  // Invalidar caché
  await invalidateCategoryCache();

  return nuevaCategoria;
};

/**
 * Actualiza categoría existente con validaciones
 */
const actualizarCategoria = async (id, datosActualizacion) => {
  // Verificar existencia
  const categoria = await categorias.findByPk(id);
  if (!categoria) {
    throw new Error("CATEGORIA_NOT_FOUND");
  }

  // Validar nombre único si se está actualizando
  if (
    datosActualizacion.nombre &&
    datosActualizacion.nombre !== categoria.nombre
  ) {
    const validacionNombre = await validarNombreUnico(
      datosActualizacion.nombre,
      id
    );
    if (!validacionNombre.valido) {
      throw new Error(
        `DUPLICATE_NAME:${validacionNombre.categoriaExistente.nombre}`
      );
    }
  }

  // Limpiar datos
  const fieldsToUpdate = { ...datosActualizacion };
  if (fieldsToUpdate.nombre) {
    fieldsToUpdate.nombre = fieldsToUpdate.nombre.trim();
  }
  if (fieldsToUpdate.descripcion !== undefined) {
    fieldsToUpdate.descripcion = fieldsToUpdate.descripcion?.trim() || null;
  }

  // Actualizar
  await categoria.update(fieldsToUpdate);

  // Invalidar caché
  await invalidateCategoryCache();
  await invalidateCategoryCache(id);

  return {
    categoria,
    camposModificados: Object.keys(fieldsToUpdate),
  };
};

/**
 * Valida reglas de negocio para eliminación
 */
const validarEliminacion = async (id) => {
  // Verificar existencia
  const categoria = await categorias.findByPk(id);
  if (!categoria) {
    throw new Error("CATEGORIA_NOT_FOUND");
  }

  // Verificar si ya está desactivada
  if (!categoria.activo) {
    throw new Error("CATEGORIA_ALREADY_INACTIVE");
  }

  // Validar productos activos asociados
  const productosActivos = await productos.count({
    where: { categoria_id: id, activo: true },
  });

  if (productosActivos > 0) {
    const productosEjemplo = await productos.findAll({
      where: { categoria_id: id, activo: true },
      attributes: ["nombre", "codigo_barras"],
      limit: 3,
    });

    throw new Error(
      `ACTIVE_PRODUCTS:${productosActivos}:${JSON.stringify(productosEjemplo)}`
    );
  }

  return categoria;
};

/**
 * Desactiva categoría (soft delete)
 */
const desactivarCategoria = async (id) => {
  // Validar reglas de negocio
  const categoria = await validarEliminacion(id);

  // Desactivar
  await categoria.update({ activo: false });

  // Invalidar caché
  await invalidateCategoryCache();
  await invalidateCategoryCache(id);

  return categoria;
};

// =====================================================
// 📊 OPERACIONES DE ANÁLISIS
// =====================================================

/**
 * Obtiene estadísticas completas de categorías
 */
const obtenerEstadisticasCompletas = async () => {
  const cacheKey = generateCacheKey(CACHE_PREFIXES.CATEGORIAS_ESTADISTICAS, {});
  const cached = await cacheGet(cacheKey);

  if (cached) {
    return { data: cached.data, metadata: cached.metadata, fromCache: true };
  }

  // Query de estadísticas
  const estadisticas = await categorias.findAll({
    include: [
      {
        model: productos,
        as: "productos",
        attributes: [],
        required: false,
      },
    ],
    attributes: [
      "id",
      "nombre",
      "activo",
      [sequelize.fn("COUNT", sequelize.col("productos.id")), "total_productos"],
      [
        sequelize.fn(
          "SUM",
          sequelize.case().when(sequelize.col("productos.activo"), 1).else(0)
        ),
        "productos_activos",
      ],
      [
        sequelize.fn(
          "COALESCE",
          sequelize.fn(
            "SUM",
            sequelize.literal("productos.precio_venta * productos.stock_actual")
          ),
          0
        ),
        "valor_inventario",
      ],
    ],
    group: ["categorias.id"],
    order: [
      [sequelize.literal("valor_inventario"), "DESC"],
      ["nombre", "ASC"],
    ],
  });

  // Calcular totales
  const totales = {
    categorias_activas: estadisticas.filter((cat) => cat.activo).length,
    categorias_inactivas: estadisticas.filter((cat) => !cat.activo).length,
    categorias_sin_productos: estadisticas.filter(
      (cat) => parseInt(cat.dataValues.total_productos) === 0
    ).length,
    valor_total_inventario: estadisticas.reduce(
      (sum, cat) => sum + parseFloat(cat.dataValues.valor_inventario || 0),
      0
    ),
  };

  const result = {
    data: { por_categoria: estadisticas, totales },
    metadata: { total_categorias_analizadas: estadisticas.length },
    fromCache: false,
  };

  await cacheSet(cacheKey, result, CACHE_TTL.ESTADISTICAS);
  return result;
};

// =====================================================
// 📤 EXPORTACIONES
// =====================================================
export default {
  // Consultas
  obtenerCategoriasFiltradas,
  obtenerCategoriaPorId,

  // Escritura
  crearCategoria,
  actualizarCategoria,
  desactivarCategoria,

  // Análisis
  obtenerEstadisticasCompletas,

  // Validaciones (para uso interno)
  validarNombreUnico,
  validarEliminacion,
};
