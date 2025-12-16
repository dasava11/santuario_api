import redisClient from "../config/redis.js";

// =====================================================
// 🎯 TTL CONFIG UNIFICADO (extendido según módulos)
// =====================================================
export const CACHE_TTL = {
  // Autenticación
  AUTH_USER_PROFILE: 600, // 10 minutos - perfil de usuario
  AUTH_SESSION_VALIDATION: 300, // 5 minutos - validación de sesión
  AUTH_LOGIN_ATTEMPTS: 900, // 15 minutos - intentos de login
  AUTH_TOKEN_VALIDATION: 180, // 3 minutos - validación de token

  // Usuarios
  USUARIO_INDIVIDUAL: 600, // 10 minutos - perfil de usuario
  USUARIOS_PAGINADOS: 300, // 5 minutos - listados con filtros
  USUARIOS_SEARCH: 240, // 4 minutos - búsquedas administrativas

  // Productos
  PRODUCTO_INDIVIDUAL: 600, // 10 min
  PRODUCTOS_PAGINADOS: 240, // 4 min
  PRODUCTO_BARCODE: 900, // 15 min

  // Categorías
  CATEGORIAS_LIST: 900, // 15 minutos - listados
  CATEGORIA_INDIVIDUAL: 600, // 10 minutos - categoría específica
  CATEGORIA_CON_PRODUCTOS: 300, // 5 minutos - incluye productos

  // Proveedores
  PROVEEDOR_INDIVIDUAL: 600, // 10 minutos
  PROVEEDORES_PAGINADOS: 300, // 5 minutos (cambian frecuentemente por búsquedas)
  PROVEEDOR_BY_EMAIL: 900, // 15 minutos - consultas por email

  // Recepciones
  RECEPCION_INDIVIDUAL: 600, // 10 minutos - recepción específica
  RECEPCIONES_PAGINADOS: 240, // 4 minutos - listados paginados
  RECEPCION_CON_DETALLES: 900, // 15 minutos - con productos incluidos
  RECEPCIONES_ESTADISTICAS: 300, // 5 minutos - estadísticas y reportes
  RECEPCIONES_POR_PROVEEDOR: 600, // 10 minutos - recepciones de un proveedor

  //ventas
  VENTA_INDIVIDUAL: 600, // 10 min
  VENTAS_PAGINADOS: 240, // 4 min
  VENTAS_RESUMEN: 300, // 5 min (pesado)
  VENTAS_ESTADISTICAS: 600, // 10 min

  // Estadísticas (general)
  ESTADISTICAS: 300, // 5 minutos - datos con estadísticas
  ESTADISTICAS_PROVEEDORES: 600, // 10 minutos - específicas de proveedores
  ESTADISTICAS_CATEGORIAS: 300, // 5 minutos - específicas de categorías

  // Inventario y Movimientos
  MOVIMIENTOS_PAGINADOS: 300, // 5 min - historial de movimientos
  INVENTARIO_STOCK_BAJO: 180, // 3 min - crítico para reposición
  INVENTARIO_RESUMEN: 240, // 4 min - dashboard general
  INVENTARIO_ESTADISTICAS: 300, // 5 min - cálculos complejos
  INVENTARIO_VALOR: 600, // 10 min - valor total cambia menos
  INVENTARIO_REPORTE: 420, // 7 min - reportes específicos
  INVENTARIO_ALERTAS: 120, // 2 min - alertas críticas
};

// =====================================================
// 🔑 PREFIJOS DE CACHE CENTRALIZADOS - NUEVA SECCIÓN
// =====================================================
export const CACHE_PREFIXES = {
  // Autenticación
  AUTH_USER: "auth:user",
  AUTH_USERNAME: "auth:username",
  AUTH_PROFILE: "auth:profile",
  AUTH_ATTEMPTS: "auth:attempts",
  AUTH_SESSION: "auth:sessions",
  AUTH_TOKEN_VALIDATION: "auth:token_validation",

  // Usuarios
  USUARIO_ID: "usuario:id",
  USUARIO_USERNAME: "usuario:username",
  USUARIO_EMAIL: "usuario:email",
  USUARIOS_LIST: "usuarios:list",
  USUARIOS_SEARCH: "usuarios:search",

  // Productos
  PRODUCTO_ID: "producto:id",
  PRODUCTO_BARCODE: "producto:barcode",
  PRODUCTOS_LIST: "productos:list",

  // Categorías
  CATEGORIA: "categoria",
  CATEGORIAS: "categorias",
  CATEGORIAS_LIST: "categorias:list",
  CATEGORIAS_ESTADISTICAS: "categorias:estadisticas",

  // Proveedores
  PROVEEDOR: "proveedor",
  PROVEEDOR_EMAIL: "proveedor:email",
  PROVEEDORES_LIST: "proveedores:list",
  PROVEEDORES_SEARCH: "proveedores:search",
  PROVEEDORES_ESTADISTICAS: "proveedores:estadisticas",

  // Recepciones
  RECEPCION: "recepcion",
  RECEPCION_FACTURA: "recepcion:factura",
  RECEPCIONES_LIST: "recepciones:list",
  RECEPCIONES_SEARCH: "recepciones:search",
  RECEPCIONES_ESTADISTICAS: "recepciones:estadisticas",
  RECEPCIONES_PROVEEDOR: "recepciones:proveedor",

  // Ventas
  VENTA: "venta",
  VENTA_NUMERO: "venta:numero",
  VENTAS_LIST: "ventas:list",
  VENTAS_RESUMEN: "ventas:resumen",
  VENTAS_ESTADISTICAS: "ventas:estadisticas",

  // Inventario/Movimientos
  MOVIMIENTO: "movimiento",
  MOVIMIENTOS_LIST: "movimientos:list",
  INVENTARIO_STOCK_BAJO: "inventario:stock_bajo",
  INVENTARIO_RESUMEN: "inventario:resumen",
  INVENTARIO_VALOR: "inventario:valor",
  INVENTARIO_ESTADISTICAS: "inventario:estadisticas",
  INVENTARIO_REPORTE: "inventario:reporte",
  INVENTARIO_ALERTAS: "inventario:alertas",
};

// =====================================================
// 🔹 UTILIDADES DE CACHÉ
// =====================================================

/**
 * Genera clave de caché consistente con parámetros ordenados
 * 
 * ✅ USO PRINCIPAL para queries complejas con múltiples parámetros
 * 
 * @param {string} prefix - Prefijo de la clave (usar CACHE_PREFIXES)
 * @param {Object} params - Parámetros para la clave
 * @returns {string} Clave de caché
 * 
 * @example
 * // Para filtros complejos
 * generateCacheKey(CACHE_PREFIXES.VENTAS_LIST, {
 *   fecha_inicio: "2024-01-01",
 *   fecha_fin: "2024-12-31",
 *   metodo_pago: "efectivo",
 *   page: 1,
 *   limit: 20
 * });
 * // Resultado: "ventas:list:{"fecha_fin":"2024-12-31","fecha_inicio":"2024-01-01",...}"
 */
export const generateCacheKey = (prefix, params = {}) => {
  // Ordenar parámetros alfabéticamente para consistencia
  const sortedParams = Object.keys(params)
    .sort()
    .reduce((result, key) => {
      result[key] = params[key];
      return result;
    }, {});

  return `${prefix}:${JSON.stringify(sortedParams)}`;
};

/**
 * ✅ NUEVA: Genera clave simple para identificadores únicos
 * 
 * ✅ USO RECOMENDADO para:
 * - Búsqueda por ID único (producto:id:123)
 * - Búsqueda por campo único (usuario:email:user@example.com)
 * - Casos donde NO hay múltiples parámetros
 * 
 * @param {string} prefix - Prefijo de la clave
 * @param {string|number} identifier - Identificador simple
 * @returns {string} Clave simple
 * 
 * @example
 * // Para búsquedas por ID
 * generateSimpleCacheKey("venta", 123);
 * // Resultado: "venta:123"
 * 
 * generateSimpleCacheKey("usuario:email", "user@example.com");
 * // Resultado: "usuario:email:user@example.com"
 */
export const generateSimpleCacheKey = (prefix, identifier) => {
  // Normalizar identifier (convertir a string y trim)
  const normalizedId = String(identifier).trim();

  if (!normalizedId) {
    throw new Error(`CACHE_KEY_ERROR: Identifier cannot be empty for prefix "${prefix}"`);
  }

  return `${prefix}:${normalizedId}`;
};

/**
 * ✅ NUEVA: Determina automáticamente qué función usar
 * 
 * Esta función INTELIGENTE decide:
 * - Si params es objeto → usa generateCacheKey()
 * - Si params es string/number → usa generateSimpleCacheKey()
 * 
 * @param {string} prefix - Prefijo de la clave
 * @param {Object|string|number} params - Parámetros o identificador
 * @returns {string} Clave de caché
 * 
 * @example
 * // Con objeto (múltiples parámetros)
 * smartCacheKey("ventas:list", { page: 1, limit: 20 });
 * // Usa: generateCacheKey()
 * 
 * // Con número (ID único)
 * smartCacheKey("venta", 123);
 * // Usa: generateSimpleCacheKey()
 * 
 * // Con string (email, username, etc)
 * smartCacheKey("usuario:email", "user@example.com");
 * // Usa: generateSimpleCacheKey()
 */
export const smartCacheKey = (prefix, params) => {
  // Si params es objeto no vacío → clave compleja
  if (typeof params === "object" && params !== null && !Array.isArray(params)) {
    return generateCacheKey(prefix, params);
  }

  // Si params es string, number, o boolean → clave simple
  if (["string", "number", "boolean"].includes(typeof params)) {
    return generateSimpleCacheKey(prefix, params);
  }

  // Fallback: si no es ninguno de los anteriores, error
  throw new Error(
    `CACHE_KEY_ERROR: Invalid params type for prefix "${prefix}". Expected object, string, number, or boolean.`
  );
};

/*
┌─────────────────────────────────────────────────────────────────────┐
│ 🎯 GUÍA RÁPIDA: ¿Cuándo usar cada función?                         │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│ 1️⃣ generateCacheKey() - Para FILTROS COMPLEJOS                      │
│    ✅ Usa cuando: Tienes múltiples parámetros                       │
│    📝 Ejemplo:                                                      │
│       generateCacheKey(CACHE_PREFIXES.VENTAS_LIST, {               │
│         fecha_inicio: "2024-01-01",                                 │
│         metodo_pago: "efectivo",                                    │
│         page: 1                                                     │
│       });                                                           │
│                                                                     │
│ 2️⃣ generateSimpleCacheKey() - Para IDENTIFICADORES ÚNICOS           │
│    ✅ Usa cuando: Buscas por ID, email, username, código            │
│    📝 Ejemplo:                                                      │
│       generateSimpleCacheKey(CACHE_PREFIXES.VENTA, 123);           │
│       generateSimpleCacheKey(CACHE_PREFIXES.USUARIO_EMAIL,         │
│                              "user@example.com");                   │
│                                                                     │
│ 3️⃣ smartCacheKey() - AUTOMÁTICO (RECOMENDADO)                       │
│    ✅ Usa cuando: No estás seguro cuál usar                         │
│    📝 Ejemplo:                                                      │
│       // Detecta automáticamente que es objeto → generateCacheKey()│
│       smartCacheKey("ventas:list", { page: 1, limit: 20 });        │
│                                                                     │
│       // Detecta automáticamente que es número → generateSimple... │
│       smartCacheKey("venta", 123);                                  │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
*/


// =====================================================
// 🔹 OPERACIONES BÁSICAS
// =====================================================
export const cacheGet = async (key) => {
  try {
    const cached = await redisClient.get(key);
    return cached ? JSON.parse(cached) : null;
  } catch (error) {
    console.error(`⚠️ Error obteniendo cache para clave ${key}:`, error);
    return null; // Fallar silenciosamente para no romper la aplicación
  }
};

export const cacheSet = async (key, data, ttl = 300) => {
  try {
    await redisClient.setEx(key, ttl, JSON.stringify(data));
  } catch (error) {
    console.error(`⚠️ Error guardando cache para clave ${key}:`, error);
    // No lanzar error para mantener la aplicación funcionando
  }
};

export const getCacheStats = async () => {
  try {
    const info = await redisClient.info("stats");
    const lines = info.split("\r\n");

    // Parsear las métricas de Redis
    const stats = {};
    lines.forEach((line) => {
      const [key, value] = line.split(":");
      if (key && value) {
        stats[key] = isNaN(value) ? value : parseInt(value);
      }
    });

    const hits = stats.keyspace_hits || 0;
    const misses = stats.keyspace_misses || 0;
    const total = hits + misses;

    return {
      hits,
      misses,
      total_requests: total,
      hit_rate: total > 0 ? ((hits / total) * 100).toFixed(2) : "0.00",
      connected_clients: stats.connected_clients || 0,
      used_memory_human: stats.used_memory_human || "0B",
    };
  } catch (error) {
    console.error("⚠️ Error obteniendo estadísticas de Redis:", error);
    return {
      hits: 0,
      misses: 0,
      hit_rate: "0.00",
      error: "No disponible",
    };
  }
};

// =====================================================
// 🔹 SCAN CONFIG OPTIMIZADA
// =====================================================
const SCAN_CONFIG = {
  SMALL_SUPERMARKET: {
    COUNT: 100,
    MAX_ITERATIONS: 50,
    BATCH_DELETE: 50,
  },
};

export const optimizedScan = async (pattern) => {
  let cursor = "0";
  let deletedKeys = 0;
  let iterations = 0;
  const keysToDelete = [];

  try {
    do {
      const reply = await redisClient.scan(cursor, {
        MATCH: pattern,
        COUNT: SCAN_CONFIG.SMALL_SUPERMARKET.COUNT,
      });

      cursor = reply.cursor;
      keysToDelete.push(...reply.keys);
      iterations++;

      // Borrado en lotes
      if (keysToDelete.length >= SCAN_CONFIG.SMALL_SUPERMARKET.BATCH_DELETE) {
        const batch = keysToDelete.splice(
          0,
          SCAN_CONFIG.SMALL_SUPERMARKET.BATCH_DELETE
        );
        if (batch.length > 0) {
          await redisClient.del(batch);
          deletedKeys += batch.length;
        }
      }

      if (iterations >= SCAN_CONFIG.SMALL_SUPERMARKET.MAX_ITERATIONS) {
        console.warn(
          `⚠️ Scan limitado a ${iterations} iteraciones para patrón: ${pattern}`
        );
        break;
      }
    } while (cursor !== "0");

    // Borrar claves restantes
    if (keysToDelete.length > 0) {
      await redisClient.del(keysToDelete);
      deletedKeys += keysToDelete.length;
    }

    return deletedKeys;
  } catch (error) {
    console.error(`⚠️ Error en optimizedScan para patrón ${pattern}:`, error);
    return 0;
  }
};

// =====================================================
// 🔹 HELPERS DE INVALIDACIÓN
// =====================================================

export const invalidateKeys = async (keys = []) => {
  if (keys.length === 0) return 0;

  try {
    const result = await redisClient.del(keys);
    console.log(
      `🗑️ Cache invalidado: ${keys.join(", ")} (${result} claves eliminadas)`
    );
    return result;
  } catch (error) {
    console.error(`⚠️ Error invalidando claves:`, error);
    return 0;
  }
};

export const invalidateByPattern = async (pattern) => {
  try {
    const deleted = await optimizedScan(pattern);
    if (deleted > 0) {
      console.log(`🧹 Cache invalidado [${pattern}]: ${deleted} claves`);
    }
    return deleted;
  } catch (error) {
    console.error(`⚠️ Error invalidando por patrón ${pattern}:`, error);
    return 0;
  }
};

// =====================================================
// 🔐 ESPECÍFICOS DE AUTENTICACIÓN - CORREGIDOS
// =====================================================

/**
 * 🔥 CORREGIDO: Invalida cache específico de autenticación de un usuario
 * Ahora usa generateCacheKey para CONSISTENCIA TOTAL
 * @param {number} userId - ID del usuario
 * @param {string} username - Username del usuario (opcional)
 */
export const invalidateAuthCache = async (userId, username = null) => {
  const keys = [
    smartCacheKey(CACHE_PREFIXES.AUTH_USER, userId)
  ];

  if (username) {
    keys.push(
      smartCacheKey(CACHE_PREFIXES.AUTH_USERNAME, username.toLowerCase())
    );
  }

  const deleted = await invalidateKeys(keys);

  // También invalidar sesiones activas usando patrón
  await invalidateByPattern(`${CACHE_PREFIXES.AUTH_SESSION}:${userId}:*`);

  return deleted;
};

/**
 * 🔥 CORREGIDO: Invalida cache de intentos de login fallidos
 * Ahora usa generateSimpleCacheKey para compatibilidad
 * @param {string} identifier - Username o email
 */
export const invalidateLoginAttemptsCache = async (identifier) => {
  // 🔥 NUEVA ESTRATEGIA: Usar generateSimpleCacheKey para compatibilidad
  const key = generateSimpleCacheKey(
    CACHE_PREFIXES.AUTH_ATTEMPTS,
    identifier.toLowerCase()
  );
  return await invalidateKeys([key]);
};

/**
 * Invalida cache de perfiles de usuario
 * Útil cuando cambia información del perfil
 */
export const invalidateUserProfilesCache = async () => {
  return await invalidateByPattern(`${CACHE_PREFIXES.AUTH_PROFILE}:*`);
};

/**
 * Invalida todo el cache relacionado con autenticación
 * Usar con precaución - solo para operaciones masivas como mantenimiento
 */
export const invalidateAllAuthCache = async () => {
  return await invalidateByPattern("auth:*");
};

// =====================================================
// FUNCIONES ESPECÍFICAS DE PRODUCTOS
// =====================================================

/**
 * Invalida caché específico de un producto
 * @param {number} productoId - ID del producto
 * @param {string} codigoBarras - Código de barras del producto (opcional)
 */
export const invalidateProductCache = async (
  productoId,
  codigoBarras = null
) => {
  const keys = [
    smartCacheKey(CACHE_PREFIXES.PRODUCTO_ID, productoId)
  ];

  if (codigoBarras) {
    keys.push(
      smartCacheKey(CACHE_PREFIXES.PRODUCTO_BARCODE, codigoBarras)
    );
  }

  const deleted = await invalidateKeys(keys);

  // También invalidar listas de productos
  await invalidateByPattern(`${CACHE_PREFIXES.PRODUCTOS_LIST}:*`);

  return deleted;
};

/**
 * Invalida caché de listas de productos
 * Útil cuando se crean, actualizan o eliminan productos
 */
export const invalidateProductsListCache = async () => {
  return await invalidateByPattern(`${CACHE_PREFIXES.PRODUCTOS_LIST}:*`);
};

/**
 * Invalida caché cuando cambia la categoría de un producto
 * Afecta tanto el producto como las listas filtradas por categoría
 * @param {number} productoId - ID del producto
 * @param {number} categoriaId - ID de la categoría (opcional)
 */
export const invalidateProductCategoryCache = async (
  productoId,
  categoriaId = null
) => {
  // Invalidar producto específico
  await invalidateProductCache(productoId);

  // Invalidar listas filtradas por categoría
  if (categoriaId) {
    await invalidateByPattern(
      `${CACHE_PREFIXES.PRODUCTOS_LIST}:*categoria_id*${categoriaId}*`
    );
  }
};

/**
 * Invalida caché cuando cambia el stock de un producto
 * Usado desde el módulo de inventarios
 * @param {number} productoId - ID del producto
 * @param {string} codigoBarras - Código de barras (opcional)
 */
export const invalidateProductStockCache = async (
  productoId,
  codigoBarras = null
) => {
  // Misma lógica que invalidateProductCache pero con nombre semántico
  return await invalidateProductCache(productoId, codigoBarras);
};

/**
 * Invalida todo el caché relacionado con productos
 * Usar con precaución - solo para operaciones masivas
 */
export const invalidateAllProductsCache = async () => {
  return await invalidateByPattern("producto*");
};

// =====================================================
// UTILIDAD PARA DEBUGGING DE PRODUCTOS
// =====================================================

/**
 * Verifica consistencia de caché para un producto específico
 * Útil para detectar claves huérfanas
 */
export const debugProductCacheKeys = async (productoId) => {
  console.log(`🔍 DEBUG Cache Keys para Producto ID: ${productoId}`);

  const patterns = [
    `producto:id:*${productoId}*`,
    `producto:barcode:*`,
    `productos:list:*`,
  ];

  for (const pattern of patterns) {
    const keys = await debugCacheKeys(pattern);
    console.log(`  ${pattern}: ${keys.length} claves`);
  }
};

// =====================================================
// 🔹 ESPECÍFICOS DE CATEGORÍAS - ACTUALIZADOS
// =====================================================
export const invalidateCategoryCache = async (categoriaId = null) => {
  if (categoriaId) {
    // Invalidar categoría específica usando generateCacheKey
    const keys = [
      generateCacheKey(CACHE_PREFIXES.CATEGORIA, { categoriaId: categoriaId }),
      generateCacheKey(CACHE_PREFIXES.CATEGORIAS, { categoriaId: categoriaId }),
    ];
    await invalidateKeys(keys);

    // También invalidar listas que podrían incluir esta categoría
    await invalidateByPattern(`${CACHE_PREFIXES.CATEGORIAS_LIST}:*`);
    await invalidateByPattern(`${CACHE_PREFIXES.CATEGORIAS_ESTADISTICAS}*`);
  } else {
    // Invalidar todo el cache de categorías
    return await invalidateByPattern("categorias:*");
  }
};

// =====================================================
// 🔹 ESPECÍFICOS DE PROVEEDORES - ACTUALIZADOS
// =====================================================

/**
 * Invalida cache específico de un proveedor
 * @param {number} proveedorId - ID del proveedor
 * @param {string} email - Email del proveedor (opcional)
 */
export const invalidateProviderCache = async (proveedorId, email = null) => {
  const keys = [
    generateCacheKey(CACHE_PREFIXES.PROVEEDOR, { proveedorId: proveedorId }),
  ];

  if (email) {
    keys.push(
      generateCacheKey(CACHE_PREFIXES.PROVEEDOR_EMAIL, { email: email })
    );
  }

  const deleted = await invalidateKeys(keys);

  // También invalidar listas paginadas que podrían incluir este proveedor
  await invalidateByPattern(`${CACHE_PREFIXES.PROVEEDORES_LIST}:*`);
  await invalidateByPattern(`${CACHE_PREFIXES.PROVEEDORES_SEARCH}:*`);

  return deleted;
};

/**
 * Invalida cache de listas de proveedores
 * Útil cuando se crean, actualizan o eliminan proveedores
 */
export const invalidateProvidersListCache = async () => {
  const patterns = [
    `${CACHE_PREFIXES.PROVEEDORES_LIST}:*`,
    `${CACHE_PREFIXES.PROVEEDORES_SEARCH}:*`,
    `${CACHE_PREFIXES.PROVEEDORES_ESTADISTICAS}*`,
  ];

  let totalDeleted = 0;
  for (const pattern of patterns) {
    totalDeleted += await invalidateByPattern(pattern);
  }

  return totalDeleted;
};

/**
 * Invalida todo el cache relacionado con proveedores
 * Usar con precaución - solo para operaciones masivas
 */
export const invalidateAllProvidersCache = async () => {
  return await invalidateByPattern("proveedor*");
};

// =====================================================
// 📦 FUNCIONES ESPECÍFICAS DE USUARIOS
// =====================================================

/**
 * Invalida caché específico de un usuario
 * Coordina con invalidateAuthCache para consistencia
 * @param {number} userId - ID del usuario
 * @param {string} username - Username del usuario (opcional)
 * @param {string} email - Email del usuario (opcional)
 */
export const invalidateUserCache = async (
  userId,
  username = null,
  email = null
) => {
  const keys = [
    smartCacheKey(CACHE_PREFIXES.USUARIO_ID, userId)
  ];

  if (username) {
    keys.push(
      smartCacheKey(CACHE_PREFIXES.USUARIO_USERNAME, username.toLowerCase())
    );
  }

  if (email) {
    keys.push(
      smartCacheKey(CACHE_PREFIXES.USUARIO_EMAIL, email.toLowerCase())
    );
  }

  const deleted = await invalidateKeys(keys);

  // Invalidar listas
  await invalidateByPattern(`${CACHE_PREFIXES.USUARIOS_LIST}:*`);
  await invalidateByPattern(`${CACHE_PREFIXES.USUARIOS_SEARCH}:*`);

  // CRÍTICO: Invalidar cache de autenticación relacionado
  await invalidateAuthCache(userId, username);

  return deleted;
};

/**
 * Invalida caché de listas de usuarios
 * Útil cuando se crean, actualizan o eliminan usuarios
 */
export const invalidateUsersListCache = async () => {
  const patterns = [
    `${CACHE_PREFIXES.USUARIOS_LIST}:*`,
    `${CACHE_PREFIXES.USUARIOS_SEARCH}:*`,
  ];

  let totalDeleted = 0;
  for (const pattern of patterns) {
    totalDeleted += await invalidateByPattern(pattern);
  }

  return totalDeleted;
};

/**
 * Invalida caché cuando se cambia el estado activo de un usuario
 * Afecta tanto el usuario como las listas filtradas
 * @param {number} userId - ID del usuario
 * @param {string} username - Username del usuario
 * @param {string} email - Email del usuario
 */
export const invalidateUserStatusCache = async (userId, username, email) => {
  // Invalidar usuario específico
  await invalidateUserCache(userId, username, email);

  // Invalidar autenticación para forzar re-validación de estado activo
  await invalidateAuthCache(userId, username);
};

/**
 * Invalida caché cuando se cambia la contraseña de un usuario
 * Afecta autenticación y perfil del usuario
 * @param {number} userId - ID del usuario
 * @param {string} username - Username del usuario
 */
export const invalidateUserPasswordCache = async (userId, username) => {
  // Invalidar cache de usuario
  await invalidateUserCache(userId, username);

  // CRÍTICO: Invalidar sesiones activas y tokens
  await invalidateAuthCache(userId, username);
  await invalidateByPattern(`${CACHE_PREFIXES.AUTH_SESSION}:${userId}:*`);
};

/**
 * Invalida todo el caché relacionado con usuarios
 * Usar con precaución - solo para operaciones masivas
 */
export const invalidateAllUsersCache = async () => {
  return await invalidateByPattern("usuario*");
};

// =====================================================
// 🔧 UTILIDAD PARA DEBUGGING DE USUARIOS
// =====================================================

/**
 * Verifica consistencia de cache para un usuario específico
 * Útil para detectar claves huérfanas
 */
export const debugUserCacheKeys = async (userId) => {
  console.log(`🔍 DEBUG Cache Keys para Usuario ID: ${userId}`);

  const patterns = [
    `usuario:id:*${userId}*`,
    `usuario:username:*`,
    `usuario:email:*`,
    `auth:user:*${userId}*`,
  ];

  for (const pattern of patterns) {
    const keys = await debugCacheKeys(pattern);
    console.log(`  ${pattern}: ${keys.length} claves`);
  }
};

// =====================================================
// 🔹 UTILIDADES ADICIONALES
// =====================================================

/**
 * Limpia todo el cache (usar con precaución)
 */
export const flushAllCache = async () => {
  try {
    await redisClient.flushAll();
    console.log("🧹 Todo el cache ha sido limpiado");
    return true;
  } catch (error) {
    console.error("⚠️ Error limpiando todo el cache:", error);
    return false;
  }
};

/**
 * Obtiene información de una clave específica
 */
export const getCacheInfo = async (key) => {
  try {
    const [exists, ttl, type] = await Promise.all([
      redisClient.exists(key),
      redisClient.ttl(key),
      redisClient.type(key),
    ]);

    return {
      exists: Boolean(exists),
      ttl: ttl === -1 ? "sin expiración" : `${ttl}s`,
      type,
      key,
    };
  } catch (error) {
    console.error(`⚠️ Error obteniendo info de clave ${key}:`, error);
    return null;
  }
};

// =====================================================
// 🔦 FUNCIONES ESPECÍFICAS DE RECEPCIONES
// =====================================================

/**
 * Invalida caché específico de una recepción
 * @param {number} recepcionId - ID de la recepción
 * @param {string} numeroFactura - Número de factura (opcional)
 */
export const invalidateRecepcionCache = async (
  recepcionId,
  numeroFactura = null
) => {
  const keys = [
    generateCacheKey(CACHE_PREFIXES.RECEPCION, { recepcionId: recepcionId }),
  ];

  if (numeroFactura) {
    keys.push(
      generateCacheKey(CACHE_PREFIXES.RECEPCION_FACTURA, {
        numeroFactura: numeroFactura,
      })
    );
  }

  const deleted = await invalidateKeys(keys);

  // También invalidar listas que podrían incluir esta recepción
  await invalidateByPattern(`${CACHE_PREFIXES.RECEPCIONES_LIST}:*`);
  await invalidateByPattern(`${CACHE_PREFIXES.RECEPCIONES_PROVEEDOR}:*`);

  return deleted;
};

/**
 * Invalida caché de listas de recepciones
 * Útil cuando se crean, actualizan o eliminan recepciones
 */
export const invalidateRecepcionesListCache = async () => {
  const patterns = [
    `${CACHE_PREFIXES.RECEPCIONES_LIST}:*`,
    `${CACHE_PREFIXES.RECEPCIONES_SEARCH}:*`,
    `${CACHE_PREFIXES.RECEPCIONES_ESTADISTICAS}*`,
    `${CACHE_PREFIXES.RECEPCIONES_PROVEEDOR}:*`,
  ];

  let totalDeleted = 0;
  for (const pattern of patterns) {
    totalDeleted += await invalidateByPattern(pattern);
  }

  return totalDeleted;
};

/**
 * Invalida caché específico de recepciones por proveedor
 * @param {number} proveedorId - ID del proveedor
 */
export const invalidateRecepcionesPorProveedorCache = async (proveedorId) => {
  return await invalidateByPattern(
    `${CACHE_PREFIXES.RECEPCIONES_PROVEEDOR}:${proveedorId}:*`
  );
};

/**
 * Invalida caché cuando se procesa una recepción
 * Afecta tanto la recepción como estadísticas de inventario
 * @param {number} recepcionId - ID de la recepción
 * @param {number} proveedorId - ID del proveedor
 */
export const invalidateRecepcionProcesadaCache = async (
  recepcionId,
  proveedorId
) => {
  // Invalidar recepción específica
  await invalidateRecepcionCache(recepcionId);

  // Invalidar listas y estadísticas
  await invalidateRecepcionesListCache();
  await invalidateRecepcionesPorProveedorCache(proveedorId);

  // Invalidar caché de productos (porque cambió el stock)
  await invalidateByPattern("productos:*");
  await invalidateByPattern("inventario:*");
};

/**
 * Invalida todo el caché relacionado con recepciones
 * Usar con precaución - solo para operaciones masivas
 */
export const invalidateAllRecepcionesCache = async () => {
  return await invalidateByPattern("recepciones*");
};

// =====================================================
// FUNCIONES ESPECÍFICAS DE VENTAS
// =====================================================

/**
 * Invalida caché específico de una venta
 * @param {number} ventaId - ID de la venta
 * @param {string} numeroVenta - Número de venta (opcional)
 */
export const invalidateVentaCache = async (ventaId, numeroVenta = null) => {
  const keys = [
    // ✅ Usa smartCacheKey (detecta automáticamente que es número)
    smartCacheKey(CACHE_PREFIXES.VENTA, ventaId)
  ];

  if (numeroVenta) {
    keys.push(
      smartCacheKey(CACHE_PREFIXES.VENTA_NUMERO, numeroVenta)
    );
  }

  const deleted = await invalidateKeys(keys);

  // También invalidar listas que podrían incluir esta venta
  await invalidateByPattern(`${CACHE_PREFIXES.VENTAS_LIST}:*`);

  return deleted;
};

/**
 * Invalida caché de listas de ventas
 * Útil cuando se crean o anulan ventas
 */
export const invalidateVentasListCache = async () => {
  const patterns = [
    `${CACHE_PREFIXES.VENTAS_LIST}:*`,
    `${CACHE_PREFIXES.VENTAS_RESUMEN}:*`,
    `${CACHE_PREFIXES.VENTAS_ESTADISTICAS}*`,
  ];

  let totalDeleted = 0;
  for (const pattern of patterns) {
    totalDeleted += await invalidateByPattern(pattern);
  }

  return totalDeleted;
};

/**
 * Invalida caché cuando se procesa una venta
 * Afecta tanto la venta como estadísticas de inventario
 * @param {number} ventaId - ID de la venta
 * @param {string} numeroVenta - Número de venta
 */
export const invalidateVentaProcesadaCache = async (ventaId, numeroVenta) => {
  // Invalidar venta específica
  await invalidateVentaCache(ventaId, numeroVenta);

  // Invalidar listas y estadísticas
  await invalidateVentasListCache();

  // CRÍTICO: Invalidar caché de productos (porque cambió el stock)
  await invalidateByPattern("productos:*");
  await invalidateByPattern("inventario:*");
};

/**
 * Invalida caché cuando se anula una venta
 * Similar a procesada pero incluye reversión de inventario
 * @param {number} ventaId - ID de la venta
 * @param {string} numeroVenta - Número de venta
 */
export const invalidateVentaAnuladaCache = async (ventaId, numeroVenta) => {
  // Reutilizar lógica de venta procesada (afecta lo mismo)
  await invalidateVentaProcesadaCache(ventaId, numeroVenta);

  // Log específico para anulaciones
  console.log(`🗑️ Caché invalidado por anulación de venta ${numeroVenta}`);
};

/**
 * Invalida todo el caché relacionado con ventas
 * Usar con precaución - solo para operaciones masivas
 */
export const invalidateAllVentasCache = async () => {
  return await invalidateByPattern("ventas*");
};

// =====================================================
// UTILIDAD PARA DEBUGGING DE VENTAS
// =====================================================

/**
 * Verifica consistencia de caché para una venta específica
 * Útil para detectar claves huérfanas
 */
export const debugVentaCacheKeys = async (ventaId) => {
  console.log(`🔍 DEBUG Cache Keys para Venta ID: ${ventaId}`);

  const patterns = [`venta:*${ventaId}*`, `venta:numero:*`, `ventas:list:*`];

  for (const pattern of patterns) {
    const keys = await debugCacheKeys(pattern);
    console.log(`  ${pattern}: ${keys.length} claves`);
  }
};

// =====================================================
// FUNCIONES ESPECÍFICAS DE INVENTARIO
// =====================================================

/**
 * Invalida caché de listas de movimientos
 * Útil cuando se registran nuevos movimientos
 */
export const invalidateMovimientosListCache = async () => {
  return await invalidateByPattern(`${CACHE_PREFIXES.MOVIMIENTOS_LIST}:*`);
};

/**
 * Invalida caché general de inventario
 * Afecta stock bajo, resumen, valor y estadísticas
 */
export const invalidateInventoryCache = async () => {
  const patterns = [
    `${CACHE_PREFIXES.INVENTARIO_STOCK_BAJO}*`,
    `${CACHE_PREFIXES.INVENTARIO_RESUMEN}*`,
    `${CACHE_PREFIXES.INVENTARIO_VALOR}*`,
    `${CACHE_PREFIXES.INVENTARIO_ESTADISTICAS}*`,
    `${CACHE_PREFIXES.INVENTARIO_ALERTAS}*`,
  ];

  let totalDeleted = 0;
  for (const pattern of patterns) {
    totalDeleted += await invalidateByPattern(pattern);
  }

  return totalDeleted;
};

/**
 * Invalida caché cuando se actualiza stock
 * Coordina invalidación entre productos e inventario
 * @param {number} productoId - ID del producto
 * @param {string} codigoBarras - Código de barras (opcional)
 */
export const invalidateStockUpdateCache = async (
  productoId,
  codigoBarras = null
) => {
  // Invalidar caché del producto (usa función existente)
  await invalidateProductStockCache(productoId, codigoBarras);

  // Invalidar caché de inventario general
  await invalidateInventoryCache();

  // Invalidar movimientos que podrían incluir este producto
  await invalidateMovimientosListCache();

  console.log(
    `🔄 Caché de stock actualizado para producto ${productoId} (cascada completa)`
  );
};

/**
 * Invalida caché de reportes específicos de un producto
 * @param {number} productoId - ID del producto
 */
export const invalidateInventoryReportCache = async (productoId) => {
  return await invalidateByPattern(
    `${CACHE_PREFIXES.INVENTARIO_REPORTE}:${productoId}:*`
  );
};

/**
 * Invalida todo el caché relacionado con inventario
 * Usar con precaución - solo para operaciones masivas
 */
export const invalidateAllInventoryCache = async () => {
  return await invalidateByPattern("inventario*");
};

// =====================================================
// UTILIDAD PARA DEBUGGING DE INVENTARIO
// =====================================================

/**
 * Verifica consistencia de caché para inventario
 * Útil para detectar claves huérfanas
 */
export const debugInventoryCacheKeys = async () => {
  console.log("🔍 DEBUG Cache Keys para Inventario:");

  const patterns = [
    "movimientos:*",
    "inventario:stock_bajo*",
    "inventario:resumen*",
    "inventario:valor*",
    "inventario:estadisticas*",
    "inventario:alertas*",
  ];

  for (const pattern of patterns) {
    const keys = await debugCacheKeys(pattern);
    console.log(`  ${pattern}: ${keys.length} claves`);
  }
};

// =====================================================
// 🔧 UTILIDADES DE DEBUGGING Y MONITOREO - NUEVAS
// =====================================================

/**
 * 🔥 NUEVA: Verifica la consistencia de claves en el sistema
 * Útil para detectar inconsistencias como las que encontraste
 */
export const debugCacheKeys = async (prefix) => {
  try {
    const pattern = `${prefix}:*`;
    let cursor = "0";
    const foundKeys = [];

    do {
      const reply = await redisClient.scan(cursor, {
        MATCH: pattern,
        COUNT: 100,
      });

      cursor = reply.cursor;
      foundKeys.push(...reply.keys);
    } while (cursor !== "0");

    console.log(`🔍 DEBUG Cache Keys para ${prefix}:`);
    console.log(`📊 Total encontradas: ${foundKeys.length}`);
    console.log(`🗝️ Claves:`, foundKeys.sort());

    return foundKeys;
  } catch (error) {
    console.error(`❌ Error en debugCacheKeys para ${prefix}:`, error);
    return [];
  }
};

/**
 * 🔥 NUEVA: Compara formato de claves entre generateCacheKey y string manual
 */
export const compareCacheKeyFormats = (prefix, params, manualString) => {
  const generated = generateCacheKey(prefix, params);
  const simple = generateSimpleCacheKey(prefix, Object.values(params)[0]);

  console.log(`🔍 COMPARACIÓN DE FORMATOS:`);
  console.log(`  generateCacheKey: "${generated}"`);
  console.log(`  generateSimpleCacheKey: "${simple}"`);
  console.log(`  String manual: "${manualString}"`);
  console.log(
    `  ✅ generateCacheKey === manual: ${generated === manualString}`
  );
  console.log(
    `  ✅ generateSimpleCacheKey === manual: ${simple === manualString}`
  );

  return {
    generated,
    simple,
    manual: manualString,
    generatedMatches: generated === manualString,
    simpleMatches: simple === manualString,
  };
};

// =====================================================
// 📹 FUNCIÓN DE TESTING Y DEBUGGING
// =====================================================

/**
 * ✅ NUEVA: Compara los 3 métodos de generación para debugging
 * 
 * @param {string} prefix - Prefijo a probar
 * @param {*} params - Parámetros a probar
 */
export const debugCacheKeyComparison = (prefix, params) => {
  console.log(`\n🔍 DEBUG: Comparación de métodos de cache key`);
  console.log(`Prefix: "${prefix}"`);
  console.log(`Params: ${JSON.stringify(params)}`);
  console.log(`Tipo params: ${typeof params}`);
  console.log(`───────────────────────────────────────────────────`);

  try {
    // Método 1: generateCacheKey (siempre)
    let method1;
    try {
      method1 = generateCacheKey(
        prefix,
        typeof params === "object" ? params : { value: params }
      );
      console.log(`✅ generateCacheKey(): "${method1}"`);
    } catch (e) {
      console.log(`❌ generateCacheKey(): Error - ${e.message}`);
    }

    // Método 2: generateSimpleCacheKey (si no es objeto)
    let method2;
    try {
      method2 =
        typeof params === "object"
          ? "N/A (params es objeto)"
          : generateSimpleCacheKey(prefix, params);
      console.log(`${typeof params === "object" ? "⚠️" : "✅"} generateSimpleCacheKey(): "${method2}"`);
    } catch (e) {
      console.log(`❌ generateSimpleCacheKey(): Error - ${e.message}`);
    }

    // Método 3: smartCacheKey (automático)
    let method3;
    try {
      method3 = smartCacheKey(prefix, params);
      console.log(`✅ smartCacheKey(): "${method3}"`);
    } catch (e) {
      console.log(`❌ smartCacheKey(): Error - ${e.message}`);
    }

    console.log(`───────────────────────────────────────────────────`);
    console.log(`📊 RECOMENDACIÓN:`);

    if (typeof params === "object" && params !== null) {
      console.log(`   ✅ Usar: generateCacheKey() o smartCacheKey()`);
      console.log(`   ❌ NO usar: generateSimpleCacheKey()`);
    } else {
      console.log(`   ✅ Usar: generateSimpleCacheKey() o smartCacheKey()`);
      console.log(`   ⚠️ Evitar: generateCacheKey() (innecesariamente complejo)`);
    }

    return { method1, method2, method3 };
  } catch (error) {
    console.error(`❌ Error en comparación:`, error);
    return null;
  }
};

/**
 * ✅ NUEVA: Ejecuta tests de consistencia en cache keys
 */
export const runCacheKeyConsistencyTests = () => {
  console.log(`\n🧪 EJECUTANDO TESTS DE CONSISTENCIA DE CACHE KEYS\n`);

  const tests = [
    {
      nombre: "Venta por ID (número)",
      prefix: "venta",
      params: 123,
      esperado: "venta:123",
    },
    {
      nombre: "Usuario por email (string)",
      prefix: "usuario:email",
      params: "user@example.com",
      esperado: "usuario:email:user@example.com",
    },
    {
      nombre: "Ventas con filtros (objeto)",
      prefix: "ventas:list",
      params: { page: 1, limit: 20, estado: "activa" },
      esperado: 'ventas:list:{"estado":"activa","limit":20,"page":1}',
    },
  ];

  let passed = 0;
  let failed = 0;

  tests.forEach((test, index) => {
    console.log(`\nTest ${index + 1}: ${test.nombre}`);
    try {
      const resultado = smartCacheKey(test.prefix, test.params);
      const success = resultado === test.esperado;

      if (success) {
        console.log(`   ✅ PASS`);
        console.log(`   Resultado: "${resultado}"`);
        passed++;
      } else {
        console.log(`   ❌ FAIL`);
        console.log(`   Esperado:  "${test.esperado}"`);
        console.log(`   Obtenido:  "${resultado}"`);
        failed++;
      }
    } catch (error) {
      console.log(`   ❌ ERROR: ${error.message}`);
      failed++;
    }
  });

  console.log(`\n${"=".repeat(50)}`);
  console.log(`RESULTADOS: ${passed} passed, ${failed} failed`);
  console.log(`${"=".repeat(50)}\n`);

  return { passed, failed, total: tests.length };
};

