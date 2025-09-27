import { sequelize } from "../config/database.js";
import db from "../models/index.js";

const { categorias, productos } = db;

// Obtener todas las categorías con filtros
const obtenerCategorias = async (req, res) => {
  try {
    const { activo } = req.query; // Ya validado por middleware

    // Construir filtros dinámicos
    const where = {};

    if (activo !== "all") {
      where.activo = activo === "true";
    }

    const categoriasData = await categorias.findAll({
      where,
      order: [["nombre", "ASC"]],
    });

    res.json({
      success: true,
      data: categoriasData,
    });
  } catch (error) {
    console.error("Error obteniendo categorías:", error);
    res.status(500).json({
      success: false,
      error: "Error obteniendo categorías",
      message: error.message,
    });
  }
};

// Obtener categoría por ID
const obtenerCategoriaPorId = async (req, res) => {
  try {
    const { id } = req.params;

    const categoria = await categorias.findByPk(id);

    if (!categoria) {
      return res.status(404).json({
        success: false,
        error: "Categoría no encontrada",
      });
    }

    res.json({
      success: true,
      data: categoria,
    });
  } catch (error) {
    console.error("Error obteniendo categoría:", error);
    res.status(500).json({
      success: false,
      error: "Error obteniendo categoría",
      message: error.message,
    });
  }
};

// Crear nueva categoría
const crearCategoria = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const { nombre, descripcion } = req.body;

    // VALIDACIONES DE BASE DE DATOS

    // Verificar si ya existe una categoría con el mismo nombre
    const existingByName = await categorias.findOne({
      where: {
        nombre: { [sequelize.Op.like]: nombre.trim() },
      },
      transaction,
    });

    if (existingByName) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        error: `Ya existe una categoría llamada "${nombre.trim()}"`,
      });
    }

    // Crear la categoría
    const nuevaCategoria = await categorias.create(
      {
        nombre: nombre.trim(),
        descripcion: descripcion?.trim() || null,
      },
      { transaction }
    );

    await transaction.commit();

    res.status(201).json({
      success: true,
      message: `${nombre.trim()} fue creada con éxito`,
      data: { id: nuevaCategoria.id },
    });
  } catch (error) {
    await transaction.rollback();
    console.error("Error creando categoría:", error);
    res.status(500).json({
      success: false,
      error: "Error creando categoría",
      message: error.message,
    });
  }
};

// Actualizar categoría
const actualizarCategoria = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const { id } = req.params;
    const fieldsToUpdate = { ...req.body }; // Joi ya validó los campos

    // Verificar si la categoría existe
    const categoria = await categorias.findByPk(id, { transaction });
    if (!categoria) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        error: `No se encontró una categoría con el id: ${id}`,
      });
    }

    // VALIDACIONES DE BASE DE DATOS

    // Verificar nombre único (si cambió)
    if (fieldsToUpdate.nombre && fieldsToUpdate.nombre !== categoria.nombre) {
      const existingByName = await categorias.findOne({
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
          error: `Ya existe una categoría llamada "${fieldsToUpdate.nombre.trim()}"`,
        });
      }
    }

    // Limpiar campos para actualización
    if (fieldsToUpdate.nombre)
      fieldsToUpdate.nombre = fieldsToUpdate.nombre.trim();
    if (fieldsToUpdate.descripcion !== undefined)
      fieldsToUpdate.descripcion = fieldsToUpdate.descripcion?.trim() || null;

    // Actualizar la categoría
    await categoria.update(fieldsToUpdate, { transaction });

    await transaction.commit();

    res.json({
      success: true,
      message: `${
        fieldsToUpdate.nombre || categoria.nombre
      } fue actualizada con éxito`,
    });
  } catch (error) {
    await transaction.rollback();
    console.error("Error actualizando categoría:", error);
    res.status(500).json({
      success: false,
      error: "Error actualizando categoría",
      message: error.message,
    });
  }
};

// Eliminar categoría (desactivar)
const eliminarCategoria = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const { id } = req.params;

    // Verificar si la categoría existe
    const categoria = await categorias.findByPk(id, { transaction });
    if (!categoria) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        error: "Categoría no encontrada",
      });
    }

    // VALIDACIÓN DE NEGOCIO: Verificar si hay productos activos asociados
    const productosActivos = await productos.count({
      where: {
        categoria_id: id,
        activo: true,
      },
      transaction,
    });

    if (productosActivos > 0) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        error: `No se puede desactivar la categoría porque tiene ${productosActivos} producto(s) activo(s) asociado(s)`,
      });
    }

    // Desactivar la categoría
    await categoria.update({ activo: false }, { transaction });

    await transaction.commit();

    res.json({
      success: true,
      message: "Categoría desactivada exitosamente",
    });
  } catch (error) {
    await transaction.rollback();
    console.error("Error eliminando categoría:", error);
    res.status(500).json({
      success: false,
      error: "Error eliminando categoría",
      message: error.message,
    });
  }
};

export {
  obtenerCategorias,
  obtenerCategoriaPorId,
  crearCategoria,
  actualizarCategoria,
  eliminarCategoria,
};
