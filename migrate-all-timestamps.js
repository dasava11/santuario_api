// migrate-all-timestamps.js - Migración ESPECÍFICA para El Santuario
import db from "./models/index.js";

// =====================================================
// 📋 CONFIGURACIÓN ESPECÍFICA PARA TU BASE DE DATOS
// =====================================================
const TABLES_CONFIG = {
    // Tablas que YA tienen created_at, solo necesitan updated_at
    withCreatedAt: [
        {
            name: 'categorias',
            createdAtColumn: 'fecha_creacion',
            afterColumn: 'fecha_creacion',
            description: 'Ya tiene fecha_creacion, agregar updated_at'
        },
        {
            name: 'movimientos_inventario',
            createdAtColumn: 'fecha_movimiento',
            afterColumn: 'observaciones',
            description: 'Ya tiene fecha_movimiento, agregar updated_at'
        },
        {
            name: 'recepciones',
            createdAtColumn: 'fecha_recepcion', // Es DATEONLY, mantener así
            afterColumn: 'estado',
            description: 'Ya tiene fecha_recepcion, agregar fecha_actualizacion',
            updatedAtName: 'fecha_actualizacion' // NOMBRE ESPECÍFICO para recepciones
        }
    ],

    // Tablas que necesitan AMBOS timestamps (created_at y updated_at)
    needsBothTimestamps: [
        {
            name: 'detalle_recepciones',
            afterColumn: 'subtotal',
            description: 'Necesita created_at (fecha_creacion) y updated_at'
        }
    ],

    // ✅ TABLAS QUE YA ESTÁN COMPLETAS (NO MIGRAR)
    alreadyComplete: [
        'productos',      // ✅ tiene fecha_creacion y fecha_actualizacion
        'proveedores',    // ✅ tiene fecha_creacion y fecha_actualizacion
        'usuarios',       // ✅ tiene fecha_creacion y fecha_actualizacion
        'ventas',         // ✅ tiene fecha_venta y updated_at
        'detalle_ventas'  // ✅ tiene created_at y updated_at
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
    try {
        const [columns] = await db.sequelize.query(
            `SHOW COLUMNS FROM ${table}`,
            { transaction }
        );
        return columns;
    } catch (err) {
        return null; // Tabla no existe
    }
};

// =====================================================
// 🛠️ FUNCIONES DE MIGRACIÓN
// =====================================================
const addUpdatedAtColumn = async (table, config, transaction) => {
    const columnName = config.updatedAtName || 'updated_at';
    const exists = await checkColumnExists(table, columnName, transaction);

    if (exists) {
        console.log(`   ⚠️  ${table}.${columnName} ya existe - saltando`);
        return false;
    }

    await db.sequelize.query(`
    ALTER TABLE ${table} 
    ADD COLUMN ${columnName} DATETIME NULL 
    COMMENT 'Última actualización del registro'
    ${config.afterColumn ? `AFTER ${config.afterColumn}` : ''}
  `, { transaction });

    console.log(`   ✅ ${table}.${columnName} creada`);
    return true;
};

const addBothTimestamps = async (table, afterColumn, transaction) => {
    const createdExists = await checkColumnExists(table, 'fecha_creacion', transaction);
    const updatedExists = await checkColumnExists(table, 'updated_at', transaction);

    let changes = 0;

    if (!createdExists) {
        await db.sequelize.query(`
      ALTER TABLE ${table} 
      ADD COLUMN fecha_creacion DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP 
      COMMENT 'Fecha de creación del registro'
      ${afterColumn ? `AFTER ${afterColumn}` : ''}
    `, { transaction });
        console.log(`   ✅ ${table}.fecha_creacion creada`);
        changes++;
    } else {
        console.log(`   ⚠️  ${table}.fecha_creacion ya existe - saltando`);
    }

    if (!updatedExists) {
        await db.sequelize.query(`
      ALTER TABLE ${table} 
      ADD COLUMN updated_at DATETIME NULL 
      COMMENT 'Última actualización del registro'
      AFTER fecha_creacion
    `, { transaction });
        console.log(`   ✅ ${table}.updated_at creada`);
        changes++;
    } else {
        console.log(`   ⚠️  ${table}.updated_at ya existe - saltando`);
    }

    return changes > 0;
};

const populateTimestamps = async (table, config, transaction) => {
    const columnName = config.updatedAtName || 'updated_at';

    if (config.createdAtColumn) {
        // Tabla con columna de fecha existente
        const [result] = await db.sequelize.query(`
      UPDATE ${table} 
      SET ${columnName} = ${config.createdAtColumn} 
      WHERE ${columnName} IS NULL
    `, { transaction });
        return result.affectedRows || 0;
    } else {
        // Tabla nueva con fecha_creacion y updated_at
        const [result] = await db.sequelize.query(`
      UPDATE ${table} 
      SET updated_at = fecha_creacion 
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
    console.log(`
╔═══════════════════════════════════════════════════════════╗
║     MIGRACIÓN DE TIMESTAMPS - EL SANTUARIO                ║
║     Fecha: ${new Date().toLocaleDateString('es-CO')}                                    ║
╚═══════════════════════════════════════════════════════════╝
`);

    const transaction = await db.sequelize.transaction();
    const results = {
        tablesProcessed: 0,
        columnsAdded: 0,
        recordsUpdated: 0,
        errors: [],
        skipped: []
    };

    try {
        // =====================================================
        // 1. MOSTRAR TABLAS QUE YA ESTÁN COMPLETAS
        // =====================================================
        console.log("✅ Tablas que YA están completas (no requieren migración):");
        console.log("─".repeat(60));
        TABLES_CONFIG.alreadyComplete.forEach(table => {
            console.log(`   ✅ ${table}`);
        });

        // =====================================================
        // 2. PROCESAR TABLAS CON CREATED_AT EXISTENTE
        // =====================================================
        console.log("\n\n📝 Paso 1: Agregando updated_at a tablas existentes");
        console.log("─".repeat(60));

        for (const config of TABLES_CONFIG.withCreatedAt) {
            try {
                console.log(`\n🔧 Procesando: ${config.name}`);
                console.log(`   ℹ️  ${config.description}`);

                // Verificar si la tabla existe
                const tableInfo = await getTableInfo(config.name, transaction);
                if (!tableInfo) {
                    console.log(`   ⚠️  Tabla ${config.name} no existe - saltando`);
                    results.skipped.push(config.name);
                    continue;
                }

                const changed = await addUpdatedAtColumn(config.name, config, transaction);

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
        // 3. PROCESAR TABLAS QUE NECESITAN AMBOS TIMESTAMPS
        // =====================================================
        console.log("\n\n📝 Paso 2: Agregando created_at y updated_at");
        console.log("─".repeat(60));

        for (const config of TABLES_CONFIG.needsBothTimestamps) {
            try {
                console.log(`\n🔧 Procesando: ${config.name}`);
                console.log(`   ℹ️  ${config.description}`);

                const tableInfo = await getTableInfo(config.name, transaction);
                if (!tableInfo) {
                    console.log(`   ⚠️  Tabla ${config.name} no existe - saltando`);
                    results.skipped.push(config.name);
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
        // 4. VERIFICACIÓN FINAL
        // =====================================================
        console.log("\n\n📝 Paso 3: Verificación de estructura final");
        console.log("─".repeat(60));

        const allTables = [
            ...TABLES_CONFIG.alreadyComplete,
            ...TABLES_CONFIG.withCreatedAt.map(t => t.name),
            ...TABLES_CONFIG.needsBothTimestamps.map(t => t.name)
        ];

        const verification = [];
        for (const tableName of allTables) {
            try {
                const columns = await getTableInfo(tableName, transaction);
                if (!columns) continue;

                const hasCreatedAt = columns.some(c =>
                    ['created_at', 'fecha_creacion', 'fecha_venta', 'fecha_recepcion', 'fecha_movimiento'].includes(c.Field)
                );
                const hasUpdatedAt = columns.some(c =>
                    ['updated_at', 'fecha_actualizacion'].includes(c.Field)
                );

                verification.push({
                    tabla: tableName,
                    created: hasCreatedAt ? '✅' : '❌',
                    updated: hasUpdatedAt ? '✅' : '❌',
                    estado: (hasCreatedAt && hasUpdatedAt) ? '✅ COMPLETO' : '⚠️ INCOMPLETO'
                });
            } catch (err) {
                // Tabla no existe
            }
        }

        console.log("\n");
        console.table(verification);

        // =====================================================
        // 5. COMMIT
        // =====================================================
        await transaction.commit();

        const endTime = Date.now();
        const duration = ((endTime - startTime) / 1000).toFixed(2);

        console.log("\n" + "=".repeat(60));
        console.log("✅ ¡MIGRACIÓN COMPLETADA EXITOSAMENTE!");
        console.log("=".repeat(60));
        console.log(`⏱️  Tiempo total: ${duration}s`);
        console.log(`📊 Tablas procesadas: ${results.tablesProcessed}`);
        console.log(`📊 Columnas agregadas: ${results.columnsAdded}`);
        console.log(`📊 Registros actualizados: ${results.recordsUpdated}`);

        if (results.skipped.length > 0) {
            console.log(`\n⚠️  Tablas saltadas: ${results.skipped.join(', ')}`);
        }

        if (results.errors.length > 0) {
            console.log(`\n⚠️  Errores encontrados: ${results.errors.length}`);
            results.errors.forEach(err => {
                console.log(`   • ${err.table}: ${err.error}`);
            });
        }

        console.log("\n📋 PRÓXIMOS PASOS:");
        console.log("   1. ✅ Los modelos ya están actualizados");
        console.log("   2. 🔄 Reinicia el servidor: npm run dev");
        console.log("   3. 🧪 Prueba operaciones CRUD en cada tabla");
        console.log("   4. 🔍 Verifica que timestamps funcionen automáticamente");

        process.exit(0);

    } catch (error) {
        await transaction.rollback();
        console.error("\n❌ ERROR CRÍTICO durante la migración:", error.message);
        console.error(error.stack);
        console.error("\n🔄 Los cambios fueron revertidos (rollback automático)");
        process.exit(1);
    }
};

// Ejecutar migración
runMigration();