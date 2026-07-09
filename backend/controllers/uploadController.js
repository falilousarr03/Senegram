const path = require("path");
const fs = require("fs");

const AUDIO_MIMES = new Set(["audio/webm", "audio/mpeg", "audio/mp3", "audio/ogg", "audio/opus"]);
const MAX_VOICE_SIZE = 10 * 1024 * 1024;
const MAX_VOICE_DURATION = 5 * 60;

/**
 * Retourne les métadonnées du fichier uploadé (utilisées ensuite dans un
 * POST /api/messages/conversation/:id comme "attachment").
 */
exports.uploadSingle = (req, res) => {
  if (!req.file) return res.status(400).json({ message: "Aucun fichier reçu" });
  const relative = path
    .relative(path.join(__dirname, ".."), req.file.path)
    .replace(/\\/g, "/");
  res.status(201).json({
    file: {
      url:       `/${relative}`,                      // → /uploads/<type>/<filename>
      file_name: req.file.originalname,
      file_size: req.file.size,
      mime_type: req.file.mimetype,
    },
  });
};

exports.uploadAvatar = (req, res) => {
  if (!req.file) return res.status(400).json({ message: "Aucun fichier reçu" });
  const relative = path
    .relative(path.join(__dirname, ".."), req.file.path)
    .replace(/\\/g, "/");
  res.status(201).json({ avatar_url: `/${relative}` });
};

exports.uploadVoice = (req, res) => {
  if (!req.file) return res.status(400).json({ message: "Aucun fichier audio reçu" });

  const duration = Number(req.body.duration || 0);
  const removeUploaded = () => {
    fs.unlink(req.file.path, () => {});
  };

  if (!AUDIO_MIMES.has(req.file.mimetype)) {
    removeUploaded();
    return res.status(400).json({ message: "Format audio non supporté" });
  }
  if (req.file.size > MAX_VOICE_SIZE) {
    removeUploaded();
    return res.status(400).json({ message: "Note vocale trop lourde (max 10 MB)" });
  }
  if (!duration || duration > MAX_VOICE_DURATION) {
    removeUploaded();
    return res.status(400).json({ message: "Durée audio invalide ou supérieure à 5 minutes" });
  }

  const relative = path
    .relative(path.join(__dirname, ".."), req.file.path)
    .replace(/\\/g, "/");
  res.status(201).json({
    file: {
      url:       `/${relative}`,
      file_name: req.file.originalname || "note-vocale.webm",
      file_size: req.file.size,
      mime_type: req.file.mimetype,
      duration: Math.round(duration * 1000),
    },
  });
};
