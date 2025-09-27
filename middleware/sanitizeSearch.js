// middlewares/sanitizeSearch.js
export const sanitizeSearch = (req, res, next) => {
  if (req.query.search) {
    // Escapar % y _
    req.query.search = req.query.search.replace(/[%_]/g, "\\$&");
  }
  next();
};
