import { DataTypes, Sequelize } from "sequelize";

export default (sequelize) => {
  const proveedores = sequelize.define(
    "proveedores",
    {
      id: {
        autoIncrement: true,
        type: DataTypes.INTEGER,
        allowNull: false,
        primaryKey: true,
      },
      nombre: {
        type: DataTypes.STRING(200),
        allowNull: false,
        // ✅ NUEVO: Validaciones
        validate: {
          notEmpty: {
            msg: "El nombre del proveedor no puede estar vacío",
          },
          len: {
            args: [2, 200],
            msg: "El nombre debe tener entre 2 y 200 caracteres",
          },
        },
      },
      contacto: {
        type: DataTypes.STRING(100),
        allowNull: true,
        // ✅ NUEVO: Validación de longitud
        validate: {
          len: {
            args: [0, 100],
            msg: "El contacto no puede exceder 100 caracteres",
          },
        },
      },
      telefono: {
        type: DataTypes.STRING(20),
        allowNull: true,
        // ✅ NUEVO: Validación de longitud
        validate: {
          len: {
            args: [0, 20],
            msg: "El teléfono no puede exceder 20 caracteres",
          },
        },
      },
      email: {
        type: DataTypes.STRING(100),
        allowNull: true,
        // ✅ NUEVO: Validación de email
        validate: {
          isEmail: {
            msg: "Debe proporcionar un email válido",
          },
          len: {
            args: [0, 100],
            msg: "El email no puede exceder 100 caracteres",
          },
        },
      },
      direccion: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      ciudad: {
        type: DataTypes.STRING(100),
        allowNull: true,
        validate: {
          len: {
            args: [0, 100],
            msg: "La ciudad no puede exceder 100 caracteres",
          },
        },
      },
      pais: {
        type: DataTypes.STRING(100),
        allowNull: true,
        defaultValue: "Colombia",
        validate: {
          len: {
            args: [0, 100],
            msg: "El país no puede exceder 100 caracteres",
          },
        },
      },
      activo: {
        type: DataTypes.BOOLEAN,
        allowNull: false, 
        defaultValue: true,
      },
      // fecha_creacion (mapear a createdAt)
      fecha_creacion: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: Sequelize.Sequelize.literal("CURRENT_TIMESTAMP"),
      },
      // fecha_actualizacion (mapear a updatedAt)
      fecha_actualizacion: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: Sequelize.Sequelize.literal("CURRENT_TIMESTAMP"),
      },
    },
    {
      sequelize,
      tableName: "proveedores",
      // ✅ CAMBIAR: Habilitar timestamps
      timestamps: true,
      createdAt: "fecha_creacion",    // Mapear a campo existente
      updatedAt: "fecha_actualizacion", // Mapear a campo existente

      // ✅ NUEVO: Índices estratégicos
      indexes: [
        {
          name: "PRIMARY",
          unique: true,
          using: "BTREE",
          fields: [{ name: "id" }],
        },
        // ✅ NUEVO: Índice en email (búsquedas + unicidad lógica)
        {
          name: "idx_proveedores_email",
          using: "BTREE",
          fields: [{ name: "email" }],
        },
        // ✅ NUEVO: Índice en estado activo (filtro común)
        {
          name: "idx_proveedores_activo",
          using: "BTREE",
          fields: [{ name: "activo" }],
        },
        // ✅ NUEVO: Índice en nombre (búsquedas frecuentes)
        {
          name: "idx_proveedores_nombre",
          using: "BTREE",
          fields: [{ name: "nombre" }],
        },
        // ✅ NUEVO: Índice compuesto (filtro combinado)
        {
          name: "idx_proveedores_nombre_activo",
          using: "BTREE",
          fields: [{ name: "nombre" }, { name: "activo" }],
        },
      ],
    }
  );

  // Asociaciones
  proveedores.associate = (models) => {
    proveedores.hasMany(models.recepciones, {
      as: "recepciones",
      foreignKey: "proveedor_id",
    });
  };

  return proveedores;
};