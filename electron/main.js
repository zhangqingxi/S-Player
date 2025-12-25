/**
 * S-Player - Electron 主进程
 * 
 * 【什么是主进程？】
 * Electron 应用有两种进程：
 * 1. 主进程 (Main Process) - 就是这个文件，负责：
 *    - 创建和管理窗口
 *    - 与操作系统交互（文件对话框、系统托盘等）
 *    - 启动和控制 MPV 播放器
 *    - 处理来自渲染进程的请求
 * 
 * 2. 渲染进程 (Renderer Process) - React 应用运行的地方
 *    - 负责 UI 显示和用户交互
 *    - 通过 preload.js 暴露的 API 与主进程通信
 * 
 * 【本文件的主要功能】
 * - 创建透明无边框窗口
 * - 启动 MPV 播放器作为子进程
 * - 通过 IPC 管道与 MPV 通信
 * - 处理蓝光碟片的标题解析
 * - 响应渲染进程的各种请求
 */

// ==================== 导入依赖 ====================

const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');      // 路径处理
const { spawn } = require('child_process');  // 启动子进程
const net = require('net');        // 网络通信（用于 IPC 管道）
const os = require('os');          // 操作系统信息
const fs = require('fs');          // 文件系统操作

// ==================== 常量定义 ====================

/**
 * MPV IPC 管道路径
 * Windows 使用命名管道，格式为 \\.\pipe\名称
 * 用于与 MPV 播放器进行双向通信
 */
const IPC_PIPE = '\\\\.\\pipe\\s-player-mpv';

/** 是否为开发模式（未打包） */
const isDev = !app.isPackaged;

// ==================== 全局变量 ====================

let mainWindow = null;        // 主窗口实例
let mpvProcess = null;        // MPV 子进程
let ipcClient = null;         // IPC 客户端连接
let blurayTitles = [];        // 蓝光标题列表
let currentBlurayDevice = null;  // 当前蓝光设备路径
let isPlayingContent = false;    // 是否正在播放内容

// ==================== 窗口创建 ====================

/**
 * 创建主窗口
 * 
 * 窗口特点：
 * - 无边框 (frame: false) - 自定义标题栏
 * - 透明 (transparent: true) - 让 UI 覆盖在 MPV 视频上方
 * - 使用 preload.js 进行安全的进程间通信
 */
function createWindow() {
  // 初始窗口尺寸
  const initialSize = { width: 1000, height: 600 };
  
  mainWindow = new BrowserWindow({
    width: initialSize.width,
    height: initialSize.height,
    minWidth: 800,      // 最小宽度，防止窗口太小
    minHeight: 500,     // 最小高度
    frame: false,       // 无边框窗口，使用自定义标题栏
    transparent: true,  // 透明窗口，让 React UI 覆盖在 MPV 上
    hasShadow: false,   // 透明窗口不需要阴影
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),  // 预加载脚本
      contextIsolation: true,   // 上下文隔离，安全必需
      nodeIntegration: false,   // 禁用 Node 集成，安全必需
      enableRemoteModule: false // 禁用 remote 模块
    }
  });
  
  // 允许拖放文件到窗口
  mainWindow.webContents.on('will-navigate', (e) => e.preventDefault());
  
  // 禁用默认菜单
  mainWindow.setMenuBarVisibility(false);

  // 根据环境加载不同的页面
  if (isDev) {
    // 开发模式：加载 Vite 开发服务器
    mainWindow.loadURL('http://localhost:5173');
    // 打开开发者工具（分离窗口模式）
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    // 生产模式：加载打包后的文件
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  // 窗口关闭时清理资源
  mainWindow.on('closed', () => {
    killMpv();
    mainWindow = null;
  });
  
  // 关闭前确认（如果正在播放）
  mainWindow.on('close', (e) => {
    if (isPlayingContent) {
      e.preventDefault();
      // 通知前端显示确认对话框
      mainWindow?.webContents.send('confirm-exit');
    }
  });
  
  // 全屏状态变化监听
  mainWindow.on('leave-full-screen', () => {
    // 退出全屏时恢复初始尺寸并居中
    mainWindow.setSize(initialSize.width, initialSize.height);
    mainWindow.center();
  });
  
  // 保存窗口引用到全局
  global.mainWindow = mainWindow;
}

// ==================== MPV 控制 ====================

/**
 * 获取 MPV 可执行文件路径
 * 开发模式：项目根目录
 * 打包后：resources 目录
 */
function findMpv() {
  if (isDev) {
    return path.join(__dirname, '../mpv.exe');
  } else {
    // 打包后 mpv.exe 在 resources 目录
    return path.join(process.resourcesPath, 'mpv.exe');
  }
}

/**
 * 启动 MPV 播放器
 * 
 * @param {string} filePath - 要播放的文件/文件夹路径
 * @param {number|null} titleEdition - 蓝光标题编号（切换标题时使用）
 * 
 * 【工作流程】
 * 1. 关闭旧的 MPV 进程和 IPC 连接
 * 2. 构建 MPV 启动参数
 * 3. 启动 MPV 子进程
 * 4. 等待 MPV 启动完成后连接 IPC
 */
async function startMpv(filePath, titleEdition = null) {
  // 关闭旧的 IPC 连接
  if (ipcClient) {
    try { ipcClient.destroy(); } catch (e) { /* 忽略错误 */ }
    ipcClient = null;
  }
  
  // 如果是切换标题，通知前端显示加载提示
  if (titleEdition !== null) {
    mainWindow?.webContents.send('switching-title');
  }
  
  // 关闭旧的 MPV 进程
  killMpv();
  
  // 切换标题时等待更长时间，确保旧进程完全退出
  if (titleEdition !== null) {
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  if (!mainWindow) return;

  const mpvPath = findMpv();

  // 获取窗口句柄，让 MPV 嵌入到我们的窗口中
  const hwnd = mainWindow.getNativeWindowHandle();
  const wid = os.endianness() === 'LE' 
    ? hwnd.readInt32LE(0) 
    : hwnd.readInt32BE(0);

  // ==================== MPV 启动参数 ====================
  const args = [
    `--wid=${wid}`,                     // 嵌入到指定窗口
    `--input-ipc-server=${IPC_PIPE}`,   // IPC 管道路径
    '--no-border',                      // 无边框
    '--no-osc',                         // 禁用屏幕控制器
    '--no-osd-bar',                     // 禁用 OSD 进度条
    '--keep-open=yes',                  // 播放完毕保持打开
    
    // ==================== GPU 硬件解码（使用显卡替代CPU） ====================
    '--hwdec=auto-safe',                // 自动选择安全的硬解模式
    '--vo=gpu',                         // 使用GPU视频输出
    '--gpu-api=auto',                   // 自动选择GPU API (d3d11/vulkan)
    '--gpu-context=auto',               // 自动GPU上下文
    '--hwdec-codecs=all',               // 所有编解码器启用硬解
    
    // ==================== 画质增强 ====================
    '--scale=ewa_lanczossharp',         // 放大算法（高质量）
    '--cscale=ewa_lanczossharp',        // 色度放大算法
    '--dscale=mitchell',                // 缩小算法
    '--correct-downscaling=yes',        // 正确的缩小处理
    '--linear-downscaling=yes',         // 线性缩小
    '--sigmoid-upscaling=yes',          // Sigmoid 放大（减少振铃）
    '--deband=yes',                     // 去色带
    '--deband-iterations=2',            // 去色带迭代次数
    '--deband-threshold=48',            // 去色带阈值
    '--deband-range=16',                // 去色带范围
    '--deband-grain=48',                // 去色带颗粒
    '--interpolation=yes',              // 帧插值（运动补偿）
    '--video-sync=display-resample',    // 视频同步模式
    '--tscale=oversample',              // 时间插值算法
    
    // ==================== 音频输出（Windows 使用 wasapi） ====================
    '--ao=wasapi',                      // 使用 Windows 音频会话 API
    '--audio-exclusive=no',             // 禁用独占模式
    '--audio-fallback-to-null=yes',     // 音频失败时使用空输出（不阻塞播放）
    
    '--sub-auto=fuzzy',                             // 模糊匹配外部字幕
    '--sub-visibility=yes',                         // 显示字幕
    
    // ==================== 语言优选（中文优先） ====================
    // 音频语言优先级：简体中文、繁体中文、粤语、普通话、英语、日语
    '--alang=chi,zho,zh,cmn,chs,cht,sc,tc,cn,tw,yue,cantonese,mandarin,chinese,eng,en,jpn,ja',
    // 字幕语言优先级：简体中文、繁体中文、中文、英语
    '--slang=chi,zho,zh,cmn,chs,cht,sc,tc,cn,tw,chinese,eng,en',
    
    // ==================== 窗口与缓存 ====================
    '--force-window=immediate',                     // 立即创建窗口
    '--cache=yes',                                  // 启用缓存
    
    // ==================== 动态预加载配置 ====================
    // 注意：预加载大小会根据文件大小动态调整（见下方代码）
    '--demuxer-max-bytes=150M',                     // 最大缓存 150MB（默认值，会动态调整）
    '--demuxer-readahead-secs=20',                  // 预读20秒
    
    // ==================== 音频配置 ====================
    // 注释掉音频透传，先测试基本播放
    // '--audio-spdif=ac3,dts,eac3,truehd,dts-hd',     // 支持透传的音频格式
    '--audio-channels=auto',                        // 自动音频声道配置
    
    // ==================== HDR 和杜比视界（需HDR显示器） ====================
    '--target-trc=auto',                            // 自动色调响应曲线
    '--tone-mapping=hable',                         // Hable色调映射算法（适合HDR到SDR）
    '--hdr-compute-peak=yes',                       // 动态计算HDR峰值亮度
    '--target-prim=auto',                           // 自动色域匹配
  ];
  
  // ==================== 文件类型检测 ====================
  const lower = filePath.toLowerCase();
  const isIso = lower.endsWith('.iso');
  
  // ==================== 缓冲优化（防卡顿） ====================
  // 检测文件大小，为大文件和网络文件增加预加载缓存
  if (!isIso) {
    try {
      const stats = fs.statSync(filePath);
      const fileSizeGB = stats.size / (1024 * 1024 * 1024);
      
      if (fileSizeGB > 10) {
        // 超大文件（>10GB）：增强缓冲
        args.push('--demuxer-max-bytes=500M', '--demuxer-readahead-secs=60');
        console.log(`超大文件 (${fileSizeGB.toFixed(1)}GB)：500MB缓存，60秒预读`);
      } else if (fileSizeGB > 5) {
        // 大文件（>5GB）：中等缓冲
        args.push('--demuxer-max-bytes=300M', '--demuxer-readahead-secs=40');
        console.log(`大文件 (${fileSizeGB.toFixed(1)}GB)：300MB缓存，40秒预读`);
      } else {
        // 普通文件：标准缓冲
        args.push('--demuxer-max-bytes=150M', '--demuxer-readahead-secs=20');
        console.log(`普通文件 (${fileSizeGB.toFixed(2)}GB)：150MB缓存，20秒预读`);
      }
    } catch (e) {
      // 无法获取文件大小，使用安全的默认值
      args.push('--demuxer-max-bytes=200M', '--demuxer-readahead-secs=30');
      console.log('无法获取文件大小，使用默认缓冲配置');
    }
  }
  
  // 通用缓冲优化参数（适用于所有文件）
  args.push(
    '--cache-pause=yes',                // 缓冲不足时暂停播放
    '--cache-pause-wait=3',             // 暂停后等待3秒缓冲
    '--cache-pause-initial=yes',        // 初始缓冲时暂停
    '--demuxer-seekable-cache=yes'      // 允许在缓存范围内seek
  );
  
  if (isIso) {
    // ISO 文件通过大小判断是蓝光还是DVD
    try {
      const stats = fs.statSync(filePath);
      const sizeGB = stats.size / (1024 * 1024 * 1024);
      
      if (sizeGB > 10) {
        // 蓝光ISO（>10GB）
        console.log(`检测到蓝光ISO (${sizeGB.toFixed(1)}GB)`);
        // 只在初次打开时清空标题列表，切换标题时保留
        if (titleEdition === null) {
          blurayTitles = [];
        }
        currentBlurayDevice = filePath;
        args.push(`--bluray-device=${filePath}`);
        if (titleEdition !== null) {
          args.push(`--edition=${titleEdition}`);
        }
        args.push('bd://longest');
      } else {
        // DVD ISO
        console.log(`检测到DVD ISO (${sizeGB.toFixed(1)}GB)`);
        currentBlurayDevice = null;
        args.push(`--dvd-device=${filePath}`);
        args.push('dvd://longest');
      }
    } catch (e) {
      // 无法判断，当作蓝光处理
      console.log('无法获取ISO大小，默认蓝光模式');
      currentBlurayDevice = filePath;
      args.push(`--bluray-device=${filePath}`);
      if (titleEdition !== null) {
        args.push(`--edition=${titleEdition}`);
      }
      args.push('bd://longest');
    }
  } else {
    // 普通视频文件
    console.log(`播放文件: ${filePath}`);
    currentBlurayDevice = null;
    args.push(filePath);
  }

  // ==================== 启动 MPV 进程 ====================
  mpvProcess = spawn(mpvPath, args, { 
    stdio: ['ignore', 'pipe', 'pipe']  // 忽略 stdin，捕获 stdout/stderr
  });
  isPlayingContent = true;
  
  // 用于解析蓝光标题的缓冲区
  let stdoutBuffer = '';
  let stderrBuffer = '';
  
  // 监听 stdout，解析蓝光标题信息
  mpvProcess.stdout.on('data', (data) => {
    stdoutBuffer += data.toString();
    parseBlurayTitles(stdoutBuffer);
  });
  
  // 监听 stderr，同样可能包含标题信息
  mpvProcess.stderr.on('data', (data) => {
    stderrBuffer += data.toString();
    parseBlurayTitles(stderrBuffer);
  });

  // MPV 启动失败
  mpvProcess.on('error', (err) => {
    console.error('MPV 启动失败:', err.message);
    mainWindow?.webContents.send('mpv-error', err.message);
  });

  // MPV 进程退出
  mpvProcess.on('exit', () => {
    mpvProcess = null;
    if (ipcClient) {
      ipcClient.destroy();
      ipcClient = null;
    }
  });

  // 等待 MPV 启动完成后连接 IPC
  const waitTime = titleEdition !== null ? 800 : 600;
  setTimeout(() => connectIpc(), waitTime);
}

/**
 * 解析蓝光标题信息
 * 
 * MPV 输出格式示例：
 * --edition=0 'title: 1 (2:15:30) (00001.mpls)'
 * 
 * @param {string} buffer - MPV 输出的文本
 */
function parseBlurayTitles(buffer) {
  const regex = /--edition=(\d+)\s+'title:\s*(\d+)\s*\(([^)]+)\)\s*\(([^)]+\.mpls)\)'/g;
  let match;
  let found = false;
  
  while ((match = regex.exec(buffer)) !== null) {
    const edition = parseInt(match[1], 10);   // 标题编号
    const titleNum = parseInt(match[2], 10);  // 显示编号
    const duration = match[3];                 // 时长
    const playlist = match[4];                 // 播放列表文件
    
    // 避免重复添加
    if (!blurayTitles.find(t => t.edition === edition)) {
      blurayTitles.push({ edition, titleNum, duration, playlist });
      found = true;
    }
  }
  
  // 如果找到新标题，排序并通知前端
  if (found && blurayTitles.length > 0) {
    // 按时长降序排序（最长的在前面）
    blurayTitles.sort((a, b) => {
      const toSec = (d) => d.split(':').reduce((acc, t) => acc * 60 + parseFloat(t), 0);
      return toSec(b.duration) - toSec(a.duration);
    });
    
    // 添加显示索引、主标题标记和秒数
    blurayTitles.forEach((t, i) => {
      t.displayIndex = i + 1;
      t.isMain = i === 0;  // 最长的是主标题
      // 将时长字符串转换为秒数
      t.durationSeconds = t.duration.split(':').reduce((acc, time) => acc * 60 + parseFloat(time), 0);
    });
    
    // 通知前端更新标题列表
    mainWindow?.webContents.send('bluray-titles', blurayTitles);
  }
}

/**
 * 关闭 MPV 播放器
 * 清理 IPC 连接和子进程
 */
function killMpv() {
  if (ipcClient) {
    try { ipcClient.destroy(); } catch (e) { /* 忽略 */ }
    ipcClient = null;
  }
  
  if (mpvProcess) {
    try { mpvProcess.kill(); } catch (e) { /* 忽略 */ }
    mpvProcess = null;
  }
}

/**
 * 停止播放
 * 关闭 MPV 并重置状态
 */
function stopPlayback() {
  isPlayingContent = false;
  killMpv();
  blurayTitles = [];
  currentBlurayDevice = null;
  mainWindow?.webContents.send('mpv-closed');
}

// ==================== IPC 通信 ====================

/**
 * 连接到 MPV 的 IPC 管道
 * 
 * @param {number} retries - 当前重试次数
 * 
 * MPV 启动需要时间，所以需要重试机制
 */
function connectIpc(retries = 0) {
  if (retries > 40) {
    console.error('IPC 连接失败：超过重试次数');
    return;
  }
  
  ipcClient = net.connect(IPC_PIPE);
  
  ipcClient.on('connect', () => {
    setupIpc();
    mainWindow?.webContents.send('mpv-ready');
  });
  
  ipcClient.on('error', () => {
    // 连接失败，100ms 后重试
    setTimeout(() => connectIpc(retries + 1), 100);
  });
}

/** IPC 数据缓冲区 */
let buffer = '';

/**
 * 设置 IPC 通信
 * 
 * 【MPV IPC 协议】
 * - 使用 JSON 格式通信
 * - 每条消息以换行符分隔
 * - 可以发送命令、监听属性变化
 */
function setupIpc() {
  buffer = '';
  
  // 监听 MPV 发来的数据
  ipcClient.on('data', (data) => {
    buffer += data.toString();
    const lines = buffer.split('\n');
    buffer = lines.pop();  // 保留不完整的行
    
    for (const line of lines) {
      if (!line) continue;
      try {
        const msg = JSON.parse(line);
        
        // 属性变化事件 - 转发给前端
        if (msg.event === 'property-change') {
          mainWindow?.webContents.send('mpv-prop', msg.name, msg.data);
        } 
        // get_property 命令的返回值
        else if (msg.error === 'success' && msg.data !== undefined && msg.request_id) {
          mainWindow?.webContents.send('mpv-prop', msg.request_id, msg.data);
        }
        // 文件加载完成事件
        else if (msg.event === 'file-loaded' || msg.event === 'playback-restart') {
          mainWindow?.webContents.send('mpv-ready');
        }
      } catch (e) { /* 忽略解析错误 */ }
    }
  });

  // 注册属性监听
  const props = [
    'time-pos', 'duration', 'pause', 'volume', 'mute',
    'track-list', 'chapter-list', 'chapter',
    'video-params', 'audio-codec-name', 'video-codec',
    'video-bitrate', 'audio-bitrate', 'aid', 'sid',
    'paused-for-cache', 'cache-buffering-state'
  ];
  props.forEach((p, i) => sendCmd(['observe_property', i + 1, p]));
}

/**
 * 发送命令给 MPV
 * @param {Array} cmd - 命令数组
 */
function sendCmd(cmd) {
  if (ipcClient && !ipcClient.destroyed) {
    ipcClient.write(JSON.stringify({ command: cmd }) + '\n');
    return true;
  }
  return false;
}

// ==================== IPC 处理器 ====================
// 这些处理器响应来自渲染进程（React）的请求

/** 打开文件对话框 */
ipcMain.handle('open-file', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: [{ 
      name: 'Videos', 
      extensions: ['mkv', 'mp4', 'avi', 'mov', 'iso', 'm2ts'] 
    }]
  });
  return canceled ? null : filePaths[0];
});

/** 播放文件 */
ipcMain.handle('play', (_, filePath) => startMpv(filePath));

/** 发送 MPV 命令 */
ipcMain.handle('mpv-cmd', (_, cmd) => sendCmd(cmd));

/** 停止播放 */
ipcMain.handle('stop', () => stopPlayback());

/** 切换蓝光标题 */
ipcMain.handle('switch-title', (_, edition) => {
  if (!currentBlurayDevice) return false;
  startMpv(currentBlurayDevice, edition);
  return true;
});

/** 最小化窗口 */
ipcMain.handle('win-minimize', () => mainWindow?.minimize());

/** 最大化/还原窗口 */
ipcMain.handle('win-maximize', () => {
  if (mainWindow?.isMaximized()) {
    mainWindow.unmaximize();
  } else {
    mainWindow?.maximize();
  }
});

/** 关闭窗口 */
ipcMain.handle('win-close', () => mainWindow?.close());

/** 强制关闭窗口（确认退出后调用） */
ipcMain.handle('win-force-close', () => {
  isPlayingContent = false;
  mainWindow?.destroy();
});

/** 切换全屏 */
ipcMain.handle('win-fullscreen', () => {
  if (!mainWindow) return false;
  const newState = !mainWindow.isFullScreen();
  mainWindow.setFullScreen(newState);
  return newState;
});

/** 获取全屏状态 */
ipcMain.handle('win-is-fullscreen', () => {
  return mainWindow?.isFullScreen() || false;
});

// ==================== 应用生命周期 ====================

// 应用准备就绪时创建窗口
app.whenReady().then(createWindow);

// 所有窗口关闭时退出应用
app.on('window-all-closed', () => app.quit());
