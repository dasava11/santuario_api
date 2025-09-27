import { sequelize } from "../config/database.js";
import initModels from "../models/init-models.js";
import { Op } from "sequelize";

// Inicializar modelos
const models = initModels(sequelize);
const {
  recepciones,
  detalle_recepciones,
  proveedores,
  usuarios,
  productos,
  movimientos_inventario,
} = models;

// Obtener todas las recepciones
const obtenerRecepciones = async (req, res) => {
  try {
    const {
      fecha_inicio,
      fecha_fin,
      proveedor_id,
      estado = "all",
      page = 1,
      limit = 20,
    } = req.query;

    // Construir filtros dinámicos
    const where = {};

    if (fecha_inicio && fecha_fin) {
      where.fecha_recepcion = {
        [Op.between]: [fecha_inicio, fecha_fin],
      };
    }

    if (proveedor_id) {
      where.proveedor_id = proveedor_id;
    }

    if (estado !== "all") {
      where.estado = estado;
    }

    // Configurar paginación
    const offset = (page - 1) * limit;

    const { count, rows } = await recepciones.findAndCountAll({
      where,
      include: [
        {
          model: proveedores,
          as: "proveedor",
          attributes: ["id", "nombre", "telefono", "email"],
        },
        {
          model: usuarios,
          as: "usuario",
          attributes: ["id", "nombre", "apellido"],
        },
      ],
      order: [
        ["fecha_recepcion", "DESC"],
        ["fecha_creacion", "DESC"],
      ],
      limit: parseInt(limit),
      offset: parseInt(offset),
    });

    res.json({
      success: true,
      data: rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: count,
        pages: Math.ceil(count / limit),
      },
    });
  } catch (error) {
    console.error("Error obteniendo recepciones:", error);
    res.status(500).json({
      success: false,
      error: "Error obteniendo recepciones",
      message: error.message,
    });
  }
};

// Obtener recepción por ID con detalles
const obtenerRecepcionPorId = async (req, res) => {
  try {
    const { id } = req.params;

    const recepcion = await recepciones.findByPk(id, {
      include: [
        {
          model: proveedores,
          as: "proveedor",
          attributes: ["id", "nombre", "telefono", "email"],
        },
        {
          model: usuarios,
          as: "usuario",
          attributes: ["id", "nombre", "apellido"],
        },
        {
          model: detalle_recepciones,
          as: "detalle_recepciones",
          include: [
            {
              model: productos,
              as: "producto",
              attributes: ["id", "name", "code", "brand"],
            },
          ],
        },
      ],
    });

    if (!recepcion) {
      return res.status(404).json({
        success: false,
        error: "Recepción no encontrada",
      });
    }

    res.json({
      success: true,
      data: recepcion,
    });
  } catch (error) {
    console.error("Error obteniendo recepción:", error);
    res.status(500).json({
      success: false,
      error: "Error obteniendo recepción",
      message: error.message,
    });
  }
};

// Crear nueva recepción
const crearRecepcion = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const {
      numero_factura,
      proveedor_id,
      fecha_recepcion,
      observaciones,
      productos: productosRecepcion,
    } = req.body;

    const usuario_id = req.user.id;

    // VALIDACIONES DE BASE DE DATOS

    // Verificar que el proveedor existe y está activo
    const proveedor = await proveedores.findOne({
      where: {
        id: proveedor_id,
        activo: true,
      },
      transaction,
    });

    if (!proveedor) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        error: "Proveedor no encontrado o inactivo",
      });
    }

    // Verificar que no existe una factura con el mismo número del mismo proveedor
    const facturaExistente = await recepciones.findOne({
      where: {
        numero_factura: numero_factura.trim(),
        proveedor_id,
      },
      transaction,
    });

    if (facturaExistente) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        error:
          "Ya existe una recepción con este número de factura para este proveedor",
      });
    }

    // Validar productos y calcular total
    let total = 0;
    const productosValidados = [];

    for (const item of productosRecepcion) {
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

      const subtotal = parseFloat(
        (item.cantidad * item.precio_unitario).toFixed(2)
      );
      total += subtotal;

      productosValidados.push({
        ...item,
        producto,
        subtotal,
      });
    }

    // Crear la recepción
    const nuevaRecepcion = await recepciones.create(
      {
        numero_factura: numero_factura.trim(),
        proveedor_id,
        usuario_id,
        fecha_recepcion,
        total: parseFloat(total.toFixed(2)),
        observaciones: observaciones?.trim() || null,
        estado: "pendiente",
      },
      { transaction }
    );

    // Crear detalles de la recepción
    const detallesData = productosValidados.map((item) => ({
      recepcion_id: nuevaRecepcion.id,
      producto_id: item.producto_id,
      cantidad: item.cantidad,
      precio_unitario: item.precio_unitario,
      subtotal: item.subtotal,
    }));

    await detalle_recepciones.bulkCreate(detallesData, { transaction });

    await transaction.commit();

    res.status(201).json({
      success: true,
      message: "Recepción creada exitosamente",
      data: {
        id: nuevaRecepcion.id,
        numero_factura: nuevaRecepcion.numero_factura,
        total: nuevaRecepcion.total,
      },
    });
  } catch (error) {
    await transaction.rollback();
    console.error("Error creando recepción:", error);
    res.status(500).json({
      success: false,
      error: "Error creando recepción",
      message: error.message,
    });
  }
};

// Procesar recepción (actualizar inventario)
const procesarRecepcion = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const { id } = req.params;

    // Verificar que la recepción existe y está pendiente
    const recepcion = await recepciones.findOne({
      where: {
        id,
        estado: "pendiente",
      },
      transaction,
    });

    if (!recepcion) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        error: "Recepción no encontrada o ya procesada",
      });
    }

    // Obtener detalles de la recepción
    const detalles = await detalle_recepciones.findAll({
      where: { recepcion_id: id },
      include: [
        {
          model: productos,
          as: "producto",
          attributes: ["id", "stock_actual", "precio_compra"],
        },
      ],
      transaction,
    });

    // Procesar cada detalle
    for (const detalle of detalles) {
      const producto = detalle.producto;
      const cantidad = parseFloat(detalle.cantidad);
      const stockAnterior = parseFloat(producto.stock) || 0;
      const nuevoStock = parseFloat((stockAnterior + cantidad).toFixed(4));

      // Actualizar stock del producto
      await productos.update(
        {
          stock: nuevoStock,
          buy_price: detalle.precio_unitario,
        },
        {
          where: { id: detalle.producto_id },
          transaction,
        }
      );

      // Registrar movimiento de inventario
      await movimientos_inventario.create(
        {
          producto_id: detalle.producto_id,
          tipo_movimiento: "entrada",
          cantidad: detalle.cantidad,
          stock_anterior: stockAnterior,
          stock_nuevo: nuevoStock,
          referencia_id: id,
          referencia_tipo: "recepcion",
          usuario_id: req.user.id,
          observaciones: `Recepción ${recepcion.numero_factura}`,
        },
        { transaction }
      );
    }

    // Actualizar estado de la recepción
    await recepcion.update({ estado: "procesada" }, { transaction });

    await transaction.commit();

    res.json({
      success: true,
      message: "Recepción procesada exitosamente",
    });
  } catch (error) {
    await transaction.rollback();
    console.error("Error procesando recepción:", error);
    res.status(500).json({
      success: false,
      error: "Error procesando recepción",
      message: error.message,
    });
  }
};

// Cancelar recepción
const cancelarRecepcion = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const { id } = req.params;

    // Verificar que la recepción existe y está pendiente
    const recepcion = await recepciones.findOne({
      where: {
        id,
        estado: "pendiente",
      },
      transaction,
    });

    if (!recepcion) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        error: "Recepción no encontrada o ya procesada",
      });
    }

    await recepcion.update({ estado: "cancelada" }, { transaction });

    await transaction.commit();

    res.json({
      success: true,
      message: "Recepción cancelada exitosamente",
    });
  } catch (error) {
    await transaction.rollback();
    console.error("Error cancelando recepción:", error);
    res.status(500).json({
      success: false,
      error: "Error cancelando recepción",
      message: error.message,
    });
  }
};

export {
  obtenerRecepciones,
  obtenerRecepcionPorId,
  crearRecepcion,
  procesarRecepcion,
  cancelarRecepcion,
};
