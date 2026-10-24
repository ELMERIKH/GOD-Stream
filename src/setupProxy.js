const { handleMangaDexProxy, isMangaDexApiPath, isMangaDexImagePath } = require("../mangadexProxy");

module.exports = function mangaDexDevProxy(app) {
  app.use((req, res, next) => {
    const pathname = String(req.url || "/").split("?")[0];
    if (!isMangaDexApiPath(pathname) && !isMangaDexImagePath(pathname)) {
      next();
      return;
    }
    handleMangaDexProxy(req, res);
  });
};
