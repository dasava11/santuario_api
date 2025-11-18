// routes/usuarios_router.js
import express from "express";

// Controladores
import {
  obtenerUsuarios,
  obtenerUsuarioPorId,
  buscarUsuarios,
  crearUsuario,
  actualizarUsuario,
  toggleEstadoUsuario,
  resetearPassword,
} from "../controllers/usuariosControlador.js";

// Middlewares de autenticación
import { verifyToken, verifyRole } from "../middleware/auth.js";

// Middleware de sanitización
import { sanitizeSearch } from "../middleware/sanitizeSearch.js";

// Validaciones específicas
import {
  validateCreateUsuario,
  validateUpdateUsuario,
  validateUsuarioId,
  validateGetUsuariosQuery,
  validateBuscarUsuariosQuery,
  validateResetPassword,
} from "../validations/usuarios_validations.js";

const router = express.Router();

// =====================================================
// 📊 OBTENER TODOS LOS USUARIOS
// =====================================================
/**
 * @swagger
 * /usuarios:
 *   get:
 *     summary: Obtener todos los usuarios con filtros y paginación
 *     tags: [Usuarios]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: rol
 *         schema:
 *           type: string
 *           enum: [administrador, cajero, dueño]
 *         description: Filtrar por rol
 *       - in: query
 *         name: activo
 *         schema:
 *           type: string
 *           enum: [true, false, all]
 *           default: "true"
 *         description: Filtrar por estado activo
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: Número de página
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 20
 *         description: Límite de resultados por página
 *     responses:
 *       200:
 *         description: Lista de usuarios obtenida exitosamente
 *       401:
 *         description: No autorizado
 *       403:
 *         description: Permisos insuficientes
 */
router.get(
  "/",
  sanitizeSearch({
    queryFields: ["rol", "activo"],
    maxLength: 50,
    removeDangerousChars: true,
  }),
  verifyToken,
  verifyRole(["administrador", "dueño"]),
  validateGetUsuariosQuery,
  obtenerUsuarios
);

// =====================================================
// 🔍 BUSCAR USUARIOS
// =====================================================
/**
 * @swagger
 * /usuarios/buscar:
 *   get:
 *     summary: Buscar usuarios por término (nombre, apellido, username, email)
 *     tags: [Usuarios]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: termino
 *         required: true
 *         schema:
 *           type: string
 *           minLength: 2
 *           maxLength: 100
 *         description: Término de búsqueda
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 50
 *           default: 10
 *         description: Límite de resultados
 *       - in: query
 *         name: incluirInactivos
 *         schema:
 *           type: boolean
 *           default: false
 *         description: Incluir usuarios inactivos
 *     responses:
 *       200:
 *         description: Resultados de búsqueda obtenidos exitosamente
 *       400:
 *         description: Término de búsqueda inválido
 *       401:
 *         description: No autorizado
 */
router.get(
  "/buscar",
  sanitizeSearch({
    queryFields: ["termino"],
    maxLength: 100,
    removeDangerousChars: true,
  }),
  verifyToken,
  verifyRole(["administrador", "dueño"]),
  validateBuscarUsuariosQuery,
  buscarUsuarios
);

// =====================================================
// 📄 OBTENER USUARIO POR ID
// =====================================================
/**
 * @swagger
 * /usuarios/{id}:
 *   get:
 *     summary: Obtener usuario por ID
 *     tags: [Usuarios]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *           minimum: 1
 *         description: ID del usuario
 *     responses:
 *       200:
 *         description: Usuario obtenido exitosamente
 *       404:
 *         description: Usuario no encontrado
 *       401:
 *         description: No autorizado
 */
router.get(
  "/:id",
  sanitizeSearch({
    paramFields: ["id"],
    maxLength: 20,
    removeDangerousChars: true,
  }),
  verifyToken,
  verifyRole(["administrador", "dueño"]),
  validateUsuarioId,
  obtenerUsuarioPorId
);

// =====================================================
// ✨ CREAR NUEVO USUARIO
// =====================================================
/**
 * @swagger
 * /usuarios:
 *   post:
 *     summary: Crear nuevo usuario
 *     tags: [Usuarios]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - username
 *               - password
 *               - password_confirmacion
 *               - email
 *               - nombre
 *               - apellido
 *               - rol
 *             properties:
 *               username:
 *                 type: string
 *                 minLength: 3
 *                 maxLength: 50
 *               password:
 *                 type: string
 *                 minLength: 8
 *                 maxLength: 100
 *               password_confirmacion:
 *                 type: string
 *               email:
 *                 type: string
 *                 format: email
 *               nombre:
 *                 type: string
 *                 minLength: 2
 *                 maxLength: 50
 *               apellido:
 *                 type: string
 *                 minLength: 2
 *                 maxLength: 50
 *               rol:
 *                 type: string
 *                 enum: [administrador, cajero, dueño]
 *               activo:
 *                 type: boolean
 *                 default: true
 *           example:
 *             username: "jperez"
 *             password: "Pass1234"
 *             password_confirmacion: "Pass1234"
 *             email: "jperez@example.com"
 *             nombre: "Juan"
 *             apellido: "Pérez"
 *             rol: "cajero"
 *             activo: true
 *     responses:
 *       201:
 *         description: Usuario creado exitosamente
 *       400:
 *         description: Errores de validación o usuario duplicado
 *       401:
 *         description: No autorizado
 */
router.post(
  "/",
  sanitizeSearch({
    bodyFields: ["username", "email", "nombre", "apellido"],
    maxLength: 100,
    removeDangerousChars: true,
    escapeWildcards: false,
  }),
  verifyToken,
  verifyRole(["administrador", "dueño"]),
  validateCreateUsuario,
  crearUsuario
);

// =====================================================
// 🔄 ACTUALIZAR USUARIO
// =====================================================
/**
 * @swagger
 * /usuarios/{id}:
 *   put:
 *     summary: Actualizar usuario existente
 *     tags: [Usuarios]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID del usuario
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             minProperties: 1
 *             properties:
 *               username:
 *                 type: string
 *               password:
 *                 type: string
 *               password_confirmacion:
 *                 type: string
 *               email:
 *                 type: string
 *               nombre:
 *                 type: string
 *               apellido:
 *                 type: string
 *               rol:
 *                 type: string
 *               activo:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Usuario actualizado exitosamente
 *       400:
 *         description: Errores de validación
 *       404:
 *         description: Usuario no encontrado
 */
router.put(
  "/:id",
  sanitizeSearch({
    paramFields: ["id"],
    bodyFields: ["username", "email", "nombre", "apellido"],
    maxLength: 100,
    removeDangerousChars: true,
    escapeWildcards: false,
  }),
  verifyToken,
  verifyRole(["administrador", "dueño"]),
  validateUsuarioId,
  validateUpdateUsuario,
  actualizarUsuario
);

// =====================================================
// 🔀 TOGGLE ESTADO USUARIO (ACTIVAR/DESACTIVAR)
// =====================================================
/**
 * @swagger
 * /usuarios/{id}/toggle-estado:
 *   patch:
 *     summary: Cambiar estado del usuario (activar/desactivar)
 *     tags: [Usuarios]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID del usuario
 *     responses:
 *       200:
 *         description: Estado del usuario cambiado exitosamente
 *       400:
 *         description: No puede modificar su propia cuenta
 *       404:
 *         description: Usuario no encontrado
 */
router.patch(
  "/:id/toggle-estado",
  sanitizeSearch({
    paramFields: ["id"],
    maxLength: 20,
    removeDangerousChars: true,
  }),
  verifyToken,
  verifyRole(["administrador", "dueño"]),
  validateUsuarioId,
  toggleEstadoUsuario
);

// =====================================================
// 🔑 RESETEAR CONTRASEÑA
// =====================================================
/**
 * @swagger
 * /usuarios/{id}/resetear-password:
 *   post:
 *     summary: Resetear contraseña de usuario (solo administradores)
 *     tags: [Usuarios]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID del usuario
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - password_nuevo
 *               - password_confirmacion
 *             properties:
 *               password_nuevo:
 *                 type: string
 *                 minLength: 8
 *               password_confirmacion:
 *                 type: string
 *           example:
 *             password_nuevo: "NewPass1234"
 *             password_confirmacion: "NewPass1234"
 *     responses:
 *       200:
 *         description: Contraseña reseteada exitosamente
 *       400:
 *         description: No puede resetear su propia contraseña
 *       404:
 *         description: Usuario no encontrado
 */
router.post(
  "/:id/resetear-password",
  sanitizeSearch({
    paramFields: ["id"],
    maxLength: 20,
    removeDangerousChars: true,
  }),
  verifyToken,
  verifyRole(["administrador", "dueño"]),
  validateUsuarioId,
  validateResetPassword,
  resetearPassword
);

// =====================================================
// 📋 SWAGGER COMPONENTS
// =====================================================
/**
 * @swagger
 * components:
 *   schemas:
 *     Usuario:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *         username:
 *           type: string
 *         email:
 *           type: string
 *         nombre:
 *           type: string
 *         apellido:
 *           type: string
 *         rol:
 *           type: string
 *           enum: [administrador, cajero, dueño]
 *         activo:
 *           type: boolean
 *         fecha_creacion:
 *           type: string
 *           format: date-time
 *         fecha_actualizacion:
 *           type: string
 *           format: date-time
 */

export default router;
