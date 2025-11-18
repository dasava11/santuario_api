// services/usuariosService.js
import { sequelize, Op } from "../config/database.js";
import db from "../models/index.js";
import { hashPassword } from "../utils/passwordUtils.js";
import {
  cacheGet,
  cacheSet,
  CACHE_TTL,
  CACHE_PREFIXES,
  invalidateUserCache,
  invalidateUsersListCache,
  invalidateUserStatusCache,
  invalidateUserPasswordCache,
  generateCacheKey,
} from "./cacheService.js";

const { usuarios } = db;

// =====================================================
// OPERACIONES DE CONSULTA
// =====================================================

/**
 * Obtiene usuarios con filtros y paginación
 */
const obtenerUsuariosFiltrados = async (filtros) => {
  const { rol, activo = "true", page = 1, limit = 20 } = filtros;

  // Generar clave de caché
  const cacheKey = generateCacheKey(CACHE_PREFIXES.USUARIOS_LIST, filtros);
  const cached = await cacheGet(cacheKey);
  if (cached) return { ...cached, fromCache: true };

  // Construir filtros WHERE
  const where = {};
  if (activo !== "all") where.activo = activo === "true";
  if (rol) where.rol = rol;

  const offset = (parseInt(page) - 1) * parseInt(limit);

  // Consulta con paginación
  const { count, rows: usuariosData } = await usuarios.findAndCountAll({
    where,
    attributes: [
      "id",
      "username",
      "email",
      "nombre",
      "apellido",
      "rol",
      "activo",
      "fecha_creacion",
      "fecha_actualizacion",
    ],
    limit: parseInt(limit),
    offset: parseInt(offset),
    order: [
      ["nombre", "ASC"],
      ["apellido", "ASC"],
    ],
    distinct: true,
  });

  const result = {
    data: usuariosData,
    metadata: {
      total_usuarios: count,
      filtro_rol: rol || null,
      filtro_activo: activo,
    },
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total: count,
      pages: Math.ceil(count / limit),
    },
    fromCache: false,
  };

  await cacheSet(cacheKey, result, CACHE_TTL.USUARIOS_PAGINADOS);
  return result;
};

/**
 * Obtiene un usuario específico por ID
 */
const obtenerUsuarioPorId = async (id) => {
  const cacheKey = generateCacheKey(CACHE_PREFIXES.USUARIO_ID, { userId: id });
  const cached = await cacheGet(cacheKey);
  if (cached) return { ...cached, fromCache: true };

  const usuario = await usuarios.findOne({
    where: { id },
    attributes: [
      "id",
      "username",
      "email",
      "nombre",
      "apellido",
      "rol",
      "activo",
      "fecha_creacion",
      "fecha_actualizacion",
    ],
  });

  if (!usuario) return null;

  const result = {
    data: usuario,
    metadata: {},
    fromCache: false,
  };

  await cacheSet(cacheKey, result, CACHE_TTL.USUARIO_INDIVIDUAL);
  return result;
};

/**
 * Busca usuarios por término (nombre, apellido, username, email)
 */
const buscarUsuarios = async (termino, opciones = {}) => {
  const { limit = 10, incluirInactivos = false } = opciones;

  const cacheKey = generateCacheKey(CACHE_PREFIXES.USUARIOS_SEARCH, {
    termino,
    limit,
    incluirInactivos,
  });
  const cached = await cacheGet(cacheKey);
  if (cached) return { ...cached, fromCache: true };

  const searchTerm = `%${termino.trim()}%`;
  const where = {
    [Op.or]: [
      { nombre: { [Op.like]: searchTerm } },
      { apellido: { [Op.like]: searchTerm } },
      { username: { [Op.like]: searchTerm } },
      { email: { [Op.like]: searchTerm } },
    ],
  };

  if (!incluirInactivos) where.activo = true;

  const usuariosData = await usuarios.findAll({
    where,
    attributes: [
      "id",
      "username",
      "email",
      "nombre",
      "apellido",
      "rol",
      "activo",
    ],
    limit: parseInt(limit),
    order: [
      ["nombre", "ASC"],
      ["apellido", "ASC"],
    ],
  });

  const result = {
    data: usuariosData,
    metadata: {
      termino_busqueda: termino,
      resultados_encontrados: usuariosData.length,
      incluye_inactivos: incluirInactivos,
    },
    fromCache: false,
  };

  await cacheSet(cacheKey, result, CACHE_TTL.USUARIOS_SEARCH);
  return result;
};

// =====================================================
// OPERACIONES DE ESCRITURA
// =====================================================

/**
 * Crea nuevo usuario con validaciones de unicidad
 */
const crearUsuario = async (datosUsuario) => {
  const transaction = await sequelize.transaction();

  try {
    const { username, password, email, nombre, apellido, rol, activo } =
      datosUsuario;

    // Normalizar para búsqueda case-insensitive
    const usernameNormalizado = username.trim().toLowerCase();
    const emailNormalizado = email.trim().toLowerCase();

    // Verificar username único (case-insensitive)
    const existingByUsername = await usuarios.findOne({
      where: sequelize.where(
        sequelize.fn("LOWER", sequelize.col("username")),
        usernameNormalizado
      ),
      transaction,
    });

    if (existingByUsername) {
      throw new Error(`USERNAME_EXISTS:${username.trim()}`);
    }

    // Verificar email único (case-insensitive)
    const existingByEmail = await usuarios.findOne({
      where: sequelize.where(
        sequelize.fn("LOWER", sequelize.col("email")),
        emailNormalizado
      ),
      transaction,
    });

    if (existingByEmail) {
      throw new Error(`EMAIL_EXISTS:${email.trim()}`);
    }

    // Hashear contraseña
    const hashedPassword = await hashPassword(password);

    // Crear usuario
    const nuevoUsuario = await usuarios.create(
      {
        username: username.trim(),
        password: hashedPassword,
        email: emailNormalizado,
        nombre: nombre.trim(),
        apellido: apellido.trim(),
        rol,
        activo: activo ?? true,
      },
      { transaction }
    );

    await transaction.commit();

    // Invalidar cache
    await invalidateUsersListCache();

    return nuevoUsuario;
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
};

/**
 * Actualiza usuario existente
 */
const actualizarUsuario = async (id, datosActualizacion) => {
  const transaction = await sequelize.transaction();

  try {
    const usuario = await usuarios.findByPk(id, { transaction });
    if (!usuario) {
      throw new Error("USUARIO_NOT_FOUND");
    }

    const fieldsToUpdate = {};

    // Verificar username único si cambió (case-insensitive)
    if (
      datosActualizacion.username &&
      datosActualizacion.username.trim().toLowerCase() !==
        usuario.username.toLowerCase()
    ) {
      const usernameNormalizado = datosActualizacion.username
        .trim()
        .toLowerCase();

      const existingByUsername = await usuarios.findOne({
        where: {
          [Op.and]: [
            sequelize.where(
              sequelize.fn("LOWER", sequelize.col("username")),
              usernameNormalizado
            ),
            { id: { [Op.ne]: id } },
          ],
        },
        transaction,
      });

      if (existingByUsername) {
        throw new Error(
          `USERNAME_EXISTS:${datosActualizacion.username.trim()}`
        );
      }

      fieldsToUpdate.username = datosActualizacion.username.trim();
    }

    // Verificar email único si cambió (case-insensitive)
    if (
      datosActualizacion.email &&
      datosActualizacion.email.trim().toLowerCase() !==
        usuario.email.toLowerCase()
    ) {
      const emailNormalizado = datosActualizacion.email.trim().toLowerCase();

      const existingByEmail = await usuarios.findOne({
        where: {
          [Op.and]: [
            sequelize.where(
              sequelize.fn("LOWER", sequelize.col("email")),
              emailNormalizado
            ),
            { id: { [Op.ne]: id } },
          ],
        },
        transaction,
      });

      if (existingByEmail) {
        throw new Error(`EMAIL_EXISTS:${datosActualizacion.email.trim()}`);
      }

      fieldsToUpdate.email = emailNormalizado;
    }

    // Otros campos
    if (datosActualizacion.nombre)
      fieldsToUpdate.nombre = datosActualizacion.nombre.trim();
    if (datosActualizacion.apellido)
      fieldsToUpdate.apellido = datosActualizacion.apellido.trim();
    if (datosActualizacion.rol) fieldsToUpdate.rol = datosActualizacion.rol;
    if (datosActualizacion.activo !== undefined)
      fieldsToUpdate.activo = datosActualizacion.activo;

    // Hashear password si se proporciona
    if (datosActualizacion.password) {
      fieldsToUpdate.password = await hashPassword(datosActualizacion.password);
    }

    await usuario.update(fieldsToUpdate, { transaction });
    await transaction.commit();

    // Invalidar cache
    await invalidateUsersListCache();
    await invalidateUserCache(id, usuario.username, usuario.email);

    // Si cambió password, invalidar sesiones
    if (datosActualizacion.password) {
      await invalidateUserPasswordCache(id, usuario.username);
    }

    return {
      usuario: await usuario.reload(),
      camposModificados: Object.keys(fieldsToUpdate),
    };
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
};

/**
 * Toggle estado activo del usuario (activar/desactivar)
 */
const toggleEstadoUsuario = async (id, usuarioActualId) => {
  const transaction = await sequelize.transaction();

  try {
    // Validación: no puede modificar su propio estado
    if (parseInt(id) === parseInt(usuarioActualId)) {
      throw new Error("CANNOT_MODIFY_SELF");
    }

    const usuario = await usuarios.findByPk(id, { transaction });
    if (!usuario) {
      throw new Error("USUARIO_NOT_FOUND");
    }

    // Toggle del estado
    const nuevoEstado = !usuario.activo;

    await usuario.update({ activo: nuevoEstado }, { transaction });
    await transaction.commit();

    // Invalidar cache
    await invalidateUserStatusCache(id, usuario.username, usuario.email);

    return {
      usuario: await usuario.reload(),
      estado_anterior: !nuevoEstado,
      estado_nuevo: nuevoEstado,
    };
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
};

/**
 * Resetea contraseña de usuario (solo administradores)
 */
const resetearPassword = async (id, passwordNuevo, usuarioActualId) => {
  const transaction = await sequelize.transaction();

  try {
    // Validación: no puede resetear su propia contraseña por esta vía
    if (parseInt(id) === parseInt(usuarioActualId)) {
      throw new Error("CANNOT_RESET_SELF");
    }

    const usuario = await usuarios.findByPk(id, { transaction });
    if (!usuario) {
      throw new Error("USUARIO_NOT_FOUND");
    }

    // Hashear nueva contraseña
    const hashedPassword = await hashPassword(passwordNuevo);

    await usuario.update(
      {
        password: hashedPassword,
        fecha_actualizacion: new Date(),
      },
      { transaction }
    );

    await transaction.commit();

    // Invalidar cache de autenticación y sesiones
    await invalidateUserPasswordCache(id, usuario.username);

    return usuario;
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
};

// =====================================================
// EXPORTACIONES
// =====================================================
export default {
  obtenerUsuariosFiltrados,
  obtenerUsuarioPorId,
  buscarUsuarios,
  crearUsuario,
  actualizarUsuario,
  toggleEstadoUsuario,
  resetearPassword,
};
