// validations/productos_validations.js
import { validate, validateSource } from "../middleware/validation.js";
import {
  createProducto,
  updateProducto,
  getProductos,
  productoId,
  codigoBarras,
  productosSchemas,
} from "./schemas/productosSchemas.js";

// =====================================================
// MIDDLEWARES ESPECÍFICOS PARA PRODUCTOS
// =====================================================

/**
 * Validar datos para crear producto
 * Incluye validación custom de precio_venta > precio_compra
 */
const validateCreateProducto = validate(createProducto);

/**
 * Validar datos para actualizar producto
 * Todos los campos opcionales, al menos uno requerido
 */
const validateUpdateProducto = validate(updateProducto);

/**
 * Validar ID de producto en parámetros
 */
const validateProductoId = validateSource(productoId, "params");

/**
 * Validar código de barras en parámetros
 */
const validateCodigoBarras = validateSource(codigoBarras, "params");

/**
 * Validar query parameters para obtener productos
 * Incluye paginación y filtros (categoría, búsqueda, código de barras, activo)
 */
const validateGetProductosQuery = validateSource(getProductos, "query", {
  abortEarly: false,
  stripUnknown: true,
  convert: true,
  allowUnknown: false,
});

// =====================================================
// MIDDLEWARES COMPUESTOS (OPCIONAL)
// =====================================================

/**
 * Middleware compuesto para validar creación completa
 */
const validateCompleteProductoCreation = [validateCreateProducto];

/**
 * Middleware compuesto para validar actualización completa
 */
const validateCompleteProductoUpdate = [
  validateProductoId,
  validateUpdateProducto,
];

/**
 * Middleware compuesto para operaciones que requieren ID
 */
const validateProductoOperation = [validateProductoId];

/**
 * Middleware compuesto para búsqueda por código de barras
 */
const validateBarcodeSearch = [validateCodigoBarras];

// =====================================================
// EXPORTACIONES LIMPIAS
// =====================================================

export {
  // Schemas (para uso directo si necesario)
  productosSchemas,

  // Middlewares específicos listos para rutas
  validateCreateProducto,
  validateUpdateProducto,
  validateProductoId,
  validateCodigoBarras,
  validateGetProductosQuery,

  // Middlewares compuestos (opcional para rutas complejas)
  validateCompleteProductoCreation,
  validateCompleteProductoUpdate,
  validateProductoOperation,
  validateBarcodeSearch,
};
