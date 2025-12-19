# S-Player

基于 MPV 的现代化桌面视频播放器，支持蓝光原盘、DVD、多音轨、多字幕。

## 功能特性

- 🎬 支持常见视频格式 (MKV, MP4, AVI, MOV, M2TS)
- 💿 支持蓝光原盘 (ISO/文件夹) 和 DVD 原盘
- 🔊 多音轨切换，自动选择中文音轨
- 📝 多字幕切换，自动选择中文字幕
- 📑 章节跳转
- 🎯 蓝光多标题切换
- 🖥️ 现代化 UI，毛玻璃效果

## 技术栈

- Electron - 桌面应用框架
- React - UI 框架
- Vite - 构建工具
- MPV - 视频播放核心

## 开发

```bash
# 安装依赖
npm install

# 开发模式
npm start

# 打包
npm run dist
```

## 项目结构

```
s-player/
├── electron/
│   ├── main.js      # Electron 主进程
│   └── preload.js   # 预加载脚本
├── src/
│   ├── App.jsx      # React 主组件
│   ├── main.jsx     # React 入口
│   └── index.css    # 样式
├── index.html       # HTML 入口
├── mpv.exe          # MPV 播放器
└── package.json
```

## 作者

**Qasim**  
📧 15750783791@163.com

## License

MIT
