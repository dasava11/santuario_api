// validations/recepciones_validations.js - Reutilizando Utils Existentes
import { validate, validateSource } from "../middleware/validation.js";
import {
  createRecepcion,
  updateRecepcion,
  getRecepciones,
  getRecepcionById,
  recepcionId,
  procesarRecepcion,
  recepcionesSchemas,
} from "./schemas/recepcionesSchemas.js";

// =====================================================
// 🎯 MIDDLEWARES ESPECÍFICOS PARA RECEPCIONES
// =====================================================

/**
 * Validar datos para crear recepción
 * Reutiliza el middleware genérico existente
 */
const validateCreateRecepcion = validate(createRecepcion);

/**
 * Validar datos para actualizar recepción
 * Reutiliza el middleware genérico existente
 */
const validateUpdateRecepcion = validate(updateRecepcion);

/**
 * Validar ID de recepción en parámetros
 * Reutiliza validateSource para params
 */
const validateRecepcionId = validateSource(recepcionId, "params");

/**
 * Validar query parameters para obtener recepciones
 * Reutiliza validateSource para query con defaults
 * Incluye paginación y filtros de búsqueda
 */
const validateGetRecepcionesQuery = validateSource(getRecepciones, "query", {
  abortEarly: false,
  stripUnknown: true,
  convert: true,
  allowUnknown: false, // Rechazar parámetros no definidos
});

/**
 * Validar query parameters para obtener recepción por ID
 * Reutiliza validateSource para query con defaults
 */
const validateGetRecepcionByIdQuery = validateSource(getRecepcionById, "query");

/**
 * Validar datos para procesar recepción
 * Permite parámetros adicionales específicos del procesamiento
 */
const validateProcesarRecepcion = validate(procesarRecepcion);

// =====================================================
// 🔧 MIDDLEWARES COMPUESTOS (OPCIONAL)
// =====================================================

/**
 * Middleware compuesto para validar creación completa
 * Combina validación de datos + sanitización
 * Ejemplo de uso: router.post("/", validateCompleteRecepcionCreation, controller)
 */
const validateCompleteRecepcionCreation = [validateCreateRecepcion];

/**
 * Middleware compuesto para validar actualización completa
 * Combina validación de ID + datos de actualización
 */
const validateCompleteRecepcionUpdate = [
  validateRecepcionId,
  validateUpdateRecepcion,
];

/**
 * Middleware compuesto para obtener recepción específica
 * Combina validación de ID + query parameters
 */
const validateGetSpecificRecepcion = [
  validateRecepcionId,
  validateGetRecepcionByIdQuery,
];

/**
 * Middleware compuesto para procesar recepción
 * Combina validación de ID + parámetros de procesamiento
 */
const validateCompleteRecepcionProcessing = [
  validateRecepcionId,
  validateProcesarRecepcion,
];

/**
 * Middleware compuesto para cancelar recepción
 * Solo necesita validación de ID
 */
const validateRecepcionCancellation = [validateRecepcionId];

// =====================================================
// 🔍 VALIDACIONES DE NEGOCIO ADICIONALES (OPCIONAL)
// =====================================================

/**
 * Middleware personalizado para validar fechas de recepción
 * Valida reglas de negocio específicas adicionales
 */
const validateBusinessDateRules = (req, res, next) => {
  const { fecha_recepcion } = req.body;

  if (!fecha_recepcion) {
    return next(); // Ya validado por Joi
  }

  const fechaRecepcion = new Date(fecha_recepcion);
  const hoy = new Date();
  const hace30Dias = new Date();
  hace30Dias.setDate(hace30Dias.getDate() - 30);

  // Regla de negocio: No permitir recepciones muy antiguas (más de 30 días)
  if (fechaRecepcion < hace30Dias) {
    return res.status(400).json({
      success: false,
      error: "Regla de negocio violada",
      details: [
        {
          field: "fecha_recepcion",
          message:
            "No se pueden registrar recepciones con más de 30 días de antigüedad",
        },
      ],
    });
  }

  next();
};

/**
 * Middleware personalizado para validar productos en recepción
 * Valida que todos los productos tengan cantidades válidas
 */
const validateProductosBusinessRules = (req, res, next) => {
  const { productos } = req.body;
  
    if (!productos || !Array.isArray(productos)) {
    return next();
  }

  // ✅ Construir un Set de identificadores únicos
  const identificadoresVistos = new Set();
  const duplicados = [];

  productos.forEach((producto, index) => {
    // Extraer el identificador que se esté usando
    let identificador;
    
    if (producto.producto_id) {
      identificador = `ID:${producto.producto_id}`;
    } else if (producto.codigo_barras) {
      identificador = `CB:${producto.codigo_barras}`;
    } else if (producto.nombre) {
      identificador = `NOM:${producto.nombre}`;
    } else {
      // Esto no debería pasar porque Joi ya lo valida, pero por seguridad
      identificador = `INDEX:${index}`;
    }

    // Verificar si ya lo vimos
    if (identificadoresVistos.has(identificador)) {
      duplicados.push(identificador);
    } else {
      identificadoresVistos.add(identificador);
    }
  });

  if (duplicados.length > 0) {
    return res.status(400).json({
      success: false,
      error: "Regla de negocio violada",
      details: [
        {
          field: "productos",
          message: `Productos duplicados encontrados: ${duplicados.join(", ")}`,
        },
      ],
    });
  }

  // Regla de negocio: Validar que el subtotal calculado sea correcto
  const errores = [];
  productos.forEach((producto, index) => {
    const subtotalCalculado = parseFloat(
      (producto.cantidad * producto.precio_unitario).toFixed(2)
    );

    // Permitir pequeñas diferencias por redondeo (0.01)
    if (
      producto.subtotal &&
      Math.abs(producto.subtotal - subtotalCalculado) > 0.01
    ) {
      errores.push({
        field: `productos[${index}].subtotal`,
        message: `Subtotal incorrecto. Esperado: ${subtotalCalculado}, Recibido: ${producto.subtotal}`,
      });
    }
  });

  if (errores.length > 0) {
    return res.status(400).json({
      success: false,
      error: "Errores en cálculo de subtotales",
      details: errores,
    });
  }

  next();
};

/**
 * ✅ NUEVA: Validación de límite máximo de productos por recepción
 * Contexto: Supermercado pequeño, previene recepciones masivas incorrectas
 */
const validateMaxProductos = (req, res, next) => {
  const { productos } = req.body;

  if (!productos || !Array.isArray(productos)) {
    return next(); // Ya validado por Joi
  }

  // ✅ Contexto de negocio: Supermercado con ~3000 productos
  // Recepción típica: 10-50 productos
  // Máximo razonable: 100 productos (permite pedidos grandes pero bloquea errores)
  const MAX_PRODUCTOS_POR_RECEPCION = 100;

  if (productos.length > MAX_PRODUCTOS_POR_RECEPCION) {
    console.warn(
      `⚠️ RECEPCIÓN CON DEMASIADOS PRODUCTOS BLOQUEADA:\n` +
        `   Productos enviados: ${productos.length}\n` +
        `   Máximo permitido: ${MAX_PRODUCTOS_POR_RECEPCION}\n` +
        `   Usuario: ${req.user?.id || "desconocido"}\n` +
        `   Proveedor ID: ${req.body.proveedor_id || "N/A"}\n` +
        `   Timestamp: ${new Date().toISOString()}`
    );

    return res.status(400).json({
      success: false,
      error: "Demasiados productos en una sola recepción",
      details: {
        productos_enviados: productos.length,
        maximo_permitido: MAX_PRODUCTOS_POR_RECEPCION,
        exceso: productos.length - MAX_PRODUCTOS_POR_RECEPCION,
      },
      sugerencia:
        "Divida la recepción en múltiples entregas. " +
        "Si realmente necesita procesar más productos, contacte al administrador.",
      contexto: {
        razon: "Protección contra errores de entrada masiva",
        recepcion_tipica: "10-50 productos",
      },
    });
  }

  next();
};

/**
 * ✅ NUEVA: Validación de cantidad total razonable
 * Previene errores de entrada (ej: 1000 unidades en lugar de 100)
 */
const validateCantidadesRazonables = (req, res, next) => {
  const { productos } = req.body;

  if (!productos || !Array.isArray(productos)) {
    return next();
  }

  const MAX_CANTIDAD_POR_PRODUCTO = 10000; // Contexto: supermercado pequeño
  const productosExcesivos = [];

  productos.forEach((producto, index) => {
    if (producto.cantidad > MAX_CANTIDAD_POR_PRODUCTO) {
      productosExcesivos.push({
        index,
        producto_id: producto.producto_id,
        cantidad: producto.cantidad,
        maximo: MAX_CANTIDAD_POR_PRODUCTO,
      });
    }
  });

  if (productosExcesivos.length > 0) {
    console.warn(
      `⚠️ CANTIDADES EXCESIVAS DETECTADAS:\n` +
        `   Productos con cantidades inusuales: ${productosExcesivos.length}\n` +
        `   Detalles: ${JSON.stringify(productosExcesivos, null, 2)}\n` +
        `   Usuario: ${req.user?.id}`
    );

    return res.status(400).json({
      success: false,
      error: "Cantidades inusualmente altas detectadas",
      details: {
        productos_excesivos: productosExcesivos,
        maximo_permitido_por_producto: MAX_CANTIDAD_POR_PRODUCTO,
      },
      sugerencia:
        "Verifique las cantidades ingresadas. " +
        "Si los valores son correctos, contacte al administrador para autorización.",
    });
  }

  next();
};

/**
 * ✅ NUEVA: Validación de precios razonables
 * Previene errores de entrada (ej: $100 en lugar de $1.00)
 */
const validatePreciosRazonables = (req, res, next) => {
  const { productos } = req.body;

  if (!productos || !Array.isArray(productos)) {
    return next();
  }

  // Contexto: Supermercado mayoría productos entre $0.10 - $100
  const MIN_PRECIO = 0.01;
  const MAX_PRECIO_NORMAL = 1000;
  const MAX_PRECIO_EXCEPCIONAL = 10000; // Para electrodomésticos caros

  const productosConPreciosInusuales = [];

  productos.forEach((producto, index) => {
    const precio = parseFloat(producto.precio_unitario);

    if (precio < MIN_PRECIO) {
      productosConPreciosInusuales.push({
        index,
        producto_id: producto.producto_id,
        precio,
        tipo_error: "precio_muy_bajo",
        mensaje: `Precio menor a $${MIN_PRECIO}`,
      });
    } else if (precio > MAX_PRECIO_EXCEPCIONAL) {
      productosConPreciosInusuales.push({
        index,
        producto_id: producto.producto_id,
        precio,
        tipo_error: "precio_excesivo",
        mensaje: `Precio mayor a $${MAX_PRECIO_EXCEPCIONAL}`,
      });
    } else if (precio > MAX_PRECIO_NORMAL) {
      // Solo advertencia, no bloquea
      console.warn(
        `⚠️ PRECIO INUSUALMENTE ALTO:\n` +
          `   Producto ID: ${producto.producto_id}\n` +
          `   Precio: $${precio}\n` +
          `   Usuario: ${req.user?.id}\n` +
          `   Acción: Permitir (puede ser producto caro legítimo)`
      );
    }
  });

  if (productosConPreciosInusuales.length > 0) {
    return res.status(400).json({
      success: false,
      error: "Precios inválidos detectados",
      details: {
        productos_con_errores: productosConPreciosInusuales,
        rango_permitido: {
          minimo: MIN_PRECIO,
          maximo: MAX_PRECIO_EXCEPCIONAL,
        },
      },
      sugerencia:
        "Verifique los precios ingresados (puede ser error de punto decimal)",
    });
  }

  next();
};

// =====================================================
// 📤 EXPORTACIONES LIMPIAS
// =====================================================

export {
  // Schemas (para uso directo si necesario)
  recepcionesSchemas,

  // Middlewares específicos listos para rutas
  validateCreateRecepcion,
  validateUpdateRecepcion,
  validateRecepcionId,
  validateGetRecepcionesQuery,
  validateGetRecepcionByIdQuery,
  validateProcesarRecepcion,

  // Middlewares compuestos (opcional para rutas complejas)
  validateCompleteRecepcionCreation,
  validateCompleteRecepcionUpdate,
  validateGetSpecificRecepcion,
  validateCompleteRecepcionProcessing,
  validateRecepcionCancellation,

  // Validaciones de negocio adicionales (existentes)
  validateBusinessDateRules,
  validateProductosBusinessRules,

  // Validaciones de negocio extendidas
  validateMaxProductos,
  validateCantidadesRazonables,
  validatePreciosRazonables,
};
