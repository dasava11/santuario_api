// controllers/authControlador.js - Refactorizado: Consistencia Total
import authService from "../services/authService.js";
import {
  buildSuccessResponse,
  createControllerLogger,
  buildOperationMetadata,
  generateSuccessMessage,
  asyncControllerWrapper,
} from "../utils/controllerResponseUtils.js";

const logger = createControllerLogger("auth");

// =====================================================
// LOGIN DE USUARIO
// =====================================================
const login = asyncControllerWrapper(async (req, res) => {
  const { username, password } = req.body;

  const result = await authService.autenticarUsuario({ username, password });

  const metadata = buildOperationMetadata("login", result.data.user.id, {
    ...result.metadata,
    username: result.data.user.username,
    rol: result.data.user.rol,
  });

  logger.business("Login exitoso", {
    user_id: result.data.user.id,
    username: result.data.user.username,
    rol: result.data.user.rol,
  });

  res.json(
    buildSuccessResponse(
      {
        message: `Bienvenido ${result.data.user.nombre}`,
        token: result.data.token,
        user: result.data.user,
      },
      metadata
    )
  );
}, "login de usuario");

// =====================================================
// VERIFICAR TOKEN
// =====================================================
const verifyToken = asyncControllerWrapper(async (req, res) => {
  const metadata = buildOperationMetadata("token_verification", req.user.id, {
    verification_timestamp: new Date().toISOString(),
  });

  res.json(
    buildSuccessResponse(
      {
        valid: true,
        message: "Token válido",
        user: req.user,
      },
      metadata
    )
  );
}, "verificación de token");

// =====================================================
// LOGOUT
// =====================================================
const logout = asyncControllerWrapper(async (req, res) => {
  const metadata = buildOperationMetadata("logout", req.user?.id || null, {
    logout_timestamp: new Date().toISOString(),
  });

  if (req.user) {
    logger.business("Logout exitoso", {
      user_id: req.user.id,
      username: req.user.username,
    });
  }

  res.json(
    buildSuccessResponse(
      {
        message: "Sesión cerrada exitosamente",
        timestamp: new Date().toISOString(),
      },
      metadata
    )
  );
}, "logout de usuario");

// =====================================================
// OBTENER PERFIL
// =====================================================
const obtenerPerfil = asyncControllerWrapper(async (req, res) => {
  const userId = req.user.id;
  const result = await authService.obtenerPerfilUsuario(userId);

  const metadata = buildOperationMetadata("consulta_perfil", userId, {
    ...result.metadata,
    last_access: new Date().toISOString(),
  });

  if (result.fromCache) {
    logger.cache("HIT", `auth:profile:${userId}`);
  } else {
    logger.cache("MISS → SET", `auth:profile:${userId}`);
  }

  res.json(buildSuccessResponse(result.data, metadata, result.fromCache));
}, "consulta de perfil");

// =====================================================
// ACTUALIZAR PERFIL
// =====================================================
const actualizarPerfil = asyncControllerWrapper(async (req, res) => {
  const userId = req.user.id;

  const result = await authService.actualizarPerfilUsuario(userId, req.body);

  const metadata = buildOperationMetadata("actualizar_perfil", userId, {
    campos_modificados: result.camposModificados,
  });

  logger.business("Perfil actualizado", {
    user_id: userId,
    campos: result.camposModificados,
  });

  const mensaje = generateSuccessMessage(
    "actualizar",
    "Perfil",
    result.usuario.username
  );

  res.json(
    buildSuccessResponse(
      {
        message: mensaje,
        user: {
          id: result.usuario.id,
          username: result.usuario.username,
          email: result.usuario.email,
          nombre: result.usuario.nombre,
          apellido: result.usuario.apellido,
          rol: result.usuario.rol,
          fecha_actualizacion: result.usuario.fecha_actualizacion,
        },
        cambios_realizados: result.camposModificados,
      },
      metadata
    )
  );
}, "actualización de perfil");

// =====================================================
// CAMBIAR CONTRASEÑA
// =====================================================
const cambiarPassword = asyncControllerWrapper(async (req, res) => {
  const { password_actual, password_nuevo } = req.body;
  const userId = req.user.id;

  const result = await authService.cambiarPasswordUsuario(userId, {
    passwordActual: password_actual,
    passwordNuevo: password_nuevo,
  });

  const metadata = buildOperationMetadata("cambio_password", userId, {
    ...result.metadata,
    security_level: "user_authenticated",
  });

  logger.business("Contraseña cambiada", {
    user_id: userId,
    username: req.user.username,
    password_strength: result.metadata.password_strength,
  });

  res.json(
    buildSuccessResponse(
      {
        message: "Contraseña actualizada exitosamente",
        password_info: {
          strength: result.metadata.password_strength,
          changed_at: result.metadata.password_changed_at,
        },
      },
      metadata
    )
  );
}, "cambio de contraseña");

// =====================================================
// ESTADÍSTICAS DE SESIÓN (OPCIONAL)
// =====================================================
const obtenerEstadisticasSesiones = asyncControllerWrapper(async (req, res) => {
  const result = await authService.obtenerEstadisticasSesiones();

  const metadata = buildOperationMetadata("estadisticas_sesiones", null, {
    consulted_by: req.user.id,
    consulted_at: new Date().toISOString(),
  });

  if (result.fromCache) {
    logger.cache("HIT", "auth:session_stats");
  } else {
    logger.cache("MISS → SET", "auth:session_stats");
  }

  res.json(buildSuccessResponse(result.data, metadata, result.fromCache));
}, "estadísticas de sesiones");

// =====================================================
// MANTENIMIENTO (OPCIONAL - SOLO PARA ADMINISTRADORES)
// =====================================================
const limpiarSesiones = asyncControllerWrapper(async (req, res) => {
  const result = await authService.limpiarSesionesExpiradas();

  const metadata = buildOperationMetadata("limpieza_sesiones", null, {
    executed_by: req.user.id,
    execution_time_ms: result.execution_time,
  });

  logger.business("Limpieza de sesiones ejecutada", {
    cleaned_entries: result.cleaned_entries,
    executed_by: req.user.username,
  });

  res.json(
    buildSuccessResponse(
      {
        message: "Limpieza de sesiones completada",
        cleaned_entries: result.cleaned_entries,
        execution_time_ms: result.execution_time,
      },
      metadata
    )
  );
}, "limpieza de sesiones");

// =====================================================
// EXPORTACIONES
// =====================================================
export {
  // Funciones principales de autenticación
  login,
  verifyToken,
  logout,
  obtenerPerfil,
  actualizarPerfil,
  cambiarPassword,

  // Funciones opcionales/administrativas
  obtenerEstadisticasSesiones,
  limpiarSesiones,
};
