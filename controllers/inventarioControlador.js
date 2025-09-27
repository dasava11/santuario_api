import { sequelize } from "../config/database.js";
import db from "../models/index.js";

const { movimientos_inventario, productos, categorias, usuarios } = db;

// Obtener movimientos de inventario con filtros y paginación
const obtenerMovimientos = async (req, res) => {
  try {
    const {
      producto_id,
      tipo_movimiento,
      fecha_inicio,
      fecha_fin,
      page,
      limit,
    } = req.query;

    // Construir filtros dinámicos
    const where = {};

    if (producto_id) {
      where.producto_id = producto_id;
    }

    if (tipo_movimiento) {
      where.tipo_movimiento = tipo_movimiento;
    }

    // Filtro de fecha
    if (fecha_inicio && fecha_fin) {
      where.fecha_movimiento = {
        [sequelize.Op.between]: [
          new Date(fecha_inicio + " 00:00:00"),
          new Date(fecha_fin + " 23:59:59"),
        ],
      };
    }

    // Calcular offset para paginación
    const offset = (page - 1) * limit;

    // Consulta con paginación e incluir datos relacionados
    const { count, rows: movimientos } =
      await movimientos_inventario.findAndCountAll({
        where,
        include: [
          {
            model: productos,
            as: "producto",
            attributes: ["id", "nombre", "codigo_barras"],
          },
          {
            model: usuarios,
            as: "usuario",
            attributes: ["id", "nombre", "apellido"],
          },
        ],
        limit: parseInt(limit),
        offset: parseInt(offset),
        order: [["fecha_movimiento", "DESC"]],
        distinct: true,
      });

    res.json({
      success: true,
      data: {
        movimientos,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: count,
          pages: Math.ceil(count / limit),
        },
      },
    });
  } catch (error) {
    console.error("Error obteniendo movimientos:", error);
    res.status(500).json({
      success: false,
      error: "Error obteniendo movimientos de inventario",
      message: error.message,
    });
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
      order: [
        [sequelize.literal("(stock_actual - stock_minimo)"), "ASC"],
        ["nombre", "ASC"],
      ],
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

// Obtener resumen general del inventario
const obtenerResumenInventario = async (req, res) => {
  try {
    // Total de productos activos
    const totalProductos = await productos.count({
      where: { activo: true },
    });

    // Productos con stock bajo
    const productosStockBajo = await productos.count({
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
    });

    // Productos sin stock
    const productosSinStock = await productos.count({
      where: {
        activo: true,
        stock_actual: { [sequelize.Op.lte]: 0 },
      },
    });

    // Valor total del inventario
    const valorInventario = await productos.findOne({
      attributes: [
        [
          sequelize.fn(
            "COALESCE",
            sequelize.fn(
              "SUM",
              sequelize.literal("stock_actual * precio_compra")
            ),
            0
          ),
          "valor_compra",
        ],
        [
          sequelize.fn(
            "COALESCE",
            sequelize.fn(
              "SUM",
              sequelize.literal("stock_actual * precio_venta")
            ),
            0
          ),
          "valor_venta",
        ],
      ],
      where: { activo: true },
      raw: true,
    });

    // Categorías con más productos
    const categoriasResumen = await categorias.findAll({
      attributes: [
        "id",
        "nombre",
        [
          sequelize.fn("COUNT", sequelize.col("productos.id")),
          "total_productos",
        ],
        [
          sequelize.fn(
            "COALESCE",
            sequelize.fn("SUM", sequelize.col("productos.stock_actual")),
            0
          ),
          "total_stock",
        ],
      ],
      include: [
        {
          model: productos,
          as: "productos",
          where: { activo: true },
          attributes: [],
          required: false,
        },
      ],
      where: { activo: true },
      group: ["categorias.id", "categorias.nombre"],
      order: [[sequelize.literal("total_productos"), "DESC"]],
      limit: 10,
      raw: true,
    });

    // Movimientos recientes (últimos 7 días)
    const fechaInicio = new Date();
    fechaInicio.setDate(fechaInicio.getDate() - 7);

    const movimientosRecientes = await movimientos_inventario.findAll({
      attributes: [
        "tipo_movimiento",
        [sequelize.fn("COUNT", "*"), "cantidad"],
        [sequelize.fn("DATE", sequelize.col("fecha_movimiento")), "fecha"],
      ],
      where: {
        fecha_movimiento: {
          [sequelize.Op.gte]: fechaInicio,
        },
      },
      group: [
        "tipo_movimiento",
        sequelize.fn("DATE", sequelize.col("fecha_movimiento")),
      ],
      order: [
        [sequelize.fn("DATE", sequelize.col("fecha_movimiento")), "DESC"],
        ["tipo_movimiento", "ASC"],
      ],
      raw: true,
    });

    res.json({
      success: true,
      data: {
        total_productos: totalProductos,
        productos_stock_bajo: productosStockBajo,
        productos_sin_stock: productosSinStock,
        valor_inventario: valorInventario,
        categorias_resumen: categoriasResumen,
        movimientos_recientes: movimientosRecientes,
      },
    });
  } catch (error) {
    console.error("Error obteniendo resumen de inventario:", error);
    res.status(500).json({
      success: false,
      error: "Error obteniendo resumen de inventario",
      message: error.message,
    });
  }
};

// Ajustar inventario
const ajustarInventario = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const { producto_id, nuevo_stock, observaciones } = req.body;

    // Verificar si el producto existe
    const producto = await productos.findByPk(producto_id, {
      transaction,
      where: { activo: true },
    });

    if (!producto) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        error: "Producto no encontrado o inactivo",
      });
    }

    const stockAnterior = parseFloat(producto.stock_actual);
    const nuevoStockFloat = parseFloat(nuevo_stock);
    const diferencia = nuevoStockFloat - stockAnterior;

    // VALIDACIÓN DE NEGOCIO: No permitir ajuste sin cambio
    if (diferencia === 0) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        error: "El nuevo stock es igual al stock actual",
      });
    }

    // Actualizar stock del producto
    await producto.update(
      {
        stock_actual: nuevoStockFloat,
      },
      { transaction }
    );

    // Registrar movimiento de inventario
    const tipoMovimiento = diferencia > 0 ? "entrada" : "salida";
    const descripcionAjuste =
      diferencia > 0
        ? `Ajuste de inventario: Incremento de ${Math.abs(diferencia)} unidades`
        : `Ajuste de inventario: Reducción de ${Math.abs(diferencia)} unidades`;

    await movimientos_inventario.create(
      {
        producto_id: producto_id,
        tipo_movimiento: "ajuste",
        cantidad: Math.abs(diferencia),
        stock_anterior: stockAnterior,
        stock_nuevo: nuevoStockFloat,
        referencia_tipo: "ajuste",
        referencia_id: null,
        usuario_id: req.user.id,
        observaciones: observaciones || descripcionAjuste,
      },
      { transaction }
    );

    await transaction.commit();

    res.json({
      success: true,
      message: "Ajuste de inventario realizado exitosamente",
      data: {
        stock_anterior: stockAnterior,
        stock_nuevo: nuevoStockFloat,
        diferencia: diferencia,
        tipo_ajuste: diferencia > 0 ? "incremento" : "reduccion",
      },
    });
  } catch (error) {
    await transaction.rollback();
    console.error("Error ajustando inventario:", error);
    res.status(500).json({
      success: false,
      error: "Error ajustando inventario",
      message: error.message,
    });
  }
};

// Obtener reporte de movimientos por producto
const obtenerReporteMovimientosPorProducto = async (req, res) => {
  try {
    const { producto_id } = req.params;
    const { fecha_inicio, fecha_fin, limit = 100 } = req.query;

    // Validar que el producto existe
    const producto = await productos.findByPk(producto_id, {
      attributes: ["id", "nombre", "codigo_barras", "stock_actual"],
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

    // Construir filtros
    const where = { producto_id };

    if (fecha_inicio && fecha_fin) {
      where.fecha_movimiento = {
        [sequelize.Op.between]: [
          new Date(fecha_inicio + " 00:00:00"),
          new Date(fecha_fin + " 23:59:59"),
        ],
      };
    }

    // Obtener movimientos del producto
    const movimientos = await movimientos_inventario.findAll({
      where,
      include: [
        {
          model: usuarios,
          as: "usuario",
          attributes: ["id", "nombre", "apellido"],
        },
      ],
      order: [["fecha_movimiento", "DESC"]],
      limit: parseInt(limit),
    });

    // Calcular estadísticas
    const estadisticas = await movimientos_inventario.findOne({
      attributes: [
        [sequelize.fn("COUNT", "*"), "total_movimientos"],
        [
          sequelize.fn(
            "SUM",
            sequelize.literal(
              `CASE WHEN tipo_movimiento = 'entrada' THEN cantidad ELSE 0 END`
            )
          ),
          "total_entradas",
        ],
        [
          sequelize.fn(
            "SUM",
            sequelize.literal(
              `CASE WHEN tipo_movimiento = 'salida' THEN cantidad ELSE 0 END`
            )
          ),
          "total_salidas",
        ],
      ],
      where,
      raw: true,
    });

    res.json({
      success: true,
      data: {
        producto,
        movimientos,
        estadisticas,
        filtros_aplicados: {
          fecha_inicio: fecha_inicio || null,
          fecha_fin: fecha_fin || null,
          limite: parseInt(limit),
        },
      },
    });
  } catch (error) {
    console.error(
      "Error obteniendo reporte de movimientos por producto:",
      error
    );
    res.status(500).json({
      success: false,
      error: "Error obteniendo reporte de movimientos",
      message: error.message,
    });
  }
};

export {
  obtenerMovimientos,
  obtenerProductosStockBajo,
  obtenerResumenInventario,
  ajustarInventario,
  obtenerReporteMovimientosPorProducto,
};
