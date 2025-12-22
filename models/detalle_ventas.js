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
        validate: {
          isInt: {
            msg: "El ID de la venta debe ser un número entero",
          },
          min: {
            args: [1],
            msg: "El ID de la venta debe ser mayor a 0",
          },
        },
      },
      producto_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: "productos",
          key: "id",
        },
        validate: {
          isInt: {
            msg: "El ID del producto debe ser un número entero",
          },
          min: {
            args: [1],
            msg: "El ID del producto debe ser mayor a 0",
          },
        },
      },
      cantidad: {
        type: DataTypes.DECIMAL(10, 3),
        allowNull: false,
        validate: {
          min: {
            args: [0.001],
            msg: "La cantidad mínima es 0.001",
          },
          max: {
            args: [99999999.999],
            msg: "La cantidad excede el límite máximo permitido",
          },
          isDecimal: {
            msg: "La cantidad debe ser un número decimal válido",
          },
        },
      },
      precio_unitario: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        validate: {
          min: {
            args: [0.01],
            msg: "El precio unitario mínimo es 0.01",
          },
          max: {
            args: [99999999.99],
            msg: "El precio unitario excede el límite máximo permitido",
          },
          isDecimal: {
            msg: "El precio unitario debe ser un número decimal válido",
          },
        },
      },
      subtotal: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: false,
        validate: {
          min: {
            args: [0.01],
            msg: "El subtotal mínimo es 0.01",
          },
          isDecimal: {
            msg: "El subtotal debe ser un número decimal válido",
          },
          // ✅ NUEVA VALIDACIÓN: Consistencia subtotal = cantidad * precio
          isConsistent(value) {
            const expectedSubtotal = parseFloat(
              (this.cantidad * this.precio_unitario).toFixed(2)
            );
            const actualSubtotal = parseFloat(value);

            // Permitir diferencia de 0.01 por redondeo
            if (Math.abs(expectedSubtotal - actualSubtotal) > 0.02) {
              throw new Error(
                `El subtotal (${actualSubtotal}) no coincide con cantidad × precio (${expectedSubtotal})`
              );
            }
          },
        },
      },
      // ✅ NUEVOS CAMPOS: Para auditoría
      created_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
        comment: "Fecha de creación del detalle",
      },
      updated_at: {
        type: DataTypes.DATE,
        allowNull: true,
        comment: "Última actualización del detalle",
      },
    },
    {
      sequelize,
      tableName: "detalle_ventas",
      // ✅ ACTIVADO: Timestamps
      timestamps: true,
      createdAt: "created_at",
      updatedAt: "updated_at",
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
        // ÍNDICE COMPUESTO: Para evitar duplicados en misma venta
        {
          name: "idx_detalle_venta_producto_unique",
          unique: true,
          using: "BTREE",
          fields: [{ name: "venta_id" }, { name: "producto_id" }],
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
