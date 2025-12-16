import { DataTypes, Sequelize } from "sequelize";

export default (sequelize) => {
  const movimientos_inventario = sequelize.define(
    "movimientos_inventario",
    {
      id: {
        autoIncrement: true,
        type: DataTypes.INTEGER,
        allowNull: false,
        primaryKey: true,
      },
      producto_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: "productos",
          key: "id",
        },
      },
      tipo_movimiento: {
        type: DataTypes.ENUM("entrada", "salida", "ajuste"),
        allowNull: false,
      },
      cantidad: {
        type: DataTypes.DECIMAL(10, 3),
        allowNull: false,
        validate: {
          min: {
            args: [0.001],
            msg: "La cantidad debe ser mayor a 0"
          },
          isDecimal: {
            msg: "La cantidad debe ser un número decimal válido"
          }
        }
      },
      stock_anterior: {
        type: DataTypes.DECIMAL(10, 3),
        allowNull: false,
      },
      stock_nuevo: {
        type: DataTypes.DECIMAL(10, 3),
        allowNull: false,
      },
      referencia_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      referencia_tipo: {
        type: DataTypes.ENUM("venta", "recepcion", "ajuste"),
        allowNull: true,
      },
      usuario_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: "usuarios",
          key: "id",
        },
      },
      observaciones: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      fecha_movimiento: {
        type: DataTypes.DATE,
        allowNull: true,
        defaultValue: Sequelize.Sequelize.literal("CURRENT_TIMESTAMP"),
      },
    },
    {
      sequelize,
      tableName: "movimientos_inventario",
      timestamps: true,
      indexes: [
        {
          name: "PRIMARY",
          unique: true,
          using: "BTREE",
          fields: [{ name: "id" }],
        },
        {
          name: "usuario_id",
          using: "BTREE",
          fields: [{ name: "usuario_id" }],
        },
        {
          name: "idx_movimientos_producto",
          using: "BTREE",
          fields: [{ name: "producto_id" }],
        },
        {
          name: "idx_movimientos_fecha",
          using: "BTREE",
          fields: [{ name: "fecha_movimiento" }],
        },
      ],
    }
  );

  // ASOCIACIONES
  movimientos_inventario.associate = (models) => {
    movimientos_inventario.belongsTo(models.productos, {
      as: "producto",
      foreignKey: "producto_id",
    });
    movimientos_inventario.belongsTo(models.usuarios, {
      as: "usuario",
      foreignKey: "usuario_id",
    });
  };
  return movimientos_inventario;
};
