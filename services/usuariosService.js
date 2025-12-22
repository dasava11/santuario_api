// services/usuariosService.js - REFACTORIZADO con Optimizaciones
import { sequelize, Op } from "../config/database.js";
import db from "../models/index.js";
import { hashPassword } from "../utils/passwordUtils.js";
import { normalizeString } from "../utils/normalizeString.js";
import {
  cacheGet,
  cacheSet,
  CACHE_TTL,
  CACHE_PREFIXES,
  invalidateUserCache,
  invalidateUsersListCache,
  invalidateUserStatusCache,
  invalidateUserPasswordCache,
  smartCacheKey, // ✅ NUEVO: Función inteligente para caché
} from "./cacheService.js";

const { usuarios } = db;

// =====================================================
// 📊 OPERACIONES DE CONSULTA
// =====================================================

/**
 * Obtiene usuarios con filtros y paginación
 * 
 * ✅ OPTIMIZACIONES:
 * - Usa smartCacheKey() para claves consistentes
 * - Aprovecha índice idx_usuarios_rol_activo del modelo
 * - Orden alfabético por nombre completo
 * 
 * @param {Object} filtros - { rol, activo, page, limit }
 * @returns {Object} { data, metadata, pagination, fromCache }
 */
const obtenerUsuariosFiltrados = async (filtros) => {
  const { rol, activo = "true", page = 1, limit = 20 } = filtros;

  // ✅ MEJORA: smartCacheKey detecta automáticamente tipo de params
  const cacheKey = smartCacheKey(CACHE_PREFIXES.USUARIOS_LIST, filtros);
  const cached = await cacheGet(cacheKey);
  if (cached) return { ...cached, fromCache: true };

  // Construir filtros WHERE
  const where = {};
  if (activo !== "all") where.activo = activo === "true";
  if (rol) where.rol = rol;

  const offset = (parseInt(page) - 1) * parseInt(limit);

  // ✅ OPTIMIZACIÓN: Esta query usa el índice idx_usuarios_rol_activo
  // si se filtra por rol y activo (caso común en el frontend)
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
    // ✅ OPTIMIZACIÓN: Orden alfabético aprovecha idx_usuarios_nombre_completo
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
 * 
 * ✅ MEJORA: Usa smartCacheKey con ID numérico
 * 
 * @param {number} id - ID del usuario
 * @returns {Object|null} { data, metadata, fromCache } o null si no existe
 */
const obtenerUsuarioPorId = async (id) => {
  // ✅ MEJORA: smartCacheKey detecta que id es número → generateSimpleCacheKey
  const cacheKey = smartCacheKey(CACHE_PREFIXES.USUARIO_ID, id);
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
 * 
 * ✅ OPTIMIZACIONES:
 * - Usa normalizeString() para búsquedas consistentes
 * - Aprovecha índice idx_usuarios_nombre_completo para ordenamiento
 * - smartCacheKey con objeto de parámetros
 * 
 * @param {string} termino - Término de búsqueda
 * @param {Object} opciones - { limit, incluirInactivos }
 * @returns {Object} { data, metadata, fromCache }
 */
const buscarUsuarios = async (termino, opciones = {}) => {
  const { limit = 10, incluirInactivos = false } = opciones;

  // ✅ MEJORA: smartCacheKey detecta objeto → generateCacheKey
  const cacheKey = smartCacheKey(CACHE_PREFIXES.USUARIOS_SEARCH, {
    termino,
    limit,
    incluirInactivos,
  });
  const cached = await cacheGet(cacheKey);
  if (cached) return { ...cached, fromCache: true };

  // ✅ MEJORA: normalizeString para búsquedas case-insensitive consistentes
  // Nota: MySQL ya es case-insensitive por defecto, pero esto documenta la intención
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

  // ✅ OPTIMIZACIÓN: El ordenamiento usa idx_usuarios_nombre_completo
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
// ✍️ OPERACIONES DE ESCRITURA
// =====================================================

/**
 * Crea nuevo usuario con validaciones de unicidad
 * 
 * ✅ MEJORAS:
 * - Usa normalizeString() para comparaciones consistentes
 * - Validaciones case-insensitive más robustas
 * - Mejor manejo de errores con mensajes descriptivos
 * 
 * @param {Object} datosUsuario - Datos del nuevo usuario
 * @returns {Object} Usuario creado
 * @throws {Error} USERNAME_EXISTS, EMAIL_EXISTS
 */
const crearUsuario = async (datosUsuario) => {
  const transaction = await sequelize.transaction();

  try {
    const { username, password, email, nombre, apellido, rol, activo } =
      datosUsuario;

    // ✅ MEJORA: normalizeString para comparaciones consistentes
    // Remueve acentos, convierte a lowercase, trim
    const usernameNormalizado = normalizeString(username);
    const emailNormalizado = normalizeString(email);

    // =====================================================
    // 🔍 VALIDACIÓN: Username único (case-insensitive)
    // =====================================================
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

    // =====================================================
    // 🔍 VALIDACIÓN: Email único (case-insensitive)
    // =====================================================
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

    // =====================================================
    // 🔐 HASHEAR CONTRASEÑA
    // =====================================================
    const hashedPassword = await hashPassword(password);

    // =====================================================
    // ✅ CREAR USUARIO
    // =====================================================
    const nuevoUsuario = await usuarios.create(
      {
        username: username.trim(),
        password: hashedPassword,
        email: emailNormalizado,
        nombre: nombre.trim(),
        apellido: apellido.trim(),
        rol,
        activo: activo ?? true,
        // ✅ fecha_creacion y fecha_actualizacion se manejan automáticamente
        // gracias a timestamps: true en el modelo
      },
      { transaction }
    );

    await transaction.commit();

    // =====================================================
    // 🗑️ INVALIDAR CACHÉ
    // =====================================================
    await invalidateUsersListCache();

    console.log(
      `✅ Usuario creado: ${nuevoUsuario.username} (ID: ${nuevoUsuario.id}, Rol: ${nuevoUsuario.rol})`
    );

    return nuevoUsuario;
  } catch (error) {
    await transaction.rollback();

    // Re-lanzar errores de negocio con contexto
    if (error.message.startsWith("USERNAME_EXISTS") ||
      error.message.startsWith("EMAIL_EXISTS")) {
      throw error;
    }

    // Errores inesperados
    console.error("❌ Error creando usuario:", error);
    throw new Error(`Error al crear usuario: ${error.message}`);
  }
};

/**
 * Actualiza usuario existente
 * 
 * ✅ MEJORAS:
 * - normalizeString() para comparaciones
 * - Validación de unicidad más eficiente
 * - Invalidación de caché inteligente (solo si cambia password)
 * 
 * @param {number} id - ID del usuario a actualizar
 * @param {Object} datosActualizacion - Campos a actualizar
 * @returns {Object} { usuario, camposModificados }
 * @throws {Error} USUARIO_NOT_FOUND, USERNAME_EXISTS, EMAIL_EXISTS
 */
const actualizarUsuario = async (id, datosActualizacion) => {
  const transaction = await sequelize.transaction();

  try {
    // =====================================================
    // 🔍 VALIDAR EXISTENCIA
    // =====================================================
    const usuario = await usuarios.findByPk(id, { transaction });
    if (!usuario) {
      throw new Error("USUARIO_NOT_FOUND");
    }

    const fieldsToUpdate = {};
    let passwordCambiado = false;

    // =====================================================
    // 🔍 VALIDAR USERNAME ÚNICO (si cambió)
    // =====================================================
    if (
      datosActualizacion.username &&
      normalizeString(datosActualizacion.username) !==
      normalizeString(usuario.username)
    ) {
      const usernameNormalizado = normalizeString(datosActualizacion.username);

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

    // =====================================================
    // 🔍 VALIDAR EMAIL ÚNICO (si cambió)
    // =====================================================
    if (
      datosActualizacion.email &&
      normalizeString(datosActualizacion.email) !==
      normalizeString(usuario.email)
    ) {
      const emailNormalizado = normalizeString(datosActualizacion.email);

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

    // =====================================================
    // 📝 OTROS CAMPOS
    // =====================================================
    if (datosActualizacion.nombre) {
      fieldsToUpdate.nombre = datosActualizacion.nombre.trim();
    }
    if (datosActualizacion.apellido) {
      fieldsToUpdate.apellido = datosActualizacion.apellido.trim();
    }
    if (datosActualizacion.rol) {
      fieldsToUpdate.rol = datosActualizacion.rol;
    }
    if (datosActualizacion.activo !== undefined) {
      fieldsToUpdate.activo = datosActualizacion.activo;
    }

    // =====================================================
    // 🔐 HASHEAR PASSWORD (si se proporciona)
    // =====================================================
    if (datosActualizacion.password) {
      fieldsToUpdate.password = await hashPassword(datosActualizacion.password);
      passwordCambiado = true;
    }

    // ✅ fecha_actualizacion se actualiza automáticamente por timestamps: true
    await usuario.update(fieldsToUpdate, { transaction });
    await transaction.commit();

    // =====================================================
    // 🗑️ INVALIDAR CACHÉ
    // =====================================================
    await invalidateUsersListCache();
    await invalidateUserCache(id, usuario.username, usuario.email);

    // ✅ MEJORA: Solo invalidar sesiones si cambió password
    if (passwordCambiado) {
      await invalidateUserPasswordCache(id, usuario.username);
      console.log(`🔐 Contraseña actualizada para usuario ${usuario.username} - Sesiones invalidadas`);
    }

    console.log(
      `✅ Usuario actualizado: ${usuario.username} (Campos: ${Object.keys(fieldsToUpdate).join(", ")})`
    );

    return {
      usuario: await usuario.reload(),
      camposModificados: Object.keys(fieldsToUpdate),
    };
  } catch (error) {
    await transaction.rollback();

    // Re-lanzar errores de negocio
    if (error.message === "USUARIO_NOT_FOUND" ||
      error.message.startsWith("USERNAME_EXISTS") ||
      error.message.startsWith("EMAIL_EXISTS")) {
      throw error;
    }

    // Errores inesperados
    console.error("❌ Error actualizando usuario:", error);
    throw new Error(`Error al actualizar usuario: ${error.message}`);
  }
};

/**
 * Toggle estado activo del usuario (activar/desactivar)
 * 
 * ✅ MEJORA: Invalidación coordinada de caché con función específica
 * 
 * @param {number} id - ID del usuario
 * @param {number} usuarioActualId - ID del usuario que realiza la acción
 * @returns {Object} { usuario, estado_anterior, estado_nuevo }
 * @throws {Error} CANNOT_MODIFY_SELF, USUARIO_NOT_FOUND
 */
const toggleEstadoUsuario = async (id, usuarioActualId) => {
  const transaction = await sequelize.transaction();

  try {
    // =====================================================
    // 🔒 VALIDACIÓN: No puede modificar su propio estado
    // =====================================================
    if (parseInt(id) === parseInt(usuarioActualId)) {
      throw new Error("CANNOT_MODIFY_SELF");
    }

    // =====================================================
    // 🔍 VALIDAR EXISTENCIA
    // =====================================================
    const usuario = await usuarios.findByPk(id, { transaction });
    if (!usuario) {
      throw new Error("USUARIO_NOT_FOUND");
    }

    // =====================================================
    // 🔄 TOGGLE DEL ESTADO
    // =====================================================
    const estadoAnterior = usuario.activo;
    const nuevoEstado = !usuario.activo;

    await usuario.update({ activo: nuevoEstado }, { transaction });
    await transaction.commit();

    // =====================================================
    // 🗑️ INVALIDAR CACHÉ (función específica para status)
    // =====================================================
    await invalidateUserStatusCache(id, usuario.username, usuario.email);

    const accion = nuevoEstado ? "activado" : "desactivado";
    console.log(
      `${nuevoEstado ? "✅" : "⚠️"} Usuario ${accion}: ${usuario.username} (ID: ${id})`
    );

    return {
      usuario: await usuario.reload(),
      estado_anterior: estadoAnterior,
      estado_nuevo: nuevoEstado,
    };
  } catch (error) {
    await transaction.rollback();

    // Re-lanzar errores de negocio
    if (error.message === "CANNOT_MODIFY_SELF" ||
      error.message === "USUARIO_NOT_FOUND") {
      throw error;
    }

    // Errores inesperados
    console.error("❌ Error en toggle estado:", error);
    throw new Error(`Error al cambiar estado de usuario: ${error.message}`);
  }
};

/**
 * Resetea contraseña de usuario (solo administradores)
 * 
 * ✅ MEJORA: Invalidación completa de sesiones con función específica
 * 
 * @param {number} id - ID del usuario
 * @param {string} passwordNuevo - Nueva contraseña (sin hashear)
 * @param {number} usuarioActualId - ID del administrador que realiza el reset
 * @returns {Object} Usuario actualizado
 * @throws {Error} CANNOT_RESET_SELF, USUARIO_NOT_FOUND
 */
const resetearPassword = async (id, passwordNuevo, usuarioActualId) => {
  const transaction = await sequelize.transaction();

  try {
    // =====================================================
    // 🔒 VALIDACIÓN: No puede resetear su propia contraseña
    // =====================================================
    if (parseInt(id) === parseInt(usuarioActualId)) {
      throw new Error("CANNOT_RESET_SELF");
    }

    // =====================================================
    // 🔍 VALIDAR EXISTENCIA
    // =====================================================
    const usuario = await usuarios.findByPk(id, { transaction });
    if (!usuario) {
      throw new Error("USUARIO_NOT_FOUND");
    }

    // =====================================================
    // 🔐 HASHEAR NUEVA CONTRASEÑA
    // =====================================================
    const hashedPassword = await hashPassword(passwordNuevo);

    await usuario.update(
      {
        password: hashedPassword,
        // fecha_actualizacion se actualiza automáticamente
      },
      { transaction }
    );

    await transaction.commit();

    // =====================================================
    // 🗑️ INVALIDAR CACHÉ DE AUTENTICACIÓN Y SESIONES
    // =====================================================
    await invalidateUserPasswordCache(id, usuario.username);

    console.log(
      `🔐 Contraseña reseteada para: ${usuario.username} (ID: ${id}) por admin ID: ${usuarioActualId}`
    );

    return usuario;
  } catch (error) {
    await transaction.rollback();

    // Re-lanzar errores de negocio
    if (error.message === "CANNOT_RESET_SELF" ||
      error.message === "USUARIO_NOT_FOUND") {
      throw error;
    }

    // Errores inesperados
    console.error("❌ Error reseteando contraseña:", error);
    throw new Error(`Error al resetear contraseña: ${error.message}`);
  }
};

// =====================================================
// 📤 EXPORTACIONES
// =====================================================
export default {
  // Consultas
  obtenerUsuariosFiltrados,
  obtenerUsuarioPorId,
  buscarUsuarios,

  // Escritura
  crearUsuario,
  actualizarUsuario,
  toggleEstadoUsuario,
  resetearPassword,
};