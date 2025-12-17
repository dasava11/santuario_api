// routes/recepciones.js - Router Refactorizado
import express from "express";

// Controladores
import {
  obtenerRecepciones,
  obtenerRecepcionPorId,
  crearRecepcion,
  actualizarRecepcion,
  procesarRecepcion,
  cancelarRecepcion,
  obtenerEstadisticasRecepciones,
} from "../controllers/recepcionesControlador.js";

// Middlewares de autenticación
import { verifyToken, verifyRole } from "../middleware/auth.js";

// Middleware de sanitización
import { sanitizeSearch } from "../middleware/sanitizeSearch.js";

// Rate Limiters específicos para recepciones
import {
  recepcionesWriteLimiter,
  criticalRecepcionLimiter,
  recepcionesReportLimiter,
} from "../middleware/rateLimiters.js";

import { trackPerformance } from "../middleware/performance.js";

// Validaciones específicas
import {
  validateCreateRecepcion,
  validateUpdateRecepcion,
  validateRecepcionId,
  validateGetRecepcionesQuery,
  validateGetRecepcionByIdQuery,
  validateProcesarRecepcion,
  validateBusinessDateRules,
  validateProductosBusinessRules,
  validateMaxProductos,
  validateCantidadesRazonables,
  validatePreciosRazonables,
} from "../validations/recepciones_validations.js";

const router = express.Router();

// ✅ NUEVO: Aplicar performance tracking a todas las rutas
router.use(trackPerformance);

// =====================================================
// 📊 OBTENER TODAS LAS RECEPCIONES
// =====================================================
/**
 * @swagger
 * /recepciones:
 *   get:
 *     summary: Obtener todas las recepciones con filtros y paginación
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
 *       - in: query
 *         name: fecha_fin
 *         schema:
 *           type: string
 *           format: date
 *         description: Fecha fin para filtrar (YYYY-MM-DD)
 *       - in: query
 *         name: proveedor_id
 *         schema:
 *           type: integer
 *           minimum: 1
 *         description: ID del proveedor para filtrar
 *       - in: query
 *         name: estado
 *         schema:
 *           type: string
 *           enum: [pendiente, procesada, cancelada, all]
 *           default: all
 *         description: Estado de la recepción
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
 *         name: incluir_detalles
 *         schema:
 *           type: string
 *           enum: [true, false]
 *           default: "false"
 *         description: Incluir detalles de productos
 *     responses:
 *       200:
 *         description: Lista de recepciones obtenida exitosamente
 *       400:
 *         description: Parámetros de consulta inválidos
 *       401:
 *         description: No autorizado
 */
router.get(
  "/",
  sanitizeSearch({
    queryFields: ["estado", "incluir_detalles"],
    maxLength: 50,
    removeDangerousChars: true,
  }),
  verifyToken,
  validateGetRecepcionesQuery,
  obtenerRecepciones
);

// =====================================================
// 📊 ESTADÍSTICAS DE RECEPCIONES
// =====================================================
/**
 * @swagger
 * /recepciones/estadisticas:
 *   get:
 *     summary: Obtener estadísticas completas de recepciones
 *     description: |
 *       **Contexto de Negocio:**
 *       - Query computacionalmente costoso (agregaciones + joins)
 *       - Incluye estadísticas por proveedor (top 10)
 *       - Cálculos de totales y promedios
 *
 *       **Rate Limiting:**
 *       - Máximo 20 consultas cada 5 minutos
 *       - Previene sobrecarga del servidor
 *     tags: [Recepciones]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: fecha_inicio
 *         schema:
 *           type: string
 *           format: date
 *         description: Fecha de inicio para filtrar estadísticas
 *       - in: query
 *         name: fecha_fin
 *         schema:
 *           type: string
 *           format: date
 *         description: Fecha fin para filtrar estadísticas
 *       - in: query
 *         name: proveedor_id
 *         schema:
 *           type: integer
 *           minimum: 1
 *         description: ID del proveedor específico
 *     responses:
 *       200:
 *         description: Estadísticas obtenidas exitosamente
 *       401:
 *         description: No autorizado
 *       403:
 *         description: Permisos insuficientes
 *       429:
 *         description: Límite de reportes excedido (20 cada 5 min)
 */
router.get(
  "/estadisticas",
  recepcionesReportLimiter,
  verifyToken,
  verifyRole(["administrador", "dueño"]),
  obtenerEstadisticasRecepciones
);

// =====================================================
// 📄 OBTENER RECEPCIÓN POR ID
// =====================================================
/**
 * @swagger
 * /recepciones/{id}:
 *   get:
 *     summary: Obtener recepción por ID
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
 *       - in: query
 *         name: incluir_productos
 *         schema:
 *           type: string
 *           enum: [true, false]
 *           default: "true"
 *         description: Incluir productos asociados
 *       - in: query
 *         name: incluir_movimientos
 *         schema:
 *           type: string
 *           enum: [true, false]
 *           default: "false"
 *         description: Incluir movimientos de inventario
 *     responses:
 *       200:
 *         description: Recepción obtenida exitosamente
 *       400:
 *         description: ID de recepción inválido
 *       404:
 *         description: Recepción no encontrada
 *       401:
 *         description: No autorizado
 */
router.get(
  "/:id",
  sanitizeSearch({
    paramFields: ["id"],
    queryFields: ["incluir_productos", "incluir_movimientos"],
    maxLength: 50,
    removeDangerousChars: true,
  }),
  verifyToken,
  validateRecepcionId,
  validateGetRecepcionByIdQuery,
  obtenerRecepcionPorId
);

// =====================================================
// ✨ CREAR NUEVA RECEPCIÓN
// =====================================================
/**
 * @swagger
 * /recepciones:
 *   post:
 *     summary: Crear nueva recepción
 *     description: |
 *       Registra recepción de productos de proveedor.
 *
 *       **Contexto de Negocio:**
 *       - Supermercado con ~100 proveedores
 *       - Recepciones típicas: 2-5 por día
 *       - Promedio: 10-50 productos por recepción
 *
 *       **Flujo de Trabajo:**
 *       1. Crear recepción (estado: "pendiente")
 *       2. Verificar mercancía física
 *       3. Procesar recepción → Actualiza inventario
 *
 *       **Rate Limiting:**
 *       - Máximo 30 recepciones cada 10 minutos por usuario
 *       - Diseñado para operación normal del supermercado
 *       - Protege contra errores de entrada duplicada
 *
 *       **Validaciones de Negocio:**
 *       - No facturas duplicadas del mismo proveedor
 *       - No productos duplicados en misma recepción
 *       - No recepciones >30 días de antigüedad
 *       - Proveedor debe estar activo
 *     tags: [Recepciones]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - numero_factura
 *               - proveedor_id
 *               - fecha_recepcion
 *               - productos
 *             properties:
 *               numero_factura:
 *                 type: string
 *                 minLength: 1
 *                 maxLength: 100
 *                 description: Número de factura del proveedor
 *               proveedor_id:
 *                 type: integer
 *                 minimum: 1
 *                 description: ID del proveedor
 *               fecha_recepcion:
 *                 type: string
 *                 format: date
 *                 description: Fecha de recepción de mercancía
 *               observaciones:
 *                 type: string
 *                 maxLength: 1000
 *                 description: Observaciones adicionales
 *               productos:
 *                 type: array
 *                 minItems: 1
 *                 items:
 *                   type: object
 *                   required:
 *                     - producto_id
 *                     - cantidad
 *                     - precio_unitario
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
 *           example:
 *             numero_factura: "FAC-2024-001"
 *             proveedor_id: 5
 *             fecha_recepcion: "2024-12-16"
 *             observaciones: "Entrega completa y en buen estado"
 *             productos:
 *               - producto_id: 123
 *                 cantidad: 50
 *                 precio_unitario: 2.50
 *               - producto_id: 456
 *                 cantidad: 30
 *                 precio_unitario: 5.00
 *     responses:
 *       201:
 *         description: Recepción creada exitosamente
 *       400:
 *         description: Errores de validación o datos duplicados
 *       401:
 *         description: No autorizado
 *       403:
 *         description: Permisos insuficientes
 *       429:
 *         description: Límite de recepciones excedido (30 cada 10 min)
 */
router.post(
  "/",
  recepcionesWriteLimiter,
  sanitizeSearch({
    bodyFields: ["numero_factura", "observaciones"],
    maxLength: 1000,
    removeDangerousChars: true,
    escapeWildcards: false,
  }),
  verifyToken,
  verifyRole(["administrador", "dueño", "ayudante"]),
  validateCreateRecepcion,
  validateBusinessDateRules,
  validateProductosBusinessRules,
  validateMaxProductos,
  validateCantidadesRazonables,
  validatePreciosRazonables,
  crearRecepcion
);

// =====================================================
// 🔄 ACTUALIZAR RECEPCIÓN
// =====================================================
/**
 * @swagger
 * /recepciones/{id}:
 *   put:
 *     summary: Actualizar recepción existente
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
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             minProperties: 1
 *             properties:
 *               observaciones:
 *                 type: string
 *                 maxLength: 1000
 *                 description: Observaciones adicionales
 *     responses:
 *       200:
 *         description: Recepción actualizada exitosamente
 *       400:
 *         description: Errores de validación o recepción no editable
 *       404:
 *         description: Recepción no encontrada
 *       401:
 *         description: No autorizado
 *       403:
 *         description: Permisos insuficientes
 */
router.put(
  "/:id",
  sanitizeSearch({
    paramFields: ["id"],
    bodyFields: ["observaciones"],
    maxLength: 1000,
    removeDangerousChars: true,
    escapeWildcards: false,
  }),
  verifyToken,
  verifyRole(["administrador", "dueño", "ayudante"]),
  validateRecepcionId,
  validateUpdateRecepcion,
  actualizarRecepcion
);

// =====================================================
// ⚡ PROCESAR RECEPCIÓN
// =====================================================
/**
 * @swagger
 * /recepciones/{id}/procesar:
 *   post:
 *     summary: Procesar recepción (actualizar inventario)
 *     description: |
 *       **OPERACIÓN CRÍTICA:** Actualiza stock de todos los productos en la recepción.
 *
 *       **Contexto de Negocio:**
 *       - Procesamiento requiere verificación física de mercancía
 *       - Actualiza inventario masivamente (múltiples productos)
 *       - Crea movimientos de inventario auditables
 *       - Opcionalmente actualiza precios de compra
 *
 *       **Rate Limiting:**
 *       - Máximo 15 procesamientos cada 15 minutos por usuario
 *       - Protege contra procesamiento accidental múltiple
 *       - Operación irreversible (solo administradores/dueños)
 *
 *       **Validaciones Críticas:**
 *       - Recepción debe estar en estado "pendiente"
 *       - Productos deben estar activos (advertencia si inactivos)
 *       - Stock se actualiza atómicamente (previene race conditions)
 *
 *       **Cascada de Efectos:**
 *       1. Actualiza stock_actual de cada producto
 *       2. Opcionalmente actualiza precio_compra
 *       3. Crea movimientos_inventario (auditoría)
 *       4. Cambia estado recepción a "procesada"
 *       5. Invalida caché (productos + inventario + recepciones)
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
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               observaciones_proceso:
 *                 type: string
 *                 maxLength: 500
 *                 description: Observaciones del procesamiento
 *               actualizar_precios:
 *                 type: boolean
 *                 default: true
 *                 description: Actualizar precios de compra de productos
 *           example:
 *             observaciones_proceso: "Mercancía verificada, todo en orden"
 *             actualizar_precios: true
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
 *                 data:
 *                   type: object
 *                   properties:
 *                     mensaje:
 *                       type: string
 *                       example: "Recepción FAC-2024-001 procesada exitosamente"
 *                     recepcion:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: integer
 *                         numero_factura:
 *                           type: string
 *                         estado:
 *                           type: string
 *                           example: "procesada"
 *       400:
 *         description: Recepción no encontrada o ya procesada
 *       401:
 *         description: No autorizado
 *       403:
 *         description: Permisos insuficientes
 *       429:
 *         description: Límite de procesamientos excedido (15 cada 15 min)
 */
router.post(
  "/:id/procesar",
  criticalRecepcionLimiter,
  sanitizeSearch({
    paramFields: ["id"],
    bodyFields: ["observaciones_proceso"],
    maxLength: 500,
    removeDangerousChars: true,
    escapeWildcards: false,
  }),
  verifyToken,
  verifyRole(["administrador", "dueño", "ayudante"]),
  validateRecepcionId,
  validateProcesarRecepcion,
  procesarRecepcion
);

// =====================================================
// 🗑️ CANCELAR RECEPCIÓN
// =====================================================
/**
 * @swagger
 * /recepciones/{id}/cancelar:
 *   delete:
 *     summary: Cancelar recepción
 *     description: |
 *       Cancela una recepción en estado "pendiente".
 *
 *       **Restricciones:**
 *       - Solo recepciones en estado "pendiente"
 *       - No afecta inventario (no se procesó)
 *       - Operación auditable
 *       - Solo administradores y dueños
 *
 *       **Casos de Uso:**
 *       - Mercancía no llegó completa
 *       - Error en factura detectado antes de procesar
 *       - Cancelación de pedido por proveedor
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
 *     responses:
 *       200:
 *         description: Recepción cancelada exitosamente
 *       400:
 *         description: ID inválido o recepción ya procesada
 *       404:
 *         description: Recepción no encontrada
 *       401:
 *         description: No autorizado
 *       403:
 *         description: Permisos insuficientes
 */
router.delete(
  "/:id/cancelar",
  sanitizeSearch({
    paramFields: ["id"],
    maxLength: 20,
    removeDangerousChars: true,
  }),
  verifyToken,
  verifyRole(["administrador", "dueño"]),
  validateRecepcionId,
  cancelarRecepcion
);

// =====================================================
// 📋 SWAGGER COMPONENTS
// =====================================================
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
 *           description: Número de factura del proveedor
 *         proveedor_id:
 *           type: integer
 *           description: ID del proveedor
 *         fecha_recepcion:
 *           type: string
 *           format: date
 *           description: Fecha de recepción de mercancía
 *         total:
 *           type: number
 *           format: float
 *           description: Valor total de la recepción
 *         estado:
 *           type: string
 *           enum: [pendiente, procesada, cancelada]
 *           description: Estado de la recepción
 *         observaciones:
 *           type: string
 *           nullable: true
 *           description: Observaciones adicionales
 *         fecha_creacion:
 *           type: string
 *           format: date-time
 *           description: Fecha de creación del registro
 *
 *     DetalleRecepcion:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *         recepcion_id:
 *           type: integer
 *         producto_id:
 *           type: integer
 *         cantidad:
 *           type: number
 *           format: float
 *         precio_unitario:
 *           type: number
 *           format: float
 *         subtotal:
 *           type: number
 *           format: float
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
 *     RateLimitInfo:
 *       type: object
 *       description: Información de límites de tasa para recepciones
 *       properties:
 *         recepciones_crear:
 *           type: object
 *           properties:
 *             limite:
 *               type: integer
 *               example: 30
 *             ventana:
 *               type: string
 *               example: "10 minutos"
 *             descripcion:
 *               type: string
 *               example: "Permite entrada masiva sin saturar sistema"
 *         recepciones_procesar:
 *           type: object
 *           properties:
 *             limite:
 *               type: integer
 *               example: 15
 *             ventana:
 *               type: string
 *               example: "15 minutos"
 *             descripcion:
 *               type: string
 *               example: "Operación crítica con actualización masiva de inventario"
 *         recepciones_reportes:
 *           type: object
 *           properties:
 *             limite:
 *               type: integer
 *               example: 20
 *             ventana:
 *               type: string
 *               example: "5 minutos"
 *             descripcion:
 *               type: string
 *               example: "Consultas computacionalmente costosas"
 */

export default router;
