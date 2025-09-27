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

export { validate };
