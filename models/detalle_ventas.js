import { DataTypes, Sequelize } from "sequelize";

export default (sequelize) => {
  const detalle_ventas = sequelize.define(
    "detalle_ventas",
    {
      id: {
        autoIncrement: true,
        type: DataTypes.INTEGER,
        allowNull: false,
        primaryKey: true,
      },
      venta_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: "ventas",
          key: "id",
        },
      },
      producto_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: "productos",
          key: "id",
        },
      },
      cantidad: {
        type: DataTypes.DECIMAL(10, 3),
        allowNull: false,
      },
      precio_unitario: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
      },
      subtotal: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: false,
      },
    },
    {
      sequelize,
      tableName: "detalle_ventas",
      timestamps: false,
      indexes: [
        {
          name: "PRIMARY",
          unique: true,
          using: "BTREE",
          fields: [{ name: "id" }],
        },
        {
          name: "venta_id",
          using: "BTREE",
          fields: [{ name: "venta_id" }],
        },
        {
          name: "producto_id",
          using: "BTREE",
          fields: [{ name: "producto_id" }],
        },
      ],
    }
  );

  // ASOCIACIONES
  detalle_ventas.associate = (models) => {
    detalle_ventas.belongsTo(models.productos, {
      as: "producto",
      foreignKey: "producto_id",
    });
    detalle_ventas.belongsTo(models.ventas, {
      as: "ventum",
      foreignKey: "venta_id",
    });
  };
  return detalle_ventas;
};
