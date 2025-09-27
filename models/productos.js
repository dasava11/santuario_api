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
        unique: "codigo_barras",
      },
      nombre: {
        type: DataTypes.STRING(200),
        allowNull: false,
      },
      descripcion: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      categoria_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
          model: "categorias",
          key: "id",
        },
      },
      precio_compra: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
      },
      precio_venta: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
      },
      tipo_medida: {
        type: DataTypes.ENUM("unidad", "peso"),
        allowNull: true,
        defaultValue: "unidad",
      },
      stock_actual: {
        type: DataTypes.DECIMAL(10, 3),
        allowNull: true,
        defaultValue: 0.0,
      },
      stock_minimo: {
        type: DataTypes.DECIMAL(10, 3),
        allowNull: true,
        defaultValue: 0.0,
      },
      activo: {
        type: DataTypes.BOOLEAN,
        allowNull: true,
        defaultValue: 1,
      },
      fecha_creacion: {
        type: DataTypes.DATE,
        allowNull: true,
        defaultValue: Sequelize.Sequelize.literal("CURRENT_TIMESTAMP"),
      },
      fecha_actualizacion: {
        type: DataTypes.DATE,
        allowNull: true,
        defaultValue: Sequelize.Sequelize.literal("CURRENT_TIMESTAMP"),
      },
    },
    {
      sequelize,
      tableName: "productos",
      timestamps: false,
      indexes: [
        {
          name: "PRIMARY",
          unique: true,
          using: "BTREE",
          fields: [{ name: "id" }],
        },
        {
          name: "codigo_barras",
          unique: true,
          using: "BTREE",
          fields: [{ name: "codigo_barras" }],
        },
        {
          name: "idx_productos_codigo_barras",
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
      ],
    }
  );

  // ASOCIACIONES
  productos.associate = (models) => {
    productos.belongsTo(models.categorias, {
      as: "categorias",
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
