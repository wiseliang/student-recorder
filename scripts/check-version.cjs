const fs = require("fs"),
  assert = require("assert/strict"),
  pkg = require("../package.json"),
  app = require("../app.json").expo,
  lock = require("../package-lock.json");
assert.equal(app.version, pkg.version);
assert.equal(lock.version, pkg.version);
assert.equal(lock.packages[""].version, pkg.version);
const gradle = fs.readFileSync(
  require("path").join(__dirname, "../android/app/build.gradle"),
  "utf8",
);
assert(gradle.includes('versionName "' + pkg.version + '"'));
assert(gradle.includes("versionCode " + app.android.versionCode));
assert(
  fs
    .readFileSync(
      require("path").join(__dirname, "../src/utils/presentation.js"),
      "utf8",
    )
    .includes(pkg.version),
);
console.log("App package, lock, native version and display version agree");
