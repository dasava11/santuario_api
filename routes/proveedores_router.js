// routes/proveedores.js - Router Refactorizado con Sanitización
import express from "express";

// Controladores
import {
  obtenerProveedores,
  obtenerProveedorPorId,
  crearProveedor,
  actualizarProveedor,
  eliminarProveedor,
  obtenerEstadisticasProveedores,
} from "../controllers/proveedoresControlador.js";

// Middlewares de autenticación
import { verifyToken, verifyRole } from "../middleware/auth.js";

// Middleware de sanitización
import { sanitizeSearch } from "../middleware/sanitizeSearch.js";

// Validaciones específicas
import {
  validateCreateProveedor,
  validateUpdateProveedor,
  validateProveedorId,
  validateGetProveedoresQuery,
  validateGetProveedorByIdQuery,
} from "../validations/proveedores_validations.js";

import {
  proveedoresWriteLimiter,
  criticalProveedorLimiter,
  proveedoresReportLimiter,
} from "../middleware/rateLimiters.js";

const router = express.Router();

// =====================================================
// 📊 OBTENER TODOS LOS PROVEEDORES
// =====================================================
/**
 * @swagger
 * /proveedores:
 *   get:
 *     summary: Obtener todos los proveedores con filtros y paginación
 *     description: |
 *       Lista proveedores con opciones de búsqueda, filtrado por estado y paginación.
 *       
 *       **Características**:
 *       - Búsqueda por nombre, contacto o email
 *       - Filtrado por estado activo/inactivo
 *       - Paginación configurable (máx 100 por página)
 *       - Opción de incluir estadísticas de recepciones
 *       - Resultados cacheados para mejor performance
 *     tags: [Proveedores]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *           maxLength: 200
 *           example: "Distribuidora"
 *         description: Buscar por nombre, contacto o email (LIKE parcial)
 *       - in: query
 *         name: activo
 *         schema:
 *           type: string
 *           enum: [true, false, all]
 *           default: "true"
 *         description: |
 *           Filtrar por estado:
 *           - `true`: Solo proveedores activos (defecto)
 *           - `false`: Solo proveedores inactivos
 *           - `all`: Todos los proveedores
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *           example: 1
 *         description: Número de página (inicia en 1)
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 20
 *           example: 20
 *         description: Resultados por página (1-100)
 *       - in: query
 *         name: incluir_estadisticas
 *         schema:
 *           type: string
 *           enum: [true, false]
 *           default: "false"
 *         description: |
 *           Incluir estadísticas adicionales por proveedor:
 *           - Total de recepciones
 *           - Valor total de compras
 *           - Fecha de última recepción
 *           
 *           ⚠️ Nota: Activar esto aumenta el tiempo de respuesta
 *     responses:
 *       200:
 *         description: Lista de proveedores obtenida exitosamente
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
 *                     proveedores:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Proveedor'
 *                     pagination:
 *                       $ref: '#/components/schemas/Pagination'
 *                 metadata:
 *                   type: object
 *                   properties:
 *                     total_proveedores:
 *                       type: integer
 *                       example: 45
 *                     con_estadisticas:
 *                       type: boolean
 *                       example: false
 *                     filtro_activo:
 *                       type: string
 *                       example: "true"
 *                     busqueda_aplicada:
 *                       type: boolean
 *                       example: true
 *                     tiempo_consulta_ms:
 *                       type: number
 *                       example: 23.45
 *                     timestamp:
 *                       type: string
 *                       format: date-time
 *                 cache_info:
 *                   $ref: '#/components/schemas/CacheInfo'
 *             examples:
 *               busqueda_basica:
 *                 summary: Búsqueda básica sin filtros
 *                 value:
 *                   success: true
 *                   data:
 *                     proveedores:
 *                       - id: 1
 *                         nombre: "Distribuidora Central"
 *                         email: "contacto@central.com"
 *                         telefono: "+57 300 123 4567"
 *                         activo: true
 *                     pagination:
 *                       page: 1
 *                       limit: 20
 *                       total: 45
 *                       pages: 3
 *               con_estadisticas:
 *                 summary: Con estadísticas incluidas
 *                 value:
 *                   success: true
 *                   data:
 *                     proveedores:
 *                       - id: 1
 *                         nombre: "Distribuidora Central"
 *                         total_recepciones: 15
 *                         valor_total_compras: 45000000.00
 *                         ultima_recepcion: "2024-12-15T10:30:00Z"
 *       400:
 *         description: Parámetros de consulta inválidos
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             examples:
 *               parametro_invalido:
 *                 summary: Parámetro inválido
 *                 value:
 *                   success: false
 *                   error:
 *                     message: "Datos de entrada inválidos"
 *                     code: 400
 *                     details:
 *                       - field: "limit"
 *                         message: "El límite no puede ser mayor a 100"
 *       401:
 *         description: No autorizado - Token faltante o inválido
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               success: false
 *               error:
 *                 message: "Token de acceso requerido"
 *                 code: 401
 */
router.get(
  "/",
  sanitizeSearch({
    queryFields: ["search", "activo", "incluir_estadisticas"],
    maxLength: 200,
    removeDangerousChars: true,
  }),
  verifyToken,
  validateGetProveedoresQuery,
  obtenerProveedores
);

// =====================================================
// 📊 ESTADÍSTICAS DE PROVEEDORES
// =====================================================
/**
 * @swagger
 * /proveedores/estadisticas:
 *   get:
 *     summary: Obtener estadísticas completas de proveedores
 *     description: |
 *       Retorna análisis agregado de todos los proveedores con:
 *       - Total de recepciones por proveedor
 *       - Valor total de compras acumulado
 *       - Fecha de última recepción
 *       - Totales consolidados (proveedores activos/inactivos)
 *       
 *       **Rate Limiting**:
 *       - Máximo 15 consultas cada 5 minutos por usuario
 *       - Consulta computacionalmente costosa (joins complejos)
 *       - Resultados cacheados por 10 minutos
 *       
 *       **Permisos**: Solo administrador y dueño
 *     tags: [Proveedores]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Estadísticas obtenidas exitosamente
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
 *                     por_proveedor:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: integer
 *                           nombre:
 *                             type: string
 *                           ciudad:
 *                             type: string
 *                           pais:
 *                             type: string
 *                           activo:
 *                             type: boolean
 *                           total_recepciones:
 *                             type: integer
 *                           valor_total_compras:
 *                             type: number
 *                             format: decimal
 *                           ultima_recepcion:
 *                             type: string
 *                             format: date-time
 *                             nullable: true
 *                     totales:
 *                       type: object
 *                       properties:
 *                         proveedores_activos:
 *                           type: integer
 *                           example: 45
 *                         proveedores_inactivos:
 *                           type: integer
 *                           example: 5
 *                         valor_total_compras:
 *                           type: number
 *                           format: decimal
 *                           example: 125000000.50
 *                 metadata:
 *                   type: object
 *                   properties:
 *                     total_proveedores_analizados:
 *                       type: integer
 *                     tiempo_consulta_ms:
 *                       type: number
 *                     timestamp:
 *                       type: string
 *                       format: date-time
 *                 cache_info:
 *                   $ref: '#/components/schemas/CacheInfo'
 *             example:
 *               success: true
 *               data:
 *                 por_proveedor:
 *                   - id: 1
 *                     nombre: "Distribuidora Central"
 *                     total_recepciones: 25
 *                     valor_total_compras: 50000000.00
 *                     ultima_recepcion: "2024-12-15T10:30:00Z"
 *                 totales:
 *                   proveedores_activos: 45
 *                   proveedores_inactivos: 5
 *                   valor_total_compras: 125000000.50
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       429:
 *         description: Rate limit excedido
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/RateLimitError'
 *             example:
 *               error: "Demasiadas consultas de estadísticas de proveedores"
 *               detalles: "Límite de 15 consultas cada 5 minutos"
 *               retry_after_seconds: 300
 *               tipo: "proveedores_report_limit"
 *               sugerencia: "Espera unos minutos antes de generar más reportes"
 */
router.get(
  "/estadisticas",
  proveedoresReportLimiter,
  verifyToken,
  verifyRole(["administrador", "dueño"]),
  obtenerEstadisticasProveedores
);

// =====================================================
// 📄 OBTENER PROVEEDOR POR ID
// =====================================================
/**
 * @swagger
 * /proveedores/{id}:
 *   get:
 *     summary: Obtener proveedor por ID
 *     description: |
 *       Obtiene información detallada de un proveedor específico.
 *       
 *       **Opciones**:
 *       - Incluir últimas 10 recepciones (opcional)
 *       - Resultados cacheados por 10 minutos
 *     tags: [Proveedores]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *           minimum: 1
 *           example: 1
 *         description: ID único del proveedor
 *       - in: query
 *         name: incluir_recepciones
 *         schema:
 *           type: string
 *           enum: [true, false]
 *           default: "false"
 *         description: |
 *           Incluir últimas 10 recepciones del proveedor
 *           (solo recepciones no canceladas)
 *     responses:
 *       200:
 *         description: Proveedor obtenido exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/Proveedor'
 *                 metadata:
 *                   type: object
 *                   properties:
 *                     incluye_recepciones:
 *                       type: boolean
 *                     total_recepciones:
 *                       type: integer
 *                       nullable: true
 *                 cache_info:
 *                   $ref: '#/components/schemas/CacheInfo'
 *             examples:
 *               sin_recepciones:
 *                 summary: Proveedor sin recepciones incluidas
 *                 value:
 *                   success: true
 *                   data:
 *                     id: 1
 *                     nombre: "Distribuidora Central"
 *                     email: "contacto@central.com"
 *                     activo: true
 *               con_recepciones:
 *                 summary: Proveedor con recepciones incluidas
 *                 value:
 *                   success: true
 *                   data:
 *                     id: 1
 *                     nombre: "Distribuidora Central"
 *                     recepciones:
 *                       - id: 100
 *                         numero_factura: "F-2024-001"
 *                         total: 5000000.00
 *                         estado: "procesada"
 *       400:
 *         description: ID de proveedor inválido
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               success: false
 *               error:
 *                 message: "Datos de entrada inválidos"
 *                 code: 400
 *                 details:
 *                   - field: "id"
 *                     message: "El ID debe ser un número positivo"
 *       404:
 *         description: Proveedor no encontrado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               success: false
 *               error:
 *                 message: "Proveedor no encontrado"
 *                 code: 404
 *                 tipo: "not_found"
 *                 details:
 *                   proveedor_id: 999
 *                   sugerencia: "Verifica que el ID del proveedor sea correcto"
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.get(
  "/:id",
  sanitizeSearch({
    paramFields: ["id"],
    queryFields: ["incluir_recepciones"],
    maxLength: 50,
    removeDangerousChars: true,
  }),
  verifyToken,
  validateProveedorId,
  validateGetProveedorByIdQuery,
  obtenerProveedorPorId
);

// =====================================================
// ✨ CREAR NUEVO PROVEEDOR
// =====================================================
/**
 * @swagger
 * /proveedores:
 *   post:
 *     summary: Crear nuevo proveedor
 *     description: |
 *       Registra un nuevo proveedor en el sistema.
 *       
 *       **Validaciones**:
 *       - Nombre obligatorio (2-200 caracteres)
 *       - Email único (si se proporciona)
 *       - Email con formato válido
 *       - Campos opcionales con validaciones de longitud
 *       
 *       **Rate Limiting**:
 *       - Máximo 20 operaciones cada 10 minutos por usuario
 *       - Previene creación masiva accidental
 *       
 *       **Permisos**: Solo administrador y dueño
 *     tags: [Proveedores]
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
 *             properties:
 *               nombre:
 *                 type: string
 *                 minLength: 2
 *                 maxLength: 200
 *                 description: Nombre del proveedor (obligatorio)
 *                 example: "Distribuidora ABC"
 *               contacto:
 *                 type: string
 *                 maxLength: 100
 *                 description: Persona de contacto (opcional)
 *                 example: "Juan Pérez"
 *               telefono:
 *                 type: string
 *                 maxLength: 20
 *                 description: Número de teléfono (opcional)
 *                 example: "+57 300 123 4567"
 *               email:
 *                 type: string
 *                 format: email
 *                 maxLength: 100
 *                 description: Correo electrónico único (opcional)
 *                 example: "contacto@distribuidoraabc.com"
 *               direccion:
 *                 type: string
 *                 maxLength: 500
 *                 description: Dirección física (opcional)
 *                 example: "Calle 123 #45-67, Bodega 5"
 *               ciudad:
 *                 type: string
 *                 maxLength: 100
 *                 description: Ciudad (opcional)
 *                 example: "Bogotá"
 *               pais:
 *                 type: string
 *                 maxLength: 100
 *                 default: "Colombia"
 *                 description: País (opcional, defecto Colombia)
 *                 example: "Colombia"
 *               activo:
 *                 type: boolean
 *                 default: true
 *                 description: Estado del proveedor (opcional)
 *                 example: true
 *           examples:
 *             proveedor_completo:
 *               summary: Proveedor con todos los campos
 *               value:
 *                 nombre: "Distribuidora ABC"
 *                 contacto: "Juan Pérez"
 *                 telefono: "+57 300 123 4567"
 *                 email: "contacto@distribuidoraabc.com"
 *                 direccion: "Calle 123 #45-67, Bodega 5"
 *                 ciudad: "Bogotá"
 *                 pais: "Colombia"
 *                 activo: true
 *             proveedor_minimo:
 *               summary: Proveedor con campos mínimos
 *               value:
 *                 nombre: "Distribuidora XYZ"
 *     responses:
 *       201:
 *         description: Proveedor creado exitosamente
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
 *                       example: "Proveedor \"Distribuidora ABC\" creado exitosamente"
 *                     proveedor:
 *                       $ref: '#/components/schemas/Proveedor'
 *                 metadata:
 *                   type: object
 *                   properties:
 *                     operacion:
 *                       type: string
 *                       example: "creacion"
 *                     resource_id:
 *                       type: integer
 *                       example: 15
 *                     campos_creados:
 *                       type: array
 *                       items:
 *                         type: string
 *                       example: ["nombre", "email", "telefono"]
 *                     timestamp:
 *                       type: string
 *                       format: date-time
 *       400:
 *         description: Errores de validación
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             examples:
 *               validacion_falla:
 *                 summary: Error de validación
 *                 value:
 *                   success: false
 *                   error:
 *                     message: "Datos de entrada inválidos"
 *                     code: 400
 *                     details:
 *                       - field: "nombre"
 *                         message: "El nombre es obligatorio"
 *                       - field: "email"
 *                         message: "El email debe tener un formato válido"
 *               validacion_modelo:
 *                 summary: Error de validación del modelo
 *                 value:
 *                   success: false
 *                   error:
 *                     message: "Errores de validación en los datos"
 *                     code: 400
 *                     tipo: "validation_error"
 *                     details:
 *                       campos_invalidos:
 *                         - campo: "email"
 *                           mensaje: "Debe proporcionar un email válido"
 *                           valor: "email-invalido"
 *       409:
 *         description: Email duplicado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               success: false
 *               error:
 *                 message: "Ya existe un proveedor con este email"
 *                 code: 409
 *                 tipo: "duplicate_email"
 *                 details:
 *                   email: "contacto@distribuidoraabc.com"
 *                   sugerencia: "Verifica si el proveedor ya está registrado o usa otro email"
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       429:
 *         description: Rate limit excedido
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/RateLimitError'
 *             example:
 *               error: "Límite de operaciones de proveedores excedido temporalmente"
 *               detalles: "Has realizado demasiadas operaciones en los últimos 10 minutos (máximo: 20)"
 *               retry_after_seconds: 600
 *               tipo: "proveedores_rate_limit"
 *               contexto:
 *                 limite: 20
 *                 ventana: "10 minutos"
 *                 usuario: 5
 */
router.post(
  "/",
  proveedoresWriteLimiter,
  sanitizeSearch({
    bodyFields: [
      "nombre",
      "contacto",
      "telefono",
      "email",
      "direccion",
      "ciudad",
      "pais",
    ],
    maxLength: 500,
    removeDangerousChars: true,
    escapeWildcards: false,
  }),
  verifyToken,
  verifyRole(["administrador", "dueño"]),
  validateCreateProveedor,
  crearProveedor
);

// =====================================================
// 🔄 ACTUALIZAR PROVEEDOR
// =====================================================
/**
 * @swagger
 * /proveedores/{id}:
 *   put:
 *     summary: Actualizar proveedor existente
 *     description: |
 *       Actualiza información de un proveedor.
 *       
 *       **Validaciones**:
 *       - Al menos 1 campo requerido para actualizar
 *       - Email único (si se modifica)
 *       - Validaciones de longitud en campos
 *       
 *       **Rate Limiting**:
 *       - Máximo 20 operaciones cada 10 minutos por usuario
 *       - Compartido con operaciones de creación
 *       
 *       **Permisos**: Solo administrador y dueño
 *     tags: [Proveedores]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *           minimum: 1
 *           example: 1
 *         description: ID del proveedor a actualizar
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             minProperties: 1
 *             properties:
 *               nombre:
 *                 type: string
 *                 minLength: 2
 *                 maxLength: 200
 *               contacto:
 *                 type: string
 *                 maxLength: 100
 *               telefono:
 *                 type: string
 *                 maxLength: 20
 *               email:
 *                 type: string
 *                 format: email
 *                 maxLength: 100
 *               direccion:
 *                 type: string
 *                 maxLength: 500
 *               ciudad:
 *                 type: string
 *                 maxLength: 100
 *               pais:
 *                 type: string
 *                 maxLength: 100
 *               activo:
 *                 type: boolean
 *           examples:
 *             actualizar_parcial:
 *               summary: Actualizar solo algunos campos
 *               value:
 *                 telefono: "+57 301 987 6543"
 *                 email: "nuevo_email@proveedor.com"
 *             actualizar_completo:
 *               summary: Actualizar múltiples campos
 *               value:
 *                 nombre: "Distribuidora ABC Actualizada"
 *                 telefono: "+57 301 987 6543"
 *                 email: "nuevo@proveedor.com"
 *                 ciudad: "Medellín"
 *             desactivar:
 *               summary: Desactivar proveedor (alternativa a DELETE)
 *               value:
 *                 activo: false
 *     responses:
 *       200:
 *         description: Proveedor actualizado exitosamente
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
 *                     mensaje:
 *                       type: string
 *                       example: "Proveedor \"Distribuidora ABC\" actualizado exitosamente"
 *                     cambios_realizados:
 *                       type: array
 *                       items:
 *                         type: string
 *                       example: ["telefono", "email", "ciudad"]
 *                     proveedor:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: integer
 *                         nombre:
 *                           type: string
 *                         email:
 *                           type: string
 *                         activo:
 *                           type: boolean
 *                 metadata:
 *                   type: object
 *                   properties:
 *                     operacion:
 *                       type: string
 *                       example: "actualizacion"
 *                     resource_id:
 *                       type: integer
 *                     campos_modificados:
 *                       type: array
 *                       items:
 *                         type: string
 *                     total_cambios:
 *                       type: integer
 *                       example: 3
 *       400:
 *         description: Errores de validación o sin cambios
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             examples:
 *               sin_campos:
 *                 summary: No se proporcionaron campos
 *                 value:
 *                   success: false
 *                   error:
 *                     message: "Datos de entrada inválidos"
 *                     code: 400
 *                     details:
 *                       - field: "body"
 *                         message: "Debe proporcionar al menos un campo para actualizar"
 *       404:
 *         description: Proveedor no encontrado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               success: false
 *               error:
 *                 message: "Proveedor no encontrado"
 *                 code: 404
 *                 tipo: "not_found"
 *                 details:
 *                   proveedor_id: 999
 *                   sugerencia: "Verifica que el ID del proveedor sea correcto"
 *   409:
 *      description: Email duplicado
 *      content:
 *        application/json:
 *          schema:
 *           $ref: '#/components/schemas/ErrorResponse'
 *         example:
 *           success: false
 *           error:
 *             message: "Ya existe otro proveedor con este email"
 *             code: 409
 *             tipo: "duplicate_email"
 *             details:
 *               email: "contacto@otro.com"
 *               proveedor_id: 5
 *               sugerencia: "Verifica si otro proveedor ya está usando este email"
 *    
*     401:
*       $ref: '#/components/responses/UnauthorizedError'
*     403:
*       $ref: '#/components/responses/ForbiddenError'
*     429:
*       $ref: '#/components/schemas/RateLimitError'
*/
router.put(
  "/:id",
  proveedoresWriteLimiter,
  sanitizeSearch({
    paramFields: ["id"],
    bodyFields: [
      "nombre",
      "contacto",
      "telefono",
      "email",
      "direccion",
      "ciudad",
      "pais",
    ],
    maxLength: 500,
    removeDangerousChars: true,
    escapeWildcards: false,
  }),
  verifyToken,
  verifyRole(["administrador", "dueño"]),
  validateProveedorId,
  validateUpdateProveedor,
  actualizarProveedor
);

// =====================================================
// 🗑️ ELIMINAR (DESACTIVAR) PROVEEDOR
// =====================================================
/**
 * @swagger
 * /proveedores/{id}:
 *   delete:
 *     summary: Eliminar proveedor (desactivación lógica)
 *     description: |
 *       Desactiva un proveedor en el sistema (soft delete).
 *
 *       **Validaciones Críticas**:
 *       - Verifica que no tenga recepciones activas (pendientes/procesadas)
 *       - Verifica que no esté ya inactivo
 *       - Solo marca como inactivo, NO elimina datos
 *
 *       **Rate Limiting**:
 *       - Máximo 5 desactivaciones cada 15 minutos por usuario
 *       - Operación crítica con auditoría completa
 *       - Alertas si se detecta patrón anormal
 *
 *       **Permisos**: Solo administrador y dueño
 *     tags:
 *       - Proveedores
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: ID del proveedor a desactivar
 *         schema:
 *           type: integer
 *           minimum: 1
 *           example: 1
 *     responses:
 *       200:
 *         description: Proveedor desactivado exitosamente
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
 *                       example: Proveedor "Distribuidora ABC" desactivado exitosamente
 *                     proveedor:
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
 *                       example: desactivacion
 *                     resource_id:
 *                       type: integer
 *                     fecha_desactivacion:
 *                       type: string
 *                       format: date-time
 *                     proveedor_nombre:
 *                       type: string
 *       400:
 *         description: No se puede desactivar
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             examples:
 *               ya_inactivo:
 *                 summary: Proveedor ya está inactivo
 *                 value:
 *                   success: false
 *                   error:
 *                     message: El proveedor ya está inactivo
 *                     code: 400
 *                     tipo: already_inactive
 *                     details:
 *                       proveedor_id: 5
 *                       sugerencia: El proveedor ya fue desactivado previamente
 *               recepciones_activas:
 *                 summary: Tiene recepciones activas
 *                 value:
 *                   success: false
 *                   error:
 *                     message: No se puede desactivar el proveedor porque tiene recepciones activas
 *                     code: 400
 *                     tipo: has_active_relations
 *                     details:
 *                       proveedor_id: 5
 *                       recepciones_activas: 3
 *                       sugerencia: Procesa o cancela las recepciones pendientes antes de desactivar el proveedor
 *                       acciones_requeridas:
 *                         - Revisar recepciones en estado 'pendiente'
 *                         - Procesar recepciones completadas
 *                         - Cancelar recepciones no válidas
 *       404:
 *         description: Proveedor no encontrado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               success: false
 *               error:
 *                 message: Proveedor no encontrado
 *                 code: 404
 *                 tipo: not_found
 *                 details:
 *                   proveedor_id: 999
 *                   sugerencia: Verifica que el ID del proveedor sea correcto
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       429:
 *         description: Rate limit crítico excedido
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/RateLimitError'
 *             example:
 *               error: Límite de desactivaciones de proveedores excedido
 *               detalles: Solo se permiten 5 desactivaciones cada 15 minutos por razones de seguridad
 *               retry_after_seconds: 900
 *               tipo: critical_delete_limit
 *               contexto:
 *                 limite: 5
 *                 ventana: 15 minutos
 *                 razon: Prevención de errores masivos y auditoría de operaciones críticas
 *               sugerencia: Si necesitas desactivar múltiples proveedores, contacta al supervisor o administrador del sistema
 */

router.delete(
  "/:id",
  criticalProveedorLimiter,
  sanitizeSearch({
    paramFields: ["id"],
    maxLength: 20,
    removeDangerousChars: true,
  }),
  verifyToken,
  verifyRole(["administrador", "dueño"]),
  validateProveedorId,
  eliminarProveedor
);

// =====================================================
// 📋 SWAGGER COMPONENTS
// =====================================================
/**
 * @swagger
 * components:
 *   schemas:
 *     Proveedor:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *           description: ID único del proveedor
 *           example: 1
 *         nombre:
 *           type: string
 *           description: Nombre del proveedor
 *           example: Distribuidora Central
 *         contacto:
 *           type: string
 *           nullable: true
 *           description: Persona de contacto
 *           example: Juan Pérez
 *         telefono:
 *           type: string
 *           nullable: true
 *           description: Número de teléfono
 *           example: +57 300 123 4567
 *         email:
 *           type: string
 *           nullable: true
 *           description: Correo electrónico
 *           example: contacto@central.com
 *         direccion:
 *           type: string
 *           nullable: true
 *           description: Dirección física
 *           example: Calle 123 #45-67
 *         ciudad:
 *           type: string
 *           nullable: true
 *           description: Ciudad
 *           example: Bogotá
 *         pais:
 *           type: string
 *           nullable: true
 *           description: País
 *           example: Colombia
 *         activo:
 *           type: boolean
 *           description: Estado del proveedor (activo/inactivo)
 *           example: true
 *         fecha_creacion:
 *           type: string
 *           format: date-time
 *           description: Fecha de creación del registro
 *           example: 2024-01-15T10:30:00Z
 *         fecha_actualizacion:
 *           type: string
 *           format: date-time
 *           description: Fecha de última actualización
 *           example: 2024-12-15T14:20:00Z
 *       required:
 *         - id
 *         - nombre
 *         - activo
 *
 *     Pagination:
 *       type: object
 *       properties:
 *         page:
 *           type: integer
 *           description: Página actual
 *           example: 1
 *         limit:
 *           type: integer
 *           description: Resultados por página
 *           example: 20
 *         total:
 *           type: integer
 *           description: Total de registros
 *           example: 45
 *         pages:
 *           type: integer
 *           description: Total de páginas
 *           example: 3
 *
 *     CacheInfo:
 *       type: object
 *       properties:
 *         from_cache:
 *           type: boolean
 *           description: Indica si la respuesta proviene del caché
 *           example: true
 *         cache_timestamp:
 *           type: string
 *           format: date-time
 *           description: Timestamp de cuando se cacheó
 *           example: 2024-12-15T10:30:45Z
 *
 *     ErrorResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           example: false
 *         error:
 *           type: object
 *           properties:
 *             message:
 *               type: string
 *               example: Error en la operación
 *             code:
 *               type: integer
 *               example: 400
 *             tipo:
 *               type: string
 *               example: validation_error
 *             timestamp:
 *               type: string
 *               format: date-time
 *             details:
 *               type: object
 *               description: Detalles específicos del error
 *
 *     RateLimitError:
 *       type: object
 *       properties:
 *         error:
 *           type: string
 *           example: Demasiadas operaciones en poco tiempo
 *         detalles:
 *           type: string
 *           example: Has excedido el límite de 20 operaciones en 10 minutos
 *         retry_after_seconds:
 *           type: integer
 *           description: Segundos hasta poder reintentar
 *           example: 600
 *         tipo:
 *           type: string
 *           example: proveedores_rate_limit
 *         contexto:
 *           type: object
 *           properties:
 *             limite:
 *               type: integer
 *               example: 20
 *             ventana:
 *               type: string
 *               example: 10 minutos
 *             usuario:
 *               type: integer
 *               nullable: true
 *               example: 5
 *         sugerencia:
 *           type: string
 *           example: Espera unos minutos antes de realizar más operaciones
 *
 *   responses:
 *     UnauthorizedError:
 *       description: No autorizado - Token faltante o inválido
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ErrorResponse'
 *           example:
 *             success: false
 *             error:
 *               message: Token de acceso requerido
 *               code: 401
 *               timestamp: 2024-12-15T10:30:00Z
 *
 *     ForbiddenError:
 *       description: Permisos insuficientes
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ErrorResponse'
 *           example:
 *             success: false
 *             error:
 *               message: No tienes permisos para realizar esta acción
 *               code: 403
 *               details:
 *                 requiredRoles:
 *                   - administrador
 *                   - dueño
 *                 userRole: cajero
 *
 *   securitySchemes:
 *     bearerAuth:
 *       type: http
 *       scheme: bearer
 *       bearerFormat: JWT
 *       description: |
 *         Token JWT de autenticación. Obtén el token desde el endpoint `/api/auth/login`
 *
 *         Formato del header:
 *         Authorization: Bearer <tu_token_jwt>
 */

export default router;
