// middlewares/validation.js - Extensión del existente

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

// EXTENSIÓN: Validador para diferentes fuentes (params, query)
const validateSource = (schema, source = "body", options = {}) => {
  const defaultOptions = {
    abortEarly: false,
    stripUnknown: true,
    convert: true,
    ...options,
  };

  return (req, res, next) => {
    const { error, value } = schema.validate(req[source], defaultOptions);

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

    // Reemplazar con valores validados
    req[source] = value;
    next();
  };
};

export { validate, validateSource };
