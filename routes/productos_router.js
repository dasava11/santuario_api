// routes/productos_router.js
import express from "express";

// Controladores
import {
  obtenerProductos,
  obtenerProductoPorId,
  obtenerProductoPorCodigoBarras,
  crearProducto,
  actualizarProducto,
  eliminarProducto,
} from "../controllers/productosControlador.js";

// Middlewares de autenticación
import { verifyToken, verifyRole } from "../middleware/auth.js";

// Middleware de sanitización
import { sanitizeSearch } from "../middleware/sanitizeSearch.js";

// Validaciones específicas
import {
  validateCreateProducto,
  validateUpdateProducto,
  validateProductoId,
  validateCodigoBarras,
  validateGetProductosQuery,
} from "../validations/productos_validations.js";

const router = express.Router();

// =====================================================
// OBTENER TODOS LOS PRODUCTOS
// =====================================================
/**
 * @swagger
 * /productos:
 *   get:
 *     summary: Obtener todos los productos con filtros y paginación
 *     tags: [Productos]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: categoria_id
 *         schema:
 *           type: integer
 *         description: Filtrar por categoría
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *           maxLength: 200
 *         description: Buscar por nombre o descripción
 *       - in: query
 *         name: codigo_barras
 *         schema:
 *           type: string
 *           maxLength: 50
 *         description: Filtrar por código de barras exacto
 *       - in: query
 *         name: activo
 *         schema:
 *           type: string
 *           enum: [true, false, all]
 *           default: all
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
 *           default: 50
 *         description: Límite de resultados por página
 *     responses:
 *       200:
 *         description: Lista de productos obtenida exitosamente
 *       401:
 *         description: No autorizado
 */
router.get(
  "/",
  sanitizeSearch({
    queryFields: ["search", "codigo_barras"],
    maxLength: 200,
    removeDangerousChars: true,
  }),
  verifyToken,
  validateGetProductosQuery,
  obtenerProductos
);

// =====================================================
// BUSCAR PRODUCTO POR CÓDIGO DE BARRAS
// =====================================================
/**
 * @swagger
 * /productos/barcode/{codigo}:
 *   get:
 *     summary: Buscar producto por código de barras (para POS)
 *     tags: [Productos]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: codigo
 *         required: true
 *         schema:
 *           type: string
 *           minLength: 1
 *           maxLength: 50
 *         description: Código de barras del producto
 *     responses:
 *       200:
 *         description: Producto encontrado exitosamente
 *       404:
 *         description: Producto no encontrado con este código de barras
 *       401:
 *         description: No autorizado
 */
router.get(
  "/barcode/:codigo",
  sanitizeSearch({
    paramFields: ["codigo"],
    maxLength: 50,
    removeDangerousChars: true,
  }),
  verifyToken,
  validateCodigoBarras,
  obtenerProductoPorCodigoBarras
);

// =====================================================
// OBTENER PRODUCTO POR ID
// =====================================================
/**
 * @swagger
 * /productos/{id}:
 *   get:
 *     summary: Obtener producto por ID
 *     tags: [Productos]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *           minimum: 1
 *         description: ID del producto
 *     responses:
 *       200:
 *         description: Producto obtenido exitosamente
 *       404:
 *         description: Producto no encontrado
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
  validateProductoId,
  obtenerProductoPorId
);

// =====================================================
// CREAR NUEVO PRODUCTO
// =====================================================
/**
 * @swagger
 * /productos:
 *   post:
 *     summary: Crear nuevo producto
 *     tags: [Productos]
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
 *               - categoria_id
 *               - precio_compra
 *               - precio_venta
 *             properties:
 *               codigo_barras:
 *                 type: string
 *                 maxLength: 50
 *                 nullable: true
 *               nombre:
 *                 type: string
 *                 minLength: 2
 *                 maxLength: 200
 *               descripcion:
 *                 type: string
 *                 maxLength: 1000
 *                 nullable: true
 *               categoria_id:
 *                 type: integer
 *               precio_compra:
 *                 type: number
 *                 format: float
 *               precio_venta:
 *                 type: number
 *                 format: float
 *               tipo_medida:
 *                 type: string
 *                 enum: [unidad, peso]
 *                 default: unidad
 *               stock_actual:
 *                 type: number
 *                 format: float
 *                 default: 0
 *               stock_minimo:
 *                 type: number
 *                 format: float
 *                 default: 0
 *               activo:
 *                 type: boolean
 *                 default: true
 *           example:
 *             codigo_barras: "7501234567890"
 *             nombre: "Arroz Diana 500g"
 *             descripcion: "Arroz blanco de grano largo"
 *             categoria_id: 1
 *             precio_compra: 2500
 *             precio_venta: 3200
 *             tipo_medida: "unidad"
 *             stock_actual: 50
 *             stock_minimo: 10
 *             activo: true
 *     responses:
 *       201:
 *         description: Producto creado exitosamente
 *       400:
 *         description: Errores de validación o producto duplicado
 *       401:
 *         description: No autorizado
 *       403:
 *         description: Permisos insuficientes
 */
router.post(
  "/",
  sanitizeSearch({
    bodyFields: ["nombre", "descripcion", "codigo_barras"],
    maxLength: 200,
    removeDangerousChars: true,
    escapeWildcards: false,
  }),
  verifyToken,
  verifyRole(["administrador", "dueño"]),
  validateCreateProducto,
  crearProducto
);

// =====================================================
// ACTUALIZAR PRODUCTO
// =====================================================
/**
 * @swagger
 * /productos/{id}:
 *   put:
 *     summary: Actualizar producto existente (solo catálogo, NO stock)
 *     description: >
 *       Actualiza información del catálogo del producto (nombre, precios, categoría, etc.).
 *       NOTA: El stock_actual NO se actualiza aquí. Para modificar stock usar el módulo de inventario.
 *     tags: [Productos]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID del producto
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             minProperties: 1
 *             properties:
 *               codigo_barras:
 *                 type: string
 *                 maxLength: 50
 *                 nullable: true
 *               nombre:
 *                 type: string
 *                 minLength: 2
 *                 maxLength: 200
 *               descripcion:
 *                 type: string
 *                 maxLength: 1000
 *                 nullable: true
 *               categoria_id:
 *                 type: integer
 *               precio_compra:
 *                 type: number
 *               precio_venta:
 *                 type: number
 *               tipo_medida:
 *                 type: string
 *                 enum: [unidad, peso]
 *               stock_minimo:
 *                 type: number
 *               activo:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Producto actualizado exitosamente
 *       400:
 *         description: Errores de validación
 *       404:
 *         description: Producto no encontrado
 *       401:
 *         description: No autorizado
 *       403:
 *         description: Permisos insuficientes
 */
router.put(
  "/:id",
  sanitizeSearch({
    paramFields: ["id"],
    bodyFields: ["nombre", "descripcion", "codigo_barras"],
    maxLength: 200,
    removeDangerousChars: true,
    escapeWildcards: false,
  }),
  verifyToken,
  verifyRole(["administrador", "dueño"]),
  validateProductoId,
  validateUpdateProducto,
  actualizarProducto
);

// =====================================================
// ELIMINAR PRODUCTO (DESACTIVAR)
// =====================================================
/**
 * @swagger
 * /productos/{id}:
 *   delete:
 *     summary: Eliminar producto (desactivación lógica)
 *     tags: [Productos]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID del producto
 *     responses:
 *       200:
 *         description: Producto desactivado exitosamente
 *       404:
 *         description: Producto no encontrado
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
  validateProductoId,
  eliminarProducto
);

// =====================================================
// SWAGGER COMPONENTS
// =====================================================
/**
 * @swagger
 * components:
 *   schemas:
 *     Producto:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *         codigo_barras:
 *           type: string
 *           nullable: true
 *         nombre:
 *           type: string
 *         descripcion:
 *           type: string
 *           nullable: true
 *         categoria_id:
 *           type: integer
 *         precio_compra:
 *           type: number
 *           format: float
 *         precio_venta:
 *           type: number
 *           format: float
 *         tipo_medida:
 *           type: string
 *           enum: [unidad, peso]
 *         stock_actual:
 *           type: number
 *           format: float
 *         stock_minimo:
 *           type: number
 *           format: float
 *         activo:
 *           type: boolean
 *         fecha_creacion:
 *           type: string
 *           format: date-time
 *         fecha_actualizacion:
 *           type: string
 *           format: date-time
 *         categoria:
 *           type: object
 *           properties:
 *             id:
 *               type: integer
 *             nombre:
 *               type: string
 */

export default router;
