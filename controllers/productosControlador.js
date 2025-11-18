// controllers/productosControlador.js
import productosService from "../services/productosService.js";
import {
  buildSuccessResponse,
  createControllerLogger,
  buildOperationMetadata,
  buildBusinessErrorResponse,
  generateSuccessMessage,
  asyncControllerWrapper,
} from "../utils/controllerResponseUtils.js";

const logger = createControllerLogger("productos");

// =====================================================
// OBTENER PRODUCTOS
// =====================================================
const obtenerProductos = asyncControllerWrapper(async (req, res) => {
  const result = await productosService.obtenerProductosFiltrados(req.query);

  const metadata = buildOperationMetadata("consulta", null, {
    ...result.metadata,
    tiempo_consulta_ms: performance.now() - req.startTime,
  });

  if (result.fromCache) {
    logger.cache("HIT", "productos:list");
  } else {
    logger.cache("MISS → SET", "productos:list");
  }

  res.json(
    buildSuccessResponse(
      {
        productos: result.data,
        pagination: result.pagination,
      },
      metadata,
      result.fromCache
    )
  );
}, "consulta de productos");

// =====================================================
// OBTENER PRODUCTO POR ID
// =====================================================
const obtenerProductoPorId = asyncControllerWrapper(async (req, res) => {
  const { id } = req.params;
  const result = await productosService.obtenerProductoPorId(id);

  if (!result) {
    return res.status(404).json(
      buildBusinessErrorResponse("Producto no encontrado", {
        producto_id: id,
      })
    );
  }

  const metadata = buildOperationMetadata(
    "consulta_individual",
    id,
    result.metadata
  );

  if (result.fromCache) {
    logger.cache("HIT", `producto:${id}`);
  } else {
    logger.cache("MISS → SET", `producto:${id}`);
  }

  res.json(buildSuccessResponse(result.data, metadata, result.fromCache));
}, "consulta de producto");

// =====================================================
// OBTENER PRODUCTO POR CÓDIGO DE BARRAS
// =====================================================
const obtenerProductoPorCodigoBarras = asyncControllerWrapper(
  async (req, res) => {
    const { codigo } = req.params;
    const result = await productosService.obtenerProductoPorCodigoBarras(
      codigo
    );

    if (!result) {
      return res.status(404).json(
        buildBusinessErrorResponse(
          "Producto no encontrado con este código de barras",
          {
            codigo_barras: codigo,
          }
        )
      );
    }

    const metadata = buildOperationMetadata(
      "busqueda_codigo_barras",
      null,
      result.metadata
    );

    if (result.fromCache) {
      logger.cache("HIT", `producto:barcode:${codigo}`);
    } else {
      logger.cache("MISS → SET", `producto:barcode:${codigo}`);
    }

    res.json(buildSuccessResponse(result.data, metadata, result.fromCache));
  },
  "búsqueda por código de barras"
);

// =====================================================
// CREAR PRODUCTO
// =====================================================
const crearProducto = asyncControllerWrapper(async (req, res) => {
  try {
    const nuevoProducto = await productosService.crearProducto(
      req.body,
      req.user.id
    );

    const metadata = buildOperationMetadata("creacion", nuevoProducto.id, {
      stock_inicial: nuevoProducto.stock_actual,
      categoria_id: nuevoProducto.categoria_id,
    });

    logger.business("Producto creado", {
      id: nuevoProducto.id,
      nombre: nuevoProducto.nombre,
      codigo_barras: nuevoProducto.codigo_barras || "sin código",
      stock_inicial: nuevoProducto.stock_actual,
    });

    const mensaje = generateSuccessMessage(
      "crear",
      "Producto",
      nuevoProducto.nombre
    );

    res.status(201).json(
      buildSuccessResponse(
        {
          mensaje,
          producto: {
            id: nuevoProducto.id,
            nombre: nuevoProducto.nombre,
            codigo_barras: nuevoProducto.codigo_barras,
            precio_compra: nuevoProducto.precio_compra,
            precio_venta: nuevoProducto.precio_venta,
            stock_actual: nuevoProducto.stock_actual,
            categoria_id: nuevoProducto.categoria_id,
          },
        },
        metadata
      )
    );
  } catch (error) {
    if (error.message.startsWith("NOMBRE_DUPLICADO:")) {
      const nombre = error.message.split(":")[1];
      return res.status(400).json(
        buildBusinessErrorResponse(
          `Ya existe un producto con el nombre "${nombre}"`,
          {
            field: "nombre",
            value: nombre,
            constraint: "unique",
          }
        )
      );
    }

    if (error.message.startsWith("CODIGO_BARRAS_DUPLICADO:")) {
      const codigo = error.message.split(":")[1];
      return res.status(400).json(
        buildBusinessErrorResponse(
          `El código de barras "${codigo}" ya está registrado`,
          {
            field: "codigo_barras",
            value: codigo,
            constraint: "unique",
          }
        )
      );
    }

    if (error.message === "CATEGORIA_NOT_FOUND") {
      return res.status(400).json(
        buildBusinessErrorResponse("La categoría especificada no existe", {
          field: "categoria_id",
          suggestion: "Verifica que el ID de categoría sea válido",
        })
      );
    }

    throw error;
  }
}, "creación de producto");

// =====================================================
// ACTUALIZAR PRODUCTO
// =====================================================
const actualizarProducto = asyncControllerWrapper(async (req, res) => {
  const { id } = req.params;

  try {
    const result = await productosService.actualizarProducto(id, req.body);

    const metadata = buildOperationMetadata("actualizacion", id, {
      campos_modificados: result.camposModificados,
    });

    logger.business("Producto actualizado", {
      id,
      campos: result.camposModificados,
    });

    const mensaje = generateSuccessMessage(
      "actualizar",
      "Producto",
      req.body.nombre || result.producto.nombre
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
    if (error.message === "PRODUCTO_NOT_FOUND") {
      return res
        .status(404)
        .json(
          buildBusinessErrorResponse(
            `No se encontró un producto con el id: ${id}`
          )
        );
    }

    if (error.message.startsWith("NOMBRE_DUPLICADO:")) {
      const nombre = error.message.split(":")[1];
      return res.status(400).json(
        buildBusinessErrorResponse(
          `Ya existe un producto con el nombre "${nombre}"`,
          {
            field: "nombre",
            value: nombre,
          }
        )
      );
    }

    if (error.message.startsWith("CODIGO_BARRAS_DUPLICADO:")) {
      const codigo = error.message.split(":")[1];
      return res.status(400).json(
        buildBusinessErrorResponse(
          `El código de barras "${codigo}" ya está registrado`,
          {
            field: "codigo_barras",
            value: codigo,
          }
        )
      );
    }

    if (error.message === "CATEGORIA_NOT_FOUND") {
      return res.status(400).json(
        buildBusinessErrorResponse("La categoría especificada no existe", {
          field: "categoria_id",
          suggestion: "Verifica que el ID de categoría sea válido",
        })
      );
    }

    throw error;
  }
}, "actualización de producto");

// =====================================================
// ELIMINAR PRODUCTO (DESACTIVAR)
// =====================================================
const eliminarProducto = asyncControllerWrapper(async (req, res) => {
  const { id } = req.params;

  try {
    const producto = await productosService.eliminarProducto(id);

    const metadata = buildOperationMetadata("desactivacion", id, {
      estado_anterior: true,
      estado_nuevo: false,
    });

    logger.business("Producto desactivado", {
      id,
      nombre: producto.nombre,
    });

    const mensaje = generateSuccessMessage(
      "desactivar",
      "Producto",
      producto.nombre
    );

    res.json(
      buildSuccessResponse(
        {
          mensaje,
          producto: {
            id: producto.id,
            nombre: producto.nombre,
            activo: producto.activo,
          },
        },
        metadata
      )
    );
  } catch (error) {
    if (error.message === "PRODUCTO_NOT_FOUND") {
      return res
        .status(404)
        .json(buildBusinessErrorResponse("Producto no encontrado"));
    }

    throw error;
  }
}, "desactivación de producto");

// =====================================================
// EXPORTACIONES
// =====================================================
export {
  obtenerProductos,
  obtenerProductoPorId,
  obtenerProductoPorCodigoBarras,
  crearProducto,
  actualizarProducto,
  eliminarProducto,
};
