// Camera capture is local: never wait for recognition scope or school login here.
export async function pickRecognitionImage(picker, camera, onStage = () => {}) {
  if (camera) {
    onStage('permission');
    let permission = await picker.getCameraPermissionsAsync();
    if (!permission.granted && permission.canAskAgain !== false) {
      permission = await picker.requestCameraPermissionsAsync();
    }
    if (!permission.granted) throw Error('请在系统设置中允许相机权限，或改为从相册选择。');
  }
  onStage(camera ? 'camera' : 'library');
  const result = await (camera ? picker.launchCameraAsync : picker.launchImageLibraryAsync)({
    mediaTypes: ['images'], allowsEditing: false, quality: 1, exif: false,
  });
  if (result.canceled) return null;
  const asset = result.assets?.[0];
  if (!asset?.uri || !(asset.width > 0) || !(asset.height > 0)) throw Error('未能读取照片，请重新拍摄或选择。');
  return asset;
}
