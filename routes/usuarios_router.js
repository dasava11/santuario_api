// routes/usuarios_router.js - REFACTORIZADO con Rate Limiters y Swagger Completo
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

// ✅ NUEVO: Rate limiters específicos de usuarios
import {
  usuariosWriteLimiter,
  criticalUsuarioLimiter,
  usuariosSearchLimiter,
} from "../middleware/rateLimiters.js";

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
// 📊 OBTENER TODOS LOS USUARIOS (CON FILTROS Y PAGINACIÓN)
// =====================================================
/**
 * @swagger
 * /usuarios:
 *   get:
 *     summary: Obtener todos los usuarios con filtros y paginación
 *     description: |
 *       Lista usuarios del sistema con opciones de filtrado por rol y estado activo.
 *       Incluye paginación para manejar grandes conjuntos de datos.
 *
 *       **Contexto del negocio:**
 *       - Supermercado con 6 empleados
 *       - Filtros útiles para dashboard administrativo
 *     tags: [Usuarios]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: rol
 *         schema:
 *           type: string
 *           enum: [administrador, cajero, dueño, ayudante]
 *         description: Filtrar por rol específico
 *         example: cajero
 *       - in: query
 *         name: activo
 *         schema:
 *           type: string
 *           enum: [true, false, all]
 *           default: "true"
 *         description: |
 *           Filtrar por estado activo:
 *           - `true`: Solo usuarios activos
 *           - `false`: Solo usuarios inactivos
 *           - `all`: Todos los usuarios
 *         example: "true"
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: Número de página
 *         example: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 20
 *         description: Límite de resultados por página
 *         example: 20
 *     responses:
 *       200:
 *         description: Lista de usuarios obtenida exitosamente
 *       400:
 *         description: Parámetros de consulta inválidos
 *       401:
 *         description: No autorizado
 *       403:
 *         description: Permisos insuficientes (requiere rol administrador o dueño)
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
// 🔍 BUSCAR USUARIOS (CON RATE LIMITER)
// =====================================================
/**
 * @swagger
 * /usuarios/buscar:
 *   get:
 *     summary: Buscar usuarios por término (nombre, apellido, username, email)
 *     description: |
 *       Búsqueda flexible de usuarios por múltiples campos.
 *       Utiliza LIKE para coincidencias parciales.
 *
 *       **Rate Limiting:**
 *       - Máximo 30 búsquedas cada 5 minutos por usuario
 *       - Previene enumeración de cuentas y abuso del sistema
 *
 *       **Contexto:**
 *       - Búsquedas con LIKE son costosas en MySQL
 *       - Con 6 empleados, 30 búsquedas/5min es muy generoso
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
 *         description: Término de búsqueda (busca en nombre, apellido, username, email)
 *         example: "juan"
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 50
 *           default: 10
 *         description: Límite de resultados
 *         example: 10
 *       - in: query
 *         name: incluirInactivos
 *         schema:
 *           type: boolean
 *           default: false
 *         description: Incluir usuarios inactivos en los resultados
 *         example: false
 *     responses:
 *       200:
 *         description: Resultados de búsqueda obtenidos exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Usuario'
 *                 metadata:
 *                   type: object
 *                   properties:
 *                     termino_busqueda:
 *                       type: string
 *                     resultados_encontrados:
 *                       type: integer
 *                     incluye_inactivos:
 *                       type: boolean
 *       400:
 *         description: Término de búsqueda inválido
 *       401:
 *         description: No autorizado
 *       429:
 *         description: Límite de búsquedas excedido (30 cada 5 minutos)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/RateLimitError'
 */
router.get(
  "/buscar",
  usuariosSearchLimiter, // ✅ Rate limiter: 30 búsquedas / 5 min
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
 *     description: |
 *       Obtiene los detalles completos de un usuario específico.
 *       No incluye información sensible como contraseña.
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
 *         description: ID único del usuario
 *         example: 1
 *     responses:
 *       200:
 *         description: Usuario obtenido exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/Usuario'
 *                 metadata:
 *                   type: object
 *                   properties:
 *                     timestamp:
 *                       type: string
 *                       format: date-time
 *                 cache_info:
 *                   $ref: '#/components/schemas/CacheInfo'
 *       404:
 *         description: Usuario no encontrado
 *       401:
 *         description: No autorizado
 *       403:
 *         description: Permisos insuficientes
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
// ✨ CREAR NUEVO USUARIO (CON RATE LIMITER)
// =====================================================
/**
 * @swagger
 * /usuarios:
 *   post:
 *     summary: Crear nuevo usuario
 *     description: |
 *       Crea un nuevo usuario en el sistema con validaciones robustas.
 *
 *       **Rate Limiting:**
 *       - Máximo 20 operaciones cada 15 minutos por administrador
 *       - Permite retrabajos por errores humanos
 *       - Más estricto que otras entidades por seguridad
 *
 *       **Validaciones:**
 *       - Username único (case-insensitive)
 *       - Email único (case-insensitive)
 *       - Password debe cumplir requisitos de seguridad
 *       - Contraseña se hashea automáticamente con bcrypt
 *
 *       **Contexto del negocio:**
 *       - Supermercado con 6 empleados
 *       - Operaciones infrecuentes (1-2 usuarios/mes)
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
 *                 pattern: '^[a-zA-Z0-9]+$'
 *                 description: Nombre de usuario (solo letras y números)
 *                 example: "jperez"
 *               password:
 *                 type: string
 *                 minLength: 8
 *                 maxLength: 100
 *                 pattern: '^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)'
 *                 description: Contraseña (min 8 chars, 1 mayúscula, 1 minúscula, 1 número)
 *                 example: "Pass1234"
 *               password_confirmacion:
 *                 type: string
 *                 description: Confirmación de contraseña (debe coincidir)
 *                 example: "Pass1234"
 *               email:
 *                 type: string
 *                 format: email
 *                 minLength: 5
 *                 maxLength: 100
 *                 description: Email único del usuario
 *                 example: "jperez@example.com"
 *               nombre:
 *                 type: string
 *                 minLength: 2
 *                 maxLength: 50
 *                 description: Nombre(s) del usuario
 *                 example: "Juan"
 *               apellido:
 *                 type: string
 *                 minLength: 2
 *                 maxLength: 50
 *                 description: Apellido(s) del usuario
 *                 example: "Pérez"
 *               rol:
 *                 type: string
 *                 enum: [administrador, cajero, dueño, ayudante]
 *                 description: Rol del usuario en el sistema
 *                 example: "cajero"
 *               activo:
 *                 type: boolean
 *                 default: true
 *                 description: Estado inicial del usuario
 *                 example: true
 *     responses:
 *       201:
 *         description: Usuario creado exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     mensaje:
 *                       type: string
 *                       example: "Usuario jperez creado exitosamente"
 *                     usuario:
 *                       $ref: '#/components/schemas/Usuario'
 *                 metadata:
 *                   type: object
 *                   properties:
 *                     operacion:
 *                       type: string
 *                       example: "creacion"
 *                     resource_id:
 *                       type: integer
 *                     timestamp:
 *                       type: string
 *                       format: date-time
 *       400:
 *         description: Errores de validación o usuario duplicado
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 error:
 *                   type: object
 *                   properties:
 *                     message:
 *                       type: string
 *                       example: "Ya existe un usuario con el nombre de usuario \"jperez\""
 *                     details:
 *                       type: object
 *                       properties:
 *                         field:
 *                           type: string
 *                           example: "username"
 *                         constraint:
 *                           type: string
 *                           example: "unique"
 *       401:
 *         description: No autorizado
 *       403:
 *         description: Permisos insuficientes
 *       429:
 *         description: Límite de operaciones excedido (20 cada 15 minutos)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/RateLimitError'
 */
router.post(
  "/",
  usuariosWriteLimiter, // ✅ Rate limiter: 20 ops / 15 min
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
// 🔄 ACTUALIZAR USUARIO (CON RATE LIMITER)
// =====================================================
/**
 * @swagger
 * /usuarios/{id}:
 *   put:
 *     summary: Actualizar usuario existente
 *     description: |
 *       Actualiza uno o más campos de un usuario existente.
 *
 *       **Rate Limiting:**
 *       - Máximo 20 operaciones cada 15 minutos
 *
 *       **Validaciones:**
 *       - Username único si se cambia
 *       - Email único si se cambia
 *       - Password requiere confirmación si se cambia
 *       - Al menos un campo debe ser actualizado
 *
 *       **Nota:** Si se cambia la contraseña, se invalidan todas las sesiones activas del usuario.
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
 *         description: ID del usuario a actualizar
 *         example: 1
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
 *                 minLength: 3
 *                 maxLength: 50
 *                 example: "jperez2"
 *               password:
 *                 type: string
 *                 minLength: 8
 *                 maxLength: 100
 *                 example: "NewPass1234"
 *               password_confirmacion:
 *                 type: string
 *                 description: Requerido si se proporciona password
 *                 example: "NewPass1234"
 *               email:
 *                 type: string
 *                 format: email
 *                 example: "jperez2@example.com"
 *               nombre:
 *                 type: string
 *                 minLength: 2
 *                 maxLength: 50
 *                 example: "Juan Carlos"
 *               apellido:
 *                 type: string
 *                 minLength: 2
 *                 maxLength: 50
 *                 example: "Pérez García"
 *               rol:
 *                 type: string
 *                 enum: [administrador, cajero, dueño, ayudante]
 *                 example: "administrador"
 *               activo:
 *                 type: boolean
 *                 example: true
 *           examples:
 *             cambiar_email:
 *               summary: Cambiar email
 *               value:
 *                 email: "nuevo.email@example.com"
 *             cambiar_password:
 *               summary: Cambiar contraseña
 *               value:
 *                 password: "NewPass1234"
 *                 password_confirmacion: "NewPass1234"
 *             promocion:
 *               summary: Promover a administrador
 *               value:
 *                 rol: "administrador"
 *     responses:
 *       200:
 *         description: Usuario actualizado exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     mensaje:
 *                       type: string
 *                       example: "Usuario jperez actualizado exitosamente"
 *                     cambios_realizados:
 *                       type: array
 *                       items:
 *                         type: string
 *                       example: ["email", "rol"]
 *                 metadata:
 *                   type: object
 *                   properties:
 *                     operacion:
 *                       type: string
 *                     campos_modificados:
 *                       type: array
 *                       items:
 *                         type: string
 *       400:
 *         description: Errores de validación o datos duplicados
 *       404:
 *         description: Usuario no encontrado
 *       429:
 *         description: Límite de operaciones excedido
 */
router.put(
  "/:id",
  usuariosWriteLimiter, // ✅ Rate limiter: 20 ops / 15 min
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
// 🔀 TOGGLE ESTADO USUARIO (CON RATE LIMITER CRÍTICO)
// =====================================================
/**
 * @swagger
 * /usuarios/{id}/toggle-estado:
 *   patch:
 *     summary: Cambiar estado del usuario (activar/desactivar)
 *     description: |
 *       Activa o desactiva un usuario en el sistema.
 *       Operación crítica que afecta el acceso al sistema.
 *
 *       **Rate Limiting CRÍTICO:**
 *       - Máximo 10 operaciones cada 15 minutos
 *       - Límite más estricto por impacto en seguridad
 *
 *       **Restricciones:**
 *       - No puede desactivar su propia cuenta
 *       - Usuario desactivado no puede autenticarse
 *       - Sesiones activas se mantienen hasta expiración
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
 *         example: 2
 *     responses:
 *       200:
 *         description: Estado del usuario cambiado exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     mensaje:
 *                       type: string
 *                       example: "Usuario jperez desactivado exitosamente"
 *                     usuario:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: integer
 *                         username:
 *                           type: string
 *                         activo:
 *                           type: boolean
 *                 metadata:
 *                   type: object
 *                   properties:
 *                     operacion:
 *                       type: string
 *                       example: "toggle_estado_desactivado"
 *                     estado_anterior:
 *                       type: boolean
 *                     estado_nuevo:
 *                       type: boolean
 *       400:
 *         description: No puede modificar su propia cuenta
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 error:
 *                   type: object
 *                   properties:
 *                     message:
 *                       type: string
 *                       example: "No puedes modificar el estado de tu propia cuenta"
 *                     details:
 *                       type: object
 *                       properties:
 *                         restriction:
 *                           type: string
 *                           example: "self_modification_forbidden"
 *       404:
 *         description: Usuario no encontrado
 *       429:
 *         description: Límite de operaciones críticas excedido (10 cada 15 minutos)
 */
router.patch(
  "/:id/toggle-estado",
  criticalUsuarioLimiter, // ✅ Rate limiter CRÍTICO: 10 ops / 15 min
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
// 🔑 RESETEAR CONTRASEÑA (CON RATE LIMITER CRÍTICO)
// =====================================================
/**
 * @swagger
 * /usuarios/{id}/resetear-password:
 *   post:
 *     summary: Resetear contraseña de usuario (solo administradores)
 *     description: |
 *       Resetea la contraseña de un usuario (solo para administradores).
 *       El usuario objetivo debe cambiarla en su próximo login.
 *
 *       **Rate Limiting CRÍTICO:**
 *       - Máximo 10 operaciones cada 15 minutos
 *       - Operación sensible con auditoría completa
 *
 *       **Restricciones:**
 *       - No puede resetear su propia contraseña (usar /auth/cambiar-password)
 *       - Se invalidan todas las sesiones activas del usuario objetivo
 *       - Requiere rol administrador o dueño
 *
 *       **Seguridad:**
 *       - Contraseña se hashea automáticamente
 *       - Operación queda registrada en logs
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
 *         description: ID del usuario cuya contraseña será reseteada
 *         example: 2
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
 *                 maxLength: 100
 *                 pattern: '^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)'
 *                 description: Nueva contraseña (min 8 chars, 1 mayúscula, 1 minúscula, 1 número)
 *                 example: "NewPass1234"
 *               password_confirmacion:
 *                 type: string
 *                 description: Confirmación de nueva contraseña
 *                 example: "NewPass1234"
 *           example:
 *             password_nuevo: "NewPass1234"
 *             password_confirmacion: "NewPass1234"
 *     responses:
 *       200:
 *         description: Contraseña reseteada exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     mensaje:
 *                       type: string
 *                       example: "Contraseña del usuario jperez reseteada exitosamente"
 *                     usuario:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: integer
 *                         username:
 *                           type: string
 *                 metadata:
 *                   type: object
 *                   properties:
 *                     operacion:
 *                       type: string
 *                       example: "reseteo_password"
 *                     fecha_reseteo:
 *                       type: string
 *                       format: date-time
 *       400:
 *         description: No puede resetear su propia contraseña
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 error:
 *                   type: object
 *                   properties:
 *                     message:
 *                       type: string
 *                       example: "Para cambiar tu propia contraseña usa el endpoint /auth/cambiar-password"
 *                     details:
 *                       type: object
 *                       properties:
 *                         restriction:
 *                           type: string
 *                           example: "self_reset_forbidden"
 *                         alternative_endpoint:
 *                           type: string
 *                           example: "/api/auth/cambiar-password"
 *       404:
 *         description: Usuario no encontrado
 *       429:
 *         description: Límite de operaciones críticas excedido (10 cada 15 minutos)
 */
router.post(
  "/:id/resetear-password",
  criticalUsuarioLimiter,
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
// 📋 SWAGGER COMPONENTS - USUARIOS
// =====================================================

/**
 * @swagger
 * components:
 *   securitySchemes:
 *     bearerAuth:
 *       type: http
 *       scheme: bearer
 *       bearerFormat: JWT
 *       description: Token JWT obtenido del endpoint /api/auth/login
 *
 *   schemas:
 *     Usuario:
 *       type: object
 *       description: Entidad usuario del sistema
 *       properties:
 *         id:
 *           type: integer
 *           description: ID único del usuario
 *           example: 1
 *         username:
 *           type: string
 *           description: Nombre de usuario único para autenticación
 *           minLength: 3
 *           maxLength: 50
 *           example: "jperez"
 *         email:
 *           type: string
 *           format: email
 *           description: Email único del usuario
 *           example: "jperez@example.com"
 *         nombre:
 *           type: string
 *           description: Nombre(s) del usuario
 *           example: "Juan"
 *         apellido:
 *           type: string
 *           description: Apellido(s) del usuario
 *           example: "Pérez"
 *         rol:
 *           type: string
 *           enum: [administrador, cajero, dueño, ayudante]
 *           description: |
 *             Rol del usuario en el sistema:
 *             - `administrador`: Acceso completo al sistema
 *             - `cajero`: Gestión de ventas
 *             - `dueño`: Acceso completo + reportes avanzados
 *             - `ayudante`: Acceso limitado a operaciones básicas
 *           example: "cajero"
 *         activo:
 *           type: boolean
 *           description: Estado del usuario (true = activo, false = inactivo/desactivado)
 *           example: true
 *         fecha_creacion:
 *           type: string
 *           format: date-time
 *           description: Fecha de creación del usuario
 *           example: "2024-01-15T10:30:00.000Z"
 *         fecha_actualizacion:
 *           type: string
 *           format: date-time
 *           description: Última actualización del registro (se actualiza automáticamente)
 *           example: "2024-12-20T15:45:00.000Z"
 *       required:
 *         - id
 *         - username
 *         - email
 *         - nombre
 *         - apellido
 *         - rol
 *         - activo
 *       example:
 *         id: 1
 *         username: "jperez"
 *         email: "jperez@example.com"
 *         nombre: "Juan"
 *         apellido: "Pérez"
 *         rol: "cajero"
 *         activo: true
 *         fecha_creacion: "2024-01-15T10:30:00.000Z"
 *         fecha_actualizacion: "2024-12-20T15:45:00.000Z"
 *
 *     UsuarioCrear:
 *       type: object
 *       description: Datos requeridos para crear un nuevo usuario
 *       properties:
 *         username:
 *           type: string
 *           minLength: 3
 *           maxLength: 50
 *           pattern: '^[a-zA-Z0-9]+$'
 *           description: Nombre de usuario único (solo letras y números, sin espacios)
 *           example: "jperez"
 *         password:
 *           type: string
 *           minLength: 8
 *           maxLength: 100
 *           pattern: '^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)'
 *           description: |
 *             Contraseña del usuario. Requisitos:
 *             - Mínimo 8 caracteres
 *             - Al menos 1 letra minúscula
 *             - Al menos 1 letra mayúscula
 *             - Al menos 1 número
 *           example: "Pass1234"
 *         password_confirmacion:
 *           type: string
 *           description: Confirmación de contraseña (debe coincidir con password)
 *           example: "Pass1234"
 *         email:
 *           type: string
 *           format: email
 *           minLength: 5
 *           maxLength: 100
 *           description: Email único del usuario
 *           example: "jperez@example.com"
 *         nombre:
 *           type: string
 *           minLength: 2
 *           maxLength: 50
 *           description: Nombre(s) del usuario
 *           example: "Juan"
 *         apellido:
 *           type: string
 *           minLength: 2
 *           maxLength: 50
 *           description: Apellido(s) del usuario
 *           example: "Pérez"
 *         rol:
 *           type: string
 *           enum: [administrador, cajero, dueño, ayudante]
 *           description: Rol del usuario en el sistema
 *           example: "cajero"
 *         activo:
 *           type: boolean
 *           default: true
 *           description: Estado inicial del usuario (opcional, por defecto true)
 *           example: true
 *       required:
 *         - username
 *         - password
 *         - password_confirmacion
 *         - email
 *         - nombre
 *         - apellido
 *         - rol
 *       example:
 *         username: "jperez"
 *         password: "Pass1234"
 *         password_confirmacion: "Pass1234"
 *         email: "jperez@example.com"
 *         nombre: "Juan"
 *         apellido: "Pérez"
 *         rol: "cajero"
 *         activo: true
 *
 *     UsuarioActualizar:
 *       type: object
 *       description: Datos para actualizar un usuario existente (todos opcionales, al menos uno requerido)
 *       properties:
 *         username:
 *           type: string
 *           minLength: 3
 *           maxLength: 50
 *           example: "jperez2"
 *         password:
 *           type: string
 *           minLength: 8
 *           maxLength: 100
 *           description: Nueva contraseña (requiere password_confirmacion)
 *           example: "NewPass1234"
 *         password_confirmacion:
 *           type: string
 *           description: Confirmación de nueva contraseña (requerido si se proporciona password)
 *           example: "NewPass1234"
 *         email:
 *           type: string
 *           format: email
 *           example: "jperez2@example.com"
 *         nombre:
 *           type: string
 *           minLength: 2
 *           maxLength: 50
 *           example: "Juan Carlos"
 *         apellido:
 *           type: string
 *           minLength: 2
 *           maxLength: 50
 *           example: "Pérez García"
 *         rol:
 *           type: string
 *           enum: [administrador, cajero, dueño, ayudante]
 *           example: "administrador"
 *         activo:
 *           type: boolean
 *           example: true
 *       minProperties: 1
 *
 *     ResetPassword:
 *       type: object
 *       description: Datos para resetear contraseña de un usuario (solo administradores)
 *       properties:
 *         password_nuevo:
 *           type: string
 *           minLength: 8
 *           maxLength: 100
 *           pattern: '^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)'
 *           description: Nueva contraseña
 *           example: "NewPass1234"
 *         password_confirmacion:
 *           type: string
 *           description: Confirmación de nueva contraseña
 *           example: "NewPass1234"
 *       required:
 *         - password_nuevo
 *         - password_confirmacion
 *       example:
 *         password_nuevo: "NewPass1234"
 *         password_confirmacion: "NewPass1234"
 *
 *     Pagination:
 *       type: object
 *       description: Información de paginación para listados
 *       properties:
 *         page:
 *           type: integer
 *           description: Página actual (comienza en 1)
 *           minimum: 1
 *           example: 1
 *         limit:
 *           type: integer
 *           description: Límite de resultados por página
 *           minimum: 1
 *           maximum: 100
 *           example: 20
 *         total:
 *           type: integer
 *           description: Total de registros en la base de datos
 *           example: 6
 *         pages:
 *           type: integer
 *           description: Total de páginas disponibles
 *           example: 1
 *       example:
 *         page: 1
 *         limit: 20
 *         total: 6
 *         pages: 1
 *
 *     CacheInfo:
 *       type: object
 *       description: Información sobre caché de la respuesta
 *       properties:
 *         from_cache:
 *           type: boolean
 *           description: Indica si la respuesta proviene del caché de Redis
 *           example: true
 *         cache_timestamp:
 *           type: string
 *           format: date-time
 *           description: Timestamp de cuando se guardó en caché
 *           example: "2024-12-22T10:30:00.000Z"
 *       example:
 *         from_cache: true
 *         cache_timestamp: "2024-12-22T10:30:00.000Z"
 *
 *     RateLimitError:
 *       type: object
 *       description: Error devuelto cuando se excede el límite de rate limiting
 *       properties:
 *         error:
 *           type: string
 *           description: Mensaje de error principal
 *           example: "Límite de operaciones de usuarios excedido temporalmente"
 *         detalles:
 *           type: string
 *           description: Detalles específicos del límite excedido
 *           example: "Has realizado demasiadas operaciones en los últimos 15 minutos (máximo: 20)"
 *         retry_after_seconds:
 *           type: integer
 *           description: Segundos que debe esperar antes de reintentar
 *           example: 900
 *         tipo:
 *           type: string
 *           description: Tipo específico de límite excedido
 *           enum:
 *             - usuarios_write_limit
 *             - usuarios_critical_limit
 *             - usuarios_search_limit
 *           example: "usuarios_write_limit"
 *         contexto:
 *           type: object
 *           description: Contexto adicional sobre el límite
 *           properties:
 *             limite:
 *               type: integer
 *               description: Límite máximo permitido
 *               example: 20
 *             ventana:
 *               type: string
 *               description: Ventana de tiempo del límite
 *               example: "15 minutos"
 *             razon:
 *               type: string
 *               description: Razón de negocio del límite
 *               example: "Protección contra errores masivos y abuso del sistema"
 *             usuario:
 *               type: integer
 *               nullable: true
 *               description: ID del usuario que excedió el límite
 *               example: 1
 *         sugerencia:
 *           type: string
 *           description: Sugerencia para el usuario sobre cómo proceder
 *           example: "Si necesitas hacer cambios masivos, contacta al administrador del sistema"
 *       example:
 *         error: "Límite de operaciones de usuarios excedido temporalmente"
 *         detalles: "Has realizado demasiadas operaciones en los últimos 15 minutos (máximo: 20)"
 *         retry_after_seconds: 900
 *         tipo: "usuarios_write_limit"
 *         contexto:
 *           limite: 20
 *           ventana: "15 minutos"
 *           razon: "Protección contra errores masivos y abuso del sistema"
 *           usuario: 1
 *         sugerencia: "Si necesitas hacer cambios masivos, contacta al administrador del sistema"
 *
 *     RateLimitInfo:
 *       type: object
 *       description: |
 *         Información sobre los límites de rate limiting aplicados a la entidad Usuarios.
 *         Útil para que el frontend muestre límites proactivamente.
 *       properties:
 *         usuarios_crear_actualizar:
 *           type: object
 *           description: Límites para crear y actualizar usuarios
 *           properties:
 *             limite:
 *               type: integer
 *               description: Número máximo de operaciones permitidas
 *               example: 20
 *             ventana:
 *               type: string
 *               description: Ventana de tiempo para el límite
 *               example: "15 minutos"
 *             descripcion:
 *               type: string
 *               description: Descripción del límite y su justificación
 *               example: "Permite retrabajos por errores humanos, más estricto por seguridad"
 *         usuarios_operaciones_criticas:
 *           type: object
 *           description: Límites para operaciones críticas (toggle estado, reset password)
 *           properties:
 *             limite:
 *               type: integer
 *               example: 10
 *             ventana:
 *               type: string
 *               example: "15 minutos"
 *             descripcion:
 *               type: string
 *               example: "Toggle estado y reset password - operaciones que afectan acceso al sistema"
 *         usuarios_busquedas:
 *           type: object
 *           description: Límites para búsquedas de usuarios
 *           properties:
 *             limite:
 *               type: integer
 *               example: 30
 *             ventana:
 *               type: string
 *               example: "5 minutos"
 *             descripcion:
 *               type: string
 *               example: "Previene enumeración de cuentas y abuso de búsquedas costosas"
 *       example:
 *         usuarios_crear_actualizar:
 *           limite: 20
 *           ventana: "15 minutos"
 *           descripcion: "Permite retrabajos por errores humanos, más estricto por seguridad"
 *         usuarios_operaciones_criticas:
 *           limite: 10
 *           ventana: "15 minutos"
 *           descripcion: "Toggle estado y reset password - operaciones que afectan acceso al sistema"
 *         usuarios_busquedas:
 *           limite: 30
 *           ventana: "5 minutos"
 *           descripcion: "Previene enumeración de cuentas y abuso de búsquedas costosas"
 *
 *     SuccessResponse:
 *       type: object
 *       description: Estructura estándar de respuesta exitosa
 *       properties:
 *         success:
 *           type: boolean
 *           description: Indica si la operación fue exitosa
 *           example: true
 *         data:
 *           type: object
 *           description: Datos de la respuesta (estructura varía según endpoint)
 *         metadata:
 *           type: object
 *           description: Metadatos de la operación
 *           properties:
 *             operacion:
 *               type: string
 *               description: Tipo de operación realizada
 *               example: "creacion"
 *             timestamp:
 *               type: string
 *               format: date-time
 *               description: Timestamp de la operación
 *               example: "2024-12-22T10:30:00.000Z"
 *         cache_info:
 *           $ref: '#/components/schemas/CacheInfo'
 *
 *     ErrorResponse:
 *       type: object
 *       description: Estructura estándar de respuesta de error
 *       properties:
 *         success:
 *           type: boolean
 *           description: Siempre false en errores
 *           example: false
 *         error:
 *           type: object
 *           properties:
 *             message:
 *               type: string
 *               description: Mensaje de error legible
 *               example: "Usuario no encontrado"
 *             code:
 *               type: integer
 *               description: Código HTTP del error
 *               example: 400
 *             timestamp:
 *               type: string
 *               format: date-time
 *               example: "2024-12-22T10:30:00.000Z"
 *             details:
 *               type: object
 *               description: Detalles adicionales del error (opcional)
 *       example:
 *         success: false
 *         error:
 *           message: "Ya existe un usuario con el nombre de usuario \"jperez\""
 *           code: 400
 *           timestamp: "2024-12-22T10:30:00.000Z"
 *           details:
 *             field: "username"
 *             constraint: "unique"
 *
 *   responses:
 *     UnauthorizedError:
 *       description: Token de autenticación no proporcionado o inválido
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               error:
 *                 type: string
 *                 example: "Token de acceso requerido"
 *           examples:
 *             sin_token:
 *               summary: Sin token
 *               value:
 *                 error: "Token de acceso requerido"
 *             token_invalido:
 *               summary: Token inválido
 *               value:
 *                 error: "Token inválido o expirado"
 *
 *     ForbiddenError:
 *       description: Permisos insuficientes para realizar la operación
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               error:
 *                 type: string
 *                 example: "No tienes permisos para realizar esta acción"
 *               requiredRoles:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Roles requeridos para la operación
 *                 example: ["administrador", "dueño"]
 *               userRole:
 *                 type: string
 *                 description: Rol actual del usuario
 *                 example: "cajero"
 *           example:
 *             error: "No tienes permisos para realizar esta acción"
 *             requiredRoles: ["administrador", "dueño"]
 *             userRole: "cajero"
 *
 *     NotFoundError:
 *       description: Recurso no encontrado
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ErrorResponse'
 *           example:
 *             success: false
 *             error:
 *               message: "Usuario no encontrado"
 *               code: 400
 *               timestamp: "2024-12-22T10:30:00.000Z"
 *
 *     ValidationError:
 *       description: Errores de validación de datos
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               error:
 *                 type: string
 *                 example: "Datos de entrada inválidos"
 *               details:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     field:
 *                       type: string
 *                       description: Campo que falló la validación
 *                       example: "password"
 *                     message:
 *                       type: string
 *                       description: Mensaje de error específico
 *                       example: "La contraseña debe tener al menos 8 caracteres"
 *           example:
 *             error: "Datos de entrada inválidos"
 *             details:
 *               - field: "password"
 *                 message: "La contraseña debe tener al menos 8 caracteres"
 *               - field: "email"
 *                 message: "El email debe tener un formato válido"
 *
 *     RateLimitExceeded:
 *       description: Límite de rate limiting excedido
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/RateLimitError'
 *
 *   parameters:
 *     usuarioId:
 *       in: path
 *       name: id
 *       required: true
 *       schema:
 *         type: integer
 *         minimum: 1
 *       description: ID único del usuario
 *       example: 1
 *
 *     pageParam:
 *       in: query
 *       name: page
 *       schema:
 *         type: integer
 *         minimum: 1
 *         default: 1
 *       description: Número de página para paginación
 *       example: 1
 *
 *     limitParam:
 *       in: query
 *       name: limit
 *       schema:
 *         type: integer
 *         minimum: 1
 *         maximum: 100
 *         default: 20
 *       description: Límite de resultados por página
 *       example: 20
 *
 *   tags:
 *     - name: Usuarios
 *       description: |
 *         Gestión completa de usuarios del sistema de supermercado.
 *
 *         ## Contexto del Negocio
 *         - Supermercado con 6 empleados
 *         - Roles: administrador, cajero, dueño, ayudante
 *         - Operaciones de usuarios infrecuentes (1-2/mes en promedio)
 *
 *         ## Seguridad
 *         - Contraseñas hasheadas con bcrypt (nunca se almacenan en texto plano)
 *         - Validación de unicidad para username y email (case-insensitive)
 *         - Protección contra auto-modificación crítica (no puede desactivarse ni resetear su propia contraseña)
 *         - Invalidación automática de sesiones cuando se cambia contraseña
 *
 *         ## Rate Limiting
 *
 *         **Operaciones de Escritura (Crear/Actualizar):**
 *         - Límite: 20 operaciones cada 15 minutos por administrador
 *         - Justificación: Permite retrabajos por errores humanos, más estricto que otras entidades por seguridad
 *
 *         **Operaciones Críticas (Toggle Estado / Reset Password):**
 *         - Límite: 10 operaciones cada 15 minutos
 *         - Justificación: Operaciones que afectan directamente el acceso al sistema, requieren auditoría estricta
 *
 *         **Búsquedas:**
 *         - Límite: 30 búsquedas cada 5 minutos
 *         - Justificación: Búsquedas con LIKE son costosas en MySQL, previene enumeración de cuentas
 *
 *         ## Caché
 *         - Usuarios individuales: 10 minutos (USUARIO_INDIVIDUAL)
 *         - Listas paginadas: 5 minutos (USUARIOS_PAGINADOS)
 *         - Búsquedas: 4 minutos (USUARIOS_SEARCH)
 *         - Invalidación automática en operaciones de escritura
 *
 *         ## Permisos
 *         Todas las operaciones requieren autenticación (Bearer token).
 *         Solo usuarios con rol `administrador` o `dueño` pueden gestionar usuarios.
 */

export default router;
