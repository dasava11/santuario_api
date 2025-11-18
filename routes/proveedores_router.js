// routes/proveedores.js - Router Refactorizado con Sanitización
import express from "express";

// Controladores
import {
  obtenerProveedores,
  obtenerProveedorPorId,
  crearProveedor,
  actualizarProveedor,
  eliminarProveedor,
  obtenerEstadisticasProveedores,
} from "../controllers/proveedoresControlador.js";

// Middlewares de autenticación
import { verifyToken, verifyRole } from "../middleware/auth.js";

// Middleware de sanitización
import { sanitizeSearch } from "../middleware/sanitizeSearch.js";

// Validaciones específicas
import {
  validateCreateProveedor,
  validateUpdateProveedor,
  validateProveedorId,
  validateGetProveedoresQuery,
  validateGetProveedorByIdQuery,
} from "../validations/proveedores_validations.js";

const router = express.Router();

// =====================================================
// 📊 OBTENER TODOS LOS PROVEEDORES
// =====================================================
/**
 * @swagger
 * /proveedores:
 *   get:
 *     summary: Obtener todos los proveedores con filtros y paginación
 *     tags: [Proveedores]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *           maxLength: 200
 *         description: Buscar por nombre, contacto o email
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
 *       - in: query
 *         name: incluir_estadisticas
 *         schema:
 *           type: string
 *           enum: [true, false]
 *           default: "false"
 *         description: Incluir estadísticas de recepciones
 *     responses:
 *       200:
 *         description: Lista de proveedores obtenida exitosamente
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
 *                     proveedores:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Proveedor'
 *                     pagination:
 *                       $ref: '#/components/schemas/Pagination'
 *       400:
 *         description: Parámetros de consulta inválidos
 *       401:
 *         description: No autorizado
 */
router.get(
  "/",
  sanitizeSearch({
    queryFields: ["search", "activo", "incluir_estadisticas"],
    maxLength: 200,
    removeDangerousChars: true,
  }),
  verifyToken,
  validateGetProveedoresQuery,
  obtenerProveedores
);

// =====================================================
// 📊 ESTADÍSTICAS DE PROVEEDORES
// =====================================================
/**
 * @swagger
 * /proveedores/estadisticas:
 *   get:
 *     summary: Obtener estadísticas completas de proveedores
 *     tags: [Proveedores]
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
 *                 data:
 *                   type: object
 *                   properties:
 *                     por_proveedor:
 *                       type: array
 *                       items:
 *                         type: object
 *                     totales:
 *                       type: object
 *                       properties:
 *                         proveedores_activos:
 *                           type: integer
 *                         proveedores_inactivos:
 *                           type: integer
 *                         valor_total_compras:
 *                           type: number
 *       401:
 *         description: No autorizado
 *       403:
 *         description: Permisos insuficientes
 */
router.get(
  "/estadisticas",
  verifyToken,
  verifyRole(["administrador", "dueño"]),
  obtenerEstadisticasProveedores
);

// =====================================================
// 📄 OBTENER PROVEEDOR POR ID
// =====================================================
/**
 * @swagger
 * /proveedores/{id}:
 *   get:
 *     summary: Obtener proveedor por ID
 *     tags: [Proveedores]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *           minimum: 1
 *         description: ID del proveedor
 *       - in: query
 *         name: incluir_recepciones
 *         schema:
 *           type: string
 *           enum: [true, false]
 *           default: "false"
 *         description: Incluir recepciones asociadas
 *     responses:
 *       200:
 *         description: Proveedor obtenido exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/Proveedor'
 *       400:
 *         description: ID de proveedor inválido
 *       404:
 *         description: Proveedor no encontrado
 *       401:
 *         description: No autorizado
 */
router.get(
  "/:id",
  sanitizeSearch({
    paramFields: ["id"],
    queryFields: ["incluir_recepciones"],
    maxLength: 50,
    removeDangerousChars: true,
  }),
  verifyToken,
  validateProveedorId,
  validateGetProveedorByIdQuery,
  obtenerProveedorPorId
);

// =====================================================
// ✨ CREAR NUEVO PROVEEDOR
// =====================================================
/**
 * @swagger
 * /proveedores:
 *   post:
 *     summary: Crear nuevo proveedor
 *     tags: [Proveedores]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - nombre
 *             properties:
 *               nombre:
 *                 type: string
 *                 minLength: 2
 *                 maxLength: 200
 *                 description: Nombre del proveedor
 *               contacto:
 *                 type: string
 *                 maxLength: 100
 *                 description: Persona de contacto
 *               telefono:
 *                 type: string
 *                 maxLength: 20
 *                 description: Número de teléfono
 *               email:
 *                 type: string
 *                 format: email
 *                 maxLength: 100
 *                 description: Correo electrónico
 *               direccion:
 *                 type: string
 *                 maxLength: 500
 *                 description: Dirección física
 *               ciudad:
 *                 type: string
 *                 maxLength: 100
 *                 description: Ciudad
 *               pais:
 *                 type: string
 *                 maxLength: 100
 *                 default: "Colombia"
 *                 description: País
 *               activo:
 *                 type: boolean
 *                 default: true
 *                 description: Estado del proveedor
 *           example:
 *             nombre: "Distribuidora ABC"
 *             contacto: "Juan Pérez"
 *             telefono: "+57 300 123 4567"
 *             email: "contacto@distribuidoraabc.com"
 *             direccion: "Calle 123 #45-67"
 *             ciudad: "Bogotá"
 *             pais: "Colombia"
 *             activo: true
 *     responses:
 *       201:
 *         description: Proveedor creado exitosamente
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
 *                     proveedor:
 *                       $ref: '#/components/schemas/Proveedor'
 *       400:
 *         description: Errores de validación o proveedor duplicado
 *       401:
 *         description: No autorizado
 *       403:
 *         description: Permisos insuficientes
 */
router.post(
  "/",
  sanitizeSearch({
    bodyFields: [
      "nombre",
      "contacto",
      "telefono",
      "email",
      "direccion",
      "ciudad",
      "pais",
    ],
    maxLength: 500,
    removeDangerousChars: true,
    escapeWildcards: false,
  }),
  verifyToken,
  verifyRole(["administrador", "dueño"]),
  validateCreateProveedor,
  crearProveedor
);

// =====================================================
// 🔄 ACTUALIZAR PROVEEDOR
// =====================================================
/**
 * @swagger
 * /proveedores/{id}:
 *   put:
 *     summary: Actualizar proveedor existente
 *     tags: [Proveedores]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *           minimum: 1
 *         description: ID del proveedor
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
 *                 maxLength: 200
 *                 description: Nombre del proveedor
 *               contacto:
 *                 type: string
 *                 maxLength: 100
 *                 description: Persona de contacto
 *               telefono:
 *                 type: string
 *                 maxLength: 20
 *                 description: Número de teléfono
 *               email:
 *                 type: string
 *                 format: email
 *                 maxLength: 100
 *                 description: Correo electrónico
 *               direccion:
 *                 type: string
 *                 maxLength: 500
 *                 description: Dirección física
 *               ciudad:
 *                 type: string
 *                 maxLength: 100
 *                 description: Ciudad
 *               pais:
 *                 type: string
 *                 maxLength: 100
 *                 description: País
 *               activo:
 *                 type: boolean
 *                 description: Estado del proveedor
 *           example:
 *             nombre: "Distribuidora ABC Actualizada"
 *             telefono: "+57 301 987 6543"
 *             activo: false
 *     responses:
 *       200:
 *         description: Proveedor actualizado exitosamente
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
 *                     cambios_realizados:
 *                       type: array
 *                       items:
 *                         type: string
 *       400:
 *         description: Errores de validación o nombre duplicado
 *       404:
 *         description: Proveedor no encontrado
 *       401:
 *         description: No autorizado
 *       403:
 *         description: Permisos insuficientes
 */
router.put(
  "/:id",
  sanitizeSearch({
    paramFields: ["id"],
    bodyFields: [
      "nombre",
      "contacto",
      "telefono",
      "email",
      "direccion",
      "ciudad",
      "pais",
    ],
    maxLength: 500,
    removeDangerousChars: true,
    escapeWildcards: false,
  }),
  verifyToken,
  verifyRole(["administrador", "dueño"]),
  validateProveedorId,
  validateUpdateProveedor,
  actualizarProveedor
);

// =====================================================
// 🗑️ ELIMINAR (DESACTIVAR) PROVEEDOR
// =====================================================
/**
 * @swagger
 * /proveedores/{id}:
 *   delete:
 *     summary: Eliminar proveedor (desactivar)
 *     tags: [Proveedores]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *           minimum: 1
 *         description: ID del proveedor
 *     responses:
 *       200:
 *         description: Proveedor desactivado exitosamente
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
 *                     proveedor:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: integer
 *                         nombre:
 *                           type: string
 *       400:
 *         description: ID inválido o proveedor con recepciones activas
 *       404:
 *         description: Proveedor no encontrado
 *       401:
 *         description: No autorizado
 *       403:
 *         description: Permisos insuficientes
 */
router.delete(
  "/:id",
  sanitizeSearch({
    paramFields: ["id"],
    maxLength: 20,
    removeDangerousChars: true,
  }),
  verifyToken,
  verifyRole(["administrador", "dueño"]),
  validateProveedorId,
  eliminarProveedor
);

// =====================================================
// 📋 SWAGGER COMPONENTS
// =====================================================
/**
 * @swagger
 * components:
 *   schemas:
 *     Proveedor:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *           description: ID único del proveedor
 *         nombre:
 *           type: string
 *           description: Nombre del proveedor
 *         contacto:
 *           type: string
 *           nullable: true
 *           description: Persona de contacto
 *         telefono:
 *           type: string
 *           nullable: true
 *           description: Número de teléfono
 *         email:
 *           type: string
 *           nullable: true
 *           description: Correo electrónico
 *         direccion:
 *           type: string
 *           nullable: true
 *           description: Dirección física
 *         ciudad:
 *           type: string
 *           nullable: true
 *           description: Ciudad
 *         pais:
 *           type: string
 *           nullable: true
 *           description: País
 *         activo:
 *           type: boolean
 *           description: Estado del proveedor
 *         fecha_creacion:
 *           type: string
 *           format: date-time
 *           description: Fecha de creación
 *         fecha_actualizacion:
 *           type: string
 *           format: date-time
 *           description: Fecha de última actualización
 *
 *     Pagination:
 *       type: object
 *       properties:
 *         page:
 *           type: integer
 *           description: Página actual
 *         limit:
 *           type: integer
 *           description: Límite de resultados por página
 *         total:
 *           type: integer
 *           description: Total de registros
 *         pages:
 *           type: integer
 *           description: Total de páginas
 *
 *     ErrorResponse:
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
 *             details:
 *               type: object
 */

export default router;
