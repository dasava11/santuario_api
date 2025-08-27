const express = require('express');
const { executeQuery } = require('../config/database');
const { verifyToken, verifyRole } = require('../middleware/auth');
const { validate, schemas } = require('../middleware/validation');

const router = express.Router();


// Obtener todos los proveedores
router.get('/', verifyToken, async (req, res) => {
  try {

    const { search, activo = 'true' } = req.query;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;


    let sql = 'SELECT * FROM proveedores WHERE 1=1';
    const params = [];

    if (activo !== 'all') {
      sql += ' AND activo = ?';
      params.push(activo === 'true' ? 1 : 0);
    }

    if (search) {
      sql += ' AND (nombre LIKE ? OR contacto LIKE ? OR email LIKE ?)';
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }


    // Paginación
    sql += ` ORDER BY nombre LIMIT ${parseInt(limit)} OFFSET ${parseInt(offset)}`;
    
    console.log('SQL final:', sql);
    console.log('Params:', params);
    console.log('Tipos de datos:', params.map(p => typeof p));



    const proveedores = await executeQuery(sql, params);

    // Obtener total para paginación
    let countSql = 'SELECT COUNT(*) as total FROM proveedores WHERE 1=1';
    const countParams = [];

    if (activo !== 'all') {
      countSql += ' AND activo = ?';
      countParams.push(activo === 'true');
    }

    if (search) {
      countSql += ' AND (nombre LIKE ? OR contacto LIKE ? OR email LIKE ?)';
      countParams.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    const [countResult] = await executeQuery(countSql, countParams);
    const total = countResult.total;

    res.json({
      proveedores,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    console.error('Error obteniendo proveedores:', error);
    res.status(500).json({
      error: 'Error obteniendo proveedores'
    });
  }
});

// Obtener proveedor por ID
router.get('/:id', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;

    const proveedores = await executeQuery('SELECT * FROM proveedores WHERE id = ?', [id]);

    if (proveedores.length === 0) {
      return res.status(404).json({
        error: 'Proveedor no encontrado'
      });
    }

    res.json(proveedores[0]);

  } catch (error) {
    console.error('Error obteniendo proveedor:', error);
    res.status(500).json({
      error: 'Error obteniendo proveedor'
    });
  }
});

// Crear proveedor
router.post('/', verifyToken, verifyRole(['administrador', 'dueño']), validate(schemas.proveedor), async (req, res) => {
  try {
    const { nombre, contacto, telefono, email, direccion, ciudad, pais } = req.body;

    // Verificar si ya existe un proveedor con ese nombre
    const existing = await executeQuery(
      'SELECT id FROM proveedores WHERE nombre = ?',
      [nombre]
    );

    if (existing.length > 0) {
      return res.status(400).json({
        error: 'Ya existe un proveedor con este nombre'
      });
    }

    const result = await executeQuery(
      `INSERT INTO proveedores (nombre, contacto, telefono, email, direccion, ciudad, pais) 
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [nombre, contacto, telefono, email, direccion, ciudad, pais]
    );

    res.status(201).json({
      message: 'Proveedor creado exitosamente',
      id: result.insertId
    });

  } catch (error) {
    console.error('Error creando proveedor:', error);
    res.status(500).json({
      error: 'Error creando proveedor'
    });
  }
});

// Actualizar proveedor
router.put('/:id', verifyToken, verifyRole(['administrador', 'dueño']), validate(schemas.proveedor), async (req, res) => {
  try {
    const { id } = req.params;
    const { nombre, contacto, telefono, email, direccion, ciudad, pais } = req.body;

    // Verificar si el proveedor existe
    const existing = await executeQuery('SELECT * FROM proveedores WHERE id = ?', [id]);
    if (existing.length === 0) {
      return res.status(404).json({
        error: 'Proveedor no encontrado'
      });
    }

    // Verificar nombre único
    const duplicated = await executeQuery(
      'SELECT id FROM proveedores WHERE nombre = ? AND id != ?',
      [nombre, id]
    );

    if (duplicated.length > 0) {
      return res.status(400).json({
        error: 'Ya existe otro proveedor con este nombre'
      });
    }

    await executeQuery(
      `UPDATE proveedores SET 
       nombre = ?, contacto = ?, telefono = ?, email = ?, direccion = ?, ciudad = ?, pais = ?
       WHERE id = ?`,
      [nombre, contacto, telefono, email, direccion, ciudad, pais, id]
    );

    res.json({
      message: 'Proveedor actualizado exitosamente'
    });

  } catch (error) {
    console.error('Error actualizando proveedor:', error);
    res.status(500).json({
      error: 'Error actualizando proveedor'
    });
  }
});

// Eliminar proveedor (desactivar)
router.delete('/:id', verifyToken, verifyRole(['administrador', 'dueño']), async (req, res) => {
  try {
    const { id } = req.params;

    // Verificar si el proveedor existe
    const existing = await executeQuery('SELECT * FROM proveedores WHERE id = ?', [id]);
    if (existing.length === 0) {
      return res.status(404).json({
        error: 'Proveedor no encontrado'
      });
    }

    await executeQuery('UPDATE proveedores SET activo = false WHERE id = ?', [id]);

    res.json({
      message: 'Proveedor desactivado exitosamente'
    });

  } catch (error) {
    console.error('Error eliminando proveedor:', error);
    res.status(500).json({
      error: 'Error eliminando proveedor'
    });
  }
});

module.exports = router;