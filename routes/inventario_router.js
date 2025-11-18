// routes/inventario_router.js
import express from "express";

// Controladores
import {
  obtenerMovimientos,
  obtenerProductosStockBajo,
  obtenerAlertasCriticas,
  obtenerResumenInventario,
  obtenerValorInventario,
  obtenerEstadisticasMovimientos,
  obtenerReporteMovimientosPorProducto,
  actualizarStock,
  ajustarInventario,
} from "../controllers/inventarioControlador.js";

// Middlewares de autenticación
import { verifyToken, verifyRole } from "../middleware/auth.js";

// Middleware de sanitización
import { sanitizeSearch } from "../middlewares/sanitizeSearch.js";

// Validaciones específicas
import {
  validateAjustarInventario,
  validateActualizarStock,
  validateProductoId,
  validateStockId,
  validateGetMovimientosQuery,
  validateGetReporteProductoQuery,
  validateGetEstadisticasQuery,
  validateDateRange,
} from "../validations/inventario_validations.js";

const router = express.Router();

// =====================================================
// OBTENER MOVIMIENTOS DE INVENTARIO
// =====================================================
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
 *         description: Filtrar por producto
 *       - in: query
 *         name: tipo_movimiento
 *         schema:
 *           type: string
 *           enum: [entrada, salida, ajuste]
 *         description: Filtrar por tipo de movimiento
 *       - in: query
 *         name: fecha_inicio
 *         schema:
 *           type: string
 *           format: date
 *         description: Fecha de inicio (YYYY-MM-DD)
 *       - in: query
 *         name: fecha_fin
 *         schema:
 *           type: string
 *           format: date
 *         description: Fecha de fin (YYYY-MM-DD)
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
 *           maximum: 200
 *           default: 20
 *         description: Límite de resultados por página
 *     responses:
 *       200:
 *         description: Lista de movimientos obtenida exitosamente
 *       401:
 *         description: No autorizado
 */
router.get(
  "/movimientos",
  sanitizeSearch({
    queryFields: [],
    maxLength: 50,
    removeDangerousChars: true,
  }),
  verifyToken,
  validateGetMovimientosQuery,
  validateDateRange,
  obtenerMovimientos
);

// =====================================================
// OBTENER PRODUCTOS CON STOCK BAJO
// =====================================================
/**
 * @swagger
 * /inventario/stock-bajo:
 *   get:
 *     summary: Obtener productos con stock bajo o sin stock
 *     tags: [Inventario]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Productos con stock bajo obtenidos exitosamente
 *       401:
 *         description: No autorizado
 */
router.get(
  "/stock-bajo",
  sanitizeSearch({
    queryFields: [],
    maxLength: 50,
    removeDangerousChars: true,
  }),
  verifyToken,
  obtenerProductosStockBajo
);

// =====================================================
// OBTENER ALERTAS CRÍTICAS
// =====================================================
/**
 * @swagger
 * /inventario/alertas:
 *   get:
 *     summary: Obtener alertas críticas de inventario
 *     description: Productos con stock crítico (≤30% del stock mínimo)
 *     tags: [Inventario]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Alertas críticas obtenidas exitosamente
 *       401:
 *         description: No autorizado
 */
router.get(
  "/alertas",
  sanitizeSearch({
    queryFields: [],
    maxLength: 50,
    removeDangerousChars: true,
  }),
  verifyToken,
  obtenerAlertasCriticas
);

// =====================================================
// OBTENER RESUMEN DE INVENTARIO
// =====================================================
/**
 * @swagger
 * /inventario/resumen:
 *   get:
 *     summary: Obtener resumen general del inventario
 *     description: Dashboard con métricas principales del inventario
 *     tags: [Inventario]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Resumen de inventario obtenido exitosamente
 *       401:
 *         description: No autorizado
 *       403:
 *         description: Permisos insuficientes
 */
router.get(
  "/resumen",
  sanitizeSearch({
    queryFields: [],
    maxLength: 50,
    removeDangerousChars: true,
  }),
  verifyToken,
  verifyRole(["administrador", "dueño"]),
  obtenerResumenInventario
);

// =====================================================
// OBTENER VALOR DEL INVENTARIO
// =====================================================
/**
 * @swagger
 * /inventario/valor:
 *   get:
 *     summary: Obtener valor total del inventario por categoría
 *     description: Análisis financiero del inventario con breakdown por categoría
 *     tags: [Inventario]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Valor de inventario obtenido exitosamente
 *       401:
 *         description: No autorizado
 *       403:
 *         description: Permisos insuficientes
 */
router.get(
  "/valor",
  sanitizeSearch({
    queryFields: [],
    maxLength: 50,
    removeDangerousChars: true,
  }),
  verifyToken,
  verifyRole(["administrador", "dueño"]),
  obtenerValorInventario
);

// =====================================================
// OBTENER ESTADÍSTICAS DE MOVIMIENTOS
// =====================================================
/**
 * @swagger
 * /inventario/estadisticas:
 *   get:
 *     summary: Obtener estadísticas de rotación y movimientos
 *     tags: [Inventario]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: dias
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 365
 *           default: 30
 *         description: Período en días para el análisis
 *     responses:
 *       200:
 *         description: Estadísticas obtenidas exitosamente
 *       401:
 *         description: No autorizado
 *       403:
 *         description: Permisos insuficientes
 */
router.get(
  "/estadisticas",
  sanitizeSearch({
    queryFields: [],
    maxLength: 50,
    removeDangerousChars: true,
  }),
  verifyToken,
  verifyRole(["administrador", "dueño"]),
  validateGetEstadisticasQuery,
  obtenerEstadisticasMovimientos
);

// =====================================================
// OBTENER REPORTE POR PRODUCTO
// =====================================================
/**
 * @swagger
 * /inventario/reportes/{producto_id}:
 *   get:
 *     summary: Obtener reporte de movimientos por producto específico
 *     tags: [Inventario]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: producto_id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID del producto
 *       - in: query
 *         name: fecha_inicio
 *         schema:
 *           type: string
 *           format: date
 *         description: Fecha de inicio (YYYY-MM-DD)
 *       - in: query
 *         name: fecha_fin
 *         schema:
 *           type: string
 *           format: date
 *         description: Fecha de fin (YYYY-MM-DD)
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 1000
 *           default: 50
 *         description: Límite de movimientos a retornar
 *     responses:
 *       200:
 *         description: Reporte obtenido exitosamente
 *       404:
 *         description: Producto no encontrado
 *       401:
 *         description: No autorizado
 */
router.get(
  "/reportes/:producto_id",
  sanitizeSearch({
    paramFields: ["producto_id"],
    maxLength: 20,
    removeDangerousChars: true,
  }),
  verifyToken,
  validateProductoId,
  validateGetReporteProductoQuery,
  validateDateRange,
  obtenerReporteMovimientosPorProducto
);

// =====================================================
// ACTUALIZAR STOCK (MOVIMIENTO NORMAL)
// =====================================================
/**
 * @swagger
 * /inventario/productos/{id}/stock:
 *   patch:
 *     summary: Actualizar stock de producto (movimiento normal)
 *     description: >
 *       Registra un movimiento de entrada, salida o ajuste de stock.
 *       Para salidas, valida automáticamente que haya stock suficiente.
 *     tags: [Inventario]
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
 *             required:
 *               - cantidad
 *               - tipo_movimiento
 *             properties:
 *               cantidad:
 *                 type: number
 *                 format: float
 *                 minimum: 0.001
 *                 description: Cantidad a mover
 *               tipo_movimiento:
 *                 type: string
 *                 enum: [entrada, salida, ajuste]
 *                 description: Tipo de movimiento
 *               observaciones:
 *                 type: string
 *                 maxLength: 1000
 *                 description: Observaciones del movimiento
 *               referencia_id:
 *                 type: integer
 *                 nullable: true
 *                 description: ID de referencia (venta, recepción)
 *               referencia_tipo:
 *                 type: string
 *                 enum: [venta, recepcion, ajuste]
 *                 default: ajuste
 *                 description: Tipo de referencia
 *           example:
 *             cantidad: 10
 *             tipo_movimiento: "entrada"
 *             observaciones: "Reposición de proveedor"
 *             referencia_tipo: "recepcion"
 *     responses:
 *       200:
 *         description: Stock actualizado exitosamente
 *       400:
 *         description: Stock insuficiente o datos inválidos
 *       404:
 *         description: Producto no encontrado
 *       401:
 *         description: No autorizado
 *       403:
 *         description: Permisos insuficientes
 */
router.patch(
  "/productos/:id/stock",
  sanitizeSearch({
    paramFields: ["id"],
    bodyFields: ["observaciones"],
    maxLength: 1000,
    removeDangerousChars: true,
    escapeWildcards: false,
  }),
  verifyToken,
  verifyRole(["administrador", "dueño", "cajero"]),
  validateStockId,
  validateActualizarStock,
  actualizarStock
);

// =====================================================
// AJUSTAR INVENTARIO (CORRECCIÓN DIRECTA)
// =====================================================
/**
 * @swagger
 * /inventario/ajustar:
 *   post:
 *     summary: Ajustar inventario (corrección directa de stock)
 *     description: >
 *       Permite establecer directamente el stock de un producto.
 *       Usado para correcciones de inventario físico.
 *       Solo administradores y dueños pueden realizar ajustes.
 *     tags: [Inventario]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - producto_id
 *               - nuevo_stock
 *             properties:
 *               producto_id:
 *                 type: integer
 *                 description: ID del producto
 *               nuevo_stock:
 *                 type: number
 *                 format: float
 *                 minimum: 0
 *                 maximum: 1000000
 *                 description: Nuevo valor de stock
 *               observaciones:
 *                 type: string
 *                 maxLength: 1000
 *                 description: Motivo del ajuste
 *           example:
 *             producto_id: 15
 *             nuevo_stock: 50
 *             observaciones: "Ajuste por inventario físico realizado el 2025-01-15"
 *     responses:
 *       200:
 *         description: Inventario ajustado exitosamente
 *       400:
 *         description: Datos inválidos o stock sin cambios
 *       404:
 *         description: Producto no encontrado o inactivo
 *       401:
 *         description: No autorizado
 *       403:
 *         description: Permisos insuficientes
 */
router.post(
  "/ajustar",
  sanitizeSearch({
    bodyFields: ["observaciones"],
    maxLength: 1000,
    removeDangerousChars: true,
    escapeWildcards: false,
  }),
  verifyToken,
  verifyRole(["administrador", "dueño"]),
  validateAjustarInventario,
  ajustarInventario
);

// =====================================================
// SWAGGER COMPONENTS
// =====================================================
/**
 * @swagger
 * components:
 *   schemas:
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
 *           nullable: true
 *         usuario_id:
 *           type: integer
 *         observaciones:
 *           type: string
 *           nullable: true
 *         fecha_movimiento:
 *           type: string
 *           format: date-time
 *         producto:
 *           type: object
 *           properties:
 *             id:
 *               type: integer
 *             nombre:
 *               type: string
 *             codigo_barras:
 *               type: string
 *             tipo_medida:
 *               type: string
 *             categoria:
 *               type: object
 *               properties:
 *                 nombre:
 *                   type: string
 *         usuario:
 *           type: object
 *           properties:
 *             id:
 *               type: integer
 *             nombre:
 *               type: string
 *             apellido:
 *               type: string
 *
 *     ProductoStockBajo:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *         nombre:
 *           type: string
 *         codigo_barras:
 *           type: string
 *         stock_actual:
 *           type: number
 *           format: float
 *         stock_minimo:
 *           type: number
 *           format: float
 *         precio_venta:
 *           type: number
 *           format: float
 *         tipo_medida:
 *           type: string
 *           enum: [unidad, peso]
 *         criticidad:
 *           type: number
 *           description: Nivel de criticidad calculado
 *         categoria:
 *           type: object
 *           properties:
 *             id:
 *               type: integer
 *             nombre:
 *               type: string
 *
 *     AlertaCritica:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *         nombre:
 *           type: string
 *         codigo_barras:
 *           type: string
 *         stock_actual:
 *           type: number
 *         stock_minimo:
 *           type: number
 *         precio_venta:
 *           type: number
 *         tipo_medida:
 *           type: string
 *         nivel_alerta:
 *           type: string
 *           enum: [SIN_STOCK, CRITICO, URGENTE, NORMAL]
 *         categoria:
 *           type: object
 *           properties:
 *             nombre:
 *               type: string
 *
 *     ResumenInventario:
 *       type: object
 *       properties:
 *         resumen_general:
 *           type: object
 *           properties:
 *             total_productos:
 *               type: integer
 *             productos_stock_bajo:
 *               type: integer
 *             productos_sin_stock:
 *               type: integer
 *             valor_inventario:
 *               type: object
 *               properties:
 *                 valor_compra:
 *                   type: number
 *                 valor_venta:
 *                   type: number
 *                 total_unidades:
 *                   type: number
 *             metricas:
 *               type: object
 *               properties:
 *                 rotacion_promedio:
 *                   type: string
 *                 porcentaje_stock_bajo:
 *                   type: string
 *                 porcentaje_sin_stock:
 *                   type: string
 *         categorias_resumen:
 *           type: array
 *           items:
 *             type: object
 *         movimientos_recientes:
 *           type: array
 *           items:
 *             type: object
 *         periodo_analisis:
 *           type: string
 *
 *     ValorInventario:
 *       type: object
 *       properties:
 *         por_categoria:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               categoria_id:
 *                 type: integer
 *               total_productos:
 *                 type: integer
 *               valor_compra:
 *                 type: number
 *               valor_venta:
 *                 type: number
 *               stock_total:
 *                 type: number
 *               categoria:
 *                 type: object
 *                 properties:
 *                   nombre:
 *                     type: string
 *         totales:
 *           type: object
 *           properties:
 *             valor_compra_total:
 *               type: number
 *             valor_venta_total:
 *               type: number
 *             productos_total:
 *               type: integer
 *             stock_total:
 *               type: number
 *             margen_potencial:
 *               type: number
 *             porcentaje_margen:
 *               type: string
 *
 *     EstadisticasMovimientos:
 *       type: object
 *       properties:
 *         mas_vendidos:
 *           type: array
 *           items:
 *             type: object
 *         menos_movidos:
 *           type: array
 *           items:
 *             type: object
 *         periodo_dias:
 *           type: integer
 *         fecha_desde:
 *           type: string
 *           format: date-time
 *
 *     ReporteProducto:
 *       type: object
 *       properties:
 *         producto:
 *           type: object
 *           properties:
 *             id:
 *               type: integer
 *             nombre:
 *               type: string
 *             codigo_barras:
 *               type: string
 *             stock_actual:
 *               type: number
 *             stock_minimo:
 *               type: number
 *             categoria:
 *               type: object
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
 *             total_salidas:
 *               type: number
 *             total_ajustes:
 *               type: number
 *             rotacion:
 *               type: string
 *         filtros_aplicados:
 *           type: object
 */

export default router;
