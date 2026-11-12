# 学工录入助手

> 本开发分支为 v1.12.0：新增学校身份接入、后台学生库同步与拍照识人。稳定发布信息见下文；新功能需配套学工1.12和识同事3.4后端，尚未宣称生产发布。


当前稳定版 **v1.11.0**，Android 应用与[配套服务端](https://github.com/wiseliang/hit-record-server)共同提供学工录入和学业管理。

[下载与图文使用指南](https://wiseliang.cloud/student-recorder/releases/) · [GitHub Releases](https://github.com/wiseliang/student-recorder/releases/latest) · [本次更新说明](RELEASE-v1.11.0.md)

## 功能

- 学情陪伴、谈话与工作日志：分别读取学校名单，按过去的有效时间生成建议，支持随机方式、可维护内容模板、逐条核对后提交。
- 学期总览：区分学校次数与轮次，工作日志默认每人每学期一次；异常和待核实记录单独提示。
- 学业管理：默认所带学生总览、当前学期挂科、历史未通过、补考核对、按专业单科查询、学生历史成绩及重修课程关系。
- 补考巡考：按原考试学期、科目查看所带学生，不代替学校发布的补考资格、时间与地点。
- 学生档案照片：按学号核对并保存，供人工查看；一键按新版八列名册导出到服务器，下载需要登录。
- 学校账号验证找回原账户，恢复码仅作可选备份。

## 开发与验证

React Native 0.76 / Expo 52，源码在 `src/`，Android 工程在 `android/`。

```sh
npm ci --ignore-scripts
npm test
node scripts/check-version.cjs
npx expo export --platform android --output-dir /tmp/student-recorder-export
```

通过 `EXPO_PUBLIC_API_BASE_URL` 配置 HTTPS 服务入口。正式安装包使用 `https://wiseliang.cloud/student-recorder`，不得把测试 API 地址打入正式包。签名会话通过安全存储保存，不能仅凭 openid 认领账户。不要将学校密码、Cookie、用户数据和照片提交到仓库。

原生构建见 `.github/workflows/android-apk.yml`。v1.11.0 为 versionCode 18，Android 7.0+ / arm64-v8a；发布沿用已验证的签名 APK，覆盖安装保留应用数据。JavaScript 导出检查通过不等于完成真机验收。

公开网页提供 Android 下载与图文指南；学生查询、同步及录入在应用内使用。当前版本不包含人脸识别。
