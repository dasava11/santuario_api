// migrate-timestamps.js - Migración universal de timestamps para todas las tablas
import db from "./models/index.js";

// =====================================================
// 📋 CONFIGURACIÓN DE TABLAS A MIGRAR
// =====================================================
const TABLES_CONFIG = {
    // Tablas que YA tienen created_at (usar como createdAt)
    withCreatedAt: [
        {
            name: 'ventas',
            createdAtColumn: 'fecha_venta', // Columna existente que se usará como created_at
            needsUpdatedAt: true,
            afterColumn: 'motivo_anulacion'
        },
        {
            name: 'recepciones',
            createdAtColumn: 'fecha_recepcion',
            needsUpdatedAt: true,
            afterColumn: 'total' // Ajusta según tu estructura
        }
    ],

    // Tablas que necesitan AMBOS timestamps (created_at y updated_at)
    needsBothTimestamps: [
        {
            name: 'detalle_ventas',
            afterColumn: 'subtotal'
        },
        {
            name: 'detalle_recepciones',
            afterColumn: 'subtotal'
        },
        {
            name: 'movimientos_inventario',
            afterColumn: 'observaciones'
        },
        {
            name: 'productos',
            afterColumn: 'imagen_url'
        },
        {
            name: 'categorias',
            afterColumn: 'descripcion'
        },
        {
            name: 'proveedores',
            afterColumn: 'activo'
        },
        {
            name: 'usuarios',
            afterColumn: 'activo'
        }
    ]
};

// =====================================================
// 🔍 FUNCIONES DE VERIFICACIÓN
// =====================================================
const checkColumnExists = async (table, column, transaction) => {
    const [columns] = await db.sequelize.query(
        `SHOW COLUMNS FROM ${table} LIKE '${column}'`,
        { transaction }
    );
    return columns.length > 0;
};

const getTableInfo = async (table, transaction) => {
    const [columns] = await db.sequelize.query(
        `SHOW COLUMNS FROM ${table}`,
        { transaction }
    );
    return columns;
};

// =====================================================
// 🛠️ FUNCIONES DE MIGRACIÓN
// =====================================================
const addUpdatedAtColumn = async (table, afterColumn, transaction) => {
    const exists = await checkColumnExists(table, 'updated_at', transaction);

    if (exists) {
        console.log(`   ⚠️  ${table}.updated_at ya existe - saltando`);
        return false;
    }

    await db.sequelize.query(`
    ALTER TABLE ${table} 
    ADD COLUMN updated_at DATETIME NULL 
    COMMENT 'Última actualización del registro'
    ${afterColumn ? `AFTER ${afterColumn}` : ''}
  `, { transaction });

    console.log(`   ✅ ${table}.updated_at creada`);
    return true;
};

const addBothTimestamps = async (table, afterColumn, transaction) => {
    const createdExists = await checkColumnExists(table, 'created_at', transaction);
    const updatedExists = await checkColumnExists(table, 'updated_at', transaction);

    let changes = 0;

    if (!createdExists) {
        await db.sequelize.query(`
      ALTER TABLE ${table} 
      ADD COLUMN created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP 
      COMMENT 'Fecha de creación del registro'
      ${afterColumn ? `AFTER ${afterColumn}` : ''}
    `, { transaction });
        console.log(`   ✅ ${table}.created_at creada`);
        changes++;
    } else {
        console.log(`   ⚠️  ${table}.created_at ya existe - saltando`);
    }

    if (!updatedExists) {
        await db.sequelize.query(`
      ALTER TABLE ${table} 
      ADD COLUMN updated_at DATETIME NULL 
      COMMENT 'Última actualización del registro'
      AFTER created_at
    `, { transaction });
        console.log(`   ✅ ${table}.updated_at creada`);
        changes++;
    } else {
        console.log(`   ⚠️  ${table}.updated_at ya existe - saltando`);
    }

    return changes > 0;
};

const populateTimestamps = async (table, config, transaction) => {
    if (config.createdAtColumn) {
        // Tabla con columna de fecha existente
        const [result] = await db.sequelize.query(`
      UPDATE ${table} 
      SET updated_at = ${config.createdAtColumn} 
      WHERE updated_at IS NULL
    `, { transaction });
        return result.affectedRows || 0;
    } else {
        // Tabla nueva con created_at y updated_at
        const [result] = await db.sequelize.query(`
      UPDATE ${table} 
      SET updated_at = created_at 
      WHERE updated_at IS NULL
    `, { transaction });
        return result.affectedRows || 0;
    }
};

// =====================================================
// 🚀 MIGRACIÓN PRINCIPAL
// =====================================================
const runMigration = async () => {
    const startTime = Date.now();
    console.log("🚀 Iniciando migración universal de timestamps...\n");

    const transaction = await db.sequelize.transaction();
    const results = {
        tablesProcessed: 0,
        columnsAdded: 0,
        recordsUpdated: 0,
        errors: []
    };

    try {
        // =====================================================
        // 1. PROCESAR TABLAS CON CREATED_AT EXISTENTE
        // =====================================================
        console.log("📝 Paso 1: Tablas con fecha de creación existente");
        console.log("─".repeat(60));

        for (const config of TABLES_CONFIG.withCreatedAt) {
            try {
                console.log(`\n🔧 Procesando: ${config.name}`);

                // Verificar si la tabla existe
                try {
                    await getTableInfo(config.name, transaction);
                } catch (err) {
                    console.log(`   ⚠️  Tabla ${config.name} no existe - saltando`);
                    continue;
                }

                const changed = await addUpdatedAtColumn(
                    config.name,
                    config.afterColumn,
                    transaction
                );

                if (changed) {
                    const updated = await populateTimestamps(config.name, config, transaction);
                    console.log(`   📊 ${updated} registros actualizados`);
                    results.columnsAdded++;
                    results.recordsUpdated += updated;
                }

                results.tablesProcessed++;
            } catch (error) {
                console.error(`   ❌ Error en ${config.name}: ${error.message}`);
                results.errors.push({ table: config.name, error: error.message });
            }
        }

        // =====================================================
        // 2. PROCESAR TABLAS QUE NECESITAN AMBOS TIMESTAMPS
        // =====================================================
        console.log("\n\n📝 Paso 2: Tablas que necesitan created_at y updated_at");
        console.log("─".repeat(60));

        for (const config of TABLES_CONFIG.needsBothTimestamps) {
            try {
                console.log(`\n🔧 Procesando: ${config.name}`);

                // Verificar si la tabla existe
                try {
                    await getTableInfo(config.name, transaction);
                } catch (err) {
                    console.log(`   ⚠️  Tabla ${config.name} no existe - saltando`);
                    continue;
                }

                const changed = await addBothTimestamps(
                    config.name,
                    config.afterColumn,
                    transaction
                );

                if (changed) {
                    const updated = await populateTimestamps(config.name, config, transaction);
                    console.log(`   📊 ${updated} registros actualizados`);
                    results.columnsAdded += 2;
                    results.recordsUpdated += updated;
                }

                results.tablesProcessed++;
            } catch (error) {
                console.error(`   ❌ Error en ${config.name}: ${error.message}`);
                results.errors.push({ table: config.name, error: error.message });
            }
        }

        // =====================================================
        // 3. VERIFICACIÓN FINAL
        // =====================================================
        console.log("\n\n📝 Paso 3: Verificación final");
        console.log("─".repeat(60));

        const allTables = [
            ...TABLES_CONFIG.withCreatedAt.map(t => t.name),
            ...TABLES_CONFIG.needsBothTimestamps.map(t => t.name)
        ];

        for (const tableName of allTables) {
            try {
                const columns = await getTableInfo(tableName, transaction);
                const hasCreatedAt = columns.some(c => c.Field === 'created_at');
                const hasUpdatedAt = columns.some(c => c.Field === 'updated_at');

                console.log(`\n📋 ${tableName}:`);
                console.log(`   ${hasCreatedAt ? '✅' : '❌'} created_at`);
                console.log(`   ${hasUpdatedAt ? '✅' : '❌'} updated_at`);
            } catch (err) {
                // Tabla no existe, ya lo reportamos antes
            }
        }

        // =====================================================
        // 4. COMMIT
        // =====================================================
        await transaction.commit();

        const endTime = Date.now();
        const duration = ((endTime - startTime) / 1000).toFixed(2);

        console.log("\n\n" + "=".repeat(60));
        console.log("✅ ¡MIGRACIÓN COMPLETADA EXITOSAMENTE!");
        console.log("=".repeat(60));
        console.log(`⏱️  Tiempo total: ${duration}s`);
        console.log(`📊 Tablas procesadas: ${results.tablesProcessed}`);
        console.log(`📊 Columnas agregadas: ${results.columnsAdded}`);
        console.log(`📊 Registros actualizados: ${results.recordsUpdated}`);

        if (results.errors.length > 0) {
            console.log(`\n⚠️  Errores encontrados: ${results.errors.length}`);
            results.errors.forEach(err => {
                console.log(`   • ${err.table}: ${err.error}`);
            });
        }

        console.log("\n📋 PRÓXIMOS PASOS:");
        console.log("   1. ✅ Actualiza tus modelos con timestamps: true");
        console.log("   2. 🔄 Reinicia el servidor: npm run dev");
        console.log("   3. 🧪 Prueba operaciones CRUD en cada tabla");
        console.log("   4. 🔍 Verifica que created_at/updated_at funcionen correctamente");

        process.exit(0);

    } catch (error) {
        await transaction.rollback();
        console.error("\n❌ ERROR CRÍTICO durante la migración:", error.message);
        console.error("\n🔄 Los cambios fueron revertidos (rollback automático)");
        console.error("\n💡 Revisa el error y ajusta TABLES_CONFIG si es necesario");
        process.exit(1);
    }
};

// =====================================================
// 🎯 EJECUCIÓN
// =====================================================
console.log(`
╔═══════════════════════════════════════════════════════════╗
║     MIGRACIÓN UNIVERSAL DE TIMESTAMPS                     ║
║     Sistema de Gestión El Santuario                       ║
╚═══════════════════════════════════════════════════════════╝
`);

runMigration();