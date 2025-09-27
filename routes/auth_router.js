import express from "express";

// Importar controladores
import {
  login,
  verifyToken,
  logout,
  cambiarPassword,
  obtenerPerfil,
} from "../controllers/autentificacionControlador.js";

// Importar middlewares de autenticación
import { verifyToken as verifyTokenMiddleware } from "../middleware/auth.js";

// Importar validaciones
import { validate, authSchemas } from "../validations/auth_validations.js";

const router = express.Router();

/**
 * @swagger
 * components:
 *   schemas:
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
 *           pattern: '^[a-zA-Z0-9]+$'
 *           example: "admin123"
 *         password:
 *           type: string
 *           minLength: 6
 *           maxLength: 100
 *           example: "password123"
 *
 *     LoginResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           example: true
 *         message:
 *           type: string
 *           example: "Login exitoso"
 *         data:
 *           type: object
 *           properties:
 *             token:
 *               type: string
 *               example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
 *             user:
 *               $ref: '#/components/schemas/UserProfile'
 *
 *     UserProfile:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *           example: 1
 *         username:
 *           type: string
 *           example: "admin123"
 *         email:
 *           type: string
 *           format: email
 *           example: "admin@empresa.com"
 *         nombre:
 *           type: string
 *           example: "Juan"
 *         apellido:
 *           type: string
 *           example: "Pérez"
 *         rol:
 *           type: string
 *           enum: [administrador, cajero, dueño]
 *           example: "administrador"
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
 *     ChangePasswordRequest:
 *       type: object
 *       required:
 *         - password_actual
 *         - password_nuevo
 *         - password_confirmacion
 *       properties:
 *         password_actual:
 *           type: string
 *           minLength: 6
 *           maxLength: 100
 *         password_nuevo:
 *           type: string
 *           minLength: 8
 *           maxLength: 100
 *           pattern: '^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)'
 *         password_confirmacion:
 *           type: string
 *           minLength: 8
 *           maxLength: 100
 *
 *     TokenVerifyResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           example: true
 *         message:
 *           type: string
 *           example: "Token válido"
 *         data:
 *           type: object
 *           properties:
 *             valid:
 *               type: boolean
 *               example: true
 *             user:
 *               $ref: '#/components/schemas/UserProfile'
 *
 *     AuthErrorResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           example: false
 *         error:
 *           type: string
 *           example: "Credenciales inválidas"
 *         details:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               field:
 *                 type: string
 *               message:
 *                 type: string
 *
 *   securitySchemes:
 *     bearerAuth:
 *       type: http
 *       scheme: bearer
 *       bearerFormat: JWT
 */

/**
 * @swagger
 * tags:
 *   - name: Autenticación
 *     description: Endpoints para autenticación y gestión de sesiones
 */

/**
 * @swagger
 * /auth/login:
 *   post:
 *     summary: Iniciar sesión
 *     tags: [Autenticación]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/LoginRequest'
 *     responses:
 *       200:
 *         description: Login exitoso
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/LoginResponse'
 *       400:
 *         description: Datos inválidos
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthErrorResponse'
 *       401:
 *         description: Credenciales inválidas
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthErrorResponse'
 */
router.post("/login", validate(authSchemas.login), login);

/**
 * @swagger
 * /auth/verify:
 *   get:
 *     summary: Verificar token JWT
 *     tags: [Autenticación]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Token válido
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/TokenVerifyResponse'
 *       401:
 *         description: Token inválido o expirado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthErrorResponse'
 */
router.get("/verify", verifyTokenMiddleware, verifyToken);

/**
 * @swagger
 * /auth/logout:
 *   post:
 *     summary: Cerrar sesión
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
 *                 message:
 *                   type: string
 *                   example: "Logout exitoso"
 *       401:
 *         description: Token inválido
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthErrorResponse'
 */
router.post("/logout", verifyTokenMiddleware, logout);

/**
 * @swagger
 * /auth/cambiar-password:
 *   put:
 *     summary: Cambiar contraseña
 *     tags: [Autenticación]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ChangePasswordRequest'
 *     responses:
 *       200:
 *         description: Contraseña cambiada
 *       400:
 *         description: Error de validación
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthErrorResponse'
 *       401:
 *         description: Token inválido
 */
router.put(
  "/cambiar-password",
  verifyTokenMiddleware,
  validate(authSchemas.cambiarPassword),
  cambiarPassword
);

/**
 * @swagger
 * /auth/perfil:
 *   get:
 *     summary: Obtener perfil del usuario
 *     tags: [Autenticación]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Perfil del usuario
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UserProfile'
 *       401:
 *         description: Token inválido
 *       404:
 *         description: Usuario no encontrado
 */
router.get("/perfil", verifyTokenMiddleware, obtenerPerfil);

export default router;
