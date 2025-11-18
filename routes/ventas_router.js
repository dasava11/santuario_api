// routes/ventas.js - Router Refactorizado
import express from "express";

// Controladores
import {
  obtenerVentas,
  obtenerVentaPorId,
  crearVenta,
  eliminarVenta,
  obtenerResumenVentas,
} from "../controllers/ventasControlador.js";

// Middlewares de autenticación
import { verifyToken, verifyRole } from "../middleware/auth.js";

// Middleware de sanitización
import { sanitizeSearch } from "../middleware/sanitizeSearch.js";

// Validaciones específicas
import {
  validateCreateVenta,
  validateVentaId,
  validateVentasQuery,
  validateResumenQuery,
  validateAnularVenta,
  validateProductosBusinessRules,
} from "../validations/ventasValidations.js";

const router = express.Router();

// =====================================================
// OBTENER TODAS LAS VENTAS
// =====================================================
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
 *         description: Fecha de inicio para filtrar (YYYY-MM-DD)
 *       - in: query
 *         name: fecha_fin
 *         schema:
 *           type: string
 *           format: date
 *         description: Fecha fin para filtrar (YYYY-MM-DD)
 *       - in: query
 *         name: usuario_id
 *         schema:
 *           type: integer
 *           minimum: 1
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
 *         description: Lista de ventas obtenida exitosamente
 *       400:
 *         description: Parámetros de consulta inválidos
 *       401:
 *         description: No autorizado
 */
router.get(
  "/",
  sanitizeSearch({
    queryFields: ["metodo_pago"],
    maxLength: 50,
    removeDangerousChars: true,
  }),
  verifyToken,
  validateVentasQuery,
  obtenerVentas
);

// =====================================================
// RESUMEN DE VENTAS
// =====================================================
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
 *         description: Fecha de inicio del resumen (opcional, por defecto hoy)
 *       - in: query
 *         name: fecha_fin
 *         schema:
 *           type: string
 *           format: date
 *         description: Fecha fin del resumen (opcional, por defecto igual a fecha_inicio)
 *     responses:
 *       200:
 *         description: Resumen de ventas obtenido exitosamente
 *       400:
 *         description: Parámetros de consulta inválidos
 *       401:
 *         description: No autorizado
 */
router.get(
  "/resumen",
  sanitizeSearch({
    queryFields: [],
    maxLength: 20,
    removeDangerousChars: true,
  }),
  verifyToken,
  validateResumenQuery,
  obtenerResumenVentas
);

// =====================================================
// OBTENER VENTA POR ID
// =====================================================
/**
 * @swagger
 * /ventas/{id}:
 *   get:
 *     summary: Obtener venta por ID
 *     tags: [Ventas]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *           minimum: 1
 *         description: ID de la venta
 *     responses:
 *       200:
 *         description: Venta obtenida exitosamente
 *       400:
 *         description: ID de venta inválido
 *       404:
 *         description: Venta no encontrada
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
  validateVentaId,
  obtenerVentaPorId
);

// =====================================================
// CREAR NUEVA VENTA
// =====================================================
/**
 * @swagger
 * /ventas:
 *   post:
 *     summary: Crear nueva venta
 *     tags: [Ventas]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - productos
 *             properties:
 *               metodo_pago:
 *                 type: string
 *                 enum: [efectivo, tarjeta, transferencia]
 *                 default: efectivo
 *                 description: Método de pago utilizado
 *               productos:
 *                 type: array
 *                 minItems: 1
 *                 items:
 *                   type: object
 *                   required:
 *                     - producto_id
 *                     - cantidad
 *                   properties:
 *                     producto_id:
 *                       type: integer
 *                       minimum: 1
 *                     cantidad:
 *                       type: number
 *                       minimum: 0.001
 *                       maximum: 99999999.999
 *                     precio_unitario:
 *                       type: number
 *                       minimum: 0.01
 *                       maximum: 99999999.99
 *                       description: Opcional - si no se proporciona, se usa precio_venta del producto
 *     responses:
 *       201:
 *         description: Venta creada exitosamente
 *       400:
 *         description: Errores de validación o stock insuficiente
 *       401:
 *         description: No autorizado
 *       403:
 *         description: Permisos insuficientes
 */
router.post(
  "/",
  sanitizeSearch({
    bodyFields: [],
    maxLength: 0,
    removeDangerousChars: false,
    escapeWildcards: false,
  }),
  verifyToken,
  verifyRole(["administrador", "dueño", "cajero"]),
  validateCreateVenta,
  validateProductosBusinessRules,
  crearVenta
);

// =====================================================
// ANULAR VENTA (ELIMINACIÓN LÓGICA)
// =====================================================
/**
 * @swagger
 * /ventas/{id}:
 *   delete:
 *     summary: Anular venta (eliminación lógica con reversión de stock)
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
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - motivo_anulacion
 *             properties:
 *               motivo_anulacion:
 *                 type: string
 *                 minLength: 10
 *                 maxLength: 500
 *                 description: Motivo de la anulación (mínimo 10 caracteres)
 *                 example: "Cliente solicitó devolución por producto defectuoso"
 *     responses:
 *       200:
 *         description: Venta anulada exitosamente
 *       400:
 *         description: No se puede anular la venta (más de 24 horas o ya anulada)
 *       404:
 *         description: Venta no encontrada
 *       401:
 *         description: No autorizado
 *       403:
 *         description: Permisos insuficientes
 */
router.delete(
  "/:id",
  sanitizeSearch({
    paramFields: ["id"],
    bodyFields: ["motivo_anulacion"],
    maxLength: 500,
    removeDangerousChars: true,
    escapeWildcards: false,
  }),
  verifyToken,
  verifyRole(["administrador", "dueño"]),
  validateVentaId,
  validateAnularVenta,
  eliminarVenta
);

// =====================================================
// SWAGGER COMPONENTS
// =====================================================
/**
 * @swagger
 * components:
 *   schemas:
 *     Venta:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *           description: ID único de la venta
 *         numero_venta:
 *           type: string
 *           description: Número de venta único
 *         usuario_id:
 *           type: integer
 *           description: ID del usuario que realizó la venta
 *         total:
 *           type: number
 *           format: float
 *           description: Valor total de la venta
 *         metodo_pago:
 *           type: string
 *           enum: [efectivo, tarjeta, transferencia]
 *           description: Método de pago utilizado
 *         estado:
 *           type: string
 *           enum: [activa, anulada]
 *           description: Estado de la venta
 *         fecha_venta:
 *           type: string
 *           format: date-time
 *           description: Fecha y hora de la venta
 *         fecha_anulacion:
 *           type: string
 *           format: date-time
 *           nullable: true
 *           description: Fecha de anulación (si aplica)
 *         usuario_anulacion_id:
 *           type: integer
 *           nullable: true
 *           description: Usuario que anuló la venta
 *         motivo_anulacion:
 *           type: string
 *           nullable: true
 *           description: Motivo de la anulación
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
 */

export default router;
