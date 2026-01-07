// fix-missing-timestamps.js - Corregir columnas faltantes
import db from "./models/index.js";

const fixMissingTimestamps = async () => {
  console.log(`
╔═══════════════════════════════════════════════════════════╗
║     CORRECCIÓN DE TIMESTAMPS FALTANTES                    ║
╚═══════════════════════════════════════════════════════════╝
`);

  const transaction = await db.sequelize.transaction();
  const results = {
    success: [],
    errors: [],
  };

  try {
    // =====================================================
    // 1. AGREGAR updated_at A VENTAS
    // =====================================================
    console.log("\n📝 Paso 1: Agregando updated_at a ventas");
    console.log("─".repeat(60));

    try {
      const [ventasCheck] = await db.sequelize.query(
        `SHOW COLUMNS FROM ventas LIKE 'updated_at'`,
        { transaction }
      );

      if (ventasCheck.length === 0) {
        // Agregar columna
        await db.sequelize.query(
          `
          ALTER TABLE ventas 
          ADD COLUMN updated_at DATETIME NULL 
          COMMENT 'Última actualización del registro'
          AFTER motivo_anulacion
        `,
          { transaction }
        );
        console.log("   ✅ Columna updated_at creada");

        // Poblar con fecha_venta para registros existentes
        const [updateResult] = await db.sequelize.query(
          `
          UPDATE ventas 
          SET updated_at = fecha_venta 
          WHERE updated_at IS NULL
        `,
          { transaction }
        );
        console.log(
          `   📊 ${updateResult.affectedRows} registros actualizados`
        );

        results.success.push("ventas.updated_at");
      } else {
        console.log("   ⚠️  updated_at ya existe en ventas");
      }
    } catch (err) {
      console.error(`   ❌ Error: ${err.message}`);
      results.errors.push({ table: "ventas", error: err.message });
    }

    // =====================================================
    // 2. AGREGAR created_at Y updated_at A DETALLE_VENTAS
    // =====================================================
    console.log("\n📝 Paso 2: Agregando timestamps a detalle_ventas");
    console.log("─".repeat(60));

    try {
      // Verificar created_at
      const [createdCheck] = await db.sequelize.query(
        `SHOW COLUMNS FROM detalle_ventas LIKE 'created_at'`,
        { transaction }
      );

      if (createdCheck.length === 0) {
        await db.sequelize.query(
          `
          ALTER TABLE detalle_ventas 
          ADD COLUMN created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP 
          COMMENT 'Fecha de creación del detalle'
          AFTER subtotal
        `,
          { transaction }
        );
        console.log("   ✅ Columna created_at creada");
        results.success.push("detalle_ventas.created_at");
      } else {
        console.log("   ⚠️  created_at ya existe en detalle_ventas");
      }

      // Verificar updated_at
      const [updatedCheck] = await db.sequelize.query(
        `SHOW COLUMNS FROM detalle_ventas LIKE 'updated_at'`,
        { transaction }
      );

      if (updatedCheck.length === 0) {
        await db.sequelize.query(
          `
          ALTER TABLE detalle_ventas 
          ADD COLUMN updated_at DATETIME NULL 
          COMMENT 'Última actualización del detalle'
          AFTER created_at
        `,
          { transaction }
        );
        console.log("   ✅ Columna updated_at creada");
        results.success.push("detalle_ventas.updated_at");
      } else {
        console.log("   ⚠️  updated_at ya existe en detalle_ventas");
      }

      // Poblar timestamps retroactivos usando fecha_venta de la venta padre
      console.log("\n   📊 Poblando timestamps retroactivos...");
      const [populateResult] = await db.sequelize.query(
        `
        UPDATE detalle_ventas dv
        INNER JOIN ventas v ON dv.venta_id = v.id
        SET dv.created_at = COALESCE(dv.created_at, v.fecha_venta),
            dv.updated_at = COALESCE(dv.updated_at, v.fecha_venta)
      `,
        { transaction }
      );
      console.log(`   📊 ${populateResult.affectedRows} detalles actualizados`);
    } catch (err) {
      console.error(`   ❌ Error: ${err.message}`);
      results.errors.push({ table: "detalle_ventas", error: err.message });
    }

    // =====================================================
    // 3. CREAR ÍNDICES FALTANTES
    // =====================================================
    console.log("\n📝 Paso 3: Verificando índices");
    console.log("─".repeat(60));

    // Índice único en detalle_ventas
    try {
      await db.sequelize.query(
        `
        CREATE UNIQUE INDEX idx_detalle_venta_producto_unique 
        ON detalle_ventas(venta_id, producto_id)
      `,
        { transaction }
      );
      console.log("   ✅ Índice único detalle_ventas creado");
      results.success.push("idx_detalle_venta_producto_unique");
    } catch (err) {
      if (err.message.includes("Duplicate")) {
        console.log("   ⚠️  Índice único ya existe en detalle_ventas");
      } else {
        console.error(`   ❌ Error creando índice: ${err.message}`);
      }
    }

    // Índice de método de pago en ventas
    try {
      await db.sequelize.query(
        `
        CREATE INDEX idx_ventas_metodo_pago 
        ON ventas(metodo_pago)
      `,
        { transaction }
      );
      console.log("   ✅ Índice método de pago creado");
      results.success.push("idx_ventas_metodo_pago");
    } catch (err) {
      if (err.message.includes("Duplicate")) {
        console.log("   ⚠️  Índice método de pago ya existe");
      } else {
        console.error(`   ❌ Error creando índice: ${err.message}`);
      }
    }

    // Índice compuesto usuario-fecha en ventas
    try {
      await db.sequelize.query(
        `
        CREATE INDEX idx_ventas_usuario_fecha 
        ON ventas(usuario_id, fecha_venta)
      `,
        { transaction }
      );
      console.log("   ✅ Índice usuario-fecha creado");
      results.success.push("idx_ventas_usuario_fecha");
    } catch (err) {
      if (err.message.includes("Duplicate")) {
        console.log("   ⚠️  Índice usuario-fecha ya existe");
      } else {
        console.error(`   ❌ Error creando índice: ${err.message}`);
      }
    }

    // =====================================================
    // 4. VERIFICACIÓN FINAL
    // =====================================================
    console.log("\n📝 Paso 4: Verificación final");
    console.log("─".repeat(60));

    const verification = [];

    // Verificar ventas
    const [ventasColumns] = await db.sequelize.query(
      `SHOW COLUMNS FROM ventas`,
      { transaction }
    );
    const ventasHasUpdated = ventasColumns.some(
      (c) => c.Field === "updated_at"
    );
    verification.push({
      tabla: "ventas",
      columna: "updated_at",
      existe: ventasHasUpdated ? "✅" : "❌",
    });

    // Verificar detalle_ventas
    const [detalleColumns] = await db.sequelize.query(
      `SHOW COLUMNS FROM detalle_ventas`,
      { transaction }
    );
    const detalleHasCreated = detalleColumns.some(
      (c) => c.Field === "created_at"
    );
    const detalleHasUpdated = detalleColumns.some(
      (c) => c.Field === "updated_at"
    );
    verification.push({
      tabla: "detalle_ventas",
      columna: "created_at",
      existe: detalleHasCreated ? "✅" : "❌",
    });
    verification.push({
      tabla: "detalle_ventas",
      columna: "updated_at",
      existe: detalleHasUpdated ? "✅" : "❌",
    });

    console.log("\n");
    console.table(verification);

    // =====================================================
    // 5. COMMIT
    // =====================================================
    await transaction.commit();

    console.log("\n" + "=".repeat(60));
    console.log("✅ ¡CORRECCIÓN COMPLETADA EXITOSAMENTE!");
    console.log("=".repeat(60));
    console.log(`📊 Cambios aplicados: ${results.success.length}`);
    if (results.success.length > 0) {
      console.log("\n✅ Éxitos:");
      results.success.forEach((item) => console.log(`   • ${item}`));
    }
    if (results.errors.length > 0) {
      console.log("\n⚠️  Errores:");
      results.errors.forEach((err) =>
        console.log(`   • ${err.table}: ${err.error}`)
      );
    }

    console.log("\n📋 PRÓXIMOS PASOS:");
    console.log(
      "   1. 🔄 Ejecuta diagnóstico nuevamente: node diagnose-timestamps.js"
    );
    console.log(
      "   2. 🔧 Corrige modelo movimientos_inventario.js (ver abajo)"
    );
    console.log("   3. 🚀 Reinicia el servidor: npm run dev");

    console.log("\n⚠️  ACCIÓN REQUERIDA: Editar movimientos_inventario.js");
    console.log("─".repeat(60));
    console.log("Cambia la configuración de timestamps de:");
    console.log(`
    timestamps: true,
    createdAt: false,  // ← Cambiar a 'fecha_movimiento'
    updatedAt: false,  // ← Cambiar a 'updated_at'
`);
    console.log("A:");
    console.log(`
    timestamps: true,
    createdAt: 'fecha_movimiento',
    updatedAt: 'updated_at',
`);

    process.exit(0);
  } catch (error) {
    await transaction.rollback();
    console.error("\n❌ ERROR CRÍTICO:", error.message);
    console.error(error.stack);
    console.error("\n🔄 Cambios revertidos (rollback)");
    process.exit(1);
  }
};

fixMissingTimestamps();
