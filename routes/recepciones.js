const express = require('express');
const { executeQuery, executeTransaction } = require('../config/database');
const { verifyToken, verifyRole } = require('../middleware/auth');
const { validate, schemas } = require('../middleware/validation');

const router = express.Router();

// Obtener todas las recepciones
router.get('/', verifyToken, async (req, res) => {
  try {
    const {
      fecha_inicio,
      fecha_fin,
      proveedor_id,
      estado,
      page = 1,
      limit = 20
    } = req.query;
    

    let sql = `
      SELECT r.*, p.nombre as proveedor_nombre, u.nombre as usuario_nombre, u.apellido as usuario_apellido
      FROM recepciones r
      INNER JOIN proveedores p ON r.proveedor_id = p.id
      INNER JOIN usuarios u ON r.usuario_id = u.id
      WHERE 1=1
    `;
    const params = [];

    if (fecha_inicio && fecha_fin) {
      sql += ' AND r.fecha_recepcion BETWEEN ? AND ?';
      params.push(fecha_inicio, fecha_fin);
    }

    if (proveedor_id) {
      sql += ' AND r.proveedor_id = ?';
      params.push(proveedor_id);
    }

    if (estado) {
      sql += ' AND r.estado = ?';
      params.push(estado);
    }

    // Paginación
    const offset = (page - 1) * limit;
    sql += ` ORDER BY r.fecha_recepcion DESC, r.fecha_creacion DESC LIMIT ${parseInt(limit)} OFFSET ${parseInt(offset)}`;


    const recepciones = await executeQuery(sql, params);

    // Obtener total para paginación
    let countSql = 'SELECT COUNT(*) as total FROM recepciones r WHERE 1=1';
    const countParams = [];

    if (fecha_inicio && fecha_fin) {
      countSql += ' AND r.fecha_recepcion BETWEEN ? AND ?';
      countParams.push(fecha_inicio, fecha_fin);
    }

    if (proveedor_id) {
      countSql += ' AND r.proveedor_id = ?';
      countParams.push(proveedor_id);
    }

    if (estado) {
      countSql += ' AND r.estado = ?';
      countParams.push(estado);
    }

    const [countResult] = await executeQuery(countSql, countParams);
    const total = countResult.total;

    res.json({
      recepciones,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    console.error('Error obteniendo recepciones:', error);
    res.status(500).json({
      error: 'Error obteniendo recepciones'
    });
  }
});

// Obtener recepción por ID con detalles
router.get('/:id', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;

    // Obtener recepción
    const recepciones = await executeQuery(
      `SELECT r.*, p.nombre as proveedor_nombre, u.nombre as usuario_nombre, u.apellido as usuario_apellido
       FROM recepciones r
       INNER JOIN proveedores p ON r.proveedor_id = p.id
       INNER JOIN usuarios u ON r.usuario_id = u.id
       WHERE r.id = ?`,
      [id]
    );

    if (recepciones.length === 0) {
      return res.status(404).json({
        error: 'Recepción no encontrada'
      });
    }

    // Obtener detalles
    const detalles = await executeQuery(
      `SELECT dr.*, p.nombre as producto_nombre, p.codigo_barras, p.tipo_medida
       FROM detalle_recepciones dr
       INNER JOIN productos p ON dr.producto_id = p.id
       WHERE dr.recepcion_id = ?
       ORDER BY p.nombre`,
      [id]
    );

    const recepcion = recepciones[0];
    recepcion.detalles = detalles;

    res.json(recepcion);

  } catch (error) {
    console.error('Error obteniendo recepción:', error);
    res.status(500).json({
      error: 'Error obteniendo recepción'
    });
  }
});

// Crear nueva recepción
router.post('/', verifyToken, verifyRole(['administrador', 'dueño', 'ayudante']), validate(schemas.recepcion), async (req, res) => {
  try {
    const {
      numero_factura,
      proveedor_id,
      fecha_recepcion,
      observaciones,
      productos
    } = req.body;
    

    const usuario_id = req.user.id;

    // Verificar que el proveedor existe
    const [proveedor] = await executeQuery(
      'SELECT id FROM proveedores WHERE id = ? AND activo = true',
      [proveedor_id]
    );

    if (!proveedor) {
      return res.status(400).json({
        error: 'Proveedor no encontrado o inactivo'
      });
    }

    // Verificar que no existe una factura con el mismo número del mismo proveedor
    const facturaExistente = await executeQuery(
      'SELECT id FROM recepciones WHERE numero_factura = ? AND proveedor_id = ?',
      [numero_factura, proveedor_id]
    );

    if (facturaExistente.length > 0) {
      return res.status(400).json({
        error: 'Ya existe una recepción con este número de factura para este proveedor'
      });
    }

    // Validar productos
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

      const subtotal = item.cantidad * item.precio_unitario;
      total += subtotal;

      productosValidados.push({
        ...item,
        producto,
        subtotal
      });
    }

    // Insertar recepción
    const resultRecepcion = await executeQuery(
      'INSERT INTO recepciones (numero_factura, proveedor_id, usuario_id, fecha_recepcion, total, observaciones, estado) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [numero_factura, proveedor_id, usuario_id, fecha_recepcion, total, observaciones, 'pendiente']
    );

    const recepcionId = resultRecepcion.insertId;

    // Preparar queries para detalles
    const queryDetalles = [];

    for (const item of productosValidados) {
      // Detalle de recepción
      queryDetalles.push({
        sql: 'INSERT INTO detalle_recepciones (recepcion_id, producto_id, cantidad, precio_unitario, subtotal) VALUES (?, ?, ?, ?, ?)',
        params: [recepcionId, item.producto_id, item.cantidad, item.precio_unitario, item.subtotal]
      });
    }

    // Ejecutar todas las queries de detalles
    await executeTransaction(queryDetalles);

    res.status(201).json({
      message: 'Recepción creada exitosamente',
      recepcion_id: recepcionId,
      numero_factura,
      total
    });

  } catch (error) {
    console.error('Error creando recepción:', error);
    res.status(500).json({
      error: 'Error creando recepción'
    });
  }
});

// Procesar recepción (actualizar inventario)
router.post('/:id/procesar', verifyToken, verifyRole(['administrador', 'dueño', 'ayudante']), async (req, res) => {
  try {
    const { id } = req.params;

    // Verificar que la recepción existe y está pendiente
    const [recepcion] = await executeQuery(
      'SELECT * FROM recepciones WHERE id = ? AND estado = ?',
      [id, 'pendiente']
    );

    if (!recepcion) {
      return res.status(400).json({
        error: 'Recepción no encontrada o ya procesada'
      });
    }

    // Obtener detalles de la recepción
    const detalles = await executeQuery(
      'SELECT * FROM detalle_recepciones WHERE recepcion_id = ?',
      [id]
    );

    // Preparar queries para actualizar inventario
    const queries = [];

    for (const detalle of detalles) {
      // Obtener stock actual del producto
      const [producto] = await executeQuery(
        'SELECT stock_actual FROM productos WHERE id = ?',
        [detalle.producto_id]
      );

      const cantidad = parseFloat(detalle.cantidad);
      const stockAnterior = parseFloat(producto.stock_actual); // o como lo estés obteniendo

      const nuevoStock = parseFloat((stockAnterior + cantidad).toFixed(4));


      // Actualizar stock del producto
      queries.push({
        sql: 'UPDATE productos SET stock_actual = ?, precio_venta = ?  WHERE id = ?',
        params: [nuevoStock,detalle.precio_unitario, detalle.producto_id]
      });

      // Registrar movimiento de inventario
      queries.push({
        sql: `INSERT INTO movimientos_inventario 
              (producto_id, tipo_movimiento, cantidad, stock_anterior, stock_nuevo, referencia_id, referencia_tipo, usuario_id, observaciones) 
              VALUES (?, 'entrada', ?, ?, ?, ?, 'recepcion', ?, ?)`,
        params: [
          detalle.producto_id,
          detalle.cantidad,
          stockAnterior,
          nuevoStock,
          id,
          req.user.id,
          `Recepción ${recepcion.numero_factura}`
        ]
      });
    }

    // Actualizar estado de la recepción
    queries.push({
      sql: 'UPDATE recepciones SET estado = ? WHERE id = ?',
      params: ['procesada', id]
    });

    // Ejecutar todas las queries
    await executeTransaction(queries);

    res.json({
      message: 'Recepción procesada exitosamente'
    });

  } catch (error) {
    console.error('Error procesando recepción:', error);
    res.status(500).json({
      error: 'Error procesando recepción'
    });
  }
});

// Cancelar recepción
router.post('/:id/cancelar', verifyToken, verifyRole(['administrador', 'dueño']), async (req, res) => {
  try {
    const { id } = req.params;

    // Verificar que la recepción existe y está pendiente
    const [recepcion] = await executeQuery(
      'SELECT * FROM recepciones WHERE id = ? AND estado = ?',
      [id, 'pendiente']
    );

    if (!recepcion) {
      return res.status(400).json({
        error: 'Recepción no encontrada o ya procesada'
      });
    }

    await executeQuery('UPDATE recepciones SET estado = ? WHERE id = ?', ['cancelada', id]);

    res.json({
      message: 'Recepción cancelada exitosamente'
    });

  } catch (error) {
    console.error('Error cancelando recepción:', error);
    res.status(500).json({
      error: 'Error cancelando recepción'
    });
  }
});

module.exports = router;