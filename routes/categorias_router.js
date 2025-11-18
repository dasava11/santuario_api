// routes/categorias.js - Router Refactorizado con Sanitización
import express from "express";

// Controladores
import {
  obtenerCategorias,
  obtenerCategoriaPorId,
  crearCategoria,
  actualizarCategoria,
  eliminarCategoria,
  obtenerEstadisticasCategorias,
} from "../controllers/categoriasControlador.js";

// Middlewares de autenticación
import { verifyToken, verifyRole } from "../middleware/auth.js";

// Middleware de sanitización
import { sanitizeSearch } from "../middleware/sanitizeSearch.js";

// Validaciones específicas
import {
  validateCreateCategoria,
  validateUpdateCategoria,
  validateCategoriaId,
  validateGetCategoriasQuery,
  validateGetCategoriaByIdQuery,
} from "../validations/categorias_validations.js";

const router = express.Router();

// =====================================================
// 📊 OBTENER TODAS LAS CATEGORÍAS
// =====================================================
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
 *           default: "all"
 *         description: Filtrar por estado activo
 *       - in: query
 *         name: incluir_estadisticas
 *         schema:
 *           type: string
 *           enum: [true, false]
 *           default: "false"
 *         description: Incluir estadísticas de productos
 *     responses:
 *       200:
 *         description: Lista de categorías obtenida exitosamente
 *       400:
 *         description: Parámetros de consulta inválidos
 *       401:
 *         description: No autorizado
 */
router.get(
  "/",
  sanitizeSearch({
    queryFields: ["activo", "incluir_estadisticas"],
    maxLength: 50,
    removeDangerousChars: true,
  }),
  verifyToken,
  validateGetCategoriasQuery,
  obtenerCategorias
);

// =====================================================
// 📊 ESTADÍSTICAS DE CATEGORÍAS
// =====================================================
/**
 * @swagger
 * /categorias/estadisticas:
 *   get:
 *     summary: Obtener estadísticas completas de categorías
 *     tags: [Categorías]
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
 *                     por_categoria:
 *                       type: array
 *                       items:
 *                         type: object
 *                     totales:
 *                       type: object
 *       401:
 *         description: No autorizado
 */
router.get(
  "/estadisticas",
  verifyToken,
  verifyRole(["administrador", "dueño"]),
  obtenerEstadisticasCategorias
);

// =====================================================
// 📄 OBTENER CATEGORÍA POR ID
// =====================================================
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
 *       - in: query
 *         name: incluir_productos
 *         schema:
 *           type: string
 *           enum: [true, false]
 *           default: "false"
 *         description: Incluir productos asociados
 *     responses:
 *       200:
 *         description: Categoría obtenida exitosamente
 *       400:
 *         description: ID de categoría inválido
 *       404:
 *         description: Categoría no encontrada
 *       401:
 *         description: No autorizado
 */
router.get(
  "/:id",
  sanitizeSearch({
    paramFields: ["id"],
    queryFields: ["incluir_productos"],
    maxLength: 50,
    removeDangerousChars: true,
  }),
  verifyToken,
  validateCategoriaId,
  validateGetCategoriaByIdQuery,
  obtenerCategoriaPorId
);

// =====================================================
// ✨ CREAR NUEVA CATEGORÍA
// =====================================================
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
 *             type: object
 *             required:
 *               - nombre
 *             properties:
 *               nombre:
 *                 type: string
 *                 minLength: 2
 *                 maxLength: 100
 *                 description: Nombre de la categoría
 *               descripcion:
 *                 type: string
 *                 maxLength: 500
 *                 description: Descripción de la categoría
 *           example:
 *             nombre: "Electrónicos"
 *             descripcion: "Productos electrónicos y gadgets"
 *     responses:
 *       201:
 *         description: Categoría creada exitosamente
 *       400:
 *         description: Errores de validación o categoría duplicada
 *       401:
 *         description: No autorizado
 *       403:
 *         description: Permisos insuficientes
 */
router.post(
  "/",
  sanitizeSearch({
    bodyFields: ["nombre", "descripcion"],
    maxLength: 500,
    removeDangerousChars: true,
    escapeWildcards: false, // No necesario para creación
  }),
  verifyToken,
  verifyRole(["administrador", "dueño"]),
  validateCreateCategoria,
  crearCategoria
);

// =====================================================
// 🔄 ACTUALIZAR CATEGORÍA
// =====================================================
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
 *             type: object
 *             minProperties: 1
 *             properties:
 *               nombre:
 *                 type: string
 *                 minLength: 2
 *                 maxLength: 100
 *                 description: Nombre de la categoría
 *               descripcion:
 *                 type: string
 *                 maxLength: 500
 *                 description: Descripción de la categoría
 *               activo:
 *                 type: boolean
 *                 description: Estado de la categoría
 *           example:
 *             nombre: "Electrónicos Actualizados"
 *             descripcion: "Nueva descripción"
 *     responses:
 *       200:
 *         description: Categoría actualizada exitosamente
 *       400:
 *         description: Errores de validación o nombre duplicado
 *       404:
 *         description: Categoría no encontrada
 *       401:
 *         description: No autorizado
 *       403:
 *         description: Permisos insuficientes
 */
router.put(
  "/:id",
  sanitizeSearch({
    paramFields: ["id"],
    bodyFields: ["nombre", "descripcion"],
    maxLength: 500,
    removeDangerousChars: true,
    escapeWildcards: false,
  }),
  verifyToken,
  verifyRole(["administrador", "dueño"]),
  validateCategoriaId,
  validateUpdateCategoria,
  actualizarCategoria
);

// =====================================================
// 🗑️ ELIMINAR (DESACTIVAR) CATEGORÍA
// =====================================================
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
 *       400:
 *         description: ID inválido o categoría con productos asociados
 *       404:
 *         description: Categoría no encontrada
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
  validateCategoriaId,
  eliminarCategoria
);

export default router;
