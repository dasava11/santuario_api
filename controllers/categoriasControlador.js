// controllers/categoriasControlador.js - Solo Orquestación y Respuestas
import categoriasService from "../services/categoriasService.js";
import {
  buildSuccessResponse,
  buildBusinessErrorResponse,
  createControllerLogger,
  handleSequelizeError,
  buildOperationMetadata,
  generateSuccessMessage,
  asyncControllerWrapper,
} from "../utils/controllerResponseUtils.js";

const logger = createControllerLogger("categorias");

// =====================================================
// 📊 OBTENER CATEGORÍAS
// =====================================================
const obtenerCategorias = asyncControllerWrapper(async (req, res) => {
  const result = await categoriasService.obtenerCategoriasFiltradas(req.query);

  const metadata = buildOperationMetadata("consulta", null, {
    ...result.metadata,
    tiempo_consulta_ms: performance.now() - req.startTime,
  });

  if (result.fromCache) {
    logger.cache("HIT", "categorias:list");
  } else {
    logger.cache("MISS → SET", "categorias:list");
  }

  res.json(buildSuccessResponse(result.data, metadata, result.fromCache));
}, "consulta de categorías");

// =====================================================
// 📄 OBTENER CATEGORÍA POR ID
// =====================================================
const obtenerCategoriaPorId = asyncControllerWrapper(async (req, res) => {
  const { id } = req.params;
  const result = await categoriasService.obtenerCategoriaPorId(id, req.query);

  if (!result) {
    return res.status(404).json(
      buildBusinessErrorResponse("Categoría no encontrada", {
        categoria_id: id,
      })
    );
  }

  const metadata = buildOperationMetadata(
    "consulta_individual",
    id,
    result.metadata
  );

  if (result.fromCache) {
    logger.cache("HIT", `categoria:${id}`);
  } else {
    logger.cache("MISS → SET", `categoria:${id}`);
  }

  res.json(buildSuccessResponse(result.data, metadata, result.fromCache));
}, "consulta de categoría");

// =====================================================
// ✨ CREAR CATEGORÍA
// =====================================================
const crearCategoria = asyncControllerWrapper(async (req, res) => {
  try {
    const nuevaCategoria = await categoriasService.crearCategoria(req.body);

    const metadata = buildOperationMetadata("creacion", nuevaCategoria.id);

    logger.business("Categoría creada", {
      id: nuevaCategoria.id,
      nombre: nuevaCategoria.nombre,
    });

    const mensaje = generateSuccessMessage(
      "crear",
      "Categoría",
      nuevaCategoria.nombre
    );

    res.status(201).json(
      buildSuccessResponse(
        {
          mensaje,
          categoria: {
            id: nuevaCategoria.id,
            nombre: nuevaCategoria.nombre,
            descripcion: nuevaCategoria.descripcion,
            activo: nuevaCategoria.activo,
            fecha_creacion: nuevaCategoria.fecha_creacion,
          },
        },
        metadata
      )
    );
  } catch (error) {
    // Manejo de errores de negocio específicos
    if (error.message.startsWith("DUPLICATE_NAME:")) {
      const [, categoriaExistente] = error.message.split(":");
      return res.status(400).json(
        buildBusinessErrorResponse(
          "Ya existe una categoría con nombre similar",
          {
            nombre_enviado: req.body.nombre.trim(),
            categoria_existente: categoriaExistente,
          }
        )
      );
    }

    throw error; // Re-throw para manejo genérico
  }
}, "creación de categoría");

// =====================================================
// 🔄 ACTUALIZAR CATEGORÍA
// =====================================================
const actualizarCategoria = asyncControllerWrapper(async (req, res) => {
  const { id } = req.params;

  try {
    const result = await categoriasService.actualizarCategoria(id, req.body);

    const metadata = buildOperationMetadata("actualizacion", id, {
      campos_modificados: result.camposModificados,
    });

    logger.business("Categoría actualizada", {
      id,
      campos: result.camposModificados,
    });

    const mensaje = generateSuccessMessage(
      "actualizar",
      "Categoría",
      req.body.nombre || result.categoria.nombre
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
  } catch (error) {
    // Manejo de errores de negocio específicos
    if (error.message === "CATEGORIA_NOT_FOUND") {
      return res.status(404).json(
        buildBusinessErrorResponse("Categoría no encontrada", {
          categoria_id: id,
        })
      );
    }

    if (error.message.startsWith("DUPLICATE_NAME:")) {
      const [, categoriaExistente] = error.message.split(":");
      return res.status(400).json(
        buildBusinessErrorResponse(
          "Ya existe una categoría con nombre similar",
          {
            nombre_enviado: req.body.nombre.trim(),
            categoria_existente: categoriaExistente,
          }
        )
      );
    }

    throw error; // Re-throw para manejo genérico
  }
}, "actualización de categoría");

// =====================================================
// 🗑️ ELIMINAR (DESACTIVAR) CATEGORÍA
// =====================================================
const eliminarCategoria = asyncControllerWrapper(async (req, res) => {
  const { id } = req.params;

  try {
    const categoria = await categoriasService.desactivarCategoria(id);

    const metadata = buildOperationMetadata("desactivacion", id, {
      fecha_desactivacion: new Date().toISOString(),
    });

    logger.business("Categoría desactivada", { id, nombre: categoria.nombre });

    const mensaje = generateSuccessMessage(
      "desactivar",
      "Categoría",
      categoria.nombre
    );

    res.json(
      buildSuccessResponse(
        {
          mensaje,
          categoria: {
            id: categoria.id,
            nombre: categoria.nombre,
          },
        },
        metadata
      )
    );
  } catch (error) {
    // Manejo de errores de negocio específicos
    if (error.message === "CATEGORIA_NOT_FOUND") {
      return res.status(404).json(
        buildBusinessErrorResponse("Categoría no encontrada", {
          categoria_id: id,
        })
      );
    }

    if (error.message === "CATEGORIA_ALREADY_INACTIVE") {
      return res.status(400).json(
        buildBusinessErrorResponse("La categoría ya está desactivada", {
          categoria_id: id,
        })
      );
    }

    if (error.message.startsWith("ACTIVE_PRODUCTS:")) {
      const [, productosActivos, productosEjemplo] = error.message.split(":");
      const ejemplos = JSON.parse(productosEjemplo);

      return res.status(400).json(
        buildBusinessErrorResponse(
          `No se puede desactivar la categoría porque tiene productos activos asociados`,
          {
            productos_activos: parseInt(productosActivos),
            ejemplos,
            sugerencia: "Desactive primero los productos de esta categoría",
          }
        )
      );
    }

    throw error; // Re-throw para manejo genérico
  }
}, "eliminación de categoría");

// =====================================================
// 📊 ESTADÍSTICAS DE CATEGORÍAS
// =====================================================
const obtenerEstadisticasCategorias = asyncControllerWrapper(
  async (req, res) => {
    const result = await categoriasService.obtenerEstadisticasCompletas();

    const metadata = buildOperationMetadata(
      "estadisticas_completas",
      null,
      result.metadata
    );

    if (result.fromCache) {
      logger.cache("HIT", "categorias:estadisticas");
    } else {
      logger.cache("MISS → SET", "categorias:estadisticas");
    }

    res.json(buildSuccessResponse(result.data, metadata, result.fromCache));
  },
  "consulta de estadísticas"
);

// =====================================================
// 📤 EXPORTACIONES
// =====================================================
export {
  obtenerCategorias,
  obtenerCategoriaPorId,
  crearCategoria,
  actualizarCategoria,
  eliminarCategoria,
  obtenerEstadisticasCategorias,
};
