import express from "express";

// Controladores
import {
  obtenerVentas,
  obtenerVentaPorId,
  crearVenta,
  eliminarVenta,
  obtenerResumenVentas,
} from "../controllers/ventasControlador.js";

// Middlewares
import { verifyToken, verifyRole } from "../middleware/auth.js";

// Validaciones
import {
  validate,
  ventasSchemas,
  validateVentaId,
  validateVentasQuery,
  validateResumenQuery,
} from "../validations/ventas_validations.js";

const router = express.Router();

/**
 * @swagger
 * components:
 *   securitySchemes:
 *     bearerAuth:
 *       type: http
 *       scheme: bearer
 *       bearerFormat: JWT
 *
 *   schemas:
 *     Venta:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *           example: 1
 *         numero_venta:
 *           type: string
 *           example: "V20250920-1695123456789"
 *         fecha_venta:
 *           type: string
 *           format: date-time
 *           example: "2025-09-20T14:30:00Z"
 *         usuario_id:
 *           type: integer
 *           example: 10
 *         total:
 *           type: number
 *           format: float
 *           example: 1250.75
 *         metodo_pago:
 *           type: string
 *           enum: [efectivo, tarjeta, transferencia]
 *           example: "efectivo"
 *         usuario:
 *           type: object
 *           properties:
 *             id:
 *               type: integer
 *               example: 10
 *             nombre:
 *               type: string
 *               example: "Juan"
 *             apellido:
 *               type: string
 *               example: "Pérez"
 *         detalle_venta:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/DetalleVenta'
 *
 *     DetalleVenta:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *           example: 1
 *         venta_id:
 *           type: integer
 *           example: 1
 *         producto_id:
 *           type: integer
 *           example: 5
 *         cantidad:
 *           type: number
 *           format: float
 *           example: 2.500
 *         precio_unitario:
 *           type: number
 *           format: float
 *           example: 120.50
 *         subtotal:
 *           type: number
 *           format: float
 *           example: 301.25
 *         producto:
 *           type: object
 *           properties:
 *             id:
 *               type: integer
 *               example: 5
 *             nombre:
 *               type: string
 *               example: "Laptop Dell"
 *             codigo_barras:
 *               type: string
 *               example: "LP-2025-DL"
 *
 *     VentaCreate:
 *       type: object
 *       required:
 *         - productos
 *       properties:
 *         metodo_pago:
 *           type: string
 *           enum: [efectivo, tarjeta, transferencia]
 *           default: "efectivo"
 *           example: "efectivo"
 *         productos:
 *           type: array
 *           minItems: 1
 *           items:
 *             type: object
 *             required: [producto_id, cantidad]
 *             properties:
 *               producto_id:
 *                 type: integer
 *                 example: 5
 *               cantidad:
 *                 type: number
 *                 format: float
 *                 example: 2.500
 *               precio_unitario:
 *                 type: number
 *                 format: float
 *                 example: 120.50
 *                 description: "Opcional - si no se proporciona, se usa el precio del producto"
 *
 *     VentasListResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           example: true
 *         data:
 *           type: object
 *           properties:
 *             ventas:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Venta'
 *             pagination:
 *               type: object
 *               properties:
 *                 page:
 *                   type: integer
 *                   example: 1
 *                 limit:
 *                   type: integer
 *                   example: 20
 *                 total:
 *                   type: integer
 *                   example: 150
 *                 pages:
 *                   type: integer
 *                   example: 8
 *
 *     VentaResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           example: true
 *         data:
 *           $ref: '#/components/schemas/Venta'
 *
 *     ResumenVentasResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           example: true
 *         data:
 *           type: object
 *           properties:
 *             fecha_inicio:
 *               type: string
 *               format: date
 *               example: "2025-09-20"
 *             fecha_fin:
 *               type: string
 *               format: date
 *               example: "2025-09-20"
 *             total_ventas:
 *               type: object
 *               properties:
 *                 cantidad_ventas:
 *                   type: integer
 *                   example: 25
 *                 total_ventas:
 *                   type: number
 *                   example: 15750.50
 *             ventas_por_metodo:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   metodo_pago:
 *                     type: string
 *                     example: "efectivo"
 *                   cantidad:
 *                     type: integer
 *                     example: 15
 *                   total:
 *                     type: number
 *                     example: 8500.25
 *             productos_mas_vendidos:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   cantidad_vendida:
 *                     type: number
 *                     example: 45.5
 *                   total_vendido:
 *                     type: number
 *                     example: 2275.00
 *                   producto:
 *                     type: object
 *                     properties:
 *                       nombre:
 *                         type: string
 *                         example: "Arroz Diana 500g"
 *
 *     ErrorResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           example: false
 *         error:
 *           type: string
 *           example: "Error obteniendo ventas"
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
 * /ventas:
 *   get:
 *     summary: Obtener todas las ventas con filtros y paginación
 *     tags: [Ventas]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: fecha_inicio
 *         schema:
 *           type: string
 *           format: date
 *         description: Fecha de inicio del filtro (YYYY-MM-DD)
 *         example: "2025-09-01"
 *       - in: query
 *         name: fecha_fin
 *         schema:
 *           type: string
 *           format: date
 *         description: Fecha fin del filtro (YYYY-MM-DD)
 *         example: "2025-09-30"
 *       - in: query
 *         name: usuario_id
 *         schema:
 *           type: integer
 *         description: ID del usuario que realizó la venta
 *       - in: query
 *         name: metodo_pago
 *         schema:
 *           type: string
 *           enum: [efectivo, tarjeta, transferencia]
 *         description: Método de pago utilizado
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Número de página
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *           maximum: 100
 *         description: Cantidad de registros por página
 *     responses:
 *       200:
 *         description: Lista de ventas obtenida exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/VentasListResponse'
 *       400:
 *         description: Parámetros de consulta inválidos
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Error interno del servidor
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get("/", verifyToken, validateVentasQuery, obtenerVentas);

/**
 * @swagger
 * /ventas/resumen:
 *   get:
 *     summary: Obtener resumen de ventas por período
 *     tags: [Ventas]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: fecha_inicio
 *         schema:
 *           type: string
 *           format: date
 *         description: Fecha de inicio del resumen (por defecto hoy)
 *         example: "2025-09-20"
 *       - in: query
 *         name: fecha_fin
 *         schema:
 *           type: string
 *           format: date
 *         description: Fecha fin del resumen (por defecto igual a fecha_inicio)
 *         example: "2025-09-20"
 *     responses:
 *       200:
 *         description: Resumen de ventas obtenido exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ResumenVentasResponse'
 *       400:
 *         description: Parámetros de consulta inválidos
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Error interno del servidor
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get("/resumen", verifyToken, validateResumenQuery, obtenerResumenVentas);

/**
 * @swagger
 * /ventas/{id}:
 *   get:
 *     summary: Obtener una venta específica por ID
 *     tags: [Ventas]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         description: ID único de la venta
 *         required: true
 *         schema:
 *           type: integer
 *           example: 1
 *     responses:
 *       200:
 *         description: Venta encontrada exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/VentaResponse'
 *       400:
 *         description: ID de venta inválido
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: Venta no encontrada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Error interno del servidor
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get("/:id", verifyToken, validateVentaId, obtenerVentaPorId);

/**
 * @swagger
 * /ventas:
 *   post:
 *     summary: Crear una nueva venta
 *     tags: [Ventas]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/VentaCreate'
 *           example:
 *             metodo_pago: "efectivo"
 *             productos:
 *               - producto_id: 1
 *                 cantidad: 2
 *                 precio_unitario: 15.50
 *               - producto_id: 3
 *                 cantidad: 1.5
 *     responses:
 *       201:
 *         description: Venta creada exitosamente
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
 *                   example: "Venta registrada exitosamente"
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: integer
 *                       example: 1
 *                     numero_venta:
 *                       type: string
 *                       example: "V20250920-1695123456789"
 *                     total:
 *                       type: number
 *                       example: 46.50
 *       400:
 *         description: Datos de entrada inválidos o stock insuficiente
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Error interno del servidor
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post(
  "/",
  verifyToken,
  verifyRole(["administrador", "dueño", "cajero"]),
  validate(ventasSchemas.createVenta),
  crearVenta
);

/**
 * @swagger
 * /ventas/{id}:
 *   delete:
 *     summary: Eliminar (anular) una venta
 *     tags: [Ventas]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         description: ID único de la venta a anular
 *         required: true
 *         schema:
 *           type: integer
 *           example: 1
 *     responses:
 *       200:
 *         description: Venta anulada exitosamente
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
 *                   example: "Venta V20250920-1695123456789 anulada exitosamente y stock revertido"
 *       400:
 *         description: No se puede anular la venta (restricciones de tiempo o negocio)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: Venta no encontrada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Error interno del servidor
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.delete(
  "/:id",
  verifyToken,
  verifyRole(["administrador", "dueño"]),
  validateVentaId,
  eliminarVenta
);

export default router;
