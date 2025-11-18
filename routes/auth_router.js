// routes/auth.js - Router Refactorizado para Autenticación
import express from "express";

// Controladores
import {
  login,
  verifyToken,
  logout,
  obtenerPerfil,
  actualizarPerfil,
  cambiarPassword,
  obtenerEstadisticasSesiones,
  limpiarSesiones,
} from "../controllers/authControlador.js";

// Middlewares de autenticación
import {
  verifyToken as verifyTokenMiddleware,
  verifyRole,
} from "../middleware/auth.js";

// Middleware de sanitización
import { sanitizeSearch } from "../middleware/sanitizeSearch.js";

// Validaciones específicas
import {
  validateLogin,
  validateCambiarPassword,
  validateActualizarPerfil,
  validateSessionQuery,
  validateCompleteLogin,
  validateCompleteCambiarPassword,
  validateCompleteActualizarPerfil,
  validateLoginAttempts,
} from "../validations/auth_validations.js";

const router = express.Router();

// =====================================================
// 🔐 LOGIN DE USUARIO
// =====================================================
/**
 * @swagger
 * /auth/login:
 *   post:
 *     summary: Autenticación de usuario
 *     tags: [Autenticación]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - username
 *               - password
 *             properties:
 *               username:
 *                 type: string
 *                 minLength: 3
 *                 maxLength: 50
 *                 description: Nombre de usuario o email
 *                 example: "admin"
 *               password:
 *                 type: string
 *                 description: Contraseña del usuario
 *                 example: "password123"
 *     responses:
 *       200:
 *         description: Login exitoso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     message:
 *                       type: string
 *                       example: "Bienvenido Juan"
 *                     token:
 *                       type: string
 *                       description: JWT Token
 *                     user:
 *                       $ref: '#/components/schemas/UsuarioAuth'
 *       401:
 *         description: Credenciales inválidas
 *       429:
 *         description: Demasiados intentos fallidos
 */
router.post(
  "/login",
  sanitizeSearch({
    bodyFields: ["username"],
    maxLength: 100,
    removeDangerousChars: true,
    escapeWildcards: false,
  }),
  validateLoginAttempts,
  validateLogin,
  login
);

// =====================================================
// ✅ VERIFICAR TOKEN
// =====================================================
/**
 * @swagger
 * /auth/verify:
 *   get:
 *     summary: Verificar validez del token JWT
 *     tags: [Autenticación]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: include_permissions
 *         schema:
 *           type: string
 *           enum: [true, false]
 *           default: "false"
 *         description: Incluir permisos adicionales
 *       - in: query
 *         name: refresh_cache
 *         schema:
 *           type: string
 *           enum: [true, false]
 *           default: "false"
 *         description: Forzar actualización de cache
 *     responses:
 *       200:
 *         description: Token válido
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     valid:
 *                       type: boolean
 *                       example: true
 *                     message:
 *                       type: string
 *                       example: "Token válido"
 *                     user:
 *                       $ref: '#/components/schemas/UsuarioAuth'
 *       401:
 *         description: Token inválido o expirado
 */
router.get(
  "/verify",
  sanitizeSearch({
    queryFields: ["include_permissions", "refresh_cache"],
    maxLength: 20,
    removeDangerousChars: true,
  }),
  verifyTokenMiddleware,
  validateSessionQuery,
  verifyToken
);

// =====================================================
// 🚪 LOGOUT
// =====================================================
/**
 * @swagger
 * /auth/logout:
 *   post:
 *     summary: Cerrar sesión del usuario
 *     tags: [Autenticación]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Logout exitoso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     message:
 *                       type: string
 *                       example: "Sesión cerrada exitosamente"
 *                     timestamp:
 *                       type: string
 *                       format: date-time
 *       401:
 *         description: No autorizado
 */
router.post("/logout", verifyTokenMiddleware, logout);

// =====================================================
// 👤 OBTENER PERFIL
// =====================================================
/**
 * @swagger
 * /auth/perfil:
 *   get:
 *     summary: Obtener perfil del usuario autenticado
 *     tags: [Autenticación]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Perfil obtenido exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/UsuarioAuth'
 *       401:
 *         description: No autorizado
 *       404:
 *         description: Usuario no encontrado
 */
router.get("/perfil", verifyTokenMiddleware, obtenerPerfil);

// =====================================================
// ✏️ ACTUALIZAR PERFIL
// =====================================================
/**
 * @swagger
 * /auth/perfil:
 *   put:
 *     summary: Actualizar perfil del usuario autenticado
 *     tags: [Autenticación]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             minProperties: 1
 *             properties:
 *               nombre:
 *                 type: string
 *                 minLength: 2
 *                 maxLength: 100
 *                 description: Nombre del usuario
 *                 example: "Juan Carlos"
 *               apellido:
 *                 type: string
 *                 minLength: 2
 *                 maxLength: 100
 *                 description: Apellido del usuario
 *                 example: "García López"
 *               email:
 *                 type: string
 *                 format: email
 *                 maxLength: 100
 *                 description: Email del usuario
 *                 example: "juan.garcia@empresa.com"
 *     responses:
 *       200:
 *         description: Perfil actualizado exitosamente
 *       400:
 *         description: Errores de validación o email duplicado
 *       401:
 *         description: No autorizado
 *       404:
 *         description: Usuario no encontrado
 */
router.put(
  "/perfil",
  sanitizeSearch({
    bodyFields: ["nombre", "apellido", "email"],
    maxLength: 100,
    removeDangerousChars: true,
    escapeWildcards: false,
  }),
  verifyTokenMiddleware,
  ...validateCompleteActualizarPerfil,
  actualizarPerfil
);

// =====================================================
// 🔒 CAMBIAR CONTRASEÑA
// =====================================================
/**
 * @swagger
 * /auth/cambiar-password:
 *   patch:
 *     summary: Cambiar contraseña del usuario autenticado
 *     tags: [Autenticación]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - password_actual
 *               - password_nuevo
 *               - password_confirmacion
 *             properties:
 *               password_actual:
 *                 type: string
 *                 description: Contraseña actual del usuario
 *               password_nuevo:
 *                 type: string
 *                 minLength: 6
 *                 maxLength: 255
 *                 description: Nueva contraseña
 *               password_confirmacion:
 *                 type: string
 *                 description: Confirmación de la nueva contraseña
 *     responses:
 *       200:
 *         description: Contraseña cambiada exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     message:
 *                       type: string
 *                       example: "Contraseña actualizada exitosamente"
 *                     password_info:
 *                       type: object
 *                       properties:
 *                         strength:
 *                           type: string
 *                           enum: [débil, media, fuerte]
 *                         changed_at:
 *                           type: string
 *                           format: date-time
 *       400:
 *         description: Contraseña actual incorrecta o nueva contraseña débil
 *       401:
 *         description: No autorizado
 */
router.patch(
  "/cambiar-password",
  verifyTokenMiddleware,
  ...validateCompleteCambiarPassword,
  cambiarPassword
);

// =====================================================
// 📊 ESTADÍSTICAS DE SESIONES (SOLO ADMINISTRADORES)
// =====================================================
/**
 * @swagger
 * /auth/estadisticas-sesiones:
 *   get:
 *     summary: Obtener estadísticas de sesiones activas
 *     tags: [Autenticación]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Estadísticas obtenidas exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     active_users:
 *                       type: integer
 *                       description: Usuarios activos en las últimas 24h
 *                     generated_at:
 *                       type: string
 *                       format: date-time
 *                     period:
 *                       type: string
 *                       example: "24h"
 *       401:
 *         description: No autorizado
 *       403:
 *         description: Permisos insuficientes
 */
router.get(
  "/estadisticas-sesiones",
  verifyTokenMiddleware,
  verifyRole(["administrador", "dueño"]),
  obtenerEstadisticasSesiones
);

// =====================================================
// 🧹 LIMPIEZA DE SESIONES (SOLO ADMINISTRADORES)
// =====================================================
/**
 * @swagger
 * /auth/limpiar-sesiones:
 *   post:
 *     summary: Limpiar sesiones expiradas (mantenimiento)
 *     tags: [Autenticación]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Limpieza ejecutada exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     message:
 *                       type: string
 *                       example: "Limpieza de sesiones completada"
 *                     cleaned_entries:
 *                       type: integer
 *                       description: Número de entradas limpiadas
 *                     execution_time_ms:
 *                       type: string
 *                       description: Tiempo de ejecución en milisegundos
 *       401:
 *         description: No autorizado
 *       403:
 *         description: Permisos insuficientes
 */
router.post(
  "/limpiar-sesiones",
  verifyTokenMiddleware,
  verifyRole(["administrador", "dueño"]),
  limpiarSesiones
);

// =====================================================
// 📋 SWAGGER COMPONENTS
// =====================================================
/**
 * @swagger
 * components:
 *   schemas:
 *     UsuarioAuth:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *           description: ID único del usuario
 *           example: 1
 *         username:
 *           type: string
 *           description: Nombre de usuario
 *           example: "admin"
 *         email:
 *           type: string
 *           format: email
 *           description: Email del usuario
 *           example: "admin@empresa.com"
 *         nombre:
 *           type: string
 *           description: Nombre del usuario
 *           example: "Juan Carlos"
 *         apellido:
 *           type: string
 *           description: Apellido del usuario
 *           example: "García"
 *         rol:
 *           type: string
 *           enum: [cajero, administrador, dueño, ayudante]
 *           description: Rol del usuario en el sistema
 *           example: "administrador"
 *         activo:
 *           type: boolean
 *           description: Estado activo del usuario
 *           example: true
 *         fecha_creacion:
 *           type: string
 *           format: date-time
 *           description: Fecha de creación del usuario
 *         fecha_actualizacion:
 *           type: string
 *           format: date-time
 *           description: Última fecha de actualización
 *
 *     LoginRequest:
 *       type: object
 *       required:
 *         - username
 *         - password
 *       properties:
 *         username:
 *           type: string
 *           minLength: 3
 *           maxLength: 50
 *           description: Nombre de usuario o email
 *           example: "admin"
 *         password:
 *           type: string
 *           description: Contraseña del usuario
 *           example: "password123"
 *
 *     CambiarPasswordRequest:
 *       type: object
 *       required:
 *         - password_actual
 *         - password_nuevo
 *         - password_confirmacion
 *       properties:
 *         password_actual:
 *           type: string
 *           description: Contraseña actual del usuario
 *         password_nuevo:
 *           type: string
 *           minLength: 6
 *           maxLength: 255
 *           description: Nueva contraseña
 *         password_confirmacion:
 *           type: string
 *           description: Confirmación de la nueva contraseña
 *
 *     ActualizarPerfilRequest:
 *       type: object
 *       minProperties: 1
 *       properties:
 *         nombre:
 *           type: string
 *           minLength: 2
 *           maxLength: 100
 *           description: Nombre del usuario
 *         apellido:
 *           type: string
 *           minLength: 2
 *           maxLength: 100
 *           description: Apellido del usuario
 *         email:
 *           type: string
 *           format: email
 *           maxLength: 100
 *           description: Email del usuario
 *
 *     AuthSuccessResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           example: true
 *         data:
 *           type: object
 *         metadata:
 *           type: object
 *           properties:
 *             operacion:
 *               type: string
 *             timestamp:
 *               type: string
 *               format: date-time
 *             resource_id:
 *               type: integer
 *
 *     AuthErrorResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           example: false
 *         error:
 *           type: object
 *           properties:
 *             message:
 *               type: string
 *             code:
 *               type: integer
 *             timestamp:
 *               type: string
 *               format: date-time
 *             type:
 *               type: string
 *             details:
 *               type: object
 *
 *   securitySchemes:
 *     bearerAuth:
 *       type: http
 *       scheme: bearer
 *       bearerFormat: JWT
 */

export default router;
