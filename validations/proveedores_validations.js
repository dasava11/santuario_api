// validations/proveedoresValidations.js - Reutilizando Utils Existentes
import { validate, validateSource } from "../middleware/validation.js";
import {
  createProveedor,
  updateProveedor,
  getProveedores,
  getProveedorById,
  proveedorId,
  proveedoresSchemas,
} from "./schemas/proveedoresSchemas.js";

// =====================================================
// 🎯 MIDDLEWARES ESPECÍFICOS PARA PROVEEDORES
// =====================================================

/**
 * Validar datos para crear proveedor
 * Reutiliza el middleware genérico existente
 */
const validateCreateProveedor = validate(createProveedor);

/**
 * Validar datos para actualizar proveedor
 * Reutiliza el middleware genérico existente
 */
const validateUpdateProveedor = validate(updateProveedor);

/**
 * Validar ID de proveedor en parámetros
 * Reutiliza validateSource para params
 */
const validateProveedorId = validateSource(proveedorId, "params");

/**
 * Validar query parameters para obtener proveedores
 * Reutiliza validateSource para query con defaults
 * Incluye paginación y filtros de búsqueda
 */
const validateGetProveedoresQuery = validateSource(getProveedores, "query", {
  abortEarly: false,
  stripUnknown: true,
  convert: true,
  allowUnknown: false, // Rechazar parámetros no definidos
});

/**
 * Validar query parameters para obtener proveedor por ID
 * Reutiliza validateSource para query con defaults
 */
const validateGetProveedorByIdQuery = validateSource(getProveedorById, "query");

// =====================================================
// 🔧 MIDDLEWARES COMPUESTOS (OPCIONAL)
// =====================================================

/**
 * Middleware compuesto para validar creación completa
 * Combina validación de datos + sanitización
 * Ejemplo de uso: router.post("/", validateCompleteProveedorCreation, controller)
 */
const validateCompleteProveedorCreation = [validateCreateProveedor];

/**
 * Middleware compuesto para validar actualización completa
 * Combina validación de ID + datos de actualización
 */
const validateCompleteProveedorUpdate = [
  validateProveedorId,
  validateUpdateProveedor,
];

/**
 * Middleware compuesto para obtener proveedor específico
 * Combina validación de ID + query parameters
 */
const validateGetSpecificProveedor = [
  validateProveedorId,
  validateGetProveedorByIdQuery,
];

// =====================================================
// 📤 EXPORTACIONES LIMPIAS
// =====================================================

export {
  // Schemas (para uso directo si necesario)
  proveedoresSchemas,

  // Middlewares específicos listos para rutas
  validateCreateProveedor,
  validateUpdateProveedor,
  validateProveedorId,
  validateGetProveedoresQuery,
  validateGetProveedorByIdQuery,

  // Middlewares compuestos (opcional para rutas complejas)
  validateCompleteProveedorCreation,
  validateCompleteProveedorUpdate,
  validateGetSpecificProveedor,
};
