import express from "express";

import authRoutes from "./auth_router.js";
import usuariosRoutes from "./usuarios_router.js";
import productosRoutes from "./productos_router.js";
import categoriasRoutes from "./categorias_router.js";
import proveedoresRoutes from "./proveedores_router.js";
import recepcionesRoutes from "./recepciones_router.js";
import ventasRoutes from "./ventas_router.js";
import inventarioRoutes from "./inventario_router.js";

const router = express.Router();

router.use("/auth", authRoutes);
router.use("/usuarios", usuariosRoutes);
router.use("/productos", productosRoutes);
router.use("/categorias", categoriasRoutes);
router.use("/proveedores", proveedoresRoutes);
router.use("/recepciones", recepcionesRoutes);
router.use("/ventas", ventasRoutes);
router.use("/inventario", inventarioRoutes);

export default router;
