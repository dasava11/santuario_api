import express from "express";

// Importar controladores (funciones individuales)
import {
  obtenerCategorias,
  obtenerCategoriaPorId,
  crearCategoria,
  actualizarCategoria,
  eliminarCategoria,
} from "../controllers/categoriasControlador.js";

// Importar middlewares de autenticación
import { verifyToken, verifyRole } from "../middleware/auth.js";

// Importar validaciones
import {
  validate,
  categoriasSchemas,
  validateCategoriaId,
  validateCategoriasQuery,
} from "../validations/categorias_validations.js";

const router = express.Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     Categoria:
 *       type: object
 *       required:
 *         - nombre
 *       properties:
 *         id:
 *           type: integer
 *           description: ID único de la categoría
 *         nombre:
 *           type: string
 *           minLength: 2
 *           maxLength: 100
 *           description: Nombre de la categoría
 *         descripcion:
 *           type: string
 *           maxLength: 500
 *           description: Descripción de la categoría
 *           nullable: true
 *         activo:
 *           type: boolean
 *           default: true
 *           description: Estado de la categoría
 *         fecha_creacion:
 *           type: string
 *           format: date-time
 *           description: Fecha de creación
 *         fecha_actualizacion:
 *           type: string
 *           format: date-time
 *           description: Fecha de última actualización
 *
 *     CategoriaCreate:
 *       type: object
 *       required:
 *         - nombre
 *       properties:
 *         nombre:
 *           type: string
 *           minLength: 2
 *           maxLength: 100
 *           description: Nombre de la categoría
 *         descripcion:
 *           type: string
 *           maxLength: 500
 *           description: Descripción de la categoría
 *           nullable: true
 *
 *     CategoriaUpdate:
 *       type: object
 *       minProperties: 1
 *       properties:
 *         nombre:
 *           type: string
 *           minLength: 2
 *           maxLength: 100
 *           description: Nombre de la categoría
 *         descripcion:
 *           type: string
 *           maxLength: 500
 *           description: Descripción de la categoría
 *           nullable: true
 *
 *     CategoriaResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *         data:
 *           $ref: '#/components/schemas/Categoria'
 *
 *     CategoriasListResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *         data:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/Categoria'
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
 * /categorias:
 *   get:
 *     summary: Obtener todas las categorías
 *     tags: [Categorías]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: activo
 *         schema:
 *           type: string
 *           enum: [true, false, all]
 *           default: "true"
 *         description: Filtrar por estado activo
 *     responses:
 *       200:
 *         description: Lista de categorías obtenida exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CategoriasListResponse'
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
router.get("/", verifyToken, validateCategoriasQuery, obtenerCategorias);

/**
 * @swagger
 * /categorias/{id}:
 *   get:
 *     summary: Obtener categoría por ID
 *     tags: [Categorías]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *           minimum: 1
 *         description: ID de la categoría
 *     responses:
 *       200:
 *         description: Categoría obtenida exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CategoriaResponse'
 *       400:
 *         description: ID de categoría inválido
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: Categoría no encontrada
 *       401:
 *         description: No autorizado
 *       500:
 *         description: Error interno del servidor
 */
router.get("/:id", verifyToken, validateCategoriaId, obtenerCategoriaPorId);

/**
 * @swagger
 * /categorias:
 *   post:
 *     summary: Crear nueva categoría
 *     tags: [Categorías]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CategoriaCreate'
 *           example:
 *             nombre: "Electrónicos"
 *             descripcion: "Productos electrónicos y gadgets"
 *     responses:
 *       201:
 *         description: Categoría creada exitosamente
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
 *                   example: "Electrónicos fue creada con éxito"
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: integer
 *                       example: 123
 *       400:
 *         description: Errores de validación o categoría duplicada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
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
  validate(categoriasSchemas.createCategoria),
  crearCategoria
);

/**
 * @swagger
 * /categorias/{id}:
 *   put:
 *     summary: Actualizar categoría existente
 *     tags: [Categorías]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *           minimum: 1
 *         description: ID de la categoría
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CategoriaUpdate'
 *           example:
 *             nombre: "Electrónicos Actualizados"
 *             descripcion: "Nueva descripción para electrónicos"
 *     responses:
 *       200:
 *         description: Categoría actualizada exitosamente
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
 *                   example: "Electrónicos Actualizados fue actualizada con éxito"
 *       400:
 *         description: Errores de validación o nombre duplicado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: Categoría no encontrada
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
  validateCategoriaId,
  validate(categoriasSchemas.updateCategoria),
  actualizarCategoria
);

/**
 * @swagger
 * /categorias/{id}:
 *   delete:
 *     summary: Eliminar categoría (desactivar)
 *     tags: [Categorías]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *           minimum: 1
 *         description: ID de la categoría
 *     responses:
 *       200:
 *         description: Categoría desactivada exitosamente
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
 *                   example: "Categoría desactivada exitosamente"
 *       400:
 *         description: ID inválido o categoría con productos asociados
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 error:
 *                   type: string
 *                   example: "No se puede desactivar la categoría porque tiene 5 producto(s) activo(s) asociado(s)"
 *       404:
 *         description: Categoría no encontrada
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
  validateCategoriaId,
  eliminarCategoria
);

export default router;
