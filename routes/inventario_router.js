import express from "express";
import {
  obtenerMovimientos,
  obtenerProductosStockBajo,
  obtenerResumenInventario,
  ajustarInventario,
  obtenerReporteMovimientosPorProducto,
} from "../controllers/inventarioControlador.js";

import { verifyToken } from "../middleware/auth.js";

import {
  validate,
  inventarioSchemas,
  validateProductoId,
  validateMovimientosQuery,
  validateReporteProductoQuery,
  validateDateRange,
  validateInventoryAdjustmentPermissions,
} from "../validations/inventario_validations.js";

const router = express.Router();

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
 *
 *     MovimientoInventario:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *         producto_id:
 *           type: integer
 *         tipo_movimiento:
 *           type: string
 *           enum: [entrada, salida, ajuste]
 *         cantidad:
 *           type: number
 *           format: float
 *         stock_anterior:
 *           type: number
 *           format: float
 *         stock_nuevo:
 *           type: number
 *           format: float
 *         referencia_id:
 *           type: integer
 *           nullable: true
 *         referencia_tipo:
 *           type: string
 *           enum: [venta, recepcion, ajuste]
 *         usuario:
 *           type: object
 *           properties:
 *             id:
 *               type: integer
 *             nombre:
 *               type: string
 *             apellido:
 *               type: string
 *         fecha_movimiento:
 *           type: string
 *           format: date-time
 *         observaciones:
 *           type: string
 *           nullable: true
 *         producto:
 *           $ref: '#/components/schemas/Producto'
 *
 *     AjusteInventario:
 *       type: object
 *       required:
 *         - producto_id
 *         - nuevo_stock
 *       properties:
 *         producto_id:
 *           type: integer
 *           minimum: 1
 *         nuevo_stock:
 *           type: number
 *           format: float
 *           minimum: 0
 *         observaciones:
 *           type: string
 *           maxLength: 1000
 *           nullable: true
 *
 *     ResumenInventario:
 *       type: object
 *       properties:
 *         total_productos:
 *           type: integer
 *         productos_stock_bajo:
 *           type: integer
 *         productos_sin_stock:
 *           type: integer
 *         valor_inventario:
 *           type: object
 *           properties:
 *             valor_compra:
 *               type: number
 *               format: float
 *             valor_venta:
 *               type: number
 *               format: float
 *         categorias_resumen:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               id:
 *                 type: integer
 *               nombre:
 *                 type: string
 *               total_productos:
 *                 type: integer
 *               total_stock:
 *                 type: number
 *                 format: float
 *         movimientos_recientes:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               tipo_movimiento:
 *                 type: string
 *               cantidad:
 *                 type: integer
 *               fecha:
 *                 type: string
 *                 format: date
 *
 *     ReporteMovimientosProducto:
 *       type: object
 *       properties:
 *         producto:
 *           $ref: '#/components/schemas/Producto'
 *         movimientos:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/MovimientoInventario'
 *         estadisticas:
 *           type: object
 *           properties:
 *             total_movimientos:
 *               type: integer
 *             total_entradas:
 *               type: number
 *               format: float
 *             total_salidas:
 *               type: number
 *               format: float
 *         filtros_aplicados:
 *           type: object
 *           properties:
 *             fecha_inicio:
 *               type: string
 *               format: date
 *               nullable: true
 *             fecha_fin:
 *               type: string
 *               format: date
 *               nullable: true
 *             limite:
 *               type: integer
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
 * /inventario/movimientos:
 *   get:
 *     summary: Obtener movimientos de inventario con filtros y paginación
 *     tags: [Inventario]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: producto_id
 *         schema:
 *           type: integer
 *         description: Filtrar por ID de producto
 *       - in: query
 *         name: tipo_movimiento
 *         schema:
 *           type: string
 *           enum: [entrada, salida, ajuste]
 *       - in: query
 *         name: fecha_inicio
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: fecha_fin
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *         description: Número de página
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *         description: Límite por página
 *     responses:
 *       200:
 *         description: Movimientos obtenidos
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
 *                     movimientos:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/MovimientoInventario'
 *                     pagination:
 *                       type: object
 *                       properties:
 *                         page:
 *                           type: integer
 *                         limit:
 *                           type: integer
 *                         total:
 *                           type: integer
 *                         pages:
 *                           type: integer
 */
router.get(
  "/movimientos",
  verifyToken,
  validateMovimientosQuery,
  obtenerMovimientos
);

/**
 * @swagger
 * /inventario/stock-bajo:
 *   get:
 *     summary: Obtener productos con stock bajo
 *     tags: [Inventario]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lista de productos con stock bajo
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
 *                     $ref: '#/components/schemas/Producto'
 */
router.get("/stock-bajo", verifyToken, obtenerProductosStockBajo);

/**
 * @swagger
 * /inventario/resumen:
 *   get:
 *     summary: Obtener resumen general del inventario
 *     tags: [Inventario]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Resumen del inventario
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ResumenInventario'
 */
router.get("/resumen", verifyToken, obtenerResumenInventario);

/**
 * @swagger
 * /inventario/ajustar:
 *   post:
 *     summary: Ajustar inventario de un producto
 *     tags: [Inventario]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/AjusteInventario'
 *     responses:
 *       200:
 *         description: Ajuste realizado
 *       400:
 *         description: Error de validación o negocio
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post(
  "/ajustar",
  verifyToken,
  validateInventoryAdjustmentPermissions,
  validate(inventarioSchemas.ajustarInventario),
  ajustarInventario
);

/**
 * @swagger
 * /inventario/reporte/{producto_id}:
 *   get:
 *     summary: Obtener reporte de movimientos por producto
 *     tags: [Inventario]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: producto_id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Reporte generado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ReporteMovimientosProducto'
 */
router.get(
  "/reporte/:producto_id",
  verifyToken,
  validateProductoId,
  validateReporteProductoQuery,
  validateDateRange,
  obtenerReporteMovimientosPorProducto
);

export default router;
