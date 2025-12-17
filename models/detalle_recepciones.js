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
        validate: {
          isInt: {
            msg: "El ID de la recepción debe ser un número entero",
          },
          min: {
            args: [1],
            msg: "El ID de la recepción debe ser mayor a 0",
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
          isDecimal: {
            msg: "La cantidad debe ser un número decimal válido",
          },
          min: {
            args: [0.001],
            msg: "La cantidad debe ser mayor a 0",
          },
          max: {
            args: [99999999.999],
            msg: "La cantidad excede el límite permitido",
          },
        },
      },
      precio_unitario: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        validate: {
          isDecimal: {
            msg: "El precio unitario debe ser un número decimal válido",
          },
          min: {
            args: [0.01],
            msg: "El precio unitario debe ser mayor a 0",
          },
          max: {
            args: [99999999.99],
            msg: "El precio unitario excede el límite permitido",
          },
        },
      },
      subtotal: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: false,
        validate: {
          isDecimal: {
            msg: "El subtotal debe ser un número decimal válido",
          },
          min: {
            args: [0.01],
            msg: "El subtotal debe ser mayor a 0",
          },
          max: {
            args: [999999999.99],
            msg: "El subtotal excede el límite permitido",
          },
        },
      },
    },
    {
      sequelize,
      tableName: "detalle_recepciones",
      // Habilitar timestamps (opcional, pero recomendado)
      timestamps: true,
      createdAt: "fecha_creacion",
      updatedAt: false, // Los detalles no se actualizan una vez creados
      validate: {
        subtotalIsCorrect() {
          const calculatedSubtotal = parseFloat(
            (this.cantidad * this.precio_unitario).toFixed(2)
          );
          const storedSubtotal = parseFloat(this.subtotal);

          // Permitir diferencia de 0.01 por redondeo
          if (Math.abs(calculatedSubtotal - storedSubtotal) > 0.01) {
            throw new Error(
              `Subtotal incorrecto. Esperado: ${calculatedSubtotal}, Recibido: ${storedSubtotal}`
            );
          }
        },
      },

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
        // ✅ NUEVO: Índice único para evitar productos duplicados en misma recepción
        {
          name: "idx_detalle_recepcion_producto_unique",
          unique: true,
          using: "BTREE",
          fields: [{ name: "recepcion_id" }, { name: "producto_id" }],
        },
      ],

      // ✅ NUEVO: Hook para validación adicional
      hooks: {
        beforeCreate: (detalle, options) => {
          // Calcular y asignar subtotal automáticamente
          detalle.subtotal = parseFloat(
            (detalle.cantidad * detalle.precio_unitario).toFixed(2)
          );
        },
      },
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
      // ✅ NUEVO: Cascade delete
      onDelete: "CASCADE", // Borrar detalles si se borra recepción
    });
  };

  return detalle_recepciones;
};
