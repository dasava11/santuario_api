const express = require('express');
const { executeQuery } = require('../config/database');
const { verifyToken, verifyRole } = require('../middleware/auth');
const { validate, schemas } = require('../middleware/validation');

const router = express.Router();

// Obtener todos los productos con filtros
router.get('/', verifyToken, async (req, res) => {
  try {
    const {
      categoria_id,
      search,
      codigo_barras,
      activo = 'true',
      page = 1,
      limit = 50
    } = req.query;

    let sql = `
      SELECT p.*, c.nombre as categoria_nombre 
      FROM productos p 
      LEFT JOIN categorias c ON p.categoria_id = c.id 
      WHERE 1=1
    `;
    const params = [];

    if (activo !== 'all') {
      sql += ' AND p.activo = ?';
      params.push(activo === 'true');
    }

    if (categoria_id) {
      sql += ' AND p.categoria_id = ?';
      params.push(categoria_id);
    }

    if (search) {
      sql += ' AND (p.nombre LIKE ? OR p.descripcion LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }

    if (codigo_barras) {
      sql += ' AND p.codigo_barras = ?';
      params.push(codigo_barras);
    }

    // Paginación
    const offset = (page - 1) * limit;
    sql += ' AND p.activo = ?';
    params.push(activo === 'true' ? 1 : 0);

    sql += ` ORDER BY p.nombre LIMIT ${parseInt(limit)} OFFSET ${parseInt(offset)}`;


    const productos = await executeQuery(sql, params);

    // Obtener total para paginación
    let countSql = 'SELECT COUNT(*) as total FROM productos p WHERE 1=1';
    const countParams = [];

    if (activo !== 'all') {
      countSql += ' AND p.activo = ?';
      countParams.push(activo === 'true');
    }

    if (categoria_id) {
      countSql += ' AND p.categoria_id = ?';
      countParams.push(categoria_id);
    }

    if (search) {
      countSql += ' AND (p.nombre LIKE ? OR p.descripcion LIKE ?)';
      countParams.push(`%${search}%`, `%${search}%`);
    }

    if (codigo_barras) {
      countSql += ' AND p.codigo_barras = ?';
      countParams.push(codigo_barras);
    }

    const [countResult] = await executeQuery(countSql, countParams);
    const total = countResult.total;

    res.json({
      productos,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    console.error('Error obteniendo productos:', error);
    res.status(500).json({
      error: 'Error obteniendo productos'
    });
  }
});

// Obtener producto por ID
router.get('/:id', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;

    const productos = await executeQuery(
      `SELECT p.*, c.nombre as categoria_nombre 
       FROM productos p 
       LEFT JOIN categorias c ON p.categoria_id = c.id 
       WHERE p.id = ?`,
      [id]
    );

    if (productos.length === 0) {
      return res.status(404).json({
        error: 'Producto no encontrado'
      });
    }

    res.json(productos[0]);

  } catch (error) {
    console.error('Error obteniendo producto:', error);
    res.status(500).json({
      error: 'Error obteniendo producto'
    });
  }
});

// Buscar producto por código de barras
router.get('/barcode/:codigo', verifyToken, async (req, res) => {
  try {
    const { codigo } = req.params;

    const productos = await executeQuery(
      `SELECT p.*, c.nombre as categoria_nombre 
       FROM productos p 
       LEFT JOIN categorias c ON p.categoria_id = c.id 
       WHERE p.codigo_barras = ? AND p.activo = true`,
      [codigo]
    );

    if (productos.length === 0) {
      return res.status(404).json({
        error: 'Producto no encontrado'
      });
    }

    res.json(productos[0]);

  } catch (error) {
    console.error('Error buscando producto por código:', error);
    res.status(500).json({
      error: 'Error buscando producto'
    });
  }
});

// Crear producto
router.post('/', verifyToken, verifyRole(['administrador', 'dueño']), validate(schemas.producto), async (req, res) => {
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
      stock_minimo
    } = req.body;

    // Verificar si el código de barras ya existe
    if (codigo_barras) {
      const existing = await executeQuery(
        'SELECT id FROM productos WHERE codigo_barras = ?',
        [codigo_barras]
      );

      if (existing.length > 0) {
        return res.status(400).json({
          error: 'Ya existe un producto con este código de barras'
        });
      }
    }

    const result = await executeQuery(
      `INSERT INTO productos 
       (codigo_barras, nombre, descripcion, categoria_id, precio_compra, precio_venta, tipo_medida, stock_actual, stock_minimo) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [codigo_barras || null, nombre, descripcion, categoria_id, precio_compra, precio_venta, tipo_medida, stock_actual, stock_minimo]
    );

    // Registrar movimiento de inventario inicial si hay stock
    if (stock_actual > 0) {
      await executeQuery(
        `INSERT INTO movimientos_inventario 
         (producto_id, tipo_movimiento, cantidad, stock_anterior, stock_nuevo, referencia_tipo, usuario_id, observaciones) 
         VALUES (?, 'entrada', ?, 0, ?, 'ajuste', ?, 'Stock inicial')`,
        [result.insertId, stock_actual, stock_actual, req.user.id]
      );
    }

    res.status(201).json({
      message: 'Producto creado exitosamente',
      id: result.insertId
    });

  } catch (error) {
    console.error('Error creando producto:', error);
    res.status(500).json({
      error: 'Error creando producto'
    });
  }
});

// Actualizar producto
router.put('/:id', verifyToken, verifyRole(['administrador', 'dueño']), validate(schemas.producto), async (req, res) => {
  try {
    const { id } = req.params;
    const {
      codigo_barras,
      nombre,
      descripcion,
      categoria_id,
      precio_compra,
      precio_venta,
      tipo_medida,
      stock_minimo,
      stock_actual
    } = req.body;

    // Verificar si el producto existe
    const existing = await executeQuery('SELECT * FROM productos WHERE id = ?', [id]);
    if (existing.length === 0) {
      return res.status(404).json({
        error: 'Producto no encontrado'
      });
    }

    // Verificar código de barras único
    if (codigo_barras) {
      const duplicated = await executeQuery(
        'SELECT id FROM productos WHERE codigo_barras = ? AND id != ?',
        [codigo_barras, id]
      );

      if (duplicated.length > 0) {
        return res.status(400).json({
          error: 'Ya existe otro producto con este código de barras'
        });
      }
    }

    await executeQuery(
      `UPDATE productos SET 
       codigo_barras = ?, nombre = ?, descripcion = ?, categoria_id = ?, 
       precio_compra = ?, precio_venta = ?, tipo_medida = ?, stock_minimo = ?, stock_actual = ?
       WHERE id = ?`,
      [codigo_barras || null, nombre, descripcion, categoria_id, precio_compra, precio_venta, tipo_medida, stock_minimo,stock_actual, id]
    );

    res.json({
      message: 'Producto actualizado exitosamente'
    });

  } catch (error) {
    console.error('Error actualizando producto:', error);
    res.status(500).json({
      error: 'Error actualizando producto'
    });
  }
});

// Eliminar producto (desactivar)
router.delete('/:id', verifyToken, verifyRole(['administrador', 'dueño']), async (req, res) => {
  try {
    const { id } = req.params;

    // Verificar si el producto existe
    const existing = await executeQuery('SELECT * FROM productos WHERE id = ?', [id]);
    if (existing.length === 0) {
      return res.status(404).json({
        error: 'Producto no encontrado'
      });
    }

    await executeQuery('UPDATE productos SET activo = false WHERE id = ?', [id]);

    res.json({
      message: 'Producto desactivado exitosamente'
    });

  } catch (error) {
    console.error('Error eliminando producto:', error);
    res.status(500).json({
      error: 'Error eliminando producto'
    });
  }
});

module.exports = router;