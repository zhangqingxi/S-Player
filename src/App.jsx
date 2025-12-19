/**
 * S-Player - 主应用组件
 * 
 * 【文件结构】
 * 1. 工具函数 - 编解码器、语言、声道等格式化
 * 2. App 组件 - 主界面和播放控制逻辑
 * 
 * 【主要功能】
 * - 视频播放控制（播放/暂停/快进/快退）
 * - 音量控制
 * - 字幕和音轨切换
 * - 章节跳转
 * - 蓝光标题切换
 * - 媒体信息显示
 */

import { useState, useEffect, useRef } from 'react';
import { 
  Play, Pause, SkipBack, SkipForward, Square, 
  Volume2, VolumeX, Maximize, Minus, X, 
  FolderOpen, Info, List 
} from 'lucide-react';

// ==================== 工具函数 ====================

/**
 * 格式化音频编解码器名称
 * 将技术名称转换为用户友好的显示名称
 * 
 * @param {string} codec - 原始编解码器字符串
 * @returns {string} 格式化后的名称
 * 
 * @example
 * getCodec('dts-hd ma') // 返回 'DTS-HD MA'
 * getCodec('ac3')       // 返回 'Dolby Digital'
 */
const getCodec = (codec) => {
  if (!codec) return '未知';
  const lowerCodec = codec.toLowerCase();
  
  // DTS 系列音频
  if (lowerCodec.includes('dts')) {
    if (lowerCodec.includes('ma')) return 'DTS-HD MA';
    if (lowerCodec.includes('hd')) return 'DTS-HD';
    if (lowerCodec.includes('hra')) return 'DTS-HD HRA';
    if (lowerCodec.includes('xll')) return 'DTS-X';
    return 'DTS';
  }
  
  // Dolby 系列音频
  if (lowerCodec.includes('truehd')) return 'Dolby TrueHD';
  if (lowerCodec.includes('atmos')) return 'Dolby Atmos';
  if (lowerCodec.includes('eac3')) return 'Dolby Digital+';
  if (lowerCodec.includes('ac3')) return 'Dolby Digital';
  
  // AAC 系列
  if (lowerCodec.includes('aac')) {
    if (lowerCodec.includes('he')) return 'HE-AAC';
    return 'AAC';
  }
  
  // 其他常见格式
  if (lowerCodec.includes('flac')) return 'FLAC';
  if (lowerCodec.includes('pcm')) return 'PCM';
  if (lowerCodec.includes('mp3')) return 'MP3';
  
  return codec.substring(0, 15);
};

/**
 * 格式化视频编解码器名称
 * @param {string} codec - 原始编解码器字符串
 */
const getVideoCodec = (codec) => {
  if (!codec) return '未知';
  const lowerCodec = codec.toLowerCase();
  
  // H.265/HEVC
  if (lowerCodec.includes('hevc') || lowerCodec.includes('h265')) {
    if (lowerCodec.includes('main 10') || lowerCodec.includes('main10')) return 'H.265 Main10';
    return 'H.265';
  }
  
  // H.264/AVC
  if (lowerCodec.includes('h264') || lowerCodec.includes('avc')) {
    if (lowerCodec.includes('high')) return 'H.264 High';
    return 'H.264';
  }
  
  // 其他格式
  if (lowerCodec.includes('vp9')) return 'VP9';
  if (lowerCodec.includes('mpeg2')) return 'MPEG-2';
  
  return codec.substring(0, 20);
};

/**
 * 格式化声道数
 * @param {number|string} channels - 声道数
 * @returns {string} 格式化后的声道描述
 * 
 * @example
 * getChannels(2) // 返回 '立体声'
 * getChannels(6) // 返回 '5.1环绕'
 */
const getChannels = (channels) => {
  if (!channels || channels === 'undefined') return '';
  
  // 处理字符串形式
  if (typeof channels === 'string') {
    const num = parseInt(channels);
    if (!isNaN(num)) channels = num;
    else return channels;
  }
  
  // 数字映射
  const map = { 1: '单声道', 2: '立体声', 6: '5.1环绕', 8: '7.1环绕' };
  return map[channels] || `${channels}声道`;
};

/**
 * 格式化语言代码为中文名称
 * @param {string} lang - ISO 语言代码
 * 
 * @example
 * getLang('chi') // 返回 '中文'
 * getLang('eng') // 返回 '英文'
 */
const getLang = (lang) => {
  if (!lang) return '未知';
  const lower = lang.toLowerCase();
  
  // 语言代码映射表
  const langMap = {
    'chi,zho,zh,chs,cht,cn': '中文',
    'eng,en': '英文',
    'jpn,ja,jp': '日文',
    'kor,ko,kr': '韩文',
    'fra,fre,fr': '法文',
    'deu,ger,de': '德文',
    'spa,es': '西班牙文',
    'rus,ru': '俄文'
  };
  
  for (const [codes, name] of Object.entries(langMap)) {
    if (codes.split(',').includes(lower)) return name;
  }
  
  return lang.length > 10 ? lang.substring(0, 10) : lang;
};

/**
 * 格式化字幕类型
 * @param {string} codec - 字幕编解码器
 */
const getSubType = (codec) => {
  if (!codec) return '字幕';
  const lower = codec.toLowerCase();
  
  // 图形字幕
  if (lower.includes('pgs')) return 'PGS';
  if (lower.includes('vobsub')) return 'VobSub';
  
  // 文本字幕
  if (lower.includes('subrip') || lower.includes('srt')) return 'SRT';
  if (lower.includes('ass')) return 'ASS';
  if (lower.includes('ssa')) return 'SSA';
  
  return codec.substring(0, 15);
};

// ==================== 主组件 ====================

/**
 * App 组件 - 播放器主界面
 * 
 * 【状态管理】
 * - pageState: 当前页面状态 ('home' 或 'playing')
 * - isPlaying: 是否正在播放
 * - position/duration: 播放位置和总时长
 * - volume/isMuted: 音量和静音状态
 * - audioTracks/subTracks: 音轨和字幕列表
 * - currentAudio/currentSub: 当前选中的音轨和字幕
 * 
 * 【与 MPV 通信】
 * 通过 window.api（preload.js 暴露）与主进程通信，
 * 主进程再通过 IPC 管道与 MPV 通信
 */
function App() {
  // ==================== 状态定义 ====================
  
  // 页面状态：'home' 首页 | 'playing' 播放中
  const [pageState, setPageState] = useState('home');
  // 加载状态
  const [isLoading, setIsLoading] = useState(false);
  const [isSwitching, setIsSwitching] = useState(false);
  const [switchingText, setSwitchingText] = useState(''); // 切换提示文字
  
  // 播放状态
  const [isPlaying, setIsPlaying] = useState(false);
  const [position, setPosition] = useState(0);      // 当前位置（秒）
  const [duration, setDuration] = useState(0);      // 总时长（秒）
  const [volume, setVolume] = useState(100);        // 音量 0-100
  const [isMuted, setIsMuted] = useState(false);    // 是否静音
  
  // UI 状态
  const [showControls, setShowControls] = useState(true);  // 显示控制栏
  const [showInfo, setShowInfo] = useState(false);         // 显示信息面板
  const [showMenu, setShowMenu] = useState(false);         // 显示菜单
  const [activeTab, setActiveTab] = useState('chapter');   // 菜单当前标签
  
  // 媒体信息
  const [videoParams, setVideoParams] = useState(null);    // 视频参数
  const [audioCodec, setAudioCodec] = useState('');        // 音频编码
  const [videoCodec, setVideoCodec] = useState('');        // 视频编码
  const [currentChapter, setCurrentChapter] = useState(0); // 当前章节
  
  // 轨道列表
  const [audioTracks, setAudioTracks] = useState([]);      // 音轨列表
  const [subTracks, setSubTracks] = useState([]);          // 字幕列表
  const [chapters, setChapters] = useState([]);            // 章节列表
  const [blurayTitles, setBlurayTitles] = useState([]);    // 蓝光标题列表
  
  // 当前选中的轨道
  const [currentAudio, setCurrentAudio] = useState(null);  // 当前音轨 ID
  const [currentSub, setCurrentSub] = useState(null);      // 当前字幕 ID
  const [currentTitle, setCurrentTitle] = useState(null);  // 当前蓝光标题
  
  // 退出确认对话框
  const [showExitConfirm, setShowExitConfirm] = useState(false);

  // ==================== Refs ====================
  
  const initialized = useRef(false);           // 防止重复初始化
  const hideTimer = useRef(null);              // 控制栏隐藏定时器
  const autoSelectDoneRef = useRef(false);     // 是否已完成自动选择
  const switchingTimer = useRef(null);         // 切换提示关闭定时器

  // ==================== 初始化 ====================
  
  /**
   * 组件挂载时初始化
   * - 设置 MPV 事件监听
   * - 设置鼠标移动监听（控制栏显示/隐藏）
   */
  useEffect(() => {
    // 防止 React 严格模式下重复初始化
    if (initialized.current) return;
    initialized.current = true;
    
    // 清理旧的事件监听器
    window.api.cleanup();
    
    // MPV 准备就绪
    window.api.onMpvReady(() => {
      setPageState('playing');
      setIsLoading(false);
      setIsSwitching(false);
    });

    // 用于判断视频是否解析完成
    let videoDuration = 0;
    
    // 监听 MPV 属性变化
    window.api.onMpvProp((name, val) => {
      // 总时长 - 有值说明视频解析完成
      if (name === 'duration' && typeof val === 'number') {
        videoDuration = val;
        setDuration(val);
      }
      // 播放位置 - 位置更新且有时长说明视频正常播放
      else if (name === 'time-pos' && typeof val === 'number') {
        setPosition(val);
        // 只有 duration > 0 才关闭 loading
        if (videoDuration > 0) {
          if (switchingTimer.current) clearTimeout(switchingTimer.current);
          switchingTimer.current = setTimeout(() => {
            setIsSwitching(false);
            setIsLoading(false);
          }, 500);
        }
      }
      // 暂停状态（MPV 的 pause 为 true 表示暂停）
      else if (name === 'pause') {
        setIsPlaying(!val);
      }
      // 音量
      else if (name === 'volume') {
        setVolume(val || 100);
      }
      // 静音
      else if (name === 'mute') {
        setIsMuted(!!val);
      }
      // 当前章节
      else if (name === 'chapter') {
        setCurrentChapter(val || 0);
      }
      // 视频参数（分辨率等）
      else if (name === 'video-params') {
        setVideoParams(val);
      }
      // 音频编码
      else if (name === 'audio-codec-name') {
        setAudioCodec(val || '');
      }
      // 视频编码
      else if (name === 'video-codec') {
        setVideoCodec(val || '');
      }
      // 当前音轨 ID
      else if (name === 'aid') {
        if (typeof val === 'number' && val > 0) {
          setCurrentAudio(val);
        }
      }
      // 当前字幕 ID
      else if (name === 'sid') {
        if (typeof val === 'number' && val > 0) {
          setCurrentSub(val);
        } else if (val === false || val === 'no') {
          setCurrentSub(null);
        }
      }
      // 轨道列表（包含音频、字幕、视频轨道）
      else if (name === 'track-list' && val) {
        // 解析音频轨道
        const audio = val.filter(t => t.type === 'audio').map(t => ({
          id: t.id,
          codec: getCodec(t.codec),
          channels: getChannels(t['audio-channels']),
          lang: getLang(t.lang),
          title: t.title,
          selected: t.selected
        }));
        
        // 解析字幕轨道
        const sub = val.filter(t => t.type === 'sub').map(t => ({
          id: t.id,
          type: getSubType(t.codec),
          lang: getLang(t.lang),
          title: t.title || '',
          selected: t.selected
        }));

        // 首次加载时自动选择中文轨道
        if (!autoSelectDoneRef.current && (audio.length > 0 || sub.length > 0)) {
          autoSelectChineseTracks(audio, sub);
          autoSelectDoneRef.current = true;
        }
        
        setAudioTracks(audio);
        setSubTracks(sub);
      }
      // 章节列表
      else if (name === 'chapter-list' && val) {
        const chapterList = val.map((c, i) => ({ 
          id: i, 
          title: c.title, 
          time: c.time || 0 
        }));
        setChapters(chapterList);
      }
    });

    // MPV 关闭时重置状态
    window.api.onMpvClosed(() => {
      setPageState('home');
      setAudioTracks([]);
      setSubTracks([]);
      setChapters([]);
      setBlurayTitles([]);
      setPosition(0);
      setDuration(0);
      setShowInfo(false);
    });

    // 蓝光标题列表更新
    window.api.onBlurayTitles((titles) => {
      setBlurayTitles(titles);
      if (titles.length > 0) setCurrentTitle(titles[0].edition);
    });
    
    // 标题切换中（从后端触发）
    window.api.onSwitchingTitle(() => {
      setSwitchingText('正在切换标题...');
      setIsSwitching(true);
    });
    
    // 退出确认（从后端触发）
    window.api.onConfirmExit(() => {
      setShowExitConfirm(true);
    });

    // 鼠标移动时显示控制栏，3秒后自动隐藏
    const handleMove = () => {
      setShowControls(true);
      clearTimeout(hideTimer.current);
      hideTimer.current = setTimeout(() => setShowControls(false), 3000);
    };
    window.addEventListener('mousemove', handleMove);
    
    // 清理函数
    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.api.cleanup();
    };
  }, []);

  // 控制栏隐藏时关闭菜单
  useEffect(() => {
    if (!showControls && showMenu) setShowMenu(false);
  }, [showControls, showMenu]);

  // ==================== 文件操作 ====================
  
  /** 打开文件 */
  const handleOpenFile = async () => {
    const filePath = await window.api.openFile();
    if (filePath) {
      setIsLoading(true);  // 选择文件后才显示 loading
      setCurrentTitle(null);
      setBlurayTitles([]);
      autoSelectDoneRef.current = false;
      window.api.play(filePath);
    }
  };

  /** 打开文件夹（用于蓝光） */
  const handleOpenFolder = async () => {
    const filePath = await window.api.openFolder();
    if (filePath) {
      setIsLoading(true);  // 选择文件夹后才显示 loading
      setCurrentTitle(null);
      setBlurayTitles([]);
      autoSelectDoneRef.current = false;
      window.api.play(filePath);
    }
  };

  // ==================== 播放控制 ====================
  
  /** 切换播放/暂停 */
  const togglePlay = () => window.api.cmd(['cycle', 'pause']);
  
  /** 快退 10 秒 */
  const seekBack = () => window.api.cmd(['seek', -10, 'relative']);
  
  /** 快进 10 秒 */
  const seekForward = () => window.api.cmd(['seek', 10, 'relative']);
  
  /** 停止播放 */
  const stop = () => window.api.stop();
  
  /** 点击进度条跳转 */
  const handleSeek = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const percent = (e.clientX - rect.left) / rect.width;
    window.api.cmd(['seek', percent * duration, 'absolute']);
  };

  /** 切换静音 */
  const toggleMute = () => window.api.cmd(['cycle', 'mute']);
  
  /** 调整音量 */
  const handleVolumeChange = (e) => {
    const val = parseInt(e.target.value, 10);
    setVolume(val);
    window.api.cmd(['set', 'volume', val]);
  };

  // ==================== 轨道切换 ====================
  
  /**
   * 自动选择中文轨道
   * 在首次加载和切换标题时调用
   */
  const autoSelectChineseTracks = (audioList, subList) => {
    // 选择中文字幕，没有则选第一个
    const chnSub = subList.find(t => t.lang.includes('中') || t.title?.includes('中'));
    const targetSub = chnSub || subList[0];
    if (targetSub) {
      window.api.cmd(['set_property', 'sid', targetSub.id]);
      setCurrentSub(targetSub.id);
    }
    
    // 选择中文音频，没有则选第一个
    const chnAudio = audioList.find(t => t.lang.includes('中') || t.title?.includes('中'));
    const targetAudio = chnAudio || audioList[0];
    if (targetAudio) {
      window.api.cmd(['set_property', 'aid', targetAudio.id]);
      setCurrentAudio(targetAudio.id);
    }
  };

  /** 手动切换音轨 */
  const setAudioTrack = (id) => {
    if (id === currentAudio) return;
    setSwitchingText('正在切换音轨...');
    setIsSwitching(true);
    setCurrentAudio(id);
    window.api.cmd(['set_property', 'aid', id]);
    setShowMenu(false);
  };

  /** 手动切换字幕 */
  const setSubTrack = (id) => {
    if (id === currentSub) return;
    setSwitchingText('正在切换字幕...');
    setIsSwitching(true);
    setCurrentSub(id);
    window.api.cmd(['set_property', 'sid', id]);
    setShowMenu(false);
  };

  /** 跳转到章节 */
  const seekToChapter = (time) => {
    setSwitchingText('正在跳转章节...');
    setIsSwitching(true);
    window.api.cmd(['seek', time, 'absolute']);
    setShowMenu(false);
  };

  /** 切换蓝光标题 */
  const switchTitle = (edition) => {
    setSwitchingText('正在切换标题...');
    setIsSwitching(true);
    setPosition(0);
    setDuration(0);
    setAudioTracks([]);
    setSubTracks([]);
    setChapters([]);
    setCurrentTitle(edition);
    autoSelectDoneRef.current = false;
    window.api.switchTitle(edition);
    setShowMenu(false);
  };

  // ==================== 工具函数 ====================
  
  /**
   * 格式化时间为 H:MM:SS 或 M:SS 格式
   * @param {number} s - 秒数
   */
  const formatTime = (s) => {
    if (!s || isNaN(s)) return '0:00';
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = Math.floor(s % 60);
    if (h > 0) {
      return `${h}:${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
    }
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  /** 阻止右键菜单 */
  const handleRightClick = (e) => e.preventDefault();

  // ==================== 子组件 ====================
  
  /** 媒体信息面板 */
  const InfoPanel = () => (
    <div className="info-panel">
      <div className="info-row">
        <span>分辨率</span>
        <span>{videoParams?.w || 0}x{videoParams?.h || 0}</span>
      </div>
      <div className="info-row">
        <span>视频</span>
        <span>{getVideoCodec(videoCodec)}</span>
      </div>
      <div className="info-row">
        <span>音频</span>
        <span>{getCodec(audioCodec)}</span>
      </div>
      {blurayTitles.length > 0 && (
        <div className="info-row">
          <span>标题</span>
          <span>{blurayTitles.length}</span>
        </div>
      )}
      {chapters.length > 0 && (
        <div className="info-row">
          <span>章节</span>
          <span>{chapters.length}</span>
        </div>
      )}
      <div className="info-row">
        <span>音轨</span>
        <span>{audioTracks.length}</span>
      </div>
      <div className="info-row">
        <span>字幕</span>
        <span>{subTracks.length}</span>
      </div>
    </div>
  );

  // 是否显示首页
  const showHome = pageState === 'home';
  
  // 检查菜单是否有内容
  const hasMenuContent = subTracks.length > 0 || audioTracks.length > 0 || 
                         chapters.length > 0 || blurayTitles.length > 0;
  
  // 获取第一个有内容的标签
  const getFirstAvailableTab = () => {
    if (subTracks.length > 0) return 'sub';
    if (audioTracks.length > 0) return 'audio';
    if (chapters.length > 0) return 'chapter';
    if (blurayTitles.length > 0) return 'title';
    return 'chapter';
  };
  
  // 打开菜单时自动选中第一个有内容的标签
  const handleToggleMenu = () => {
    if (!showMenu && hasMenuContent) {
      setActiveTab(getFirstAvailableTab());
    }
    setShowMenu(!showMenu);
  };

  // ==================== 渲染 ====================
  
  return (
    <div className="app-container">
      {/* ========== 标题栏 ========== */}
      {/* 自定义标题栏，包含最小化、最大化、关闭按钮 */}
      <div className="title-bar">
        <button onClick={() => window.api.minimize()}><Minus size={16} /></button>
        <button onClick={() => window.api.maximize()}><Maximize size={16} /></button>
        <button onClick={() => window.api.close()}><X size={16} /></button>
      </div>

      {/* ========== 信息面板 ========== */}
      {/* 显示视频分辨率、编码等信息 */}
      {!showHome && showInfo && <InfoPanel />}
      
      {/* ========== 首页 ========== */}
      {/* 显示打开文件/文件夹按钮 */}
      {showHome && (
        <div className="welcome" onContextMenu={handleRightClick}>
          <h1>S-Player</h1>
          <div className="welcome-buttons">
            <button onClick={handleOpenFile}>
              <FolderOpen size={18} /> 打开文件
            </button>
            <button onClick={handleOpenFolder} className="secondary">
              <FolderOpen size={18} /> 打开文件夹
            </button>
          </div>
        </div>
      )}

      {/* ========== 加载提示 ========== */}
      {(isSwitching || isLoading) && (
        <div className="loading-overlay">
          <div className="loading-text">
            {isLoading ? '正在加载文件...' : switchingText}
          </div>
        </div>
      )}
      
      {/* ========== 退出确认对话框 ========== */}
      {showExitConfirm && (
        <div className="confirm-overlay">
          <div className="confirm-dialog">
            <div className="confirm-title">确认退出</div>
            <div className="confirm-message">视频正在播放，确定要退出吗？</div>
            <div className="confirm-buttons">
              <button className="confirm-btn cancel" onClick={() => setShowExitConfirm(false)}>
                取消
              </button>
              <button className="confirm-btn confirm" onClick={() => window.api.forceClose()}>
                退出
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========== 菜单面板 ========== */}
      {/* 字幕、音频、章节、标题切换菜单，只在有内容时显示 */}
      {showMenu && showControls && hasMenuContent && (
        <div className="menu-overlay" onClick={() => setShowMenu(false)}>
          <div 
            className={`bottom-menu ${showMenu ? 'visible' : ''}`} 
            onClick={e => e.stopPropagation()}
          >
            {/* 标签栏 */}
            <div className="menu-tabs">
              {subTracks.length > 0 && (
                <button 
                  className={`tab-btn ${activeTab === 'sub' ? 'active' : ''}`}
                  onClick={() => setActiveTab('sub')}
                >
                  字幕
                </button>
              )}
              {audioTracks.length > 0 && (
                <button 
                  className={`tab-btn ${activeTab === 'audio' ? 'active' : ''}`}
                  onClick={() => setActiveTab('audio')}
                >
                  音频
                </button>
              )}
              {chapters.length > 0 && (
                <button 
                  className={`tab-btn ${activeTab === 'chapter' ? 'active' : ''}`}
                  onClick={() => setActiveTab('chapter')}
                >
                  章节
                </button>
              )}
              {blurayTitles.length > 0 && (
                <button 
                  className={`tab-btn ${activeTab === 'title' ? 'active' : ''}`}
                  onClick={() => setActiveTab('title')}
                >
                  标题
                </button>
              )}
            </div>
            
            {/* 菜单内容 */}
            <div className="menu-content">
              {/* 章节列表 */}
              {activeTab === 'chapter' && chapters.length > 0 && (
                <div className="menu-section">
                  {chapters.map((chapter, i) => (
                    <div 
                      key={i} 
                      className={`menu-item ${i === currentChapter ? 'active' : ''}`}
                      onClick={() => seekToChapter(chapter.time)}
                    >
                      <span>章节 {i + 1}</span>
                      <span>{formatTime(chapter.time)}</span>
                    </div>
                  ))}
                </div>
              )}
              
              {/* 蓝光标题列表 */}
              {activeTab === 'title' && blurayTitles.length > 0 && (
                <div className="menu-section">
                  {blurayTitles.map((title, i) => (
                    <div 
                      key={i} 
                      className={`menu-item ${title.edition === currentTitle ? 'active' : ''}`}
                      onClick={() => switchTitle(title.edition)}
                    >
                      <span>标题 {title.displayIndex}{title.isMain ? ' ★' : ''}</span>
                      <span>{title.duration || '0:00'}</span>
                    </div>
                  ))}
                </div>
              )}
              
              {/* 字幕列表 */}
              {activeTab === 'sub' && subTracks.length > 0 && (
                <div className="menu-section">
                  {subTracks.map((sub, i) => (
                    <div 
                      key={i} 
                      className={`menu-item ${sub.id === currentSub ? 'active' : ''}`}
                      onClick={() => setSubTrack(sub.id)}
                    >
                      <span>{sub.type || '字幕'}</span>
                      <span>{sub.title || sub.lang || '未知'}</span>
                    </div>
                  ))}
                </div>
              )}
              
              {/* 音轨列表 */}
              {activeTab === 'audio' && audioTracks.length > 0 && (
                <div className="menu-section">
                  {audioTracks.map((audio, i) => (
                    <div 
                      key={i} 
                      className={`menu-item ${audio.id === currentAudio ? 'active' : ''}`}
                      onClick={() => setAudioTrack(audio.id)}
                    >
                      <span>{audio.codec || '音频'} {audio.channels}</span>
                      <span>{audio.lang || '未知'}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========== 控制栏 ========== */}
      {/* 底部播放控制栏，包含进度条、播放按钮、音量等 */}
      {!showHome && (
        <div 
          className={`control-bar ${showControls ? 'visible' : ''}`} 
          onContextMenu={handleRightClick}
        >
          {/* 进度条 */}
          <div className="progress-bar" onClick={handleSeek}>
            <div 
              className="progress-fill" 
              style={{ width: `${duration > 0 ? (position / duration) * 100 : 0}%` }} 
            />
          </div>
          
          <div className="controls-row">
            {/* 左侧：播放控制 */}
            <div className="controls-left">
              <button className="icon-btn" onClick={seekBack}>
                <SkipBack size={20} />
              </button>
              <button className="icon-btn play-btn" onClick={togglePlay}>
                {isPlaying ? <Pause size={24} /> : <Play size={24} />}
              </button>
              <button className="icon-btn" onClick={seekForward}>
                <SkipForward size={20} />
              </button>
              <button className="icon-btn" onClick={stop}>
                <Square size={18} />
              </button>
              <span className="time">
                {formatTime(position)} / {formatTime(duration)}
              </span>
            </div>
            
            {/* 右侧：音量、菜单、信息 */}
            <div className="controls-right">
              {/* 音量控制 */}
              <div className="volume-control">
                <button className="icon-btn" onClick={toggleMute}>
                  {isMuted || volume === 0 ? <VolumeX size={20} /> : <Volume2 size={20} />}
                </button>
                <input 
                  type="range" 
                  min="0" 
                  max="100" 
                  value={volume} 
                  onChange={handleVolumeChange} 
                  className="volume-slider" 
                />
              </div>
              
              {/* 菜单按钮 - 没有内容时禁用 */}
              <button 
                className={`icon-btn ${!hasMenuContent ? 'disabled' : ''}`} 
                onClick={handleToggleMenu}
                disabled={!hasMenuContent}
              >
                <List size={20} />
              </button>
              
              {/* 信息按钮 */}
              <button className="icon-btn" onClick={() => setShowInfo(!showInfo)}>
                <Info size={20} />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
