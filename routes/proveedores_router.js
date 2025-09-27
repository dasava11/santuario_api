import express from "express";

// Importar controladores (funciones individuales)
import {
  obtenerProveedores,
  obtenerProveedorPorId,
  crearProveedor,
  actualizarProveedor,
  eliminarProveedor,
} from "../controllers/proveedoresControlador.js";

// Importar middlewares de autenticación
import { verifyToken, verifyRole } from "../middleware/auth.js";

// Importar validaciones
import {
  validate,
  proveedoresSchemas,
  validateProveedorId,
  validateProveedoresQuery,
} from "../validations/proveedores_validations.js";

const router = express.Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     Proveedor:
 *       type: object
 *       required:
 *         - nombre
 *       properties:
 *         id:
 *           type: integer
 *           description: ID único del proveedor
 *         nombre:
 *           type: string
 *           minLength: 2
 *           maxLength: 200
 *           description: Nombre del proveedor
 *         contacto:
 *           type: string
 *           maxLength: 200
 *           description: Persona de contacto
 *           nullable: true
 *         telefono:
 *           type: string
 *           maxLength: 20
 *           description: Número de teléfono
 *           nullable: true
 *         email:
 *           type: string
 *           format: email
 *           maxLength: 255
 *           description: Correo electrónico
 *           nullable: true
 *         direccion:
 *           type: string
 *           maxLength: 500
 *           description: Dirección física
 *           nullable: true
 *         ciudad:
 *           type: string
 *           maxLength: 100
 *           description: Ciudad
 *           nullable: true
 *         pais:
 *           type: string
 *           maxLength: 100
 *           description: País
 *           nullable: true
 *         activo:
 *           type: boolean
 *           default: true
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
 *
 *     ProveedorCreate:
 *       type: object
 *       required:
 *         - nombre
 *       properties:
 *         nombre:
 *           type: string
 *           minLength: 2
 *           maxLength: 200
 *         contacto:
 *           type: string
 *           maxLength: 200
 *           nullable: true
 *         telefono:
 *           type: string
 *           maxLength: 20
 *           nullable: true
 *         email:
 *           type: string
 *           format: email
 *           maxLength: 255
 *           nullable: true
 *         direccion:
 *           type: string
 *           maxLength: 500
 *           nullable: true
 *         ciudad:
 *           type: string
 *           maxLength: 100
 *           nullable: true
 *         pais:
 *           type: string
 *           maxLength: 100
 *           nullable: true
 *         activo:
 *           type: boolean
 *           default: true
 *
 *     ProveedorUpdate:
 *       type: object
 *       minProperties: 1
 *       properties:
 *         nombre:
 *           type: string
 *           minLength: 2
 *           maxLength: 200
 *         contacto:
 *           type: string
 *           maxLength: 200
 *           nullable: true
 *         telefono:
 *           type: string
 *           maxLength: 20
 *           nullable: true
 *         email:
 *           type: string
 *           format: email
 *           maxLength: 255
 *           nullable: true
 *         direccion:
 *           type: string
 *           maxLength: 500
 *           nullable: true
 *         ciudad:
 *           type: string
 *           maxLength: 100
 *           nullable: true
 *         pais:
 *           type: string
 *           maxLength: 100
 *           nullable: true
 *         activo:
 *           type: boolean
 *
 *
 *     ProveedorResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *         data:
 *           $ref: '#/components/schemas/Proveedor'
 *
 *     ProveedoresListResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *         data:
 *           type: object
 *           properties:
 *             proveedores:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Proveedor'
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
 *     responses:
 *       200:
 *         description: Lista de proveedores obtenida exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ProveedoresListResponse'
 *       400:
 *         description: Parámetros de consulta inválidos
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       401:
 *         description: No autorizado
 *       500:
 *         description: Error interno del servidor
 */
router.get("/", verifyToken, validateProveedoresQuery, obtenerProveedores);

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
 *     responses:
 *       200:
 *         description: Proveedor obtenido exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ProveedorResponse'
 *       400:
 *         description: ID de proveedor inválido
 *       404:
 *         description: Proveedor no encontrado
 *       401:
 *         description: No autorizado
 *       500:
 *         description: Error interno del servidor
 */
router.get("/:id", verifyToken, validateProveedorId, obtenerProveedorPorId);

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
 *             $ref: '#/components/schemas/ProveedorCreate'
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
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Distribuidora ABC fue creado con éxito"
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: integer
 *                       example: 123
 *       400:
 *         description: Errores de validación o reglas de negocio
 *       401:
 *         description: No autorizado
 *       403:
 *         description: Permisos insuficientes
 *       500:
 *         description: Error interno del servidor
 */
router.post(
  "/",
  verifyToken,
  verifyRole(["administrador", "dueño"]),
  validate(proveedoresSchemas.createProveedor),
  crearProveedor
);

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
 *             $ref: '#/components/schemas/ProveedorUpdate'
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
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Distribuidora ABC Actualizada fue actualizado con  éxito"
 *       400:
 *         description: Errores de validación o reglas de negocio
 *       404:
 *         description: Proveedor no encontrado
 *       401:
 *         description: No autorizado
 *       403:
 *         description: Permisos insuficientes
 *       500:
 *         description: Error interno del servidor
 */
router.put(
  "/:id",
  verifyToken,
  verifyRole(["administrador", "dueño"]),
  validateProveedorId,
  validate(proveedoresSchemas.updateProveedor),
  actualizarProveedor
);

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
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Proveedor desactivado exitosamente"
 *       400:
 *         description: ID de proveedor inválido
 *       404:
 *         description: Proveedor no encontrado
 *       401:
 *         description: No autorizado
 *       403:
 *         description: Permisos insuficientes
 *       500:
 *         description: Error interno del servidor
 */
router.delete(
  "/:id",
  verifyToken,
  verifyRole(["administrador", "dueño"]),
  validateProveedorId,
  eliminarProveedor
);

export default router;
