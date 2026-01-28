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

// ✅ NUEVO: Rate limiters específicos de ventas
import {
  ventasWriteLimiter,
  criticalVentaLimiter,
  ventasReportLimiter,
} from "../middleware/rateLimiters.js";

// Validaciones específicas
import {
  validateCreateVenta,
  validateVentaId,
  validateVentasQuery,
  validateResumenQuery,
  validateVentaAnulacion,
  validateProductosBusinessRules,
} from "../validations/ventas_validations.js";

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
 *       429:
 *         description: Demasiadas solicitudes
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
 *       429:
 *         description: Límite de reportes excedido (20 cada 5 min)
 */
router.get(
  "/resumen",
  ventasReportLimiter,
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
 *     description: |
 *       Crea una venta con validación de stock y actualización atómica de inventario.
 *
 *       **✅ NUEVO: Identificación Flexible de Productos**
 *       Puedes identificar productos usando UNO de estos métodos:
 *       - `producto_id`: Búsqueda por ID (tradicional/administrativo)
 *       - `codigo_barras`: Escaneo directo en caja registradora (más común)
 *       - `nombre`: Búsqueda manual por nombre exacto
 *
 *       **Límites de Rate Limiting:**
 *       - Máximo 40 ventas cada 10 minutos por cajero
 *       - Diseñado para permitir picos de horas punta (4 ventas/min)
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
 *                 description: |
 *                   Array de productos. Cada producto debe tener EXACTAMENTE UNO de:
 *                   producto_id, codigo_barras o nombre.
 *                 items:
 *                   type: object
 *                   required:
 *                     - cantidad
 *                   properties:
 *                     producto_id:
 *                       type: integer
 *                       minimum: 1
 *                       description: |
 *                         Opción 1: ID del producto (método tradicional).
 *                         Usar solo UNO de: producto_id, codigo_barras o nombre.
 *                       example: 5
 *                     codigo_barras:
 *                       type: string
 *                       minLength: 1
 *                       maxLength: 50
 *                       description: |
 *                         Opción 2: Código de barras del producto (escaneo en caja).
 *                         Usar solo UNO de: producto_id, codigo_barras o nombre.
 *                       example: "7700304521005"
 *                     nombre:
 *                       type: string
 *                       minLength: 2
 *                       maxLength: 200
 *                       description: |
 *                         Opción 3: Nombre exacto del producto (búsqueda manual).
 *                         Usar solo UNO de: producto_id, codigo_barras o nombre.
 *                       example: "Coca Cola 1.5L"
 *                     cantidad:
 *                       type: number
 *                       minimum: 0.001
 *                       maximum: 99999999.999
 *                       description: Cantidad a vender (decimales permitidos para peso)
 *                       example: 2
 *                     precio_unitario:
 *                       type: number
 *                       minimum: 0.01
 *                       maximum: 99999999.99
 *                       description: |
 *                         Opcional - Precio unitario personalizado.
 *                         Si no se proporciona, se usa precio_venta del producto.
 *                       example: 3000.99
 *           examples:
 *             usando_id:
 *               summary: Usando IDs (método tradicional)
 *               value:
 *                 metodo_pago: "efectivo"
 *                 productos:
 *                   - producto_id: 1
 *                     cantidad: 5
 *                   - producto_id: 2
 *                     cantidad: 3
 *                     precio_unitario: 10.50
 *             usando_codigo_barras:
 *               summary: ⭐ Usando códigos de barras (escaneo - MÁS USADO)
 *               value:
 *                 metodo_pago: "tarjeta"
 *                 productos:
 *                   - codigo_barras: "7700304521005"
 *                     cantidad: 2
 *                   - codigo_barras: "7702004066101"
 *                     cantidad: 10
 *                     precio_unitario: 2500
 *             usando_nombres:
 *               summary: Usando nombres exactos (búsqueda manual)
 *               value:
 *                 metodo_pago: "efectivo"
 *                 productos:
 *                   - nombre: "Coca Cola 1.5L"
 *                     cantidad: 3
 *                   - nombre: "Pan Tajado"
 *                     cantidad: 2
 *             combinando_metodos:
 *               summary: Combinando métodos de búsqueda
 *               value:
 *                 metodo_pago: "transferencia"
 *                 productos:
 *                   - producto_id: 1
 *                     cantidad: 2
 *                   - codigo_barras: "7700304521005"
 *                     cantidad: 5
 *                   - nombre: "Leche Entera 1L"
 *                     cantidad: 3
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
 *                 data:
 *                   type: object
 *                   properties:
 *                     mensaje:
 *                       type: string
 *                       example: "Venta V20260127-1738000000000abc creada exitosamente"
 *                     venta:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: integer
 *                           example: 29
 *                         numero_venta:
 *                           type: string
 *                           example: "V20260127-1738000000000abc"
 *                         total:
 *                           type: number
 *                           example: 6001.98
 *                         metodo_pago:
 *                           type: string
 *                           example: "efectivo"
 *                         estado:
 *                           type: string
 *                           example: "activa"
 *                         fecha_venta:
 *                           type: string
 *                           format: date-time
 *       400:
 *         description: Errores de validación o stock insuficiente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 error:
 *                   type: object
 *                   properties:
 *                     message:
 *                       type: string
 *                       example: "Stock insuficiente"
 *                     details:
 *                       type: object
 *                       properties:
 *                         producto:
 *                           type: string
 *                           example: "Coca Cola 1.5L"
 *                         stock_actual:
 *                           type: number
 *                           example: 5
 *                         cantidad_requerida:
 *                           type: number
 *                           example: 10
 *       401:
 *         description: No autorizado - Token inválido o expirado
 *       403:
 *         description: Permisos insuficientes - Solo cajeros, administradores y dueños
 *       429:
 *         description: Límite de ventas excedido (40 cada 10 min)
 */
router.post(
  "/",
  ventasWriteLimiter,
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
 *     description: |
 *       Anula una venta y revierte el inventario automáticamente.
 *
 *       **Restricciones:**
 *       - Solo ventas con menos de 24 horas pueden ser anuladas
 *       - Requiere motivo de anulación (mínimo 10 caracteres)
 *       - Solo roles: administrador, dueño
 *
 *       **Límites de Rate Limiting:**
 *       - Máximo 10 anulaciones cada 15 minutos
 *       - Operación crítica con auditoría completa
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
 *       429:
 *         description: Límite de anulaciones excedido (10 cada 15 min)
 */
router.delete(
  "/:id",
  criticalVentaLimiter,
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
  validateVentaAnulacion,
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
 *         updated_at:
 *           type: string
 *           format: date-time
 *           description: Última actualización del registro
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
 *     DetalleVenta:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *         venta_id:
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
 *         created_at:
 *           type: string
 *           format: date-time
 *         updated_at:
 *           type: string
 *           format: date-time
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
 *       properties:
 *         ventas_crear:
 *           type: object
 *           properties:
 *             limite:
 *               type: integer
 *               example: 40
 *             ventana:
 *               type: string
 *               example: "10 minutos"
 *             descripcion:
 *               type: string
 *               example: "Permite picos de horas punta"
 *         ventas_anular:
 *           type: object
 *           properties:
 *             limite:
 *               type: integer
 *               example: 10
 *             ventana:
 *               type: string
 *               example: "15 minutos"
 *             descripcion:
 *               type: string
 *               example: "Operación crítica con auditoría"
 *         ventas_reportes:
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
