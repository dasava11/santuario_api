import { sequelize } from "../config/database.js";
import initModels from "../models/init-models.js";
import { Op, fn, col } from "sequelize";

// Inicializar modelos
const models = initModels(sequelize);
const { ventas, detalle_ventas, usuarios, productos, movimientos_inventario } =
  models;

// Obtener todas las ventas con filtros y paginación
const obtenerVentas = async (req, res) => {
  try {
    const {
      fecha_inicio = "2000-01-01",
      fecha_fin = "2100-12-31",
      usuario_id,
      metodo_pago,
      page = 1,
      limit = 20,
    } = req.query;

    // Construir filtros dinámicos
    const where = {
      fecha_venta: {
        [Op.between]: [fecha_inicio, fecha_fin],
      },
    };

    if (usuario_id) {
      where.usuario_id = usuario_id;
    }

    if (metodo_pago) {
      where.metodo_pago = metodo_pago;
    }

    // Configurar paginación
    const offset = (page - 1) * limit;

    const { count, rows: ventasData } = await ventas.findAndCountAll({
      where,
      include: [
        {
          model: usuarios,
          as: "usuario",
          attributes: ["id", "nombre", "apellido"],
        },
      ],
      order: [["fecha_venta", "DESC"]],
      limit: parseInt(limit),
      offset: parseInt(offset),
      distinct: true,
    });

    res.json({
      success: true,
      data: {
        ventas: ventasData,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: count,
          pages: Math.ceil(count / limit),
        },
      },
    });
  } catch (error) {
    console.error("Error obteniendo ventas:", error);
    res.status(500).json({
      success: false,
      error: "Error obteniendo ventas",
      message: error.message,
    });
  }
};

// Obtener venta por ID con detalles
const obtenerVentaPorId = async (req, res) => {
  try {
    const { id } = req.params;

    const venta = await ventas.findOne({
      where: { id },
      include: [
        {
          model: usuarios,
          as: "usuario",
          attributes: ["id", "nombre", "apellido"],
        },
        {
          model: detalle_ventas,
          as: "detalle_venta",
          include: [
            {
              model: productos,
              as: "producto",
              attributes: ["id", "nombre", "codigo_barras", "descripcion"],
            },
          ],
        },
      ],
    });

    if (!venta) {
      return res.status(404).json({
        success: false,
        error: "Venta no encontrada",
      });
    }

    res.json({
      success: true,
      data: venta,
    });
  } catch (error) {
    console.error("Error obteniendo venta:", error);
    res.status(500).json({
      success: false,
      error: "Error obteniendo venta",
      message: error.message,
    });
  }
};

// Crear nueva venta
const crearVenta = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const { productos: productosVenta, metodo_pago } = req.body;
    const usuario_id = req.user.id;

    // Validar productos y stock
    let total = 0;
    const productosValidados = [];

    for (const item of productosVenta) {
      const producto = await productos.findOne({
        where: {
          id: item.producto_id,
          activo: true,
        },
        transaction,
      });

      if (!producto) {
        await transaction.rollback();
        return res.status(400).json({
          success: false,
          error: `Producto con ID ${item.producto_id} no encontrado o inactivo`,
        });
      }

      const stockActual = parseFloat(producto.stock_actual) || 0;
      const cantidadRequerida = parseFloat(item.cantidad);

      if (stockActual < cantidadRequerida) {
        await transaction.rollback();
        return res.status(400).json({
          success: false,
          error: `Stock insuficiente para ${producto.nombre}. Stock actual: ${stockActual}, requerido: ${cantidadRequerida}`,
        });
      }

      const precioUnitario = parseFloat(
        item.precio_unitario || producto.precio_venta
      );
      const subtotal = parseFloat(
        (cantidadRequerida * precioUnitario).toFixed(2)
      );
      total += subtotal;

      productosValidados.push({
        ...item,
        producto,
        precio_unitario: precioUnitario,
        subtotal,
        stock_actual: stockActual,
      });
    }

    // Generar número de venta único
    const fecha = new Date();
    const numeroVenta = `V${fecha.getFullYear()}${String(
      fecha.getMonth() + 1
    ).padStart(2, "0")}${String(fecha.getDate()).padStart(
      2,
      "0"
    )}-${Date.now()}`;

    // Crear la venta
    const nuevaVenta = await ventas.create(
      {
        numero_venta: numeroVenta,
        usuario_id,
        total: parseFloat(total.toFixed(2)),
        metodo_pago: metodo_pago || "efectivo",
      },
      { transaction }
    );

    // Crear detalles de la venta y actualizar stock
    for (const item of productosValidados) {
      // Crear detalle de venta
      await detalle_ventas.create(
        {
          venta_id: nuevaVenta.id,
          producto_id: item.producto_id,
          cantidad: parseFloat(item.cantidad),
          precio_unitario: item.precio_unitario,
          subtotal: item.subtotal,
        },
        { transaction }
      );

      // Calcular nuevo stock
      const nuevoStock = parseFloat(
        (item.stock_actual - parseFloat(item.cantidad)).toFixed(3)
      );

      // Actualizar stock del producto
      await productos.update(
        {
          stock_actual: nuevoStock,
        },
        {
          where: { id: item.producto_id },
          transaction,
        }
      );

      // Registrar movimiento de inventario
      await movimientos_inventario.create(
        {
          producto_id: item.producto_id,
          tipo_movimiento: "salida",
          cantidad: parseFloat(item.cantidad),
          stock_anterior: item.stock_actual,
          stock_nuevo: nuevoStock,
          referencia_id: nuevaVenta.id,
          referencia_tipo: "venta",
          usuario_id,
          observaciones: `Venta ${numeroVenta}`,
        },
        { transaction }
      );
    }

    await transaction.commit();

    res.status(201).json({
      success: true,
      message: "Venta registrada exitosamente",
      data: {
        id: nuevaVenta.id,
        numero_venta: numeroVenta,
        total: nuevaVenta.total,
      },
    });
  } catch (error) {
    await transaction.rollback();
    console.error("Error creando venta:", error);
    res.status(500).json({
      success: false,
      error: "Error registrando venta",
      message: error.message,
    });
  }
};

// Eliminar venta (anulación con reversión de stock)
const eliminarVenta = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const { id } = req.params;

    // Buscar la venta con sus detalles
    const venta = await ventas.findOne({
      where: { id },
      include: [
        {
          model: detalle_ventas,
          as: "detalle_venta",
          include: [
            {
              model: productos,
              as: "producto",
              attributes: ["id", "nombre", "stock_actual"],
            },
          ],
        },
      ],
      transaction,
    });

    if (!venta) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        error: "Venta no encontrada",
      });
    }

    // Validar que la venta se pueda anular (ejemplo: máximo 24 horas)
    const fechaVenta = new Date(venta.fecha_venta);
    const ahora = new Date();
    const horasTranscurridas = (ahora - fechaVenta) / (1000 * 60 * 60);

    if (horasTranscurridas > 24) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        error: "No se puede anular una venta con más de 24 horas de antigüedad",
      });
    }

    // Revertir stock de todos los productos
    for (const detalle of venta.detalle_venta) {
      const producto = detalle.producto;
      const cantidadADevolver = parseFloat(detalle.cantidad);
      const stockActual = parseFloat(producto.stock_actual);
      const nuevoStock = parseFloat(
        (stockActual + cantidadADevolver).toFixed(3)
      );

      // Actualizar stock del producto
      await productos.update(
        {
          stock_actual: nuevoStock,
        },
        {
          where: { id: producto.id },
          transaction,
        }
      );

      // Registrar movimiento de inventario de reversión
      await movimientos_inventario.create(
        {
          producto_id: producto.id,
          tipo_movimiento: "entrada",
          cantidad: cantidadADevolver,
          stock_anterior: stockActual,
          stock_nuevo: nuevoStock,
          referencia_id: venta.id,
          referencia_tipo: "venta",
          usuario_id: req.user.id,
          observaciones: `Anulación de venta ${venta.numero_venta}`,
        },
        { transaction }
      );
    }

    // Marcar la venta como anulada (agregar campo anulada si no existe)
    // Por ahora eliminamos directamente los registros

    // Eliminar detalles de venta
    await detalle_ventas.destroy({
      where: { venta_id: id },
      transaction,
    });

    // Eliminar la venta
    await ventas.destroy({
      where: { id },
      transaction,
    });

    await transaction.commit();

    res.json({
      success: true,
      message: `Venta ${venta.numero_venta} anulada exitosamente y stock revertido`,
    });
  } catch (error) {
    await transaction.rollback();
    console.error("Error eliminando venta:", error);
    res.status(500).json({
      success: false,
      error: "Error anulando venta",
      message: error.message,
    });
  }
};

// Obtener resumen de ventas
const obtenerResumenVentas = async (req, res) => {
  try {
    const { fecha_inicio, fecha_fin } = req.query;

    const fechaFinal = fecha_fin || fecha_inicio;

    // Total de ventas del período
    const totalVentas = await ventas.findOne({
      where: {
        fecha_venta: {
          [Op.between]: [fecha_inicio, fechaFinal],
        },
      },
      attributes: [
        [fn("COUNT", col("id")), "cantidad_ventas"],
        [fn("COALESCE", fn("SUM", col("total")), 0), "total_ventas"],
      ],
      raw: true,
    });

    // Ventas por método de pago
    const ventasPorMetodo = await ventas.findAll({
      where: {
        fecha_venta: {
          [Op.between]: [fecha_inicio, fechaFinal],
        },
      },
      attributes: [
        "metodo_pago",
        [fn("COUNT", col("id")), "cantidad"],
        [fn("COALESCE", fn("SUM", col("total")), 0), "total"],
      ],
      group: ["metodo_pago"],
      raw: true,
    });

    // Productos más vendidos
    const productosMasVendidos = await detalle_ventas.findAll({
      include: [
        {
          model: ventas,
          as: "ventum",
          where: {
            fecha_venta: {
              [Op.between]: [fecha_inicio, fechaFinal],
            },
          },
          attributes: [],
        },
        {
          model: productos,
          as: "producto",
          attributes: ["nombre"],
        },
      ],
      attributes: [
        [fn("SUM", col("cantidad")), "cantidad_vendida"],
        [fn("SUM", col("subtotal")), "total_vendido"],
      ],
      group: ["producto_id", "producto.nombre"],
      order: [[fn("SUM", col("cantidad")), "DESC"]],
      limit: 10,
      raw: true,
    });

    res.json({
      success: true,
      data: {
        fecha_inicio,
        fecha_fin: fechaFinal,
        total_ventas: totalVentas,
        ventas_por_metodo: ventasPorMetodo,
        productos_mas_vendidos: productosMasVendidos,
      },
    });
  } catch (error) {
    console.error("Error obteniendo resumen de ventas:", error);
    res.status(500).json({
      success: false,
      error: "Error obteniendo resumen de ventas",
      message: error.message,
    });
  }
};

export {
  obtenerVentas,
  obtenerVentaPorId,
  crearVenta,
  eliminarVenta,
  obtenerResumenVentas,
};
