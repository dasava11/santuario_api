const express = require('express');
const { executeQuery } = require('../config/database');
const { verifyToken, verifyRole } = require('../middleware/auth');

const router = express.Router();

// Obtener movimientos de inventario
router.get('/movimientos', verifyToken, async (req, res) => {
  try {
    const { 
      producto_id, 
      tipo_movimiento, 
      fecha_inicio, 
      fecha_fin, 
      page = 1, 
      limit = 50 
    } = req.query;
    
    let sql = `
      SELECT mi.*, p.nombre as producto_nombre, p.codigo_barras,
             u.nombre as usuario_nombre, u.apellido as usuario_apellido
      FROM movimientos_inventario mi
      INNER JOIN productos p ON mi.producto_id = p.id
      INNER JOIN usuarios u ON mi.usuario_id = u.id
      WHERE 1=1
    `;
    const params = [];
    
    if (producto_id) {
      sql += ' AND mi.producto_id = ?';
      params.push(producto_id);
    }
    
    if (tipo_movimiento) {
      sql += ' AND mi.tipo_movimiento = ?';
      params.push(tipo_movimiento);
    }
    
    if (fecha_inicio && fecha_fin) {
      sql += ' AND DATE(mi.fecha_movimiento) BETWEEN ? AND ?';
      params.push(fecha_inicio, fecha_fin);
    }
    
    // Paginación
    const offset = (page - 1) * limit;
    sql += ' ORDER BY mi.fecha_movimiento DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));
    
    const movimientos = await executeQuery(sql, params);
    
    // Obtener total para paginación
    let countSql = 'SELECT COUNT(*) as total FROM movimientos_inventario mi WHERE 1=1';
    const countParams = [];
    
    if (producto_id) {
      countSql += ' AND mi.producto_id = ?';
      countParams.push(producto_id);
    }
    
    if (tipo_movimiento) {
      countSql += ' AND mi.tipo_movimiento = ?';
      countParams.push(tipo_movimiento);
    }
    
    if (fecha_inicio && fecha_fin) {
      countSql += ' AND DATE(mi.fecha_movimiento) BETWEEN ? AND ?';
      countParams.push(fecha_inicio, fecha_fin);
    }
    
    const [countResult] = await executeQuery(countSql, countParams);
    const total = countResult.total;
    
    res.json({
      movimientos,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
    
  } catch (error) {
    console.error('Error obteniendo movimientos:', error);
    res.status(500).json({
      error: 'Error obteniendo movimientos de inventario'
    });
  }
});

// Obtener productos con stock bajo
router.get('/stock-bajo', verifyToken, async (req, res) => {
  try {
    const productos = await executeQuery(
      `SELECT p.*, c.nombre as categoria_nombre
       FROM productos p
       LEFT JOIN categorias c ON p.categoria_id = c.id
       WHERE p.activo = true AND p.stock_actual <= p.stock_minimo
       ORDER BY (p.stock_actual - p.stock_minimo) ASC`
    );
    
    res.json(productos);
    
  } catch (error) {
    console.error('Error obteniendo productos con stock bajo:', error);
    res.status(500).json({
      error: 'Error obteniendo productos con stock bajo'
    });
  }
});

// Obtener resumen general del inventario
router.get('/resumen', verifyToken, async (req, res) => {
  try {
    // Total de productos
    const [totalProductos] = await executeQuery(
      'SELECT COUNT(*) as total FROM productos WHERE activo = true'
    );
    
    // Productos con stock bajo
    const [stockBajo] = await executeQuery(
      'SELECT COUNT(*) as total FROM productos WHERE activo = true AND stock_actual <= stock_minimo'
    );
    
     // Productos sin stock
    const [sinStock] = await executeQuery(
      'SELECT COUNT(*) as total FROM productos WHERE activo = true AND stock_actual <= 0'
    );

    // Valor total del inventario
    const [valorInventario] = await executeQuery(
      'SELECT COALESCE(SUM(stock_actual * precio_compra), 0) as valor_compra, COALESCE(SUM(stock_actual * precio_venta), 0) as valor_venta FROM productos WHERE activo = true'
    );
    
    // Categorías con más productos
    const categorias = await executeQuery(
      `SELECT c.nombre, COUNT(p.id) as total_productos, COALESCE(SUM(p.stock_actual), 0) as total_stock
       FROM categorias c
       LEFT JOIN productos p ON c.id = p.categoria_id AND p.activo = true
       WHERE c.activo = true
       GROUP BY c.id, c.nombre
       ORDER BY total_productos DESC
       LIMIT 10`
    );
    
    // Movimientos recientes
    const movimientosRecientes = await executeQuery(
      `SELECT mi.tipo_movimiento, COUNT(*) as cantidad, DATE(mi.fecha_movimiento) as fecha
       FROM movimientos_inventario mi
       WHERE DATE(mi.fecha_movimiento) >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
       GROUP BY mi.tipo_movimiento, DATE(mi.fecha_movimiento)
       ORDER BY fecha DESC, mi.tipo_movimiento`
    );
    
    res.json({
      total_productos: totalProductos.total,
      productos_stock_bajo: stockBajo.total,
       productos_sin_stock: sinStock.total,
      valor_inventario: valorInventario,
      categorias_resumen: categorias,
      movimientos_recientes: movimientosRecientes
    });
    
  } catch (error) {
    console.error('Error obteniendo resumen de inventario:', error);
    res.status(500).json({
      error: 'Error obteniendo resumen de inventario'
    });
  }
});

// Ajustar inventario
router.post('/ajuste', verifyToken, verifyRole(['administrador', 'dueño']), async (req, res) => {
  try {
    const { producto_id, nuevo_stock, observaciones } = req.body;
    
    // Validaciones
    if (!producto_id || nuevo_stock < 0) {
      return res.status(400).json({
        error: 'Datos inválidos para el ajuste'
      });
    }
    
    // Obtener producto actual
    const [producto] = await executeQuery(
      'SELECT * FROM productos WHERE id = ? AND activo = true',
      [producto_id]
    );
    
    if (!producto) {
      return res.status(404).json({
        error: 'Producto no encontrado'
      });
    }
    
    const stockAnterior = producto.stock_actual;
    const diferencia = nuevo_stock - stockAnterior;
    
    if (diferencia === 0) {
      return res.status(400).json({
        error: 'El nuevo stock es igual al actual'
      });
    }
    
    // Actualizar stock
    await executeQuery(
      'UPDATE productos SET stock_actual = ? WHERE id = ?',
      [nuevo_stock, producto_id]
    );
    
    // Registrar movimiento
    await executeQuery(
      `INSERT INTO movimientos_inventario 
       (producto_id, tipo_movimiento, cantidad, stock_anterior, stock_nuevo, referencia_tipo, usuario_id, observaciones) 
       VALUES (?, 'ajuste', ?, ?, ?, 'ajuste', ?, ?)`,
      [
        producto_id,
        Math.abs(diferencia),
        stockAnterior,
        nuevo_stock,
        req.user.id,
        observaciones || `Ajuste de inventario: ${diferencia > 0 ? 'Incremento' : 'Reducción'} de ${Math.abs(diferencia)} unidades`
      ]
    );
    
    res.json({
      message: 'Ajuste de inventario realizado exitosamente',
      stock_anterior: stockAnterior,
      stock_nuevo: nuevo_stock,
      diferencia
    });
    
  } catch (error) {
    console.error('Error ajustando inventario:', error);
    res.status(500).json({
      error: 'Error ajustando inventario'
    });
  }
});

module.exports = router;