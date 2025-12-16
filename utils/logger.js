// utils/logger.js
// Logger simple pero estructurado para supermercado pequeño

import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// =====================================================
// 📝 CONFIGURACIÓN
// =====================================================

const LOG_LEVELS = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
};

const CONFIG = {
  // Nivel mínimo que se guarda (INFO = solo INFO, WARN, ERROR)
  minLevel: process.env.LOG_LEVEL || "INFO",

  // Guardar logs en archivos
  saveToFile: process.env.SAVE_LOGS === "true",

  // Directorio de logs
  logDir: path.join(__dirname, "..", "logs"),

  // Mostrar en consola (siempre en desarrollo)
  consoleOutput: true,

  // Formato de timestamp
  timestampFormat: "ISO", // "ISO" o "LOCAL"
};

// =====================================================
// 🎨 COLORES PARA CONSOLA (opcional)
// =====================================================

const COLORS = {
  DEBUG: "\x1b[36m", // Cyan
  INFO: "\x1b[32m", // Verde
  WARN: "\x1b[33m", // Amarillo
  ERROR: "\x1b[31m", // Rojo
  RESET: "\x1b[0m",
};

// =====================================================
// 📝 CLASE LOGGER
// =====================================================

class Logger {
  constructor(module = "APP") {
    this.module = module;
  }

  /**
   * Log interno que procesa todos los niveles
   */
  async _log(level, message, data = {}) {
    // Filtrar por nivel mínimo
    if (LOG_LEVELS[level] < LOG_LEVELS[CONFIG.minLevel]) {
      return;
    }

    // Construir objeto de log estructurado
    const logEntry = {
      level,
      module: this.module,
      message,
      timestamp: new Date().toISOString(),
      data,
      environment: process.env.NODE_ENV || "development",
    };

    // Mostrar en consola
    if (CONFIG.consoleOutput) {
      this._printToConsole(logEntry);
    }

    // Guardar en archivo
    if (CONFIG.saveToFile) {
      await this._saveToFile(logEntry);
    }
  }

  /**
   * Imprimir en consola con colores
   */
  _printToConsole(logEntry) {
    const color = COLORS[logEntry.level] || COLORS.RESET;
    const emoji = this._getEmoji(logEntry.level);

    const timestamp = new Date(logEntry.timestamp).toLocaleTimeString("es-CO");
    const header = `${emoji} [${logEntry.level}] [${logEntry.module}] ${timestamp}`;

    console.log(`${color}${header}${COLORS.RESET}`, logEntry.message);

    // Mostrar data si existe
    if (Object.keys(logEntry.data).length > 0) {
      console.log("  ", logEntry.data);
    }
  }

  /**
   * Guardar en archivo (logs/YYYY-MM-DD.log)
   */
  async _saveToFile(logEntry) {
    try {
      // Crear directorio si no existe
      await fs.mkdir(CONFIG.logDir, { recursive: true });

      // Nombre de archivo por fecha
      const date = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
      const filename = path.join(CONFIG.logDir, `${date}.log`);

      // Convertir a JSON de una línea
      const logLine = JSON.stringify(logEntry) + "\n";

      // Append al archivo
      await fs.appendFile(filename, logLine);
    } catch (error) {
      // Si falla guardar logs, no crashear la app
      console.error("❌ Error guardando log:", error.message);
    }
  }

  /**
   * Obtener emoji según nivel
   */
  _getEmoji(level) {
    const emojis = {
      DEBUG: "🔍",
      INFO: "ℹ️",
      WARN: "⚠️",
      ERROR: "❌",
    };
    return emojis[level] || "📝";
  }

  // =====================================================
  // 🎯 MÉTODOS PÚBLICOS
  // =====================================================

  /**
   * Log de debugging (solo desarrollo)
   */
  debug(message, data = {}) {
    this._log("DEBUG", message, data);
  }

  /**
   * Log informativo (operaciones normales)
   */
  info(message, data = {}) {
    this._log("INFO", message, data);
  }

  /**
   * Log de advertencia (algo inusual pero no crítico)
   */
  warn(message, data = {}) {
    this._log("WARN", message, data);
  }

  /**
   * Log de error (algo falló)
   */
  error(message, errorOrData = {}) {
    const data =
      errorOrData instanceof Error
        ? {
            error_message: errorOrData.message,
            error_stack: errorOrData.stack,
            error_code: errorOrData.code,
          }
        : errorOrData;

    this._log("ERROR", message, data);
  }

  // =====================================================
  // 🏪 MÉTODOS ESPECÍFICOS PARA SUPERMERCADO
  // =====================================================

  /**
   * Log de operación de inventario
   */
  inventory(action, data = {}) {
    this._log("INFO", `inventario_${action}`, {
      ...data,
      category: "inventory",
    });
  }

  /**
   * Log de venta
   */
  sale(action, data = {}) {
    this._log("INFO", `venta_${action}`, {
      ...data,
      category: "sales",
    });
  }

  /**
   * Log de autenticación
   */
  auth(action, data = {}) {
    this._log("INFO", `auth_${action}`, {
      ...data,
      category: "authentication",
    });
  }

  /**
   * Log de performance
   */
  perf(endpoint, duration_ms, status_code) {
    const level = duration_ms > 1000 ? "WARN" : "INFO";
    this._log(level, "performance", {
      endpoint,
      duration_ms,
      status_code,
      category: "performance",
    });
  }
}

// =====================================================
// 📤 EXPORTAR INSTANCIAS PRE-CONFIGURADAS
// =====================================================

// Logger por defecto
export const logger = new Logger("APP");

// Loggers específicos por módulo
export const inventoryLogger = new Logger("INVENTARIO");
export const salesLogger = new Logger("VENTAS");
export const authLogger = new Logger("AUTH");
export const dbLogger = new Logger("DATABASE");

// Factory para crear loggers personalizados
export const createLogger = (moduleName) => new Logger(moduleName);

// Export default para import directo
export default logger;
