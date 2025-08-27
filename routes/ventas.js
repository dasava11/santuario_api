const express = require('express');
const { executeQuery, executeTransaction } = require('../config/database');
const { verifyToken } = require('../middleware/auth');
const { validate, schemas } = require('../middleware/validation');

const router = express.Router();

// Obtener todas las ventas
router.get('/', verifyToken, async (req, res) => {
  try {
    const fechaInicio = req.query.fecha_inicio || '2000-01-01';
    const fechaFin = req.query.fecha_fin || '2100-12-31';
    const usuario_id = req.query.usuario_id;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;

    let sql = `
      SELECT v.*, u.nombre as vendedor_nombre, u.apellido as vendedor_apellido
      FROM ventas v
      INNER JOIN usuarios u ON v.usuario_id = u.id
      WHERE DATE(v.fecha_venta) BETWEEN ? AND ?
    `;
    const params = [fechaInicio, fechaFin];

    if (usuario_id) {
      sql += ' AND v.usuario_id = ?';
      params.push(usuario_id);
    }

    sql += ` ORDER BY v.fecha_venta DESC LIMIT ${limit} OFFSET ${offset}`;



    const ventas = await executeQuery(sql, params);

    // Obtener total para paginación
    let countSql = 'SELECT COUNT(*) as total FROM ventas v WHERE DATE(v.fecha_venta) BETWEEN ? AND ?';
    const countParams = [fechaInicio, fechaFin];


    if (usuario_id) {
      countSql += ' AND v.usuario_id = ?';
      countParams.push(usuario_id);
    }

    const [countResult] = await executeQuery(countSql, countParams);
    const total = countResult.total;

    res.json({
      ventas,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    console.error('Error obteniendo ventas:', error);
    res.status(500).json({
      error: 'Error obteniendo ventas'
    });
  }
});

// Obtener venta por ID con detalles
router.get('/:id', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;

    // Obtener venta
    const ventas = await executeQuery(
      `SELECT v.*, u.nombre as vendedor_nombre, u.apellido as vendedor_apellido
       FROM ventas v
       INNER JOIN usuarios u ON v.usuario_id = u.id
       WHERE v.id = ?`,
      [id]
    );

    if (ventas.length === 0) {
      return res.status(404).json({
        error: 'Venta no encontrada'
      });
    }

    // Obtener detalles
    const detalles = await executeQuery(
      `SELECT dv.*, p.nombre as producto_nombre, p.codigo_barras, p.tipo_medida
       FROM detalle_ventas dv
       INNER JOIN productos p ON dv.producto_id = p.id
       WHERE dv.venta_id = ?
       ORDER BY p.nombre`,
      [id]
    );

    const venta = ventas[0];
    venta.detalles = detalles;

    res.json(venta);

  } catch (error) {
    console.error('Error obteniendo venta:', error);
    res.status(500).json({
      error: 'Error obteniendo venta'
    });
  }
});

// Crear nueva venta
router.post('/', verifyToken, validate(schemas.venta), async (req, res) => {
  try {
    const { productos, metodo_pago } = req.body;
    const usuario_id = req.user.id;

    // Validar productos y stock
    let total = 0;
    const productosValidados = [];

    for (const item of productos) {
      const [producto] = await executeQuery(
        'SELECT * FROM productos WHERE id = ? AND activo = true',
        [item.producto_id]
      );

      if (!producto) {
        return res.status(400).json({
          error: `Producto con ID ${item.producto_id} no encontrado o inactivo`
        });
      }

      if (producto.stock_actual < item.cantidad) {
        return res.status(400).json({
          error: `Stock insuficiente para ${producto.nombre}. Stock actual: ${producto.stock_actual}, requerido: ${item.cantidad}`
        });
      }

      const subtotal = item.cantidad * item.precio_unitario;
      total += subtotal;

      productosValidados.push({
        ...item,
        producto,
        subtotal
      });
    }

    // Generar número de venta
    const fecha = new Date();
    const numeroVenta = `V${fecha.getFullYear()}${String(fecha.getMonth() + 1).padStart(2, '0')}${String(fecha.getDate()).padStart(2, '0')}-${Date.now()}`;

    // Preparar transacciones
    const queries = [];

    // Insertar venta
    queries.push({
      sql: 'INSERT INTO ventas (numero_venta, usuario_id, total, metodo_pago) VALUES (?, ?, ?, ?)',
      params: [numeroVenta, usuario_id, total, metodo_pago]
    });

    // Ejecutar la primera parte para obtener el ID de la venta
    const resultVenta = await executeQuery(
      'INSERT INTO ventas (numero_venta, usuario_id, total, metodo_pago) VALUES (?, ?, ?, ?)',
      [numeroVenta, usuario_id, total, metodo_pago]
    );

    const ventaId = resultVenta.insertId;

    // Preparar queries para detalles y movimientos
    const queryDetalles = [];

    for (const item of productosValidados) {
      // Detalle de venta
      queryDetalles.push({
        sql: 'INSERT INTO detalle_ventas (venta_id, producto_id, cantidad, precio_unitario, subtotal) VALUES (?, ?, ?, ?, ?)',
        params: [ventaId, item.producto_id, item.cantidad, item.precio_unitario, item.subtotal]
      });

      // Actualizar stock
      const nuevoStock = item.producto.stock_actual - item.cantidad;
      queryDetalles.push({
        sql: 'UPDATE productos SET stock_actual = ? WHERE id = ?',
        params: [nuevoStock, item.producto_id]
      });

      // Movimiento de inventario
      queryDetalles.push({
        sql: `INSERT INTO movimientos_inventario 
              (producto_id, tipo_movimiento, cantidad, stock_anterior, stock_nuevo, referencia_id, referencia_tipo, usuario_id, observaciones) 
              VALUES (?, 'salida', ?, ?, ?, ?, 'venta', ?, ?)`,
        params: [
          item.producto_id,
          item.cantidad,
          item.producto.stock_actual,
          nuevoStock,
          ventaId,
          usuario_id,
          `Venta ${numeroVenta}`
        ]
      });
    }

    // Ejecutar todas las queries de detalles
    await executeTransaction(queryDetalles);

    res.status(201).json({
      message: 'Venta registrada exitosamente',
      venta_id: ventaId,
      numero_venta: numeroVenta,
      total
    });

  } catch (error) {
    console.error('Error creando venta:', error);
    res.status(500).json({
      error: 'Error registrando venta'
    });
  }
});

// Obtener resumen de ventas del día
router.get('/resumen/dia', verifyToken, async (req, res) => {
  try {
    const fechaInicio = req.query.fecha_inicio || new Date().toISOString().split('T')[0];
    const fechaFin = req.query.fecha_fin || fechaInicio;

    // Total de ventas del día
    const [totalVentas] = await executeQuery(
      `SELECT COUNT(*) as cantidad_ventas, COALESCE(SUM(total), 0) as total_ventas
       FROM ventas 
       WHERE DATE(fecha_venta)  BETWEEN ? AND ?`,
      [fechaInicio, fechaFin]
    );

    // Ventas por método de pago
    const ventasPorMetodo = await executeQuery(
      `SELECT metodo_pago, COUNT(*) as cantidad, COALESCE(SUM(total), 0) as total
       FROM ventas 
       WHERE DATE(fecha_venta) BETWEEN ? AND ?
       GROUP BY metodo_pago`,
      [fechaInicio, fechaFin]
    );

    // Productos más vendidos
    const productosMasVendidos = await executeQuery(
      `SELECT p.nombre, SUM(dv.cantidad) as cantidad_vendida, SUM(dv.subtotal) as total_vendido
       FROM detalle_ventas dv
       INNER JOIN ventas v ON dv.venta_id = v.id
       INNER JOIN productos p ON dv.producto_id = p.id
       WHERE DATE(v.fecha_venta)  BETWEEN ? AND ?
       GROUP BY dv.producto_id, p.nombre
       ORDER BY cantidad_vendida DESC
       LIMIT 10`,
      [fechaInicio, fechaFin]
    );

    res.json({
      fechaInicio,
      fechaFin,
      total_ventas: totalVentas,
      ventas_por_metodo: ventasPorMetodo,
      productos_mas_vendidos: productosMasVendidos
    });

  } catch (error) {
    console.error('Error obteniendo resumen de ventas:', error);
    res.status(500).json({
      error: 'Error obteniendo resumen de ventas'
    });
  }
});

module.exports = router;