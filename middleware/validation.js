import Joi from "joi";

// Middleware para validación
const validate = (schema) => {
  return (req, res, next) => {
    const { error } = schema.validate(req.body, { abortEarly: false });

    if (error) {
      const errors = error.details.map((detail) => ({
        field: detail.path.join("."),
        message: detail.message,
      }));

      return res.status(400).json({
        error: "Datos de entrada inválidos",
        details: errors,
      });
    }

    next();
  };
};

// Esquemas de validación
const schemas = {
  login: Joi.object({
    username: Joi.string().alphanum().min(3).max(50).required(),
    password: Joi.string().min(6).required(),
  }),

  usuario: Joi.object({
    username: Joi.string().alphanum().min(3).max(50).required(),
    password: Joi.string().min(6).required(),
    email: Joi.string().email().required(),
    nombre: Joi.string().min(2).max(100).required(),
    apellido: Joi.string().min(2).max(100).required(),
    rol: Joi.string()
      .valid("cajero", "administrador", "dueño", "ayudante")
      .required(),
  }),

  producto: Joi.object({
    codigo_barras: Joi.string().max(50).allow("", null),
    nombre: Joi.string().min(2).max(200).required(),
    descripcion: Joi.string().max(1000).allow("", null),
    categoria_id: Joi.number().integer().positive().required(),
    precio_compra: Joi.number().positive().precision(2).required(),
    precio_venta: Joi.number().positive().precision(2).required(),
    tipo_medida: Joi.string().valid("unidad", "peso").default("unidad"),
    stock_actual: Joi.number().min(0).precision(3).default(0),
    stock_minimo: Joi.number().min(0).precision(3).default(0),
  }),

  categoria: Joi.object({
    nombre: Joi.string().min(2).max(100).required(),
    descripcion: Joi.string().max(1000).allow("", null),
  }),

  proveedor: Joi.object({
    nombre: Joi.string().min(2).max(200).required(),
    contacto: Joi.string().max(100).allow("", null),
    telefono: Joi.string().max(20).allow("", null),
    email: Joi.string().email().allow("", null),
    direccion: Joi.string().max(500).allow("", null),
    ciudad: Joi.string().max(100).allow("", null),
    pais: Joi.string().max(100).default("Colombia"),
  }),

  venta: Joi.object({
    productos: Joi.array()
      .items(
        Joi.object({
          producto_id: Joi.number().integer().positive().required(),
          cantidad: Joi.number().positive().precision(3).required(),
          precio_unitario: Joi.number().positive().precision(2).required(),
        })
      )
      .min(1)
      .required(),
    metodo_pago: Joi.string()
      .valid("efectivo", "tarjeta", "transferencia")
      .default("efectivo"),
  }),

  recepcion: Joi.object({
    numero_factura: Joi.string().max(100).required(),
    proveedor_id: Joi.number().integer().positive().required(),
    fecha_recepcion: Joi.date().required(),
    observaciones: Joi.string().max(1000).allow("", null),
    productos: Joi.array()
      .items(
        Joi.object({
          producto_id: Joi.number().integer().positive().required(),
          cantidad: Joi.number().positive().precision(3).required(),
          precio_unitario: Joi.number().positive().precision(2).required(),
        })
      )
      .min(1)
      .required(),
  }),
};

export { validate, schemas };
