// SDK 52 asks for CAMERA again inside launchCameraAsync, even if JS checked it.
// Android 16 can leave that redundant request pending until Activity resumes.
// Patch only the pinned image picker; fail closed when dependency source changes.
const fs = require('fs'), path = require('path'), assert = require('assert/strict');
const root = path.resolve(__dirname, '..');
const relative = 'android/src/main/java/expo/modules/imagepicker/ImagePickerModule.kt';
const before = `    val permissions = appContext.permissions ?: throw ModuleNotFoundException("Permissions")

    permissions.askForPermissions(`;
const after = `    val permissions = appContext.permissions ?: throw ModuleNotFoundException("Permissions")

    // StudentRecorder: do not request permissions already granted (Android 16).
    val requiredPermissions = listOfNotNull(
      Manifest.permission.WRITE_EXTERNAL_STORAGE.takeIf { Build.VERSION.SDK_INT < Build.VERSION_CODES.Q },
      Manifest.permission.CAMERA
    ).toTypedArray()
    if (permissions.hasGrantedPermissions(*requiredPermissions)) {
      continuation.resume(Unit)
      return@suspendCancellableCoroutine
    }

    permissions.askForPermissions(`;
function patch(directory = path.join(root, 'node_modules/expo-image-picker')) {
  assert.equal(JSON.parse(fs.readFileSync(path.join(directory, 'package.json'))).version, '16.0.6', 'Review camera patch when upgrading image picker');
  const file = path.join(directory, relative), source = fs.readFileSync(file, 'utf8');
  if (source.includes(after)) return false;
  assert.equal(source.split(before).length, 2, 'Unexpected image picker permission implementation');
  fs.writeFileSync(file, source.replace(before, after));
  return true;
}
module.exports = {patch};
if (require.main === module) console.log(patch() ? 'Camera permission compatibility patch applied' : 'Camera permission compatibility patch ready');
