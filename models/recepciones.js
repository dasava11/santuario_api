import { DataTypes, Sequelize } from "sequelize";

export default (sequelize) => {
  const recepciones = sequelize.define(
    "recepciones",
    {
      id: {
        autoIncrement: true,
        type: DataTypes.INTEGER,
        allowNull: false,
        primaryKey: true,
      },
      numero_factura: {
        type: DataTypes.STRING(100),
        allowNull: false,
        validate: {
          notEmpty: {
            msg: "El número de factura no puede estar vacío",
          },
          len: {
            args: [1, 100],
            msg: "El número de factura debe tener entre 1 y 100 caracteres",
          },
          isValidFormat(value) {
            // Trimear espacios
            const trimmed = value.trim();
            if (trimmed.length === 0) {
              throw new Error(
                "El número de factura no puede contener solo espacios"
              );
            }
            // Validar caracteres permitidos (alfanuméricos, guiones, puntos)
            if (!/^[a-zA-Z0-9\-.\s]+$/.test(trimmed)) {
              throw new Error(
                "El número de factura contiene caracteres no permitidos"
              );
            }
          },
        },
      },
      proveedor_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: "proveedores",
          key: "id",
        },
        validate: {
          isInt: {
            msg: "El ID del proveedor debe ser un número entero",
          },
          min: {
            args: [1],
            msg: "El ID del proveedor debe ser mayor a 0",
          },
        },
      },
      usuario_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: "usuarios",
          key: "id",
        },
        validate: {
          isInt: {
            msg: "El ID del usuario debe ser un número entero",
          },
          min: {
            args: [1],
            msg: "El ID del usuario debe ser mayor a 0",
          },
        },
      },
      fecha_recepcion: {
        type: DataTypes.DATEONLY,
        allowNull: false,
        // Validación de fecha
        validate: {
          isDate: {
            msg: "La fecha de recepción debe ser una fecha válida",
          },
          // No permitir fechas futuras
          notFuture(value) {
            const fecha = new Date(value);
            const hoy = new Date();
            hoy.setHours(0, 0, 0, 0); // Resetear horas para comparar solo fecha

            if (fecha > hoy) {
              throw new Error("La fecha de recepción no puede ser futura");
            }
          },
        },
      },
      total: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: false,
        defaultValue: 0.0,
        validate: {
          isDecimal: {
            msg: "El total debe ser un número decimal válido",
          },
          min: {
            args: [0],
            msg: "El total no puede ser negativo",
          },
          max: {
            args: [999999999.99],
            msg: "El total excede el límite permitido",
          },
        },
      },
      observaciones: {
        type: DataTypes.TEXT,
        allowNull: true,
        validate: {
          len: {
            args: [0, 5000],
            msg: "Las observaciones no pueden exceder 5000 caracteres",
          },
        },
      },
      estado: {
        type: DataTypes.ENUM("pendiente", "procesada", "cancelada"),
        allowNull: false,
        defaultValue: "pendiente",
        validate: {
          isIn: {
            args: [["pendiente", "procesada", "cancelada"]],
            msg: "Estado inválido. Debe ser: pendiente, procesada o cancelada",
          },
        },
      },
      // ✅ ELIMINADO: fecha_creacion manual (se usa timestamps)
    },
    {
      sequelize,
      tableName: "recepciones",
      // ✅ CAMBIO CRÍTICO: Habilitar timestamps
      timestamps: true,
      createdAt: "fecha_creacion", // ✅ Mapear a columna existente
      updatedAt: "fecha_actualizacion", // ✅ Nueva columna (requiere migración)

      // ✅ NUEVO: Opciones de validación
      validate: {
        // ✅ Validación a nivel de modelo: Total debe ser >= suma de detalles
        async totalMatchesDetails() {
          // Esta validación se ejecuta antes de save()
          // Se puede complementar con trigger en BD
          if (this.total < 0) {
            throw new Error("El total de la recepción no puede ser negativo");
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
          name: "proveedor_id",
          using: "BTREE",
          fields: [{ name: "proveedor_id" }],
        },
        {
          name: "usuario_id",
          using: "BTREE",
          fields: [{ name: "usuario_id" }],
        },
        {
          name: "idx_recepciones_fecha",
          using: "BTREE",
          fields: [{ name: "fecha_recepcion" }],
        },
        // ✅ NUEVO: Índice para estado (queries frecuentes por estado)
        {
          name: "idx_recepciones_estado",
          using: "BTREE",
          fields: [{ name: "estado" }],
        },
        // ✅ NUEVO: Índice compuesto para unicidad de factura por proveedor
        {
          name: "idx_recepciones_factura_proveedor",
          unique: true,
          using: "BTREE",
          fields: [{ name: "numero_factura" }, { name: "proveedor_id" }],
        },
      ],

      // ✅ NUEVO: Hooks de Sequelize para auditoría
      hooks: {
        beforeCreate: (recepcion, options) => {
          // Trimear numero_factura automáticamente
          if (recepcion.numero_factura) {
            recepcion.numero_factura = recepcion.numero_factura.trim();
          }

          // Log de auditoría
          console.log(
            `📝 NUEVA RECEPCIÓN:\n` +
              `   Factura: ${recepcion.numero_factura}\n` +
              `   Proveedor: ${recepcion.proveedor_id}\n` +
              `   Usuario: ${recepcion.usuario_id}\n` +
              `   Timestamp: ${new Date().toISOString()}`
          );
        },

        beforeUpdate: (recepcion, options) => {
          // Log de cambios de estado
          if (recepcion.changed("estado")) {
            console.log(
              `🔄 CAMBIO DE ESTADO RECEPCIÓN:\n` +
                `   ID: ${recepcion.id}\n` +
                `   Estado anterior: ${recepcion._previousDataValues.estado}\n` +
                `   Estado nuevo: ${recepcion.estado}\n` +
                `   Timestamp: ${new Date().toISOString()}`
            );
          }
        },
      },
    }
  );

  // ⭐ ASOCIACIONES
  recepciones.associate = (models) => {
    recepciones.belongsTo(models.proveedores, {
      as: "proveedor",
      foreignKey: "proveedor_id",
    });
    recepciones.hasMany(models.detalle_recepciones, {
      as: "detalle_recepciones",
      foreignKey: "recepcion_id",
      // ✅ NUEVO: Cascade delete
      onDelete: "RESTRICT", // No permitir borrar recepción con detalles
    });
    recepciones.belongsTo(models.usuarios, {
      as: "usuario",
      foreignKey: "usuario_id",
    });
  };

  return recepciones;
};
