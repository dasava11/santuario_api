// ========================
// 🚀 OPTIMIZACIONES IMPLEMENTADAS:
// ========================
// ✅ Carga en paralelo con límite de concurrencia
// ✅ Mejor manejo de errores individual por modelo
// ✅ Cache para desarrollo
// ✅ Validaciones mejoradas
// ✅ Logging detallado con tiempo de carga
// ✅ Estadísticas de rendimiento
// ✅ ESM6 + Arrow Functions

// models/index.js - Versión Compatible con Sequelize-Auto (COMPLETA)
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { DataTypes } from "sequelize";
import { sequelize } from "../config/database.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const db = {};
const modelCache = new Map();
const BATCH_SIZE = 5;

// 🔄 Función principal de carga con detección automática de estructura
const loadModels = async () => {
  const startTime = performance.now();
  console.log("🔄 Iniciando carga de modelos...");

  try {
    const modelFiles = getValidModelFiles();
    console.log(`📁 Encontrados ${modelFiles.length} archivos de modelo`);

    await loadModelsInBatches(modelFiles);
    await setupAssociations();

    const endTime = performance.now();
    const loadTime = (endTime - startTime).toFixed(2);
    const loadedModels = Object.keys(db).filter(
      (key) =>
        ![
          "sequelize",
          "Sequelize",
          "getStats",
          "findModel",
          "listModelsInfo",
          "clearCache",
          "reloadModel",
        ].includes(key)
    );

    console.log(
      `✅ Carga completada: ${loadedModels.length} modelos en ${loadTime}ms`
    );
    console.log(`📊 Modelos cargados: ${loadedModels.join(", ")}`);

    return db;
  } catch (error) {
    console.error("❌ Error crítico en carga de modelos:", error);
    throw error;
  }
};

// 📁 Obtener archivos válidos de modelo
const getValidModelFiles = () =>
  fs
    .readdirSync(__dirname)
    .filter((file) => {
      const conditions = {
        isJsFile: file.endsWith(".js"),
        isNotIndex: file !== "index.js",
        isNotTest: !file.match(/\.(test|spec)\.js$/),
        isNotPrivate: !file.startsWith("_") && !file.startsWith("."),
        isNotInit: file !== "init-models.js",
      };
      return Object.values(conditions).every((condition) => condition);
    })
    .sort();

// 📦 Cargar modelos en lotes
const loadModelsInBatches = async (modelFiles) => {
  for (let i = 0; i < modelFiles.length; i += BATCH_SIZE) {
    const batch = modelFiles.slice(i, i + BATCH_SIZE);
    const batchNumber = Math.floor(i / BATCH_SIZE) + 1;

    console.log(`📦 Procesando lote ${batchNumber}: [${batch.join(", ")}]`);

    const batchPromises = batch.map((file) => loadSingleModel(file));
    const results = await Promise.allSettled(batchPromises);

    results.forEach((result, index) => {
      const fileName = batch[index];
      if (result.status === "rejected") {
        console.error(`❌ Error en ${fileName}: ${result.reason.message}`);
      }
    });
  }
};

// 📋 Cargar modelo con detección automática de estructura
const loadSingleModel = async (file) => {
  const modelName = path.basename(file, ".js");
  const modelPath = path.join(__dirname, file);

  try {
    const cacheKey = `${file}-${fs.statSync(modelPath).mtime.getTime()}`;

    if (process.env.NODE_ENV === "development" && modelCache.has(cacheKey)) {
      console.log(`💾 Usando cache para ${modelName}`);
      const cachedModel = modelCache.get(cacheKey);
      db[cachedModel.name] = cachedModel;
      return cachedModel;
    }

    const importUrl =
      process.env.NODE_ENV === "development"
        ? `${modelPath}?t=${Date.now()}`
        : modelPath;

    const moduleExport = await import(importUrl);
    let model = null;

    // 🔍 DETECCIÓN AUTOMÁTICA DE ESTRUCTURA DE MODELO
    if (typeof moduleExport.default === "function") {
      // Caso 1: Export default es función directa (estructura clásica)
      console.log(`🔧 ${modelName}: Estructura de función directa`);

      // Detectar si la función espera DataTypes como segundo parámetro
      const functionStr = moduleExport.default.toString();
      const expectsDataTypes =
        functionStr.includes("DataTypes") &&
        functionStr.match(/\(.*sequelize.*,.*DataTypes.*\)/);

      model = expectsDataTypes
        ? moduleExport.default(sequelize, DataTypes)
        : moduleExport.default(sequelize);
    } else if (
      moduleExport.default &&
      typeof moduleExport.default.init === "function"
    ) {
      // Caso 2: Export default es clase con método init (sequelize-auto)
      console.log(`🔧 ${modelName}: Estructura de clase sequelize-auto`);
      model = moduleExport.default.init(sequelize, DataTypes);

      // Copiar método associate si existe
      if (typeof moduleExport.default.associate === "function") {
        model.associate = moduleExport.default.associate;
      }
    } else if (moduleExport.default && moduleExport.default.name) {
      // Caso 3: Export default es ya una instancia de modelo
      console.log(`🔧 ${modelName}: Modelo ya instanciado`);
      model = moduleExport.default;
    } else {
      // Caso 4: Buscar named exports
      const namedExports = Object.keys(moduleExport).filter(
        (key) => key !== "default"
      );
      if (namedExports.length > 0) {
        console.log(`🔧 ${modelName}: Usando named export: ${namedExports[0]}`);
        const exportedModel = moduleExport[namedExports[0]];

        if (typeof exportedModel === "function") {
          const funcStr = exportedModel.toString();
          const expectsDataTypes =
            funcStr.includes("DataTypes") &&
            funcStr.match(/\(.*sequelize.*,.*DataTypes.*\)/);
          model = expectsDataTypes
            ? exportedModel(sequelize, DataTypes)
            : exportedModel(sequelize);
        } else if (typeof exportedModel.init === "function") {
          model = exportedModel.init(sequelize, DataTypes);
          if (typeof exportedModel.associate === "function") {
            model.associate = exportedModel.associate;
          }
        } else {
          model = exportedModel;
        }
      }
    }

    // Validar modelo final
    if (!model) {
      throw new Error(
        `No se pudo determinar la estructura del modelo en ${file}`
      );
    }

    // 🔧 VALIDACIÓN CORREGIDA - Los modelos de Sequelize son FUNCIONES
    if (typeof model !== "function" && typeof model !== "object") {
      throw new Error(
        `El modelo debe ser una función o objeto válido en ${file}. Recibido: ${typeof model}`
      );
    }

    // Los modelos de Sequelize pueden no tener .name inmediatamente
    // pero sí tienen otras propiedades como .tableName
    if (!model.name && !model.tableName) {
      console.log(`⚠️ ${modelName}: Asignando nombre por defecto`);
      model.name = modelName;
    }

    // Si no tiene name pero tiene tableName, usar tableName
    if (!model.name && model.tableName) {
      model.name = model.tableName;
    }

    // Agregar al registry usando el nombre correcto
    const modelKey = model.name || model.tableName || modelName;
    db[modelKey] = model;

    // Cachear en desarrollo
    process.env.NODE_ENV === "development" && modelCache.set(cacheKey, model);

    console.log(
      `✅ ${modelName} → ${modelKey} (tableName: ${model.tableName || "N/A"})`
    );

    return model;
  } catch (error) {
    const errorMsg = `Error cargando ${modelName}: ${error.message}`;
    console.error(`❌ ${errorMsg}`);

    if (process.env.NODE_ENV === "production") {
      throw new Error(errorMsg);
    } else {
      console.warn(`⚠️ Continuando sin ${modelName} (modo desarrollo)`);
    }
  }
};

// 🔗 Configurar asociaciones
const setupAssociations = async () => {
  const modelsWithAssociations = Object.values(db).filter(
    (model) => model && typeof model.associate === "function"
  );

  if (modelsWithAssociations.length === 0) {
    console.log("ℹ️ No se encontraron asociaciones que configurar");
    return;
  }

  console.log(
    `🔗 Configurando asociaciones para ${modelsWithAssociations.length} modelos...`
  );

  const associationResults = await Promise.allSettled(
    modelsWithAssociations.map(async (model) => {
      try {
        model.associate(db);
        return `✅ ${model.name}: asociaciones OK`;
      } catch (error) {
        const errorMsg = `❌ ${model.name}: ${error.message}`;
        console.error(errorMsg);

        process.env.NODE_ENV === "production" &&
          (() => {
            throw error;
          })();
        return errorMsg;
      }
    })
  );

  associationResults.forEach(
    (result) => result.status === "fulfilled" && console.log(result.value)
  );

  const successful = associationResults.filter(
    (r) => r.status === "fulfilled"
  ).length;
  console.log(
    `🎯 ${successful}/${modelsWithAssociations.length} asociaciones configuradas`
  );
};

// ========================
// 🔧 UTILIDADES ADICIONALES
// ========================

// 📊 Estadísticas de modelos
const getModelStats = () => {
  const models = Object.keys(db).filter(
    (key) =>
      ![
        "sequelize",
        "Sequelize",
        "getStats",
        "findModel",
        "listModelsInfo",
        "clearCache",
        "reloadModel",
      ].includes(key)
  );
  const tablesWithAssociations = Object.values(db).filter(
    (model) => model && typeof model?.associate === "function"
  ).length;

  return {
    totalModels: models.length,
    modelsWithAssociations: tablesWithAssociations,
    modelNames: models.sort(),
    environment: process.env.NODE_ENV || "development",
    cacheSize: modelCache.size,
    timestamp: new Date().toISOString(),
  };
};

// 🔄 Hot reload para desarrollo
const reloadModel = async (modelName) => {
  process.env.NODE_ENV !== "development" &&
    (() => {
      throw new Error("Hot reload solo disponible en desarrollo");
    })();

  console.log(`🔄 Recargando modelo: ${modelName}`);

  modelCache.clear();
  const file = `${modelName}.js`;
  await loadSingleModel(file);

  db[modelName] &&
    typeof db[modelName].associate === "function" &&
    db[modelName].associate(db);

  console.log(`✅ ${modelName} recargado exitosamente`);
};

// 🧹 Limpiar cache
const clearCache = () => {
  modelCache.clear();
  console.log("🧹 Cache de modelos limpiado");
};

// 🔍 Buscar modelo por nombre
const findModel = (modelName) =>
  db[modelName] ||
  Object.values(db).find(
    (model) => model && model.name?.toLowerCase() === modelName.toLowerCase()
  );

// 📝 Listar información de modelos
const listModelsInfo = () =>
  Object.entries(db)
    .filter(
      ([key]) =>
        ![
          "sequelize",
          "Sequelize",
          "getStats",
          "findModel",
          "listModelsInfo",
          "clearCache",
          "reloadModel",
        ].includes(key)
    )
    .filter(([key, model]) => model && model.name) // Solo modelos válidos
    .map(([key, model]) => ({
      name: model.name || key,
      tableName: model.tableName,
      hasAssociations: typeof model.associate === "function",
      attributes: Object.keys(model.rawAttributes || {}),
      associations: Object.keys(model.associations || {}),
    }));

// ========================
// 🚀 EJECUCIÓN
// ========================

// Cargar todos los modelos
await loadModels();

// Agregar sequelize y utilidades al objeto db
Object.assign(db, {
  sequelize,
  Sequelize: DataTypes,
  getStats: getModelStats,
  findModel,
  listModelsInfo,
  // Solo en desarrollo
  ...(process.env.NODE_ENV === "development" && {
    reloadModel,
    clearCache,
  }),
});

export default db;
