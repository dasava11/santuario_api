import { sequelize } from "../config/database.js";
import { cacheGet, cacheSet } from "../services/cacheService.js";
import db from "../models/index.js";

const { productos, categorias, movimientos_inventario } = db;

// Obtener todos los productos con filtros y paginación (optimizado)
const obtenerProductos = async (req, res) => {
  try {
    const {
      categoria_id,
      search,
      codigo_barras,
      activo,
      page = 1,
      limit = 10,
    } = req.query;

    // Construir filtros dinámicos
    const where = {};

    if (activo !== "all") {
      where.activo = activo === "true";
    }

    if (categoria_id) {
      where.categoria_id = categoria_id;
    }

    if (codigo_barras) {
      where.codigo_barras = codigo_barras;
    }

    // 🔒 Sanitizar búsqueda (evitar wildcard injection con % y _)
    if (search) {
      const sanitizedSearch = search.replace(/[%_]/g, "\\$&");
      where[sequelize.Op.or] = [
        {
          nombre: {
            [sequelize.Op.like]: `%${sanitizedSearch}%`,
            [sequelize.Op.escape]: "\\",
          },
        },
        {
          descripcion: {
            [sequelize.Op.like]: `%${sanitizedSearch}%`,
            [sequelize.Op.escape]: "\\",
          },
        },
      ];
    }

    // Calcular offset para paginación
    const offset = (parseInt(page) - 1) * parseInt(limit);

    // 🔹 Paso 1: obtener IDs paginados
    const productosIds = await productos.findAll({
      where,
      attributes: ["id"],
      limit: parseInt(limit),
      offset,
      order: [["nombre", "ASC"]],
    });

    const ids = productosIds.map((p) => p.id);

    // 🔹 Paso 2: obtener productos con include solo para esos IDs
    let productosData = [];
    if (ids.length > 0) {
      productosData = await productos.findAll({
        where: { id: { [sequelize.Op.in]: ids } },
        include: [
          {
            model: categorias,
            as: "categorias",
            attributes: ["id", "nombre"],
          },
        ],
        order: [["nombre", "ASC"]],
      });
    }

    // 🔹 Paso 3: contar total (sin DISTINCT costoso)
    const count = await productos.count({ where });

    res.json({
      success: true,
      data: {
        productos: productosData,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: count,
          pages: Math.ceil(count / limit),
        },
      },
    });
  } catch (error) {
    console.error("Error obteniendo productos:", error);
    res.status(500).json({
      success: false,
      error: "Error obteniendo productos",
      message: error.message,
    });
  }
};

// Obtener producto por ID
const obtenerProductoPorId = async (req, res) => {
  try {
    const { id } = req.params;

    const producto = await productos.findOne({
      where: { id },
      include: [
        {
          model: categorias,
          as: "categorium",
          attributes: ["id", "nombre"],
        },
      ],
    });

    if (!producto) {
      return res.status(404).json({
        success: false,
        error: "Producto no encontrado",
      });
    }

    res.json({
      success: true,
      data: producto,
    });
  } catch (error) {
    console.error("Error obteniendo producto:", error);
    res.status(500).json({
      success: false,
      error: "Error obteniendo producto",
      message: error.message,
    });
  }
};

// Buscar producto por código de barras
const obtenerProductoPorCodigoBarras = async (req, res) => {
  try {
    const { codigo } = req.params;
    const cacheKey = `producto:barcode:${codigo}`;

    // 1. Intentar cache
    const cached = await cacheGet(cacheKey);
    if (cached) {
      return res.json({ success: true, data: cached, cache: true });
    }

    // 2. Consultar DB
    const producto = await productos.findOne({ ... });

    if (!producto) {
      return res.status(404).json({ success: false, error: "No encontrado" });
    }

    // 3. Guardar en cache
    await cacheSet(cacheKey, producto);

    res.json({ success: true, data: producto, cache: false });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// Obtener productos con stock bajo
const obtenerProductosStockBajo = async (req, res) => {
  try {
    const productosStockBajo = await productos.findAll({
      where: {
        [sequelize.Op.and]: [
          sequelize.where(
            sequelize.col("stock_actual"),
            "<=",
            sequelize.col("stock_minimo")
          ),
          { activo: true },
        ],
      },
      include: [
        {
          model: categorias,
          as: "categorium",
          attributes: ["id", "nombre"],
        },
      ],
      order: [["nombre", "ASC"]],
    });

    res.json({
      success: true,
      data: productosStockBajo,
    });
  } catch (error) {
    console.error("Error obteniendo productos con stock bajo:", error);
    res.status(500).json({
      success: false,
      error: "Error obteniendo productos con stock bajo",
      message: error.message,
    });
  }
};

// Crear nuevo producto
const crearProducto = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const {
      codigo_barras,
      nombre,
      descripcion,
      categoria_id,
      precio_compra,
      precio_venta,
      tipo_medida,
      stock_actual,
      stock_minimo,
      activo,
    } = req.body;

    // VALIDACIONES DE BASE DE DATOS (no pueden hacerse en Joi)

    // Verificar si ya existe un producto con el mismo nombre
    const existingByName = await productos.findOne({
      where: {
        nombre: { [sequelize.Op.like]: nombre.trim() },
      },
      transaction,
    });

    if (existingByName) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        error: `Ya existe un producto llamado "${nombre.trim()}"`,
      });
    }

    // Verificar si el código de barras ya existe
    if (codigo_barras?.trim()) {
      const existingByCode = await productos.findOne({
        where: { codigo_barras: codigo_barras.trim() },
        transaction,
      });

      if (existingByCode) {
        await transaction.rollback();
        return res.status(400).json({
          success: false,
          error: `El código de barras "${codigo_barras.trim()}" ya existe`,
        });
      }
    }

    // Verificar que la categoría existe
    const categoria = await categorias.findByPk(categoria_id, {
      transaction,
    });
    if (!categoria) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        error: "La categoría especificada no existe",
      });
    }

    // Crear el producto
    const nuevoProducto = await productos.create(
      {
        codigo_barras: codigo_barras?.trim() || null,
        nombre: nombre.trim(),
        descripcion: descripcion?.trim() || null,
        categoria_id,
        precio_compra: Number(precio_compra),
        precio_venta: Number(precio_venta),
        tipo_medida,
        stock_actual,
        stock_minimo,
        activo: activo ?? true,
      },
      { transaction }
    );

    // Registrar movimiento de inventario inicial si hay stock
    if (stock_actual > 0) {
      await movimientos_inventario.create(
        {
          producto_id: nuevoProducto.id,
          tipo_movimiento: "entrada",
          cantidad: stock_actual,
          stock_anterior: 0,
          stock_nuevo: stock_actual,
          referencia_tipo: "ajuste",
          usuario_id: req.user.id,
          observaciones: "Stock inicial",
        },
        { transaction }
      );
    }

    await transaction.commit();

    res.status(201).json({
      success: true,
      message: `${nombre.trim()} fue creado con éxito`,
      data: { id: nuevoProducto.id },
    });
  } catch (error) {
    await transaction.rollback();
    console.error("Error creando producto:", error);
    res.status(500).json({
      success: false,
      error: "Error creando producto",
      message: error.message,
    });
  }
};

// Actualizar producto
const actualizarProducto = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const { id } = req.params;
    const fieldsToUpdate = { ...req.body }; // Joi ya validó los campos

    // Verificar si el producto existe
    const producto = await productos.findByPk(id, { transaction });
    if (!producto) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        error: `No se encontró un producto con el id: ${id}`,
      });
    }

    // VALIDACIONES DE BASE DE DATOS

    // Verificar nombre único (si cambió)
    if (fieldsToUpdate.nombre && fieldsToUpdate.nombre !== producto.nombre) {
      const existingByName = await productos.findOne({
        where: {
          nombre: { [sequelize.Op.like]: fieldsToUpdate.nombre.trim() },
          id: { [sequelize.Op.ne]: id },
        },
        transaction,
      });

      if (existingByName) {
        await transaction.rollback();
        return res.status(400).json({
          success: false,
          error: `Ya existe un producto llamado "${fieldsToUpdate.nombre.trim()}"`,
        });
      }
    }

    // Verificar código único (si cambió)
    if (fieldsToUpdate.codigo_barras !== undefined) {
      const trimmedCode = fieldsToUpdate.codigo_barras?.trim() || null;
      if (trimmedCode && trimmedCode !== producto.codigo_barras) {
        const duplicated = await productos.findOne({
          where: {
            codigo_barras: trimmedCode,
            id: { [sequelize.Op.ne]: id },
          },
          transaction,
        });

        if (duplicated) {
          await transaction.rollback();
          return res.status(400).json({
            success: false,
            error: `El código de barras "${trimmedCode}" ya existe`,
          });
        }
      }
    }

    // Verificar categoría existe (si cambió)
    if (
      fieldsToUpdate.categoria_id &&
      fieldsToUpdate.categoria_id !== producto.categoria_id
    ) {
      const categoria = await categorias.findByPk(fieldsToUpdate.categoria_id, {
        transaction,
      });
      if (!categoria) {
        await transaction.rollback();
        return res.status(400).json({
          success: false,
          error: "La categoría especificada no existe",
        });
      }
    }

    // Limpiar campos para actualización
    if (fieldsToUpdate.nombre)
      fieldsToUpdate.nombre = fieldsToUpdate.nombre.trim();
    if (fieldsToUpdate.descripcion !== undefined)
      fieldsToUpdate.descripcion = fieldsToUpdate.descripcion?.trim() || null;
    if (fieldsToUpdate.codigo_barras !== undefined)
      fieldsToUpdate.codigo_barras =
        fieldsToUpdate.codigo_barras?.trim() || null;

    // Actualizar el producto
    await producto.update(fieldsToUpdate, { transaction });

    await transaction.commit();

    res.json({
      success: true,
      message: `${
        fieldsToUpdate.nombre || producto.nombre
      } fue actualizado con éxito`,
    });
  } catch (error) {
    await transaction.rollback();
    console.error("Error actualizando producto:", error);
    res.status(500).json({
      success: false,
      error: "Error actualizando producto",
      message: error.message,
    });
  }
};

// Eliminar producto (desactivar)
const eliminarProducto = async (req, res) => {
  try {
    const { id } = req.params;

    const producto = await productos.findByPk(id);
    if (!producto) {
      return res.status(404).json({
        success: false,
        error: "Producto no encontrado",
      });
    }

    await producto.update({ activo: false });

    res.json({
      success: true,
      message: "Producto desactivado exitosamente",
    });
  } catch (error) {
    console.error("Error eliminando producto:", error);
    res.status(500).json({
      success: false,
      error: "Error eliminando producto",
      message: error.message,
    });
  }
};

// Actualizar stock de producto
const actualizarStock = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const { id } = req.params;
    const {
      cantidad,
      tipo_movimiento,
      observaciones,
      referencia_id,
      referencia_tipo,
    } = req.body;

    // Verificar si el producto existe
    const producto = await productos.findByPk(id, { transaction });
    if (!producto) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        error: "Producto no encontrado",
      });
    }

    const stockAnterior = parseFloat(producto.stock_actual);
    let nuevoStock;

    // Calcular nuevo stock según tipo de movimiento
    switch (tipo_movimiento) {
      case "entrada":
        nuevoStock = stockAnterior + parseFloat(cantidad);
        break;
      case "salida":
        nuevoStock = stockAnterior - parseFloat(cantidad);
        // VALIDACIÓN DE NEGOCIO: Stock insuficiente
        if (nuevoStock < 0) {
          await transaction.rollback();
          return res.status(400).json({
            success: false,
            error: "Stock insuficiente para realizar la operación",
          });
        }
        break;
      case "ajuste":
        nuevoStock = parseFloat(cantidad);
        break;
    }

    // Actualizar stock del producto
    await producto.update({ stock_actual: nuevoStock }, { transaction });

    // Crear movimiento de inventario
    await movimientos_inventario.create(
      {
        producto_id: id,
        tipo_movimiento,
        cantidad: parseFloat(cantidad),
        stock_anterior: stockAnterior,
        stock_nuevo: nuevoStock,
        referencia_tipo,
        referencia_id,
        usuario_id: req.user.id,
        observaciones,
      },
      { transaction }
    );

    await transaction.commit();

    res.json({
      success: true,
      message: "Stock actualizado exitosamente",
      data: {
        stock_anterior: stockAnterior,
        stock_nuevo: nuevoStock,
        movimiento: parseFloat(cantidad),
      },
    });
  } catch (error) {
    await transaction.rollback();
    console.error("Error actualizando stock:", error);
    res.status(500).json({
      success: false,
      error: "Error actualizando stock",
      message: error.message,
    });
  }
};

export {
  obtenerProductos,
  obtenerProductoPorId,
  obtenerProductoPorCodigoBarras,
  obtenerProductosStockBajo,
  crearProducto,
  actualizarProducto,
  eliminarProducto,
  actualizarStock,
};
