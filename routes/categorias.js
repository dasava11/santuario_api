const express = require('express');
const { executeQuery } = require('../config/database');
const { verifyToken, verifyRole } = require('../middleware/auth');
const { validate, schemas } = require('../middleware/validation');

const router = express.Router();

// Obtener todas las categorías
router.get('/', verifyToken, async (req, res) => {
  try {
    const { activo = 'true' } = req.query;
    
    let sql = 'SELECT * FROM categorias';
    const params = [];
    
    if (activo !== 'all') {
      sql += ' WHERE activo = ?';
      params.push(activo === 'true');
    }
    
    sql += ' ORDER BY nombre';
    
    const categorias = await executeQuery(sql, params);
    res.json(categorias);
    
  } catch (error) {
    console.error('Error obteniendo categorías:', error);
    res.status(500).json({
      error: 'Error obteniendo categorías'
    });
  }
});

// Obtener categoría por ID
router.get('/:id', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    const categorias = await executeQuery('SELECT * FROM categorias WHERE id = ?', [id]);
    
    if (categorias.length === 0) {
      return res.status(404).json({
        error: 'Categoría no encontrada'
      });
    }
    
    res.json(categorias[0]);
    
  } catch (error) {
    console.error('Error obteniendo categoría:', error);
    res.status(500).json({
      error: 'Error obteniendo categoría'
    });
  }
});

// Crear categoría
router.post('/', verifyToken, verifyRole(['administrador', 'dueño']), validate(schemas.categoria), async (req, res) => {
  try {
    const { nombre, descripcion } = req.body;
    
    // Verificar si ya existe una categoría con ese nombre
    const existing = await executeQuery(
      'SELECT id FROM categorias WHERE nombre = ?',
      [nombre]
    );
    
    if (existing.length > 0) {
      return res.status(400).json({
        error: 'Ya existe una categoría con este nombre'
      });
    }
    
    const result = await executeQuery(
      'INSERT INTO categorias (nombre, descripcion) VALUES (?, ?)',
      [nombre, descripcion]
    );
    
    res.status(201).json({
      message: 'Categoría creada exitosamente',
      id: result.insertId
    });
    
  } catch (error) {
    console.error('Error creando categoría:', error);
    res.status(500).json({
      error: 'Error creando categoría'
    });
  }
});

// Actualizar categoría
router.put('/:id', verifyToken, verifyRole(['administrador', 'dueño']), validate(schemas.categoria), async (req, res) => {
  try {
    const { id } = req.params;
    const { nombre, descripcion } = req.body;
    
    // Verificar si la categoría existe
    const existing = await executeQuery('SELECT * FROM categorias WHERE id = ?', [id]);
    if (existing.length === 0) {
      return res.status(404).json({
        error: 'Categoría no encontrada'
      });
    }
    
    // Verificar nombre único
    const duplicated = await executeQuery(
      'SELECT id FROM categorias WHERE nombre = ? AND id != ?',
      [nombre, id]
    );
    
    if (duplicated.length > 0) {
      return res.status(400).json({
        error: 'Ya existe otra categoría con este nombre'
      });
    }
    
    await executeQuery(
      'UPDATE categorias SET nombre = ?, descripcion = ? WHERE id = ?',
      [nombre, descripcion, id]
    );
    
    res.json({
      message: 'Categoría actualizada exitosamente'
    });
    
  } catch (error) {
    console.error('Error actualizando categoría:', error);
    res.status(500).json({
      error: 'Error actualizando categoría'
    });
  }
});

// Eliminar categoría (desactivar)
router.delete('/:id', verifyToken, verifyRole(['administrador', 'dueño']), async (req, res) => {
  try {
    const { id } = req.params;
    
    // Verificar si la categoría existe
    const existing = await executeQuery('SELECT * FROM categorias WHERE id = ?', [id]);
    if (existing.length === 0) {
      return res.status(404).json({
        error: 'Categoría no encontrada'
      });
    }
    
    // Verificar si hay productos asociados
    const productos = await executeQuery(
      'SELECT COUNT(*) as count FROM productos WHERE categoria_id = ? AND activo = true',
      [id]
    );
    
    if (productos[0].count > 0) {
      return res.status(400).json({
        error: 'No se puede eliminar la categoría porque tiene productos asociados'
      });
    }
    
    await executeQuery('UPDATE categorias SET activo = false WHERE id = ?', [id]);
    
    res.json({
      message: 'Categoría desactivada exitosamente'
    });
    
  } catch (error) {
    console.error('Error eliminando categoría:', error);
    res.status(500).json({
      error: 'Error eliminando categoría'
    });
  }
});

module.exports = router;