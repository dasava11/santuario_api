// controllers/proveedoresControlador.js
import proveedoresService from "../services/proveedoresService.js";
import {
  buildSuccessResponse,
  createControllerLogger,
  buildOperationMetadata,
  buildBusinessErrorResponse,
  generateSuccessMessage,
  asyncControllerWrapper,
} from "../utils/controllerResponseUtils.js";

const logger = createControllerLogger("proveedores");

// =====================================================
// OBTENER PROVEEDORES
// =====================================================
const obtenerProveedores = asyncControllerWrapper(async (req, res) => {
  const result = await proveedoresService.obtenerProveedoresFiltrados(
    req.query
  );

  const metadata = buildOperationMetadata("consulta", null, {
    ...result.metadata,
    tiempo_consulta_ms: performance.now() - req.startTime,
  });

  if (result.fromCache) {
    logger.cache("HIT", "proveedores:list");
  } else {
    logger.cache("MISS → SET", "proveedores:list");
  }

  res.json(
    buildSuccessResponse(
      {
        proveedores: result.data,
        pagination: result.pagination,
      },
      metadata,
      result.fromCache
    )
  );
}, "consulta de proveedores");

// =====================================================
// OBTENER PROVEEDOR POR ID
// =====================================================
const obtenerProveedorPorId = asyncControllerWrapper(async (req, res) => {
  const { id } = req.params;
  const result = await proveedoresService.obtenerProveedorPorId(id, req.query);

  if (!result) {
    return res.status(404).json(
      buildBusinessErrorResponse("Proveedor no encontrado", {
        proveedor_id: id,
      })
    );
  }

  const metadata = buildOperationMetadata(
    "consulta_individual",
    id,
    result.metadata
  );

  if (result.fromCache) {
    logger.cache("HIT", `proveedor:${id}`);
  } else {
    logger.cache("MISS → SET", `proveedor:${id}`);
  }

  res.json(buildSuccessResponse(result.data, metadata, result.fromCache));
}, "consulta de proveedor");

// =====================================================
// CREAR PROVEEDOR
// =====================================================
const crearProveedor = asyncControllerWrapper(async (req, res) => {
  const nuevoProveedor = await proveedoresService.crearProveedor(req.body);

  const metadata = buildOperationMetadata("creacion", nuevoProveedor.id);

  logger.business("Proveedor creado", {
    id: nuevoProveedor.id,
    nombre: nuevoProveedor.nombre,
    email: nuevoProveedor.email,
  });

  const mensaje = generateSuccessMessage(
    "crear",
    "Proveedor",
    nuevoProveedor.nombre
  );

  res.status(201).json(
    buildSuccessResponse(
      {
        mensaje,
        proveedor: {
          id: nuevoProveedor.id,
          nombre: nuevoProveedor.nombre,
          contacto: nuevoProveedor.contacto,
          telefono: nuevoProveedor.telefono,
          email: nuevoProveedor.email,
          direccion: nuevoProveedor.direccion,
          ciudad: nuevoProveedor.ciudad,
          pais: nuevoProveedor.pais,
          activo: nuevoProveedor.activo,
          fecha_creacion: nuevoProveedor.fecha_creacion,
        },
      },
      metadata
    )
  );
}, "creación de proveedor");

// =====================================================
// ACTUALIZAR PROVEEDOR
// =====================================================
const actualizarProveedor = asyncControllerWrapper(async (req, res) => {
  const { id } = req.params;

  const result = await proveedoresService.actualizarProveedor(id, req.body);

  const metadata = buildOperationMetadata("actualizacion", id, {
    campos_modificados: result.camposModificados,
  });

  logger.business("Proveedor actualizado", {
    id,
    campos: result.camposModificados,
  });

  const mensaje = generateSuccessMessage(
    "actualizar",
    "Proveedor",
    req.body.nombre || result.proveedor.nombre
  );

  res.json(
    buildSuccessResponse(
      {
        mensaje,
        cambios_realizados: result.camposModificados,
      },
      metadata
    )
  );
}, "actualización de proveedor");

// =====================================================
// ELIMINAR (DESACTIVAR) PROVEEDOR
// =====================================================
const eliminarProveedor = asyncControllerWrapper(async (req, res) => {
  const { id } = req.params;

  const proveedor = await proveedoresService.desactivarProveedor(id);

  const metadata = buildOperationMetadata("desactivacion", id, {
    fecha_desactivacion: new Date().toISOString(),
  });

  logger.business("Proveedor desactivado", { id, nombre: proveedor.nombre });

  const mensaje = generateSuccessMessage(
    "desactivar",
    "Proveedor",
    proveedor.nombre
  );

  res.json(
    buildSuccessResponse(
      {
        mensaje,
        proveedor: {
          id: proveedor.id,
          nombre: proveedor.nombre,
        },
      },
      metadata
    )
  );
}, "eliminación de proveedor");

// =====================================================
// ESTADÍSTICAS DE PROVEEDORES
// =====================================================
const obtenerEstadisticasProveedores = asyncControllerWrapper(
  async (req, res) => {
    const result = await proveedoresService.obtenerEstadisticasCompletas();

    const metadata = buildOperationMetadata(
      "estadisticas_completas",
      null,
      result.metadata
    );

    if (result.fromCache) {
      logger.cache("HIT", "proveedores:estadisticas");
    } else {
      logger.cache("MISS → SET", "proveedores:estadisticas");
    }

    res.json(buildSuccessResponse(result.data, metadata, result.fromCache));
  },
  "consulta de estadísticas"
);

// =====================================================
// EXPORTACIONES
// =====================================================
export {
  obtenerProveedores,
  obtenerProveedorPorId,
  crearProveedor,
  actualizarProveedor,
  eliminarProveedor,
  obtenerEstadisticasProveedores,
};
