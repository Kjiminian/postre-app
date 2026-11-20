// Fix para Node.js v22 en shares de red Windows UNC (evita EPERM en share root)
process.env.NEXT_IGNORE_INCORRECT_LOCKFILE = "1";
const fs = require("node:fs");

const originalRealpathSync = fs.realpathSync;
const originalNative = originalRealpathSync.native;

const patchedRealpathSync = function (p, options) {
  try {
    return originalRealpathSync(p, options);
  } catch (err) {
    if (err && (err.code === "EPERM" || err.code === "EACCES")) {
      return typeof p === "string" ? p : String(p);
    }
    throw err;
  }
};

patchedRealpathSync.native = originalNative
  ? function (p, options) {
      try {
        return originalNative(p, options);
      } catch (err) {
        if (err && (err.code === "EPERM" || err.code === "EACCES")) {
          return typeof p === "string" ? p : String(p);
        }
        throw err;
      }
    }
  : patchedRealpathSync;

fs.realpathSync = patchedRealpathSync;
