import { DataTypes, Sequelize } from "sequelize";

export default (sequelize) => {
  const detalle_recepciones = sequelize.define(
    "detalle_recepciones",
    {
      id: {
        autoIncrement: true,
        type: DataTypes.INTEGER,
        allowNull: false,
        primaryKey: true,
      },
      recepcion_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: "recepciones",
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
      tableName: "detalle_recepciones",
      timestamps: false,
      indexes: [
        {
          name: "PRIMARY",
          unique: true,
          using: "BTREE",
          fields: [{ name: "id" }],
        },
        {
          name: "recepcion_id",
          using: "BTREE",
          fields: [{ name: "recepcion_id" }],
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
  detalle_recepciones.associate = (models) => {
    detalle_recepciones.belongsTo(models.productos, {
      as: "producto",
      foreignKey: "producto_id",
    });
    detalle_recepciones.belongsTo(models.recepciones, {
      as: "recepcion",
      foreignKey: "recepcion_id",
    });
  };
  return detalle_recepciones;
};
