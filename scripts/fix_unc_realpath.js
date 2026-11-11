// Fix para Node.js v22 en shares de red Windows UNC (evita EPERM en share root)
process.env.NEXT_IGNORE_INCORRECT_LOCKFILE = "1";
const fs = require("node:fs");

const originalRealpathSync = fs.realpathSync;
fs.realpathSync = function (p, options) {
  try {
    return originalRealpathSync(p, options);
  } catch (err) {
    if (err && (err.code === "EPERM" || err.code === "EACCES")) {
      return typeof p === "string" ? p : String(p);
    }
    throw err;
  }
};

const originalNative = fs.realpathSync.native;
if (originalNative) {
  fs.realpathSync.native = function (p, options) {
    try {
      return originalNative(p, options);
    } catch (err) {
      if (err && (err.code === "EPERM" || err.code === "EACCES")) {
        return typeof p === "string" ? p : String(p);
      }
      throw err;
    }
  };
}
