// controllers/usuariosControlador.js
import usuariosService from "../services/usuariosService.js";
import {
  buildSuccessResponse,
  createControllerLogger,
  buildOperationMetadata,
  buildBusinessErrorResponse,
  generateSuccessMessage,
  asyncControllerWrapper,
} from "../utils/controllerResponseUtils.js";

const logger = createControllerLogger("usuarios");

// =====================================================
// OBTENER USUARIOS
// =====================================================
const obtenerUsuarios = asyncControllerWrapper(async (req, res) => {
  const result = await usuariosService.obtenerUsuariosFiltrados(req.query);

  const metadata = buildOperationMetadata("consulta", null, {
    ...result.metadata,
    tiempo_consulta_ms: performance.now() - req.startTime,
  });

  if (result.fromCache) {
    logger.cache("HIT", "usuarios:list");
  } else {
    logger.cache("MISS → SET", "usuarios:list");
  }

  res.json(
    buildSuccessResponse(
      {
        usuarios: result.data,
        pagination: result.pagination,
      },
      metadata,
      result.fromCache
    )
  );
}, "consulta de usuarios");

// =====================================================
// OBTENER USUARIO POR ID
// =====================================================
const obtenerUsuarioPorId = asyncControllerWrapper(async (req, res) => {
  const { id } = req.params;
  const result = await usuariosService.obtenerUsuarioPorId(id);

  if (!result) {
    return res
      .status(404)
      .json(
        buildBusinessErrorResponse("Usuario no encontrado", { usuario_id: id })
      );
  }

  const metadata = buildOperationMetadata(
    "consulta_individual",
    id,
    result.metadata
  );

  if (result.fromCache) {
    logger.cache("HIT", `usuario:${id}`);
  } else {
    logger.cache("MISS → SET", `usuario:${id}`);
  }

  res.json(buildSuccessResponse(result.data, metadata, result.fromCache));
}, "consulta de usuario");

// =====================================================
// BUSCAR USUARIOS
// =====================================================
const buscarUsuarios = asyncControllerWrapper(async (req, res) => {
  const { termino, limit, incluirInactivos } = req.query;

  const result = await usuariosService.buscarUsuarios(termino, {
    limit,
    incluirInactivos: incluirInactivos === "true",
  });

  const metadata = buildOperationMetadata("busqueda", null, result.metadata);

  if (result.fromCache) {
    logger.cache("HIT", `usuarios:search:${termino}`);
  } else {
    logger.cache("MISS → SET", `usuarios:search:${termino}`);
  }

  res.json(buildSuccessResponse(result.data, metadata, result.fromCache));
}, "búsqueda de usuarios");

// =====================================================
// CREAR USUARIO
// =====================================================
const crearUsuario = asyncControllerWrapper(async (req, res) => {
  try {
    const nuevoUsuario = await usuariosService.crearUsuario(req.body);

    const metadata = buildOperationMetadata("creacion", nuevoUsuario.id);

    logger.business("Usuario creado", {
      id: nuevoUsuario.id,
      username: nuevoUsuario.username,
      rol: nuevoUsuario.rol,
    });

    const mensaje = generateSuccessMessage(
      "crear",
      "Usuario",
      nuevoUsuario.username
    );

    res.status(201).json(
      buildSuccessResponse(
        {
          mensaje,
          usuario: {
            id: nuevoUsuario.id,
            username: nuevoUsuario.username,
            email: nuevoUsuario.email,
            nombre: nuevoUsuario.nombre,
            apellido: nuevoUsuario.apellido,
            rol: nuevoUsuario.rol,
            activo: nuevoUsuario.activo,
          },
        },
        metadata
      )
    );
  } catch (error) {
    if (error.message.startsWith("USERNAME_EXISTS:")) {
      const username = error.message.split(":")[1];
      return res.status(400).json(
        buildBusinessErrorResponse(
          `Ya existe un usuario con el nombre de usuario "${username}"`,
          {
            field: "username",
            value: username,
            constraint: "unique",
          }
        )
      );
    }

    if (error.message.startsWith("EMAIL_EXISTS:")) {
      const email = error.message.split(":")[1];
      return res.status(400).json(
        buildBusinessErrorResponse(
          `Ya existe un usuario con el email "${email}"`,
          {
            field: "email",
            value: email,
            constraint: "unique",
          }
        )
      );
    }

    throw error;
  }
}, "creación de usuario");

// =====================================================
// ACTUALIZAR USUARIO
// =====================================================
const actualizarUsuario = asyncControllerWrapper(async (req, res) => {
  const { id } = req.params;

  try {
    const result = await usuariosService.actualizarUsuario(id, req.body);

    const metadata = buildOperationMetadata("actualizacion", id, {
      campos_modificados: result.camposModificados,
    });

    logger.business("Usuario actualizado", {
      id,
      campos: result.camposModificados,
    });

    const mensaje = generateSuccessMessage(
      "actualizar",
      "Usuario",
      req.body.username || result.usuario.username
    );

    res.json(
      buildSuccessResponse(
        {
          mensaje,
          cambios_realizados: result.camposModificados,
        },
        metadata
      )
    );
  } catch (error) {
    if (error.message === "USUARIO_NOT_FOUND") {
      return res
        .status(404)
        .json(
          buildBusinessErrorResponse(
            `No se encontró un usuario con el id: ${id}`
          )
        );
    }

    if (error.message.startsWith("USERNAME_EXISTS:")) {
      const username = error.message.split(":")[1];
      return res.status(400).json(
        buildBusinessErrorResponse(
          `Ya existe un usuario con el nombre "${username}"`,
          {
            field: "username",
            value: username,
          }
        )
      );
    }

    if (error.message.startsWith("EMAIL_EXISTS:")) {
      const email = error.message.split(":")[1];
      return res.status(400).json(
        buildBusinessErrorResponse(
          `Ya existe un usuario con el email "${email}"`,
          {
            field: "email",
            value: email,
          }
        )
      );
    }

    throw error;
  }
}, "actualización de usuario");

// =====================================================
// TOGGLE ESTADO USUARIO (ACTIVAR/DESACTIVAR)
// =====================================================
const toggleEstadoUsuario = asyncControllerWrapper(async (req, res) => {
  const { id } = req.params;

  try {
    const result = await usuariosService.toggleEstadoUsuario(id, req.user.id);

    const accion = result.estado_nuevo ? "activado" : "desactivado";
    const metadata = buildOperationMetadata(`toggle_estado_${accion}`, id, {
      estado_anterior: result.estado_anterior,
      estado_nuevo: result.estado_nuevo,
    });

    logger.business(`Usuario ${accion}`, {
      id,
      username: result.usuario.username,
      estado: result.estado_nuevo,
    });

    const mensaje = generateSuccessMessage(
      accion === "activado" ? "activar" : "desactivar",
      "Usuario",
      result.usuario.username
    );

    res.json(
      buildSuccessResponse(
        {
          mensaje,
          usuario: {
            id: result.usuario.id,
            username: result.usuario.username,
            activo: result.usuario.activo,
          },
        },
        metadata
      )
    );
  } catch (error) {
    if (error.message === "USUARIO_NOT_FOUND") {
      return res
        .status(404)
        .json(buildBusinessErrorResponse("Usuario no encontrado"));
    }

    if (error.message === "CANNOT_MODIFY_SELF") {
      return res.status(400).json(
        buildBusinessErrorResponse(
          "No puedes modificar el estado de tu propia cuenta",
          {
            restriction: "self_modification_forbidden",
          }
        )
      );
    }

    throw error;
  }
}, "toggle estado usuario");

// =====================================================
// RESETEAR CONTRASEÑA
// =====================================================
const resetearPassword = asyncControllerWrapper(async (req, res) => {
  const { id } = req.params;
  const { password_nuevo } = req.body;

  try {
    const usuario = await usuariosService.resetearPassword(
      id,
      password_nuevo,
      req.user.id
    );

    const metadata = buildOperationMetadata("reseteo_password", id, {
      fecha_reseteo: new Date().toISOString(),
    });

    logger.business("Contraseña reseteada", {
      id,
      username: usuario.username,
      admin_id: req.user.id,
    });

    res.json(
      buildSuccessResponse(
        {
          mensaje: `Contraseña del usuario ${usuario.username} reseteada exitosamente`,
          usuario: {
            id: usuario.id,
            username: usuario.username,
          },
        },
        metadata
      )
    );
  } catch (error) {
    if (error.message === "USUARIO_NOT_FOUND") {
      return res
        .status(404)
        .json(buildBusinessErrorResponse("Usuario no encontrado"));
    }

    if (error.message === "CANNOT_RESET_SELF") {
      return res.status(400).json(
        buildBusinessErrorResponse(
          "Para cambiar tu propia contraseña usa el endpoint /auth/cambiar-password",
          {
            restriction: "self_reset_forbidden",
            alternative_endpoint: "/api/auth/cambiar-password",
          }
        )
      );
    }

    throw error;
  }
}, "reseteo de contraseña");

// =====================================================
// EXPORTACIONES
// =====================================================
export {
  obtenerUsuarios,
  obtenerUsuarioPorId,
  buscarUsuarios,
  crearUsuario,
  actualizarUsuario,
  toggleEstadoUsuario,
  resetearPassword,
};
