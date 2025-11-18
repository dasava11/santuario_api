// services/proveedoresService.js - Refactorizado KISS
import { sequelize, Op } from "../config/database.js";
import db from "../models/index.js";
import {
  cacheGet,
  cacheSet,
  CACHE_TTL,
  CACHE_PREFIXES,
  invalidateProviderCache,
  invalidateProvidersListCache,
  generateCacheKey,
} from "./cacheService.js";

const { proveedores, recepciones } = db;

// =====================================================
// OPERACIONES DE CONSULTA
// =====================================================

/**
 * Obtiene proveedores con filtros, búsqueda y paginación
 */
const obtenerProveedoresFiltrados = async (filtros) => {
  const {
    search,
    activo = "true",
    page = 1,
    limit = 20,
    incluir_estadisticas,
  } = filtros;

  // Generar clave de caché
  const cacheKey = generateCacheKey(CACHE_PREFIXES.PROVEEDORES_LIST, filtros);
  const cached = await cacheGet(cacheKey);
  if (cached) return { ...cached, fromCache: true };

  // Construir filtros WHERE
  const where = {};
  if (activo !== "all") where.activo = activo === "true";
  if (search) {
    const searchTerm = `%${search.trim()}%`;
    where[Op.or] = [
      { nombre: { [Op.like]: searchTerm } },
      { contacto: { [Op.like]: searchTerm } },
      { email: { [Op.like]: searchTerm } },
    ];
  }

  const offset = (parseInt(page) - 1) * parseInt(limit);

  // Paso 1: obtener IDs paginados
  const proveedoresIds = await proveedores.findAll({
    where,
    attributes: ["id"],
    limit: parseInt(limit),
    offset,
    order: [["nombre", "ASC"]],
  });

  const ids = proveedoresIds.map((p) => p.id);
  let proveedoresData = [];

  // Paso 2: traer proveedores completos (con o sin estadísticas)
  if (ids.length > 0) {
    const queryOptions = {
      where: { id: { [Op.in]: ids } },
      order: [["nombre", "ASC"]],
    };

    if (incluir_estadisticas === "true") {
      queryOptions.include = [
        {
          model: recepciones,
          as: "recepciones",
          attributes: [],
          required: false,
        },
      ];
      queryOptions.attributes = [
        ...Object.keys(proveedores.rawAttributes),
        [
          sequelize.fn("COUNT", sequelize.col("recepciones.id")),
          "total_recepciones",
        ],
        [
          sequelize.fn(
            "COALESCE",
            sequelize.fn("SUM", sequelize.col("recepciones.total")),
            0
          ),
          "valor_total_compras",
        ],
        [
          sequelize.fn("MAX", sequelize.col("recepciones.fecha_recepcion")),
          "ultima_recepcion",
        ],
      ];
      queryOptions.group = ["proveedores.id"];
    }

    proveedoresData = await proveedores.findAll(queryOptions);
  }

  // Count total
  const count = await proveedores.count({ where });

  const result = {
    data: proveedoresData,
    metadata: {
      total_proveedores: count,
      con_estadisticas: incluir_estadisticas === "true",
      filtro_activo: activo,
      busqueda_aplicada: !!search,
    },
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total: count,
      pages: Math.ceil(count / limit),
    },
    fromCache: false,
  };

  const ttl =
    incluir_estadisticas === "true"
      ? CACHE_TTL.ESTADISTICAS_PROVEEDORES
      : CACHE_TTL.PROVEEDORES_PAGINADOS;

  await cacheSet(cacheKey, result, ttl);
  return result;
};

/**
 * Obtiene un proveedor específico por ID
 */
const obtenerProveedorPorId = async (id, opciones = {}) => {
  const { incluir_recepciones = "false" } = opciones;

  const cacheKey = generateCacheKey(`proveedor:${id}`, opciones);
  const cached = await cacheGet(cacheKey);
  if (cached) return { ...cached, fromCache: true };

  const queryOptions = { where: { id } };

  if (incluir_recepciones === "true") {
    queryOptions.include = [
      {
        model: recepciones,
        as: "recepciones",
        where: { estado: { [Op.ne]: "cancelada" } },
        required: false,
        attributes: [
          "id",
          "numero_factura",
          "fecha_recepcion",
          "total",
          "estado",
        ],
        order: [["fecha_recepcion", "DESC"]],
        limit: 10,
      },
    ];
  }

  const proveedor = await proveedores.findOne(queryOptions);
  if (!proveedor) return null;

  const result = {
    data: proveedor,
    metadata: {
      incluye_recepciones: incluir_recepciones === "true",
      total_recepciones:
        incluir_recepciones === "true"
          ? proveedor.recepciones?.length || 0
          : null,
    },
    fromCache: false,
  };

  const ttl =
    incluir_recepciones === "true"
      ? CACHE_TTL.ESTADISTICAS_PROVEEDORES
      : CACHE_TTL.PROVEEDOR_INDIVIDUAL;

  await cacheSet(cacheKey, result, ttl);
  return result;
};

// =====================================================
// OPERACIONES DE ESCRITURA
// =====================================================

/**
 * Crea nuevo proveedor
 * Sequelize maneja unique constraints automáticamente
 */
const crearProveedor = async (datosProveedor) => {
  const { nombre, email, contacto, telefono, direccion, ciudad, pais, activo } =
    datosProveedor;

  const nuevoProveedor = await proveedores.create({
    nombre: nombre.trim(),
    contacto: contacto?.trim() || null,
    telefono: telefono?.trim() || null,
    email: email?.trim() || null,
    direccion: direccion?.trim() || null,
    ciudad: ciudad?.trim() || null,
    pais: pais?.trim() || "Colombia",
    activo: activo ?? true,
  });

  // Invalidar cache después de creación exitosa
  await invalidateProvidersListCache();

  return nuevoProveedor;
};

/**
 * Actualiza proveedor existente
 */
const actualizarProveedor = async (id, datosActualizacion) => {
  const transaction = await sequelize.transaction();

  try {
    const proveedor = await proveedores.findByPk(id, { transaction });
    if (!proveedor) {
      throw new Error("PROVEEDOR_NOT_FOUND");
    }

    // Preparar campos para actualización
    const fieldsToUpdate = {};

    if (datosActualizacion.nombre)
      fieldsToUpdate.nombre = datosActualizacion.nombre.trim();
    if (datosActualizacion.contacto !== undefined)
      fieldsToUpdate.contacto = datosActualizacion.contacto?.trim() || null;
    if (datosActualizacion.telefono !== undefined)
      fieldsToUpdate.telefono = datosActualizacion.telefono?.trim() || null;
    if (datosActualizacion.email !== undefined)
      fieldsToUpdate.email = datosActualizacion.email?.trim() || null;
    if (datosActualizacion.direccion !== undefined)
      fieldsToUpdate.direccion = datosActualizacion.direccion?.trim() || null;
    if (datosActualizacion.ciudad !== undefined)
      fieldsToUpdate.ciudad = datosActualizacion.ciudad?.trim() || null;
    if (datosActualizacion.pais !== undefined)
      fieldsToUpdate.pais = datosActualizacion.pais?.trim() || null;
    if (datosActualizacion.activo !== undefined)
      fieldsToUpdate.activo = datosActualizacion.activo;

    // Actualizar - Sequelize lanza error si viola unique constraint
    await proveedor.update(fieldsToUpdate, { transaction });
    await transaction.commit();

    // Invalidar cache después del commit
    await invalidateProvidersListCache();
    await invalidateProviderCache(id, proveedor.email);

    return {
      proveedor: await proveedor.reload(),
      camposModificados: Object.keys(fieldsToUpdate),
    };
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
};

/**
 * Desactiva proveedor (soft delete)
 */
const desactivarProveedor = async (id) => {
  const proveedor = await proveedores.findByPk(id);

  if (!proveedor) {
    throw new Error("PROVEEDOR_NOT_FOUND");
  }

  if (!proveedor.activo) {
    throw new Error("PROVEEDOR_ALREADY_INACTIVE");
  }

  // Verificar recepciones activas
  const recepcionesActivas = await recepciones.count({
    where: {
      proveedor_id: id,
      estado: { [Op.in]: ["pendiente", "procesada"] },
    },
  });

  if (recepcionesActivas > 0) {
    throw new Error(`ACTIVE_RECEPCIONES:${recepcionesActivas}`);
  }

  // Desactivar
  await proveedor.update({ activo: false });

  // Invalidar cache
  await invalidateProvidersListCache();
  await invalidateProviderCache(id, proveedor.email);

  return proveedor;
};

// =====================================================
// OPERACIONES DE ANÁLISIS
// =====================================================

/**
 * Obtiene estadísticas completas de proveedores
 */
const obtenerEstadisticasCompletas = async () => {
  const cacheKey = generateCacheKey(
    CACHE_PREFIXES.PROVEEDORES_ESTADISTICAS,
    {}
  );
  const cached = await cacheGet(cacheKey);
  if (cached) return { ...cached, fromCache: true };

  const estadisticas = await proveedores.findAll({
    include: [
      {
        model: recepciones,
        as: "recepciones",
        attributes: [],
        required: false,
      },
    ],
    attributes: [
      "id",
      "nombre",
      "ciudad",
      "pais",
      "activo",
      [
        sequelize.fn("COUNT", sequelize.col("recepciones.id")),
        "total_recepciones",
      ],
      [
        sequelize.fn(
          "COALESCE",
          sequelize.fn("SUM", sequelize.col("recepciones.total")),
          0
        ),
        "valor_total_compras",
      ],
      [
        sequelize.fn("MAX", sequelize.col("recepciones.fecha_recepcion")),
        "ultima_recepcion",
      ],
    ],
    group: [
      "proveedores.id",
      "proveedores.nombre",
      "proveedores.ciudad",
      "proveedores.pais",
      "proveedores.activo",
    ],
    order: [
      [sequelize.literal("valor_total_compras"), "DESC"],
      ["nombre", "ASC"],
    ],
  });

  // Calcular totales
  const totales = {
    proveedores_activos: estadisticas.filter((p) => p.activo).length,
    proveedores_inactivos: estadisticas.filter((p) => !p.activo).length,
    valor_total_compras: estadisticas.reduce(
      (sum, p) => sum + parseFloat(p.dataValues.valor_total_compras || 0),
      0
    ),
  };

  const result = {
    data: { por_proveedor: estadisticas, totales },
    metadata: { total_proveedores_analizados: estadisticas.length },
    fromCache: false,
  };

  await cacheSet(cacheKey, result, CACHE_TTL.ESTADISTICAS_PROVEEDORES);
  return result;
};

// =====================================================
// EXPORTACIONES
// =====================================================
export default {
  obtenerProveedoresFiltrados,
  obtenerProveedorPorId,
  crearProveedor,
  actualizarProveedor,
  desactivarProveedor,
  obtenerEstadisticasCompletas,
};
