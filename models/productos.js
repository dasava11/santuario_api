import { DataTypes, Sequelize } from "sequelize";

export default (sequelize) => {
  const productos = sequelize.define(
    "productos",
    {
      id: {
        autoIncrement: true,
        type: DataTypes.INTEGER,
        allowNull: false,
        primaryKey: true,
      },
      codigo_barras: {
        type: DataTypes.STRING(50),
        allowNull: true,
        unique: "codigo_barras_unique",
        validate: {
          len: {
            args: [1, 50],
            msg: "El código de barras debe tener entre 1 y 50 caracteres",
          },
        },
        comment: "Código de barras único del producto (EAN, UPC, etc.)",
      },
      nombre: {
        type: DataTypes.STRING(200),
        allowNull: false,
        validate: {
          notEmpty: {
            msg: "El nombre no puede estar vacío",
          },
          len: {
            args: [2, 200],
            msg: "El nombre debe tener entre 2 y 200 caracteres",
          },
        },
        comment: "Nombre descriptivo del producto",
      },
      descripcion: {
        type: DataTypes.TEXT,
        allowNull: true,
        validate: {
          len: {
            args: [0, 1000],
            msg: "La descripción no puede tener más de 1000 caracteres",
          },
        },
        comment: "Descripción detallada del producto",
      },
      categoria_id: {
        type: DataTypes.INTEGER,
        allowNull: false, // ✅ CAMBIADO: Categoría es obligatoria
        references: {
          model: "categorias",
          key: "id",
        },
        validate: {
          isInt: {
            msg: "El ID de categoría debe ser un número entero",
          },
          min: {
            args: [1],
            msg: "El ID de categoría debe ser mayor a 0",
          },
        },
        comment: "Categoría a la que pertenece el producto",
      },
      precio_compra: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        validate: {
          isDecimal: {
            msg: "El precio de compra debe ser un número decimal válido",
          },
          min: {
            args: [0.01],
            msg: "El precio de compra debe ser mayor a 0",
          },
          isValidPrecio(value) {
            if (value > 99999999.99) {
              throw new Error(
                "El precio de compra no puede ser mayor a 99,999,999.99"
              );
            }
          },
        },
        comment: "Precio de compra al proveedor",
      },
      precio_venta: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        validate: {
          isDecimal: {
            msg: "El precio de venta debe ser un número decimal válido",
          },
          min: {
            args: [0.01],
            msg: "El precio de venta debe ser mayor a 0",
          },
          isValidPrecio(value) {
            if (value > 99999999.99) {
              throw new Error(
                "El precio de venta no puede ser mayor a 99,999,999.99"
              );
            }
          },
          isGreaterThanCosto(value) {
            // Validación: precio_venta > precio_compra
            if (this.precio_compra && value <= this.precio_compra) {
              throw new Error(
                "El precio de venta debe ser mayor al precio de compra"
              );
            }
          },
        },
        comment: "Precio de venta al público",
      },
      tipo_medida: {
        type: DataTypes.ENUM("unidad", "peso"),
        allowNull: false, // ✅ CAMBIADO: No puede ser null
        defaultValue: "unidad",
        validate: {
          isIn: {
            args: [["unidad", "peso"]],
            msg: "El tipo de medida debe ser 'unidad' o 'peso'",
          },
        },
        comment: "Tipo de medición: unidad (piezas) o peso (kg, g)",
      },
      stock_actual: {
        type: DataTypes.DECIMAL(10, 3),
        allowNull: false, // ✅ CAMBIADO: No puede ser null
        defaultValue: 0.0,
        validate: {
          isDecimal: {
            msg: "El stock actual debe ser un número decimal válido",
          },
          min: {
            args: [0],
            msg: "El stock actual no puede ser negativo",
          },
          max: {
            args: [99999999.999],
            msg: "El stock actual no puede ser mayor a 99,999,999.999",
          },
        },
        comment:
          "Cantidad actual en inventario (actualizaciones vía módulo inventario)",
      },
      stock_minimo: {
        type: DataTypes.DECIMAL(10, 3),
        allowNull: false, // ✅ CAMBIADO: No puede ser null
        defaultValue: 0.0,
        validate: {
          isDecimal: {
            msg: "El stock mínimo debe ser un número decimal válido",
          },
          min: {
            args: [0],
            msg: "El stock mínimo no puede ser negativo",
          },
          max: {
            args: [99999999.999],
            msg: "El stock mínimo no puede ser mayor a 99,999,999.999",
          },
        },
        comment: "Stock mínimo para alertas de reposición",
      },
      activo: {
        type: DataTypes.BOOLEAN,
        allowNull: false, // ✅ CAMBIADO: No puede ser null
        defaultValue: true,
        comment: "Estado del producto: true = activo, false = desactivado",
      },
      fecha_creacion: {
        type: DataTypes.DATE,
        allowNull: false, // ✅ CAMBIADO: Timestamps obligatorios
        defaultValue: Sequelize.Sequelize.literal("CURRENT_TIMESTAMP"),
        comment: "Fecha de creación del registro",
      },
      fecha_actualizacion: {
        type: DataTypes.DATE,
        allowNull: false, // ✅ CAMBIADO: Timestamps obligatorios
        defaultValue: Sequelize.Sequelize.literal("CURRENT_TIMESTAMP"),
        comment: "Última actualización del registro",
      },
    },
    {
      sequelize,
      tableName: "productos",
      timestamps: true,
      createdAt: "fecha_creacion", 
      updatedAt: "fecha_actualizacion",
      indexes: [
        {
          name: "PRIMARY",
          unique: true,
          using: "BTREE",
          fields: [{ name: "id" }],
        },
        {
          name: "codigo_barras_unique",
          unique: true,
          using: "BTREE",
          fields: [{ name: "codigo_barras" }],
        },
        {
          name: "idx_productos_nombre",
          using: "BTREE",
          fields: [{ name: "nombre" }],
        },
        {
          name: "idx_productos_categoria",
          using: "BTREE",
          fields: [{ name: "categoria_id" }],
        },
        // ✅ NUEVOS ÍNDICES COMPUESTOS
        {
          name: "idx_productos_activo_categoria",
          using: "BTREE",
          fields: [{ name: "activo" }, { name: "categoria_id" }],
          comment: "Para filtros por categoría en productos activos",
        },
        {
          name: "idx_productos_stock_bajo",
          using: "BTREE",
          fields: [
            { name: "activo" },
            { name: "stock_actual" },
            { name: "stock_minimo" },
          ],
          comment: "Para consultas de productos con stock bajo",
        },
        {
          name: "idx_productos_nombre_activo",
          using: "BTREE",
          fields: [{ name: "nombre" }, { name: "activo" }],
          comment: "Para búsquedas por nombre en productos activos",
        },
      ],
    }
  );

  // ASOCIACIONES
  productos.associate = (models) => {
    productos.belongsTo(models.categorias, {
      as: "categoria",
      foreignKey: "categoria_id",
    });
    productos.hasMany(models.detalle_recepciones, {
      as: "detalle_recepciones",
      foreignKey: "producto_id",
    });
    productos.hasMany(models.detalle_ventas, {
      as: "detalle_venta",
      foreignKey: "producto_id",
    });
    productos.hasMany(models.movimientos_inventario, {
      as: "movimientos_inventarios",
      foreignKey: "producto_id",
    });
  };

  return productos;
};
