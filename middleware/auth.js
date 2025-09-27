import jwt from "jsonwebtoken";
import { executeQuery } from "../config/database.js";

// Middleware para verificar JWT
const verifyToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        error: "Token de acceso requerido",
      });
    }

    const token = authHeader.substring(7);

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // Verificar si el usuario aún existe y está activo
      const user = await executeQuery(
        "SELECT id, username, email, nombre, apellido, rol, activo FROM usuarios WHERE id = ? AND activo = true",
        [decoded.userId]
      );

      if (user.length === 0) {
        return res.status(401).json({
          error: "Usuario no válido o inactivo",
        });
      }

      req.user = user[0];
      next();
    } catch (jwtError) {
      return res.status(401).json({
        error: "Token inválido o expirado",
      });
    }
  } catch (error) {
    console.error("Error en middleware de autenticación:", error);
    res.status(500).json({
      error: "Error interno del servidor",
    });
  }
};

// Middleware para verificar roles
const verifyRole = (allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        error: "Usuario no autenticado",
      });
    }

    if (!allowedRoles.includes(req.user.rol)) {
      return res.status(403).json({
        error: "No tienes permisos para realizar esta acción",
        requiredRoles: allowedRoles,
        userRole: req.user.rol,
      });
    }

    next();
  };
};

export { verifyToken, verifyRole };
