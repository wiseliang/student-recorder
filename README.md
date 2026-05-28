# 学生工作记录 (Student Recorder)

批量录入助手 - 辅导员学生工作记录管理 App

## 功能

- 按周次录入**陪伴**（共同上课/进餐/自习/运动）和**谈话**（走访寝室/课堂）记录
- **一键录入**：第1周～当前周自动交替
- **查询补录**：扫描缺失记录，补齐未完成的周次
- 历史记录查看与结果追踪
- 学工系统自动登录（支持验证码）

## 技术栈

- **Expo SDK 56** / React Native 0.85
- React Navigation 7（底部Tab + 堆栈导航）
- AsyncStorage 本地持久化

## 本地运行

```bash
npm install
npx expo start
```

用 Expo Go 扫码或在模拟器中运行。

## 构建 APK

```bash
eas build --platform android --profile preview
```

> 需要先安装 [EAS CLI](https://docs.expo.dev/build/setup/) 并登录 Expo 账号。

## 配置

在设置页面填入学工系统的**工号**和**密码**即可开始使用。
