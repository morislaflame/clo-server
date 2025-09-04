const ApiError = require("../errors/ApiError");
const multer = require("multer");

module.exports = function (err, req, res, next) {
  if (err instanceof ApiError) {
    return res.status(err.status).json({ message: err.message });
  }
  if (err instanceof multer.MulterError) {
    return res.status(400).json({ message: err.message });
  }
  return res.status(500).json({ message: "Something went wrong" });
};
