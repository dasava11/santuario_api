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

// ✅ NUEVO: Rate limiters específicos de productos
import {
  productosWriteLimiter,
  criticalProductLimiter,
  productosSearchLimiter,
} from "../middleware/rateLimiters.js";

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
// 📝 NOTAS DE ARQUITECTURA
// =====================================================
/*
PERFORMANCE TRACKING:
- ✅ Ya implementado globalmente en server.js (trackPerformance middleware)
- Mide automáticamente tiempo de respuesta de TODAS las rutas
- Logs automáticos para operaciones lentas (>500ms)
- Métricas disponibles en GET /api/metrics (si implementado)

RATE LIMITING:
- Aplicado estratégicamente según tipo de operación
- Ver justificación de límites en rateLimiters.js
- Roles "sistema" pueden bypasear límites (para scripts automáticos)

CACHÉ:
- Implementado en capa de servicio (productosService.js)
- Redis con TTL diferenciado según tipo de consulta
- Invalidación automática en operaciones de escritura
*/

// =====================================================
// OBTENER TODOS LOS PRODUCTOS
// =====================================================
/**
 * @swagger
 * /productos:
 *   get:
 *     summary: Obtener todos los productos con filtros y paginación
 *     description: |
 *       Consulta paginada de productos con múltiples opciones de filtrado.
 *
 *       **Performance**:
 *       - Caché: 4 minutos (CACHE_TTL.PRODUCTOS_PAGINADOS)
 *       - Índices optimizados para filtros comunes
 *       - Query con LIKE puede ser costoso con grandes volúmenes
 *
 *       **Rate Limiting**:
 *       - Búsquedas con parámetro `search`: 60 cada 5 minutos
 *       - Búsquedas simples (sin search): ilimitadas
 *
 *     tags: [Productos]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: categoria_id
 *         schema:
 *           type: integer
 *           minimum: 1
 *         description: Filtrar por categoría específica
 *         example: 5
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *           maxLength: 200
 *         description: |
 *           Buscar por nombre o descripción (búsqueda parcial con LIKE).
 *           ⚠️ Operación costosa: limitada a 60 búsquedas cada 5 minutos.
 *         example: "arroz"
 *       - in: query
 *         name: codigo_barras
 *         schema:
 *           type: string
 *           maxLength: 50
 *         description: Filtrar por código de barras exacto (búsqueda eficiente)
 *         example: "7501234567890"
 *       - in: query
 *         name: activo
 *         schema:
 *           type: string
 *           enum: [true, false, all]
 *           default: all
 *         description: Filtrar por estado activo del producto
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
 *         description: Límite de resultados por página (máx 100)
 *     responses:
 *       200:
 *         description: Lista de productos obtenida exitosamente
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
 *                     productos:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Producto'
 *                     pagination:
 *                       $ref: '#/components/schemas/Pagination'
 *                 metadata:
 *                   type: object
 *                   properties:
 *                     timestamp:
 *                       type: string
 *                       format: date-time
 *                     total_productos:
 *                       type: integer
 *                     filtro_categoria:
 *                       type: integer
 *                       nullable: true
 *                     filtro_activo:
 *                       type: string
 *                     filtro_busqueda:
 *                       type: string
 *                       nullable: true
 *                 cache_info:
 *                   type: object
 *                   properties:
 *                     from_cache:
 *                       type: boolean
 *                     cache_timestamp:
 *                       type: string
 *                       format: date-time
 *       400:
 *         description: Parámetros de consulta inválidos
 *       401:
 *         description: No autorizado - Token inválido o expirado
 *       429:
 *         description: |
 *           Demasiadas búsquedas (solo si usa parámetro `search`).
 *           Límite: 60 búsquedas cada 5 minutos.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/RateLimitError'
 */
router.get(
  "/",
  // ✅ NUEVO: Rate limiter solo para búsquedas con LIKE
  // Aplica SOLO si existe query param "search"
  (req, res, next) => {
    if (req.query.search) {
      return productosSearchLimiter(req, res, next);
    }
    next();
  },
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
 *     summary: Buscar producto por código de barras (optimizado para POS)
 *     description: |
 *       Búsqueda eficiente por código de barras único.
 *       Diseñado para sistemas POS con escaneo de código de barras.
 *
 *       **Performance**:
 *       - Caché: 15 minutos (CACHE_TTL.PRODUCTO_BARCODE)
 *       - Índice único en codigo_barras (búsqueda instantánea)
 *       - Query típico: ~1-5ms
 *
 *       **Rate Limiting**: ❌ Sin límite (operación crítica para ventas)
 *
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
 *         description: Código de barras del producto (EAN, UPC, etc.)
 *         example: "7501234567890"
 *     responses:
 *       200:
 *         description: Producto encontrado exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/Producto'
 *                 metadata:
 *                   type: object
 *                   properties:
 *                     operacion:
 *                       type: string
 *                       example: "busqueda_codigo_barras"
 *                     timestamp:
 *                       type: string
 *                       format: date-time
 *                 cache_info:
 *                   type: object
 *                   properties:
 *                     from_cache:
 *                       type: boolean
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
 *     description: |
 *       Consulta de producto individual por su identificador único.
 *
 *       **Performance**:
 *       - Caché: 10 minutos (CACHE_TTL.PRODUCTO_INDIVIDUAL)
 *       - Índice primario (búsqueda instantánea)
 *
 *       **Rate Limiting**: ❌ Sin límite
 *
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
 *         description: ID único del producto
 *         example: 123
 *     responses:
 *       200:
 *         description: Producto obtenido exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/Producto'
 *                 metadata:
 *                   type: object
 *                 cache_info:
 *                   type: object
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
 *     summary: Crear nuevo producto en el catálogo
 *     description: |
 *       Crea un producto con validaciones de unicidad y stock inicial atómico.
 *
 *       **Validaciones**:
 *       - Nombre único (case-insensitive)
 *       - Código de barras único (si se proporciona)
 *       - Categoría existente y activa
 *       - Precio venta > Precio compra
 *
 *       **Stock Inicial**:
 *       - Si `stock_actual > 0`, se registra movimiento de inventario automáticamente
 *       - Usa función atómica para prevenir race conditions
 *       - Se crea entrada en `movimientos_inventario` con tipo "entrada"
 *
 *       **Rate Limiting**:
 *       - Límite: 30 operaciones cada 10 minutos por usuario
 *       - Diseñado para gestión normal de catálogo
 *       - Rol "sistema" puede bypasear límite (para importaciones masivas)
 *
 *       **Performance**:
 *       - Query típico: ~50-100ms (sin stock) / ~100-150ms (con stock)
 *       - Transacción atómica garantiza consistencia
 *
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
 *                 description: Código de barras único (EAN, UPC, interno). Opcional.
 *                 example: "7501234567890"
 *               nombre:
 *                 type: string
 *                 minLength: 2
 *                 maxLength: 200
 *                 description: Nombre descriptivo del producto
 *                 example: "Arroz Diana 500g"
 *               descripcion:
 *                 type: string
 *                 maxLength: 1000
 *                 nullable: true
 *                 description: Descripción detallada del producto
 *                 example: "Arroz blanco de grano largo, ideal para preparaciones tradicionales"
 *               categoria_id:
 *                 type: integer
 *                 minimum: 1
 *                 description: ID de la categoría existente
 *                 example: 1
 *               precio_compra:
 *                 type: number
 *                 format: float
 *                 minimum: 0.01
 *                 maximum: 99999999.99
 *                 description: Precio de compra al proveedor
 *                 example: 2500.00
 *               precio_venta:
 *                 type: number
 *                 format: float
 *                 minimum: 0.01
 *                 maximum: 99999999.99
 *                 description: Precio de venta al público (debe ser mayor a precio_compra)
 *                 example: 3200.00
 *               tipo_medida:
 *                 type: string
 *                 enum: [unidad, peso]
 *                 default: unidad
 *                 description: |
 *                   Tipo de medición del producto:
 *                   - `unidad`: Productos contables (piezas, cajas, botellas)
 *                   - `peso`: Productos medidos por peso (kg, g)
 *               stock_actual:
 *                 type: number
 *                 format: float
 *                 minimum: 0
 *                 maximum: 99999999.999
 *                 default: 0
 *                 description: |
 *                   Stock inicial del producto (en unidades o kg según tipo_medida).
 *                   Si es > 0, se registra automáticamente movimiento de inventario.
 *                 example: 50
 *               stock_minimo:
 *                 type: number
 *                 format: float
 *                 minimum: 0
 *                 maximum: 99999999.999
 *                 default: 0
 *                 description: Stock mínimo para alertas de reposición
 *                 example: 10
 *               activo:
 *                 type: boolean
 *                 default: true
 *                 description: Estado inicial del producto
 *           examples:
 *             producto_completo:
 *               summary: Producto con todos los campos
 *               value:
 *                 codigo_barras: "7501234567890"
 *                 nombre: "Arroz Diana 500g"
 *                 descripcion: "Arroz blanco de grano largo"
 *                 categoria_id: 1
 *                 precio_compra: 2500.00
 *                 precio_venta: 3200.00
 *                 tipo_medida: "unidad"
 *                 stock_actual: 50
 *                 stock_minimo: 10
 *                 activo: true
 *             producto_minimo:
 *               summary: Producto con campos mínimos requeridos
 *               value:
 *                 nombre: "Aceite Girasol 1L"
 *                 categoria_id: 2
 *                 precio_compra: 4500.00
 *                 precio_venta: 5800.00
 *     responses:
 *       201:
 *         description: Producto creado exitosamente
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
 *                       example: 'Producto "Arroz Diana 500g" creado exitosamente'
 *                     producto:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: integer
 *                           example: 123
 *                         nombre:
 *                           type: string
 *                         codigo_barras:
 *                           type: string
 *                         precio_compra:
 *                           type: number
 *                         precio_venta:
 *                           type: number
 *                         stock_actual:
 *                           type: number
 *                         categoria_id:
 *                           type: integer
 *                 metadata:
 *                   type: object
 *                   properties:
 *                     operacion:
 *                       type: string
 *                       example: "creacion"
 *                     resource_id:
 *                       type: integer
 *                     stock_inicial:
 *                       type: number
 *                     timestamp:
 *                       type: string
 *                       format: date-time
 *       400:
 *         description: |
 *           Errores de validación:
 *           - Nombre duplicado
 *           - Código de barras duplicado
 *           - Categoría no existe
 *           - Precio venta <= Precio compra
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ValidationError'
 *       401:
 *         description: No autorizado - Token inválido o expirado
 *       403:
 *         description: Permisos insuficientes (requiere rol admin o dueño)
 *       429:
 *         description: |
 *           Límite de operaciones excedido.
 *           Límite: 30 creaciones cada 10 minutos.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/RateLimitError'
 */
router.post(
  "/",
  productosWriteLimiter, // Rate limiter para escritura
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
  productosWriteLimiter, // Rate limiter compartido con crear
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
 *     description: |
 *       Desactiva un producto sin eliminarlo físicamente de la base de datos.
 *       El producto permanece en el sistema pero ya no aparece en listados ni POS.
 *
 *       **Operación Lógica**:
 *       - Cambia campo `activo` a `false`
 *       - Mantiene todos los datos históricos
 *       - Producto sigue en reportes históricos
 *       - Movimientos de inventario previos se conservan
 *
 *       **Rate Limiting**:
 *       - Límite: 10 eliminaciones cada 15 minutos por usuario
 *       - Operación crítica con límite restrictivo
 *       - Logs de seguridad si se excede el límite
 *
 *       **Reactivación**:
 *       - Usar `PUT /api/productos/{id}` con `{ "activo": true }`
 *
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
 *         description: ID del producto a desactivar
 *         example: 123
 *     responses:
 *       200:
 *         description: Producto desactivado exitosamente
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
 *                       example: 'Producto "Arroz Diana 500g" desactivado exitosamente'
 *                     producto:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: integer
 *                         nombre:
 *                           type: string
 *                         activo:
 *                           type: boolean
 *                           example: false
 *                 metadata:
 *                   type: object
 *                   properties:
 *                     operacion:
 *                       type: string
 *                       example: "desactivacion"
 *                     estado_anterior:
 *                       type: boolean
 *                       example: true
 *                     estado_nuevo:
 *                       type: boolean
 *                       example: false
 *       404:
 *         description: Producto no encontrado
 *       401:
 *         description: No autorizado
 *       403:
 *         description: Permisos insuficientes
 *       429:
 *         description: |
 *           Límite de eliminaciones excedido.
 *           Límite: 10 eliminaciones cada 15 minutos.
 *           ⚠️ Patrón anormal detectado - revisar logs de seguridad.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/RateLimitError'
 */
router.delete(
  "/:id",
  criticalProductLimiter, // ✅ NUEVO: Rate limiter crítico para eliminaciones
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
 *       required:
 *         - nombre
 *         - categoria_id
 *         - precio_compra
 *         - precio_venta
 *         - tipo_medida
 *         - stock_actual
 *         - stock_minimo
 *         - activo
 *       properties:
 *         id:
 *           type: integer
 *           description: ID único autoincremental del producto
 *           example: 123
 *
 *         codigo_barras:
 *           type: string
 *           nullable: true
 *           maxLength: 50
 *           description: Código de barras único del producto (EAN, UPC o interno)
 *           example: "7501234567890"
 *
 *         nombre:
 *           type: string
 *           minLength: 2
 *           maxLength: 200
 *           description: Nombre descriptivo del producto
 *           example: "Arroz Diana 500g"
 *
 *         descripcion:
 *           type: string
 *           nullable: true
 *           maxLength: 1000
 *           description: Descripción detallada del producto
 *           example: "Arroz blanco premium para consumo doméstico"
 *
 *         categoria_id:
 *           type: integer
 *           minimum: 1
 *           description: Identificador de la categoría asociada
 *           example: 5
 *
 *         precio_compra:
 *           type: number
 *           format: decimal
 *           minimum: 0.01
 *           description: Precio de compra al proveedor
 *           example: 1800.50
 *
 *         precio_venta:
 *           type: number
 *           format: decimal
 *           minimum: 0.01
 *           description: Precio de venta al público (debe ser mayor al precio de compra)
 *           example: 2300.00
 *
 *         tipo_medida:
 *           type: string
 *           enum: [unidad, peso]
 *           description: Tipo de medición del producto
 *           example: "unidad"
 *
 *         stock_actual:
 *           type: number
 *           format: decimal
 *           minimum: 0
 *           description: Cantidad actual disponible en inventario
 *           example: 150.250
 *
 *         stock_minimo:
 *           type: number
 *           format: decimal
 *           minimum: 0
 *           description: Stock mínimo para generar alertas de reposición
 *           example: 20.000
 *
 *         activo:
 *           type: boolean
 *           description: Estado del producto (true = activo, false = desactivado)
 *           example: true
 *
 *         fecha_creacion:
 *           type: string
 *           format: date-time
 *           description: Fecha de creación del registro
 *           example: "2024-11-01T10:15:30.000Z"
 *
 *         fecha_actualizacion:
 *           type: string
 *           format: date-time
 *           description: Fecha de la última actualización del registro
 *           example: "2024-11-05T08:45:12.000Z"
 *
 *         categoria:
 *           type: object
 *           description: Categoría asociada al producto
 *           properties:
 *             id:
 *               type: integer
 *               example: 5
 *             nombre:
 *               type: string
 *               example: "Granos y cereales"
 */

export default router;
