import express from "express";

// Importar controladores (funciones individuales)
import {
  obtenerRecepciones,
  obtenerRecepcionPorId,
  crearRecepcion,
  procesarRecepcion,
  cancelarRecepcion,
} from "../controllers/recepcionesControlador.js";

// Importar middlewares de autenticación
import { verifyToken, verifyRole } from "../middleware/auth.js";

// Importar validaciones
import {
  validate,
  recepcionesSchemas,
  validateRecepcionId,
  validateRecepcionesQuery,
} from "../validations/recepciones_validations.js";

const router = express.Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     Recepcion:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *           description: ID único de la recepción
 *         numero_factura:
 *           type: string
 *           maxLength: 100
 *           description: Número de factura del proveedor
 *         proveedor_id:
 *           type: integer
 *           description: ID del proveedor
 *         usuario_id:
 *           type: integer
 *           description: ID del usuario que registró la recepción
 *         fecha_recepcion:
 *           type: string
 *           format: date
 *           description: Fecha de recepción de mercancía
 *         total:
 *           type: number
 *           format: float
 *           description: Valor total de la recepción
 *         observaciones:
 *           type: string
 *           description: Observaciones adicionales
 *           nullable: true
 *         estado:
 *           type: string
 *           enum: [pendiente, procesada, cancelada]
 *           default: pendiente
 *           description: Estado de la recepción
 *         fecha_creacion:
 *           type: string
 *           format: date-time
 *           description: Fecha de creación del registro
 *         proveedor:
 *           type: object
 *           properties:
 *             id:
 *               type: integer
 *             nombre:
 *               type: string
 *             telefono:
 *               type: string
 *             email:
 *               type: string
 *         usuario:
 *           type: object
 *           properties:
 *             id:
 *               type: integer
 *             nombre:
 *               type: string
 *             apellido:
 *               type: string
 */
/**
 * @swagger
 * components:
 *   schemas:
 *     RecepcionDetalle:
 *       allOf:
 *         - $ref: '#/components/schemas/Recepcion'
 *         - type: object
 *           properties:
 *             detalle_recepciones:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: integer
 *                   producto_id:
 *                     type: integer
 *                   cantidad:
 *                     type: number
 *                     format: float
 *                   precio_unitario:
 *                     type: number
 *                     format: float
 *                   subtotal:
 *                     type: number
 *                     format: float
 *                   producto:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: integer
 *                       nombre:
 *                         type: string
 *                       codigo_barras:
 *                         type: string
 *
 *
 *     RecepcionCreate:
 *       type: object
 *       required:
 *         - numero_factura
 *         - proveedor_id
 *         - fecha_recepcion
 *         - productos
 *       properties:
 *         numero_factura:
 *           type: string
 *           maxLength: 100
 *           description: Número de factura del proveedor
 *           example: "FAC-2025-001"
 *         proveedor_id:
 *           type: integer
 *           minimum: 1
 *           description: ID del proveedor
 *           example: 1
 *         fecha_recepcion:
 *           type: string
 *           format: date
 *           description: Fecha de recepción de mercancía
 *           example: "2025-01-15"
 *         observaciones:
 *           type: string
 *           maxLength: 1000
 *           description: Observaciones adicionales
 *           nullable: true
 *           example: "Mercancía en buen estado"
 *         productos:
 *           type: array
 *           minItems: 1
 *           description: Lista de productos recibidos
 *           items:
 *             type: object
 *             required:
 *               - producto_id
 *               - cantidad
 *               - precio_unitario
 *             properties:
 *               producto_id:
 *                 type: integer
 *                 minimum: 1
 *                 description: ID del producto
 *                 example: 1
 *               cantidad:
 *                 type: number
 *                 format: float
 *                 minimum: 0.001
 *                 maximum: 99999999.999
 *                 description: Cantidad recibida
 *                 example: 10.5
 *               precio_unitario:
 *                 type: number
 *                 format: float
 *                 minimum: 0.01
 *                 maximum: 99999999.99
 *                 description: Precio unitario de compra
 *                 example: 25000.50
 *
 *     RecepcionResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           example: true
 *         data:
 *           $ref: '#/components/schemas/RecepcionDetalle'
 *
 *     RecepcionesListResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           example: true
 *         data:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/Recepcion'
 *         pagination:
 *           type: object
 *           properties:
 *             page:
 *               type: integer
 *               example: 1
 *             limit:
 *               type: integer
 *               example: 20
 *             total:
 *               type: integer
 *               example: 100
 *             pages:
 *               type: integer
 *               example: 5
 *
 *     ErrorResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           example: false
 *         error:
 *           type: string
 *           example: "Error en la validación"
 *         details:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               field:
 *                 type: string
 *                 example: "numero_factura"
 *               message:
 *                 type: string
 *                 example: "El número de factura es obligatorio"
 */
/**
 * @swagger
 * /recepciones:
 *   get:
 *     summary: Obtener todas las recepciones
 *     tags: [Recepciones]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: fecha_inicio
 *         schema:
 *           type: string
 *           format: date
 *         description: Fecha de inicio para filtrar (YYYY-MM-DD)
 *         example: "2025-01-01"
 *       - in: query
 *         name: fecha_fin
 *         schema:
 *           type: string
 *           format: date
 *         description: Fecha fin para filtrar (YYYY-MM-DD)
 *         example: "2025-01-31"
 *       - in: query
 *         name: proveedor_id
 *         schema:
 *           type: integer
 *           minimum: 1
 *         description: ID del proveedor para filtrar
 *         example: 1
 *       - in: query
 *         name: estado
 *         schema:
 *           type: string
 *           enum: [pendiente, procesada, cancelada, all]
 *           default: all
 *         description: Estado de la recepción
 *         example: "pendiente"
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
 *         description: Cantidad de resultados por página
 *         example: 20
 *     responses:
 *       200:
 *         description: Lista de recepciones obtenida exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/RecepcionesListResponse'
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
router.get("/", verifyToken, validateRecepcionesQuery, obtenerRecepciones);

/**
 * @swagger
 * /recepciones/{id}:
 *   get:
 *     summary: Obtener recepción por ID con detalles
 *     tags: [Recepciones]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *           minimum: 1
 *         description: ID de la recepción
 *         example: 1
 *     responses:
 *       200:
 *         description: Recepción obtenida exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/RecepcionResponse'
 *       400:
 *         description: ID de recepción inválido
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: Recepción no encontrada
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
 *                   example: "Recepción no encontrada"
 *       401:
 *         description: No autorizado
 *       500:
 *         description: Error interno del servidor
 */
router.get("/:id", verifyToken, validateRecepcionId, obtenerRecepcionPorId);

/**
 * @swagger
 * /recepciones:
 *   post:
 *     summary: Crear nueva recepción
 *     tags: [Recepciones]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/RecepcionCreate'
 *           example:
 *             numero_factura: "FAC-2025-001"
 *             proveedor_id: 1
 *             fecha_recepcion: "2025-01-15"
 *             observaciones: "Mercancía en buen estado"
 *             productos:
 *               - producto_id: 1
 *                 cantidad: 10.5
 *                 precio_unitario: 25000.50
 *               - producto_id: 2
 *                 cantidad: 5
 *                 precio_unitario: 15000
 *     responses:
 *       201:
 *         description: Recepción creada exitosamente
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
 *                   example: "Recepción creada exitosamente"
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: integer
 *                       example: 123
 *                     numero_factura:
 *                       type: string
 *                       example: "FAC-2025-001"
 *                     total:
 *                       type: number
 *                       format: float
 *                       example: 337505.25
 *       400:
 *         description: Errores de validación o datos duplicados
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
  verifyRole(["administrador", "dueño", "ayudante"]),
  validate(recepcionesSchemas.createRecepcion),
  crearRecepcion
);

/**
 * @swagger
 * /recepciones/{id}/procesar:
 *   post:
 *     summary: Procesar recepción (actualizar inventario)
 *     tags: [Recepciones]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *           minimum: 1
 *         description: ID de la recepción
 *         example: 1
 *     responses:
 *       200:
 *         description: Recepción procesada exitosamente
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
 *                   example: "Recepción procesada exitosamente"
 *       400:
 *         description: Recepción no encontrada o ya procesada
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
 *                   example: "Recepción no encontrada o ya procesada"
 *       401:
 *         description: No autorizado
 *       403:
 *         description: Permisos insuficientes
 *       500:
 *         description: Error interno del servidor
 */
router.post(
  "/:id/procesar",
  verifyToken,
  verifyRole(["administrador", "dueño", "ayudante"]),
  validateRecepcionId,
  procesarRecepcion
);

/**
 * @swagger
 * /recepciones/{id}/cancelar:
 *   delete:
 *     summary: Cancelar recepción
 *     tags: [Recepciones]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *           minimum: 1
 *         description: ID de la recepción
 *         example: 1
 *     responses:
 *       200:
 *         description: Recepción cancelada exitosamente
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
 *                   example: "Recepción cancelada exitosamente"
 *       400:
 *         description: ID inválido o recepción ya procesada
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
 *                   example: "Recepción no encontrada o ya procesada"
 *       404:
 *         description: Recepción no encontrada
 *       401:
 *         description: No autorizado
 *       403:
 *         description: Permisos insuficientes
 *       500:
 *         description: Error interno del servidor
 */
router.delete(
  "/:id/cancelar",
  verifyToken,
  verifyRole(["administrador", "dueño"]),
  validateRecepcionId,
  cancelarRecepcion
);

export default router;
