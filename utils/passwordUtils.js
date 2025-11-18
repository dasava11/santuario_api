// /utils/passwordUtils.js

import bcrypt from "bcryptjs";

// =====================================================
// 🔐 UTILIDADES DE PASSWORD
// =====================================================

/**
 * Encripta una contraseña usando bcrypt
 * @param {string} password - Contraseña en texto plano
 * @param {number} saltRounds - Rounds de salt (default: 12)
 * @returns {Promise<string>} Contraseña hasheada
 */
const hashPassword = async (password, saltRounds = 12) => {
  try {
    return await bcrypt.hash(password, saltRounds);
  } catch (error) {
    console.error("Error hasheando contraseña:", error);
    throw new Error("Error procesando contraseña");
  }
};

/**
 * Compara una contraseña en texto plano con su hash
 * @param {string} plainPassword - Contraseña en texto plano
 * @param {string} hashedPassword - Contraseña hasheada
 * @returns {Promise<boolean>} True si coinciden
 */
const comparePassword = async (plainPassword, hashedPassword) => {
  try {
    return await bcrypt.compare(plainPassword, hashedPassword);
  } catch (error) {
    console.error("Error comparando contraseña:", error);
    throw new Error("Error validando contraseña");
  }
};

/**
 * Valida la fortaleza de una contraseña según políticas del supermercado
 * @param {string} password - Contraseña a validar
 * @returns {Object} { isValid: boolean, errors: string[], score: number }
 */
const validatePasswordStrength = (password) => {
  const errors = [];
  let score = 0;

  // Validaciones básicas
  if (!password) {
    return {
      isValid: false,
      errors: ["La contraseña es requerida"],
      score: 0,
    };
  }

  // Longitud mínima (para supermercado: seguridad básica pero usable)
  if (password.length < 6) {
    errors.push("La contraseña debe tener al menos 6 caracteres");
  } else if (password.length >= 8) {
    score += 1; // Bonus por longitud adecuada
  }

  // Al menos una letra
  if (!/[a-zA-Z]/.test(password)) {
    errors.push("La contraseña debe contener al menos una letra");
  } else {
    score += 1;
  }

  // Al menos un número
  if (!/\d/.test(password)) {
    errors.push("La contraseña debe contener al menos un número");
  } else {
    score += 1;
  }

  // Bonus por complejidad adicional (opcional para empleados de supermercado)
  if (/[A-Z]/.test(password)) score += 1; // Mayúscula
  if (/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) score += 1; // Símbolos

  // Validar contra patrones débiles comunes
  const weakPatterns = [
    /123456/,
    /password/i,
    /qwerty/i,
    /abc123/i,
    /admin/i,
    /super/i,
    /mercado/i,
  ];

  const hasWeakPattern = weakPatterns.some((pattern) => pattern.test(password));
  if (hasWeakPattern) {
    errors.push("La contraseña contiene patrones comunes. Use algo más seguro");
    score -= 2;
  }

  // Normalizar score
  score = Math.max(0, Math.min(5, score));

  return {
    isValid: errors.length === 0,
    errors,
    score,
    strength: score <= 2 ? "débil" : score <= 3 ? "media" : "fuerte",
  };
};

export { hashPassword, comparePassword, validatePasswordStrength };
