// validations/ventas_validations.js - Reutilizando Utils Existentes
import { validate, validateSource } from "../middleware/validation.js";
import {
  createVenta,
  getVentas,
  getResumenVentas,
  ventaId,
  anularVenta,
  ventasSchemas,
} from "./schemas/ventasSchemas.js";

// =====================================================
// 🎯 MIDDLEWARES ESPECÍFICOS PARA VENTAS
// =====================================================

/**
 * Validar datos para crear venta
 * Reutiliza el middleware genérico existente
 */
const validateCreateVenta = validate(createVenta);

/**
 * Validar ID de venta en parámetros
 * Reutiliza validateSource para params
 */
const validateVentaId = validateSource(ventaId, "params");

/**
 * Validar query parameters para obtener ventas
 * Reutiliza validateSource para query con defaults
 * Incluye paginación y filtros de búsqueda
 */
const validateVentasQuery = validateSource(getVentas, "query", {
  abortEarly: false,
  stripUnknown: true,
  convert: true,
  allowUnknown: false, // Rechazar parámetros no definidos
});

/**
 * Validar query parameters para obtener resumen de ventas
 * Reutiliza validateSource para query con defaults
 */
const validateResumenQuery = validateSource(getResumenVentas, "query", {
  abortEarly: false,
  stripUnknown: true,
  convert: true,
});

// =====================================================
// 🔧 MIDDLEWARES COMPUESTOS (OPCIONAL)
// =====================================================

/**
 * Middleware compuesto para validar creación completa
 * Combina validación de datos + sanitización
 * Ejemplo de uso: router.post("/", validateCompleteVentaCreation, controller)
 */
const validateCompleteVentaCreation = [validateCreateVenta];

/**
 * Middleware compuesto para obtener venta específica
 * Combina validación de ID
 */
const validateGetSpecificVenta = [validateVentaId];

/**
 * Middleware compuesto para anular venta
 * Solo necesita validación de ID
 */
const validateVentaAnulacion = [validateVentaId];

// =====================================================
// 📏 VALIDACIONES DE NEGOCIO ADICIONALES (OPCIONAL)
// =====================================================

/**
 * Middleware personalizado para validar productos en venta
 * Valida que no haya productos duplicados
 */
const validateProductosBusinessRules = (req, res, next) => {
  const { productos } = req.body;

  if (!productos || !Array.isArray(productos)) {
    return next(); // Ya validado por Joi
  }

  // Regla de negocio: No permitir productos duplicados
  const productosIds = productos.map((p) => p.producto_id);
  const productosDuplicados = productosIds.filter(
    (id, index) => productosIds.indexOf(id) !== index
  );

  if (productosDuplicados.length > 0) {
    return res.status(400).json({
      success: false,
      error: "Regla de negocio violada",
      details: [
        {
          field: "productos",
          message: `Productos duplicados encontrados: ${productosDuplicados.join(
            ", "
          )}`,
        },
      ],
    });
  }

  // Regla de negocio: Validar que el subtotal calculado sea correcto (si se proporciona)
  const errores = [];
  productos.forEach((producto, index) => {
    if (!producto.precio_unitario) {
      return; // Se usará precio del producto, validar en service
    }

    // Si proporciona precio_unitario, validar consistencia básica
    if (producto.precio_unitario <= 0) {
      errores.push({
        field: `productos[${index}].precio_unitario`,
        message: `El precio unitario debe ser mayor a cero`,
      });
    }
  });

  if (errores.length > 0) {
    return res.status(400).json({
      success: false,
      error: "Errores en validación de productos",
      details: errores,
    });
  }

  next();
};

/**
 * Middleware personalizado para validar rango de fechas en consultas
 * Valida reglas de negocio específicas adicionales
 */
const validateDateRangeBusinessRules = (req, res, next) => {
  const { fecha_inicio, fecha_fin } = req.query;

  if (!fecha_inicio || !fecha_fin) {
    return next(); // Ya validado por Joi con defaults
  }

  const inicio = new Date(fecha_inicio);
  const fin = new Date(fecha_fin);

  // Regla de negocio: No permitir rangos mayores a 1 año
  const unAnoEnMs = 365 * 24 * 60 * 60 * 1000;
  if (fin - inicio > unAnoEnMs) {
    return res.status(400).json({
      success: false,
      error: "Regla de negocio violada",
      details: [
        {
          field: "fecha_fin",
          message:
            "El rango de fechas no puede ser mayor a 1 año. Use filtros más específicos.",
        },
      ],
    });
  }

  next();
};

// =====================================================
// 📤 EXPORTACIONES LIMPIAS
// =====================================================

export {
  // Schemas (para uso directo si necesario)
  ventasSchemas,

  // Middlewares específicos listos para rutas
  validateCreateVenta,
  validateVentaId,
  validateVentasQuery,
  validateResumenQuery,

  // Middlewares compuestos (opcional para rutas complejas)
  validateCompleteVentaCreation,
  validateGetSpecificVenta,
  validateVentaAnulacion,

  // Validaciones de negocio adicionales (opcional)
  validateProductosBusinessRules,
  validateDateRangeBusinessRules,
};
