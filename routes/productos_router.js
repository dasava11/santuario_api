import express from "express";

// Controladores
import {
  obtenerProductos,
  obtenerProductoPorId,
  obtenerProductoPorCodigoBarras,
  obtenerProductosStockBajo,
  crearProducto,
  actualizarProducto,
  eliminarProducto,
  actualizarStock,
} from "../controllers/productosControlador.js";

// Middlewares
import { verifyToken, verifyRole } from "../middleware/auth.js";

// Validaciones
import { validate } from "../middleware/validation.js";
import {
  productosSchemas,
  validateProductoId,
  validateCodigoBarras,
  validateProductosQuery,
} from "../validations/productos_validations.js";

const router = express.Router();

/**
 * @swagger
 * components:
 *    schemas:
 *     Categoria:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *         nombre:
 *           type: string
 *
 *     Producto:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *         codigo_barras:
 *           type: string
 *           maxLength: 50
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
 *           default: unidad
 *         stock_actual:
 *           type: number
 *           format: float
 *           default: 0
 *         stock_minimo:
 *           type: number
 *           format: float
 *           default: 0
 *         activo:
 *           type: boolean
 *           default: true
 *         fecha_creacion:
 *           type: string
 *           format: date-time
 *         fecha_actualizacion:
 *           type: string
 *           format: date-time
 *         categoria:
 *           $ref: '#/components/schemas/Categoria'
 *
 *     ProductoCreate:
 *       type: object
 *       required: [nombre, categoria_id, precio_compra, precio_venta]
 *       properties:
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
 *         precio_venta:
 *           type: number
 *         tipo_medida:
 *           type: string
 *           enum: [unidad, peso]
 *         stock_actual:
 *           type: number
 *         stock_minimo:
 *           type: number
 *         activo:
 *           type: boolean
 *
 *     ProductoUpdate:
 *       type: object
 *       minProperties: 1
 *       properties:
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
 *         precio_venta:
 *           type: number
 *         tipo_medida:
 *           type: string
 *           enum: [unidad, peso]
 *         stock_minimo:
 *           type: number
 *         activo:
 *           type: boolean
 *
 *     StockUpdate:
 *       type: object
 *       required: [cantidad, tipo_movimiento]
 *       properties:
 *         cantidad:
 *           type: number
 *         tipo_movimiento:
 *           type: string
 *           enum: [entrada, salida, ajuste]
 *         observaciones:
 *           type: string
 *           maxLength: 1000
 *           default: ""
 *         referencia_id:
 *           type: integer
 *           nullable: true
 *         referencia_tipo:
 *           type: string
 *           enum: [venta, recepcion, ajuste]
 *           default: ajuste
 *
 *     ProductoResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *         data:
 *           $ref: '#/components/schemas/Producto'
 *
 *     ProductosListResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *         data:
 *           type: object
 *           properties:
 *             productos:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Producto'
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
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *       - in: query
 *         name: codigo_barras
 *         schema:
 *           type: string
 *       - in: query
 *         name: activo
 *         schema:
 *           type: string
 *           enum: [true, false, all]
 *           default: "true"
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *     responses:
 *       200:
 *         description: Lista de productos obtenida exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ProductosListResponse'
 *       500:
 *         description: Error obteniendo productos
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get("/", verifyToken, validateProductosQuery, obtenerProductos);

/**
 * @swagger
 * /productos/stock-bajo:
 *   get:
 *     summary: Obtener productos con stock bajo
 *     tags: [Productos]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Productos con stock bajo obtenidos exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Producto'
 *       500:
 *         description: Error obteniendo productos con stock bajo
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get("/stock-bajo", verifyToken, obtenerProductosStockBajo);

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
 *     responses:
 *       200:
 *         description: Producto obtenido exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ProductoResponse'
 *       404:
 *         description: Producto no encontrado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get("/:id", verifyToken, validateProductoId, obtenerProductoPorId);

/**
 * @swagger
 * /productos/barcode/{codigo}:
 *   get:
 *     summary: Buscar producto por código de barras
 *     tags: [Productos]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: codigo
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Producto obtenido exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ProductoResponse'
 *       404:
 *         description: Producto no encontrado con este código de barras
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get(
  "/barcode/:codigo",
  verifyToken,
  validateCodigoBarras,
  obtenerProductoPorCodigoBarras
);

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
 *             $ref: '#/components/schemas/ProductoCreate'
 *     responses:
 *       201:
 *         description: Producto creado exitosamente
 *       400:
 *         description: Error de validación
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post(
  "/",
  verifyToken,
  verifyRole(["administrador", "dueño"]),
  validate(productosSchemas.createProducto),
  crearProducto
);

/**
 * @swagger
 * /productos/{id}:
 *   put:
 *     summary: Actualizar producto existente
 *     tags: [Productos]
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
 *             $ref: '#/components/schemas/ProductoUpdate'
 *     responses:
 *       200:
 *         description: Producto actualizado exitosamente
 *       404:
 *         description: Producto no encontrado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.put(
  "/:id",
  verifyToken,
  verifyRole(["administrador", "dueño"]),
  validateProductoId,
  validate(productosSchemas.updateProducto),
  actualizarProducto
);

/**
 * @swagger
 * /productos/{id}:
 *   delete:
 *     summary: Eliminar producto (desactivar)
 *     tags: [Productos]
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
 *         description: Producto desactivado exitosamente
 *       404:
 *         description: Producto no encontrado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.delete(
  "/:id",
  verifyToken,
  verifyRole(["administrador", "dueño"]),
  validateProductoId,
  eliminarProducto
);

/**
 * @swagger
 * /productos/{id}/stock:
 *   patch:
 *     summary: Actualizar stock de producto
 *     tags: [Productos]
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
 *             $ref: '#/components/schemas/StockUpdate'
 *     responses:
 *       200:
 *         description: Stock actualizado exitosamente
 *       400:
 *         description: Stock insuficiente o error de validación
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: Producto no encontrado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.patch(
  "/:id/stock",
  verifyToken,
  verifyRole(["administrador", "dueño", "cajero"]),
  validateProductoId,
  validate(productosSchemas.updateStock),
  actualizarStock
);

export default router;
