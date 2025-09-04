const multer = require("multer");
const path = require("path");
const ApiError = require("../errors/ApiError");

const allowedExtensions = {
  image: /\.(jpg|jpeg|png|gif|bmp|svg|webp|tiff|ico|heic|heif)$/i,
  video: /\.(mp4|avi|mov|wmv|flv|mkv|webm|3gp|m4v|ts|vob)$/i,
};

const uploadMiddleware = (options) => {
  const storage = multer.memoryStorage();

  const fileFilter = (req, file, cb) => {
    const fileExt = path.extname(file.originalname).toLowerCase();
    const mimeType = file.mimetype;

    let mediaType = null;

    // Determine the media type
    if (
      mimeType.startsWith("image/") &&
      allowedExtensions.image.test(fileExt)
    ) {
      mediaType = "IMAGE";
    } else if (
      mimeType.startsWith("video/") &&
      allowedExtensions.video.test(fileExt)
    ) {
      mediaType = "VIDEO";
    } else {
      return cb(
        new ApiError(
          400,
          "Invalid file type. Only image and video files are allowed."
        )
      );
    }

    // Check if the media type is allowed
    const criteria = options.filterCriteria.find(
      (criteria) => criteria.mediaType === mediaType
    );
    if (!criteria) {
      return cb(
        new ApiError(
          400,
          `Invalid media type. Allowed types: ${options.filterCriteria
            .map((c) => c.mediaType)
            .join(", ")}`
        )
      );
    }

    // If validation passes, continue
    file.mediaType = mediaType;
    cb(null, true);
  };

  return (req, res, next) => {
    const upload = multer({
      storage,
      fileFilter,
    }).fields(options.fields.map((field) => ({ name: field.name })));

    upload(req, res, (err) => {
      if (err) return next(err);

      try {
        // Validate file sizes after upload
        if (req.files) {
          for (const [fieldName, files] of Object.entries(req.files)) {
            const fieldConfig = options.fields.find(
              (field) => field.name === fieldName
            );

            if (!fieldConfig)
              return next(
                new ApiError(
                  400,
                  `Invalid media field. Allowed fields: ${options.fields
                    .map((c) => c.name)
                    .join(", ")}`
                )
              );

            if (files.length > fieldConfig.maxCount)
              return next(
                new ApiError(
                  400,
                  `Too many files for ${fieldName}. Max number of files is ${fieldConfig.maxCount}.`
                )
              );

            files.forEach((file) => {
              const criteria = options.filterCriteria.find(
                (criteria) => criteria.mediaType === file.mediaType
              );

              if (!criteria)
                return next(
                  new ApiError(
                    400,
                    `Invalid media type. Allowed types: ${options.filterCriteria
                      .map((c) => c.mediaType)
                      .join(", ")}`
                  )
                );

              if (file.size > criteria.maxSize) {
                throw new ApiError(
                  400,
                  `File size for '${fieldName}' exceeds the limit for ${
                    file.mediaType
                  }. Max size: ${criteria.maxSize / 1024 / 1024}MB`
                );
              }
            });
          }
        }
        next();
      } catch (err) {
        next(err);
      }
    });
  };
};

module.exports = uploadMiddleware;
