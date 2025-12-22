// controllers/proveedoresControlador.js - VERSIÓN REFACTORIZADA
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
        tipo: "not_found",
        sugerencia: "Verifica que el ID del proveedor sea correcto",
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
// ✅ CREAR PROVEEDOR - REFACTORIZADO
// =====================================================
const crearProveedor = asyncControllerWrapper(async (req, res) => {
  try {
    const nuevoProveedor = await proveedoresService.crearProveedor(req.body);

    const metadata = buildOperationMetadata("creacion", nuevoProveedor.id, {
      campos_creados: Object.keys(req.body),
    });

    logger.business("Proveedor creado", {
      id: nuevoProveedor.id,
      nombre: nuevoProveedor.nombre,
      email: nuevoProveedor.email,
      usuario: req.user?.id,
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
  } catch (error) {
    // ✅ NUEVO: Manejo específico de email duplicado
    if (error.message?.startsWith("EMAIL_ALREADY_EXISTS:")) {
      const email = error.message.split(":")[1];

      logger.business("Intento de crear proveedor con email duplicado", {
        email,
        usuario: req.user?.id,
        nombre_intento: req.body?.nombre,
      });

      return res.status(409).json(
        buildBusinessErrorResponse(
          "Ya existe un proveedor con este email",
          {
            email,
            tipo: "duplicate_email",
            sugerencia:
              "Verifica si el proveedor ya está registrado o usa otro email",
          }
        )
      );
    }

    // ✅ NUEVO: Manejo de errores de validación de Sequelize
    if (error.name === "SequelizeValidationError") {
      logger.business("Error de validación al crear proveedor", {
        errores: error.errors.map((e) => e.message),
        usuario: req.user?.id,
      });

      return res.status(400).json(
        buildBusinessErrorResponse("Errores de validación en los datos", {
          tipo: "validation_error",
          campos_invalidos: error.errors.map((e) => ({
            campo: e.path,
            mensaje: e.message,
            valor: e.value,
          })),
        })
      );
    }

    // ✅ NUEVO: Manejo de restricción única de Sequelize
    if (error.name === "SequelizeUniqueConstraintError") {
      const camposDuplicados = Object.keys(error.fields || {});

      logger.business("Restricción única violada al crear proveedor", {
        campos: camposDuplicados,
        usuario: req.user?.id,
      });

      return res.status(409).json(
        buildBusinessErrorResponse(
          "Ya existe un proveedor con estos datos",
          {
            tipo: "unique_constraint",
            campos_duplicados: camposDuplicados,
            sugerencia: "Verifica que el proveedor no esté ya registrado",
          }
        )
      );
    }

    // Dejar que asyncControllerWrapper maneje otros errores
    throw error;
  }
}, "creación de proveedor");

// =====================================================
// ✅ ACTUALIZAR PROVEEDOR - REFACTORIZADO
// =====================================================
const actualizarProveedor = asyncControllerWrapper(async (req, res) => {
  const { id } = req.params;

  try {
    const result = await proveedoresService.actualizarProveedor(id, req.body);

    const metadata = buildOperationMetadata("actualizacion", id, {
      campos_modificados: result.camposModificados,
      total_cambios: result.camposModificados.length,
    });

    logger.business("Proveedor actualizado", {
      id,
      campos: result.camposModificados,
      usuario: req.user?.id,
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
          proveedor: {
            id: result.proveedor.id,
            nombre: result.proveedor.nombre,
            email: result.proveedor.email,
            activo: result.proveedor.activo,
          },
        },
        metadata
      )
    );
  } catch (error) {
    // ✅ NUEVO: Manejo específico de proveedor no encontrado
    if (error.message === "PROVEEDOR_NOT_FOUND") {
      logger.business("Intento de actualizar proveedor inexistente", {
        id,
        usuario: req.user?.id,
      });

      return res.status(404).json(
        buildBusinessErrorResponse("Proveedor no encontrado", {
          proveedor_id: id,
          tipo: "not_found",
          sugerencia: "Verifica que el ID del proveedor sea correcto",
        })
      );
    }

    // ✅ NUEVO: Manejo específico de email duplicado
    if (error.message?.startsWith("EMAIL_ALREADY_EXISTS:")) {
      const email = error.message.split(":")[1];

      logger.business("Intento de actualizar con email duplicado", {
        id,
        email,
        usuario: req.user?.id,
      });

      return res.status(409).json(
        buildBusinessErrorResponse(
          "Ya existe otro proveedor con este email",
          {
            email,
            proveedor_id: id,
            tipo: "duplicate_email",
            sugerencia:
              "Verifica si otro proveedor ya está usando este email",
          }
        )
      );
    }

    // ✅ NUEVO: Manejo de errores de validación
    if (error.name === "SequelizeValidationError") {
      logger.business("Error de validación al actualizar proveedor", {
        id,
        errores: error.errors.map((e) => e.message),
        usuario: req.user?.id,
      });

      return res.status(400).json(
        buildBusinessErrorResponse("Errores de validación en los datos", {
          tipo: "validation_error",
          proveedor_id: id,
          campos_invalidos: error.errors.map((e) => ({
            campo: e.path,
            mensaje: e.message,
            valor: e.value,
          })),
        })
      );
    }

    // ✅ NUEVO: Manejo de restricción única
    if (error.name === "SequelizeUniqueConstraintError") {
      const camposDuplicados = Object.keys(error.fields || {});

      logger.business("Restricción única violada al actualizar proveedor", {
        id,
        campos: camposDuplicados,
        usuario: req.user?.id,
      });

      return res.status(409).json(
        buildBusinessErrorResponse(
          "Ya existe otro proveedor con estos datos",
          {
            tipo: "unique_constraint",
            proveedor_id: id,
            campos_duplicados: camposDuplicados,
            sugerencia: "Verifica que los datos no estén duplicados",
          }
        )
      );
    }

    // Dejar que asyncControllerWrapper maneje otros errores
    throw error;
  }
}, "actualización de proveedor");

// =====================================================
// ✅ ELIMINAR (DESACTIVAR) PROVEEDOR - REFACTORIZADO
// =====================================================
const eliminarProveedor = asyncControllerWrapper(async (req, res) => {
  const { id } = req.params;

  try {
    const proveedor = await proveedoresService.desactivarProveedor(id);

    const metadata = buildOperationMetadata("desactivacion", id, {
      fecha_desactivacion: new Date().toISOString(),
      proveedor_nombre: proveedor.nombre,
    });

    logger.business("Proveedor desactivado", {
      id,
      nombre: proveedor.nombre,
      usuario: req.user?.id,
    });

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
            activo: proveedor.activo,
          },
        },
        metadata
      )
    );
  } catch (error) {
    // ✅ NUEVO: Manejo específico de proveedor no encontrado
    if (error.message === "PROVEEDOR_NOT_FOUND") {
      logger.business("Intento de desactivar proveedor inexistente", {
        id,
        usuario: req.user?.id,
      });

      return res.status(404).json(
        buildBusinessErrorResponse("Proveedor no encontrado", {
          proveedor_id: id,
          tipo: "not_found",
          sugerencia: "Verifica que el ID del proveedor sea correcto",
        })
      );
    }

    // ✅ NUEVO: Manejo específico de proveedor ya inactivo
    if (error.message === "PROVEEDOR_ALREADY_INACTIVE") {
      logger.business("Intento de desactivar proveedor ya inactivo", {
        id,
        usuario: req.user?.id,
      });

      return res.status(400).json(
        buildBusinessErrorResponse("El proveedor ya está inactivo", {
          proveedor_id: id,
          tipo: "already_inactive",
          sugerencia: "El proveedor ya fue desactivado previamente",
        })
      );
    }

    // ✅ NUEVO: Manejo específico de recepciones activas
    if (error.message?.startsWith("ACTIVE_RECEPCIONES:")) {
      const count = error.message.split(":")[1];

      logger.business("Intento de desactivar proveedor con recepciones activas", {
        id,
        recepciones_activas: parseInt(count),
        usuario: req.user?.id,
      });

      return res.status(400).json(
        buildBusinessErrorResponse(
          "No se puede desactivar el proveedor porque tiene recepciones activas",
          {
            proveedor_id: id,
            recepciones_activas: parseInt(count),
            tipo: "has_active_relations",
            sugerencia:
              "Procesa o cancela las recepciones pendientes antes de desactivar el proveedor",
            acciones_requeridas: [
              "Revisar recepciones en estado 'pendiente'",
              "Procesar recepciones completadas",
              "Cancelar recepciones no válidas",
            ],
          }
        )
      );
    }

    // Dejar que asyncControllerWrapper maneje otros errores
    throw error;
  }
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
      {
        ...result.metadata,
        tiempo_consulta_ms: performance.now() - req.startTime,
      }
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