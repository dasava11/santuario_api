import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import db from "./models/index.js"; // Sequelize + modelos
import routes from "./routes/index.js"; // Centralización de rutas
import swaggerJsdoc from "swagger-jsdoc";
import swaggerUi from "swagger-ui-express";
import { trackPerformance } from "./middleware/performance.js";
import { generalLimiter } from "./middleware/rateLimiters.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3021;

// =========================
// 🌐 Middlewares globales
// =========================
app.use(
  cors({
    origin:
      process.env.NODE_ENV === "production"
        ? [
          "https://santuario-front-8o49.vercel.app",
          "https://santuario-desarrollo.vercel.app",
        ]
        : ["http://localhost:4200"],
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: [
      "Origin",
      "X-Requested-With",
      "Content-Type",
      "Accept",
      "Authorization",
    ],
    credentials: true,
  })
);

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));
// Performance tracking (debe ir ANTES de las rutas)
app.use(trackPerformance);

// Rate limiting global (opcional, puedes aplicarlo solo a /api)
app.use("/api", generalLimiter);

// =========================
// 📄 Swagger Config
// =========================
const swaggerOptions = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "API El Santuario",
      version: "2.0.0",
      description: "Documentación con Swagger para la API de El Santuario",
    },
    servers: [{ url: `http://localhost:${PORT}/api` }],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
          description: "Token JWT (opcional para pruebas Swagger, requerido en endpoints protegidos)",
        },
      },
    },
  },
  apis: ["./routes/**/*.js"], // aquí Swagger busca las anotaciones JSDoc
};

const swaggerSpec = swaggerJsdoc(swaggerOptions);
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// =========================
// 🚀 Rutas
// =========================
app.use("/api", routes);

// Endpoint health-check
app.get("/health", (req, res) => {
  res.json({
    status: "OK",
    message: "Servidor funcionando correctamente",
    timestamp: new Date().toISOString(),
  });
});

// =========================
// ⚠️ Manejo de errores
// =========================
app.use((err, req, res, next) => {
  console.error("❌ Error:", err);

  if (err.type === "entity.parse.failed") {
    return res.status(400).json({ error: "JSON inválido en la solicitud" });
  }

  if (err.name === "SequelizeConnectionError") {
    return res
      .status(500)
      .json({ error: "Error de conexión con la base de datos" });
  }

  res.status(500).json({
    error: "Error interno del servidor",
    message:
      process.env.NODE_ENV === "development" ? err.message : "Algo salió mal",
  });
});

// =========================
// 🔌 Inicialización
// =========================
async function startServer() {
  try {
    await db.sequelize.authenticate();
    console.log("✅ Conectado correctamente a la base de datos");

    // Determinar modo de sincronización
    if (process.env.FORCE_DB_RESET === "true") {
      await db.sequelize.sync({ force: true });
      console.log("⚠️ Base de datos reiniciada con éxito (modo FORCE)");
    } else if (process.env.ALTER_DB_SCHEMA === "true") {
      await db.sequelize.sync({ alter: true });
      console.log("🔧 Esquema de base de datos actualizado (modo ALTER)");
    } else {
      await db.sequelize.sync();
      console.log("📌 Base de datos sincronizada (modo normal)");
    }

    app.listen(PORT, () => {
      console.log(`🚀 Servidor ejecutándose en puerto ${PORT}`);
      console.log(`📊 Ambiente: ${process.env.NODE_ENV}`);
      console.log(`🔗 API URL: http://localhost:${PORT}/api`);
      console.log(`📚 Swagger UI: http://localhost:${PORT}/api-docs`);
    });
  } catch (error) {
    console.error("❌ No se pudo conectar a la base de datos:", error);
    process.exit(1);
  }
}

startServer();
