const router = require("express").Router();
const ctrl   = require("../controllers/messageController");
const auth   = require("../middlewares/auth");

router.use(auth);

router.get   ("/conversation/:id", ctrl.list);
router.post  ("/conversation/:id", ctrl.send);
router.post  ("/conversation/:id/read", ctrl.markRead);
router.post  ("/:id/pin",          ctrl.pin);
router.delete("/:id/pin",          ctrl.unpin);
router.post  ("/:id/reactions",    ctrl.react);
router.delete("/:id/reactions",    ctrl.removeReaction);
router.patch ("/:id",              ctrl.edit);
router.delete("/:id",              ctrl.remove);

module.exports = router;
