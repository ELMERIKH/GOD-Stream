const { handleMangaDexProxy, isMangaDexApiPath, isMangaDexImagePath } = require("../mangadexProxy");
const { handleWeebProxy, isWeebApiPath, isWeebImagePath } = require("../weebProxy");

module.exports = function catalogDevProxy(app) {
  app.use((req, res, next) => {
    const pathname = String(req.url || "/").split("?")[0];
    if (isMangaDexApiPath(pathname) || isMangaDexImagePath(pathname)) {
      handleMangaDexProxy(req, res);
      return;
    }
    if (isWeebApiPath(pathname) || isWeebImagePath(pathname)) {
      handleWeebProxy(req, res);
      return;
    }
    next();
  });
};
