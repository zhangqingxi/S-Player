/**
 * S-Player - 预加载脚本 (Preload Script)
 * 
 * 【什么是预加载脚本？】
 * 预加载脚本是 Electron 安全架构的重要组成部分。
 * 它在渲染进程（网页）加载之前运行，可以访问 Node.js API，
 * 但通过 contextBridge 只暴露安全的接口给网页使用。
 * 
 * 【为什么需要它？】
 * - 网页（渲染进程）默认无法访问 Node.js 和 Electron API
 * - 预加载脚本作为"桥梁"，安全地暴露必要的功能
 * - 防止恶意网页直接访问系统资源
 * 
 * 【本文件的作用】
 * 将主进程的功能（打开文件、控制 MPV、窗口操作等）
 * 安全地暴露给 React 应用使用
 */

const { contextBridge, ipcRenderer } = require('electron');

/**
 * 清理所有事件监听器
 * 防止内存泄漏和重复监听
 */
const cleanup = () => {
  ipcRenderer.removeAllListeners('mpv-ready');
  ipcRenderer.removeAllListeners('mpv-prop');
  ipcRenderer.removeAllListeners('mpv-closed');
  ipcRenderer.removeAllListeners('bluray-titles');
  ipcRenderer.removeAllListeners('switching-title');
  ipcRenderer.removeAllListeners('confirm-exit');
};

/**
 * 通过 contextBridge 暴露 API 给渲染进程
 * 
 * 在 React 中可以通过 window.api.xxx() 调用这些方法
 * 例如：window.api.openFile() 打开文件选择对话框
 */
contextBridge.exposeInMainWorld('api', {
  // ==================== 文件操作 ====================
  
  /** 打开文件选择对话框，返回选中的文件路径 */
  openFile: () => ipcRenderer.invoke('open-file'),
  
  /** 播放指定路径的视频文件 */
  play: (path) => ipcRenderer.invoke('play', path),
  
  /** 停止播放并关闭 MPV */
  stop: () => ipcRenderer.invoke('stop'),
  
  /** 切换蓝光标题（用于蓝光碟有多个标题的情况） */
  switchTitle: (edition) => ipcRenderer.invoke('switch-title', edition),
  
  // ==================== MPV 控制 ====================
  
  /**
   * 发送命令给 MPV 播放器
   * @param {Array} args - MPV 命令数组，如 ['seek', 10, 'relative']
   * 
   * 常用命令示例：
   * - ['cycle', 'pause'] - 切换播放/暂停
   * - ['seek', 10, 'relative'] - 快进10秒
   * - ['set_property', 'aid', 1] - 切换音轨
   * - ['set_property', 'sid', 2] - 切换字幕
   */
  cmd: (args) => ipcRenderer.invoke('mpv-cmd', args),
  
  // ==================== 窗口控制 ====================
  
  /** 最小化窗口 */
  minimize: () => ipcRenderer.invoke('win-minimize'),
  
  /** 最大化/还原窗口 */
  maximize: () => ipcRenderer.invoke('win-maximize'),
  
  /** 关闭窗口 */
  close: () => ipcRenderer.invoke('win-close'),
  
  /** 强制关闭窗口 */
  forceClose: () => ipcRenderer.invoke('win-force-close'),
  
  /** 切换全屏状态 */
  fullscreen: () => ipcRenderer.invoke('win-fullscreen'),
  
  /** 获取当前是否全屏 */
  isFullscreen: () => ipcRenderer.invoke('win-is-fullscreen'),
  
  // ==================== 事件监听 ====================
  
  /**
   * 监听 MPV 准备就绪事件
   * 当 MPV 成功启动并连接后触发
   */
  onMpvReady: (cb) => {
    ipcRenderer.on('mpv-ready', cb);
  },
  
  /**
   * 监听 MPV 属性变化事件
   * @param {Function} cb - 回调函数，参数为 (属性名, 属性值)
   * 
   * 常见属性：
   * - time-pos: 当前播放位置（秒）
   * - duration: 视频总时长（秒）
   * - pause: 是否暂停
   * - volume: 音量 (0-100)
   * - track-list: 轨道列表（音频、字幕等）
   * - aid: 当前音频轨道 ID
   * - sid: 当前字幕轨道 ID
   */
  onMpvProp: (cb) => {
    ipcRenderer.on('mpv-prop', (e, name, val) => cb(name, val));
  },
  
  /** 监听 MPV 关闭事件 */
  onMpvClosed: (cb) => {
    ipcRenderer.on('mpv-closed', cb);
  },
  
  /** 监听蓝光标题列表更新事件 */
  onBlurayTitles: (cb) => {
    ipcRenderer.on('bluray-titles', (e, titles) => cb(titles));
  },
  
  /** 监听标题切换中事件（显示加载提示） */
  onSwitchingTitle: (cb) => {
    ipcRenderer.on('switching-title', cb);
  },
  
  /** 监听退出确认事件 */
  onConfirmExit: (cb) => {
    ipcRenderer.on('confirm-exit', cb);
  },
  
  // ==================== 清理 ====================
  
  /** 清理所有事件监听器，防止内存泄漏 */
  cleanup: cleanup
});
