import express from "express";

// Importar controladores
import {
  obtenerUsuarios,
  obtenerUsuarioPorId,
  crearUsuario,
  actualizarUsuario,
  desactivarUsuario,
  activarUsuario,
  resetearPassword,
} from "../controllers/usuariosControlador.js";

// Importar middlewares de autenticación
import { verifyToken, verifyRole } from "../middleware/auth.js";

// Importar validaciones
import {
  validate,
  usuariosSchemas,
  validateUsuarioId,
  validateUsuariosQuery,
  validateNotSelfUser,
} from "../validations/usuarios_validations.js";

const router = express.Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     Usuario:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *           example: 1
 *         username:
 *           type: string
 *           example: "cajero1"
 *         email:
 *           type: string
 *           format: email
 *           example: "cajero1@empresa.com"
 *         nombre:
 *           type: string
 *           example: "María"
 *         apellido:
 *           type: string
 *           example: "González"
 *         rol:
 *           type: string
 *           example: "cajero"
 *         activo:
 *           type: boolean
 *           example: true
 *         fecha_creacion:
 *           type: string
 *           format: date-time
 *         fecha_actualizacion:
 *           type: string
 *           format: date-time
 *
 *     CreateUsuario:
 *       type: object
 *       required:
 *         - username
 *         - password
 *         - password_confirmacion
 *         - email
 *         - nombre
 *         - apellido
 *         - rol
 *       properties:
 *         username:
 *           type: string
 *         password:
 *           type: string
 *         password_confirmacion:
 *           type: string
 *         email:
 *           type: string
 *           format: email
 *         nombre:
 *           type: string
 *         apellido:
 *           type: string
 *         rol:
 *           type: string
 *           enum: [administrador, cajero, dueño]
 *         activo:
 *           type: boolean
 *
 *     UpdateUsuario:
 *       type: object
 *       minProperties: 1
 *       properties:
 *         username:
 *           type: string
 *         password:
 *           type: string
 *         password_confirmacion:
 *           type: string
 *         email:
 *           type: string
 *           format: email
 *         nombre:
 *           type: string
 *         apellido:
 *           type: string
 *         rol:
 *           type: string
 *           enum: [administrador, cajero, dueño]
 *         activo:
 *           type: boolean
 *
 *     ResetPassword:
 *       type: object
 *       required:
 *         - password_nuevo
 *         - password_confirmacion
 *       properties:
 *         password_nuevo:
 *           type: string
 *         password_confirmacion:
 *           type: string
 *
 *     UsuariosListResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *         data:
 *           type: object
 *           properties:
 *             usuarios:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Usuario'
 *             pagination:
 *               type: object
 *               properties:
 *                 page:
 *                   type: integer
 *                 limit:
 *                   type: integer
 *                 total:
 *                   type: integer
 *                 pages:
 *                   type: integer
 *
 *     ErrorResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           example: false
 *         error:
 *           type: string
 *         details:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               field:
 *                 type: string
 *               message:
 *                 type: string
 */

/**
 * @swagger
 * tags:
 *   - name: Usuarios
 *     description: Gestión de usuarios del sistema
 */

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
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 20
 *     responses:
 *       200:
 *         description: Lista de usuarios obtenida exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UsuariosListResponse'
 */
router.get(
  "/",
  verifyToken,
  verifyRole(["administrador", "dueño"]),
  validateUsuariosQuery,
  obtenerUsuarios
);

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
 *         description: ID del usuario
 *     responses:
 *       200:
 *         description: Usuario obtenido exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Usuario'
 *       400:
 *         description: ID inválido
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: Usuario no encontrado
 */
router.get(
  "/:id",
  verifyToken,
  verifyRole(["administrador", "dueño"]),
  validateUsuarioId,
  obtenerUsuarioPorId
);

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
 *             $ref: '#/components/schemas/CreateUsuario'
 *     responses:
 *       201:
 *         description: Usuario creado exitosamente
 *       400:
 *         description: Errores de validación o duplicados
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post(
  "/",
  verifyToken,
  verifyRole(["administrador", "dueño"]),
  validate(usuariosSchemas.createUsuario),
  crearUsuario
);

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
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UpdateUsuario'
 *     responses:
 *       200:
 *         description: Usuario actualizado exitosamente
 *       400:
 *         description: Error de validación
 *       404:
 *         description: Usuario no encontrado
 */
router.put(
  "/:id",
  verifyToken,
  verifyRole(["administrador", "dueño"]),
  validateUsuarioId,
  validate(usuariosSchemas.updateUsuario),
  actualizarUsuario
);

/**
 * @swagger
 * /usuarios/{id}/desactivar:
 *   patch:
 *     summary: Desactivar usuario (soft delete)
 *     tags: [Usuarios]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Usuario desactivado exitosamente
 *       400:
 *         description: No permitido (ej: auto-desactivación)
 *       404:
 *         description: Usuario no encontrado
 */
router.patch(
  "/:id/desactivar",
  verifyToken,
  verifyRole(["administrador", "dueño"]),
  validateUsuarioId,
  validateNotSelfUser,
  desactivarUsuario
);

/**
 * @swagger
 * /usuarios/{id}/activar:
 *   patch:
 *     summary: Activar usuario
 *     tags: [Usuarios]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Usuario activado exitosamente
 *       404:
 *         description: Usuario no encontrado
 */
router.patch(
  "/:id/activar",
  verifyToken,
  verifyRole(["administrador", "dueño"]),
  validateUsuarioId,
  activarUsuario
);

/**
 * @swagger
 * /usuarios/{id}/resetear-password:
 *   patch:
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
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ResetPassword'
 *     responses:
 *       200:
 *         description: Contraseña reseteada exitosamente
 *       400:
 *         description: Validación fallida o intento de resetear propia contraseña
 *       404:
 *         description: Usuario no encontrado
 */
router.patch(
  "/:id/resetear-password",
  verifyToken,
  verifyRole(["administrador", "dueño"]),
  validateUsuarioId,
  validateNotSelfUser,
  validate(usuariosSchemas.resetPassword),
  resetearPassword
);

/**
 * @swagger
 * /usuarios/{id}:
 *   delete:
 *     summary: Desactivar usuario (alias para PATCH /desactivar)
 *     description: No elimina físicamente, solo pone activo = false
 *     tags: [Usuarios]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Usuario desactivado exitosamente
 *       400:
 *         description: No permitido desactivar tu propia cuenta
 *       404:
 *         description: Usuario no encontrado
 */
router.delete(
  "/:id",
  verifyToken,
  verifyRole(["administrador", "dueño"]),
  validateUsuarioId,
  validateNotSelfUser,
  desactivarUsuario
);

export default router;
