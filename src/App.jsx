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

import { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Play, Pause, SkipBack, SkipForward, Square, 
  Volume2, VolumeX, Maximize, Minus, X, 
  FolderOpen, Info, List 
} from 'lucide-react';

// ==================== 工具函数 ====================

/**
 * 格式化音频编解码器名称（英文规范格式）
 * @param {string} codec - 原始编解码器字符串
 * @returns {string} 格式化后的名称
 */
const getCodec = (codec) => {
  if (!codec) return '';
  const lowerCodec = codec.toLowerCase();
  
  // DTS 系列音频
  if (lowerCodec.includes('dts')) {
    if (lowerCodec.includes('xll') || lowerCodec.includes('dts:x')) return 'DTS:X';
    if (lowerCodec.includes('ma')) return 'DTS-HD MA';
    if (lowerCodec.includes('hra')) return 'DTS-HD HRA';
    if (lowerCodec.includes('hd')) return 'DTS-HD';
    return 'DTS';
  }
  
  // Dolby 系列音频
  if (lowerCodec.includes('truehd')) return 'TrueHD';
  if (lowerCodec.includes('atmos')) return 'Atmos';
  if (lowerCodec.includes('eac3') || lowerCodec.includes('e-ac-3')) return 'DD+';
  if (lowerCodec.includes('ac3') || lowerCodec.includes('a_ac3')) return 'DD';
  
  // AAC 系列
  if (lowerCodec.includes('aac')) {
    if (lowerCodec.includes('he')) return 'HE-AAC';
    return 'AAC';
  }
  
  // 其他常见格式
  if (lowerCodec.includes('flac')) return 'FLAC';
  if (lowerCodec.includes('pcm')) return 'LPCM';
  if (lowerCodec.includes('mp3')) return 'MP3';
  if (lowerCodec.includes('opus')) return 'Opus';
  if (lowerCodec.includes('vorbis')) return 'Vorbis';
  
  return codec.toUpperCase().substring(0, 12);
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
  const [loadingText, setLoadingText] = useState('正在加载文件...'); // 加载提示文字
  const [isBuffering, setIsBuffering] = useState(false);  // 缓冲状态
  
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
  
  // TMDB 电影信息
  const [tmdbInfo, setTmdbInfo] = useState(null);          // TMDB电影数据
  const [currentFileName, setCurrentFileName] = useState(''); // 当前文件名
  
  // 实时码率
  const [videoBitrate, setVideoBitrate] = useState(0);     // 视频码率 (kbps)
  const [audioBitrate, setAudioBitrate] = useState(0);     // 音频码率 (kbps)
  
  // 退出确认对话框
  const [showExitConfirm, setShowExitConfirm] = useState(false);

  // ==================== Refs ====================
  
  const initialized = useRef(false);           // 防止重复初始化
  const hideTimer = useRef(null);              // 控制栏隐藏定时器
  const lastPositionRef = useRef(0);           // 上一次播放位置（用于检测进度变化）
  const isLoadingRef = useRef(false);          // Loading 状态的 ref（用于事件处理器访问最新值）

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
    const handleMpvReady = () => {
      setPageState('playing');
      
      // MPV 就绪后，如果 loading 还在显示，重置进度 ref
      if (isLoadingRef.current) {
        lastPositionRef.current = 0;
      }
    };
    
    // 监听 MPV 属性变化
    const handleMpvProp = (name, val) => {
      // 总时长
      if (name === 'duration' && typeof val === 'number' && val > 0) {
        setDuration(val);
      }
      // 播放位置
      else if (name === 'time-pos' && typeof val === 'number') {
        const oldPos = lastPositionRef.current;
        lastPositionRef.current = val;
        setPosition(val);
        
        // 计算进度差（绝对值）
        const diff = Math.abs(val - oldPos);
        
        // 如果 loading 为 true 且进度有变化（> 0.01秒），立即关闭
        if (isLoadingRef.current && diff > 0.01) {
          setIsLoading(false);
        }
      }
      // 暂停状态
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
      // 视频码率
      else if (name === 'video-bitrate') {
        setVideoBitrate(Math.round((val || 0) / 1000));
      }
      // 音频码率
      else if (name === 'audio-bitrate') {
        setAudioBitrate(Math.round((val || 0) / 1000));
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
      // 缓冲状态
      else if (name === 'paused-for-cache') {
        setIsBuffering(!!val);
      }
      // 缓存进度
      else if (name === 'cache-buffering-state') {
        if (val > 0 && val < 100) {
          setIsBuffering(true);
        } else if (val >= 100) {
          setIsBuffering(false);
        }
      }
      // 轨道列表
      else if (name === 'track-list' && val) {
        const audio = val.filter(t => t.type === 'audio').map(t => ({
          id: t.id,
          codec: getCodec(t.codec),
          channels: getChannels(t['audio-channels']),
          lang: getLang(t.lang),
          title: t.title,
          selected: t.selected
        }));
        
        const sub = val.filter(t => t.type === 'sub').map(t => ({
          id: t.id,
          type: getSubType(t.codec),
          lang: getLang(t.lang),
          title: t.title || '',
          selected: t.selected
        }));

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
    };

    // MPV 关闭时重置状态
    const handleMpvClosed = () => {
      setPageState('home');
      setAudioTracks([]);
      setSubTracks([]);
      setChapters([]);
      setBlurayTitles([]);
      setPosition(0);
      setDuration(0);
      setCurrentTitle(null);
      setShowInfo(false);
      setIsBuffering(false);
    };

    // 蓝光标题列表更新
    const handleBlurayTitles = (titles) => {
      setBlurayTitles(titles);
      if (titles.length > 0) setCurrentTitle(titles[0].edition);
    };
    
    // 标题切换中
    const handleSwitchingTitle = () => {
      setLoadingText('正在切换标题...');
      setIsLoading(true);
    };
    
    // 退出确认
    const handleConfirmExit = () => {
      setShowExitConfirm(true);
    };

    // 注册事件监听
    window.api.onMpvReady(handleMpvReady);
    window.api.onMpvProp(handleMpvProp);
    window.api.onMpvClosed(handleMpvClosed);
    window.api.onBlurayTitles(handleBlurayTitles);
    window.api.onSwitchingTitle(handleSwitchingTitle);
    window.api.onConfirmExit(handleConfirmExit);

    // 鼠标移动时显示控制栏，3秒后自动隐藏
    const handleMove = () => {
      setShowControls(true);
      if (hideTimer.current) {
        clearTimeout(hideTimer.current);
      }
      hideTimer.current = setTimeout(() => {
        // 检查菜单是否打开，如果打开则不隐藏
        setShowControls(prev => {
          // 这里无法直接访问 showMenu，所以总是设置为 false
          // 后面会通过 useEffect 来处理菜单打开时的情况
          return false;
        });
      }, 3000);
    };
    window.addEventListener('mousemove', handleMove);
    
    // 清理函数
    return () => {
      window.removeEventListener('mousemove', handleMove);
      
      // 清理定时器
      if (hideTimer.current) {
        clearTimeout(hideTimer.current);
        hideTimer.current = null;
      }
      
      window.api.cleanup();
    };
  }, []); // 空依赖数组，只在挂载时执行一次

  // 控制栏隐藏时关闭菜单
  useEffect(() => {
    if (!showControls && showMenu) {
      setShowMenu(false);
    }
  }, [showControls, showMenu]);
  
  // 菜单打开时保持控制栏显示
  useEffect(() => {
    if (showMenu) {
      setShowControls(true);
      // 清除自动隐藏定时器
      if (hideTimer.current) {
        clearTimeout(hideTimer.current);
        hideTimer.current = null;
      }
    }
  }, [showMenu]);
  
  // 同步 isLoading 到 ref（用于事件处理器访问最新值）
  useEffect(() => {
    isLoadingRef.current = isLoading;
  }, [isLoading]);

  // ==================== 文件操作 ====================
  
  // TMDB Bearer Token
  const TMDB_BEARER_TOKEN = 'eyJhbGciOiJIUzI1NiJ9.eyJhdWQiOiIyZjFkYWM4MGFlODA4YjBhNjNhNTI0YmU1Mjc3YmMyNSIsIm5iZiI6MTY3OTY2MDE5Ni4yODQsInN1YiI6IjY0MWQ5NGE0OGRlMGFlMDA4MzlhOTA5NiIsInNjb3BlcyI6WyJhcGlfcmVhZCJdLCJ2ZXJzaW9uIjoxfQ.0gCSVC3FRm6C37XrAuZ2hBYlAV3Ff2yPNTB4faiSPS4';
  
  // 从文件名提取电影标题和年份
  const extractTitleFromFileName = (filePath) => {
    const fileName = filePath.split(/[\\/]/).pop();
    
    // 提取年份（4位数字）
    const yearMatch = fileName.match(/\b(19\d{2}|20\d{2})\b/);
    const year = yearMatch ? yearMatch[1] : null;
    
    // 移除扩展名和常见标记
    let title = fileName
      .replace(/\.[^.]+$/, '')  // 移除扩展名
      .replace(/\[(.*?)\]/g, '')  // 移除方括号内容
      .replace(/@[\w]+/g, '')  // 移除@组名如@HDSky
      .replace(/\b(19\d{2}|20\d{2})\b/g, '')  // 移除年份
      .replace(/\d{4}p?/gi, '')  // 移除分辨率
      .replace(/(MULTi|COMPLETE|UHD|4K|2160p|1080p|720p|HDR|DV|SDR|REMUX)/gi, '')
      .replace(/(BluRay|BDRip|WEB-DL|WEBRip|HDRip|DVDRip|BRRip|HDTV)/gi, '')
      .replace(/(x264|x265|HEVC|AVC|H\.264|H\.265|10bit)/gi, '')
      .replace(/(AAC|DTS|TrueHD|Atmos|FLAC|DD|AC3|EAC3|LPCM)/gi, '')
      .replace(/(DIY|Repack|Proper|EXTENDED|Directors\.Cut)/gi, '')
      .replace(/[._-]+/g, ' ')  // 替换分隔符为空格
      .replace(/\s+/g, ' ')  // 合并多个空格
      .trim();
    
    console.log('提取标题:', title, '年份:', year, '来自文件:', fileName);
    return { title, year };
  };
  
  // 获取TMDB电影信息
  const fetchTMDBInfo = useCallback(async (titleInfo) => {
    if (!titleInfo.title) return;
    
    try {
      // 1. 搜索电影
      const searchRes = await fetch(
        `https://api.themoviedb.org/3/search/movie?query=${encodeURIComponent(titleInfo.title)}&language=zh-CN`,
        {
          headers: {
            'Authorization': `Bearer ${TMDB_BEARER_TOKEN}`,
            'Content-Type': 'application/json'
          }
        }
      );
      const searchData = await searchRes.json();
      
      if (!searchData.results || searchData.results.length === 0) {
        console.log('未找到匹配的电影');
        return;
      }
      
      // 2. 通过英文名和年份匹配最佳结果
      let bestMatch = searchData.results[0];
      
      if (titleInfo.year) {
        // 如果有年份，优先匹配年份相同的电影
        const yearMatch = searchData.results.find(movie => 
          movie.release_date && movie.release_date.startsWith(titleInfo.year)
        );
        if (yearMatch) {
          bestMatch = yearMatch;
          console.log('通过年份匹配到电影:', bestMatch.title, bestMatch.release_date);
        }
      }
      
      // 3. 获取详细信息
      const detailRes = await fetch(
        `https://api.themoviedb.org/3/movie/${bestMatch.id}?language=zh-CN`,
        {
          headers: {
            'Authorization': `Bearer ${TMDB_BEARER_TOKEN}`,
            'Content-Type': 'application/json'
          }
        }
      );
      const detailData = await detailRes.json();
      
      // 4. 获取演员信息
      const creditsRes = await fetch(
        `https://api.themoviedb.org/3/movie/${bestMatch.id}/credits?language=zh-CN`,
        {
          headers: {
            'Authorization': `Bearer ${TMDB_BEARER_TOKEN}`,
            'Content-Type': 'application/json'
          }
        }
      );
      const creditsData = await creditsRes.json();
      
      // 5. 筛选领衔主演和主演
      const mainCast = creditsData.cast
        ?.filter(actor => actor.order < 5)  // 前5位演员
        .map(actor => actor.name) || [];
      
      // 6. 构建海报URL
      const posterUrl = detailData.poster_path 
        ? `https://media.themoviedb.org/t/p/w300_and_h450_face${detailData.poster_path}`
        : null;
      
      setTmdbInfo({
        title: detailData.title || bestMatch.title,
        originalTitle: detailData.original_title,
        overview: detailData.overview || '暂无简介',
        releaseDate: detailData.release_date,
        rating: detailData.vote_average,
        cast: mainCast,
        posterUrl: posterUrl
      });
      
      console.log('TMDB信息获取成功:', {
        title: detailData.title,
        year: detailData.release_date?.split('-')[0],
        cast: mainCast,
        poster: posterUrl
      });
      
    } catch (e) {
      console.log('TMDB获取失败:', e.message);
    }
  }, []);
  
  /** 打开文件 */
  const handleOpenFile = useCallback(async () => {
    const filePath = await window.api.openFile();
    if (filePath) {
      setIsLoading(true);
      setLoadingText('正在加载文件...');
      setCurrentTitle(null);
      setBlurayTitles([]);
      setTmdbInfo(null);
      
      // 重置进度 ref，因为打开文件是全新的播放
      lastPositionRef.current = 0;
      
      // 保存文件名并获取TMDB信息
      const titleInfo = extractTitleFromFileName(filePath);
      setCurrentFileName(titleInfo.title);
      fetchTMDBInfo(titleInfo);
      
      window.api.play(filePath);
    }
  }, [fetchTMDBInfo]);

  // ==================== 播放控制 ====================
  
  /** 切换播放/暂停 */
  const togglePlay = useCallback(() => {
    window.api.cmd(['cycle', 'pause']);
  }, []);
  
  /** 快退 10 秒 */
  const seekBack = useCallback(() => {
    window.api.cmd(['seek', -10, 'relative']);
  }, []);
  
  /** 快进 10 秒 */
  const seekForward = useCallback(() => {
    window.api.cmd(['seek', 10, 'relative']);
  }, []);
  
  /** 停止播放 */
  const stop = useCallback(() => {
    window.api.stop();
  }, []);
  
  /** 点击进度条跳转 */
  const handleSeek = useCallback((e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const percent = (e.clientX - rect.left) / rect.width;
    window.api.cmd(['seek', percent * duration, 'absolute']);
  }, [duration]);

  /** 切换静音 */
  const toggleMute = useCallback(() => {
    window.api.cmd(['cycle', 'mute']);
  }, []);
  
  /** 调整音量 */
  const handleVolumeChange = useCallback((e) => {
    const val = parseInt(e.target.value, 10);
    setVolume(val);
    window.api.cmd(['set', 'volume', val]);
  }, []);

  // ==================== 轨道切换 ====================
  
  /** 手动切换音轨 */
  const setAudioTrack = useCallback((id) => {
    if (id === currentAudio) return;
    setLoadingText('正在切换音轨...');
    setIsLoading(true);
    setCurrentAudio(id);
    window.api.cmd(['set_property', 'aid', id]);
    setShowMenu(false);
  }, [currentAudio]);

  /** 手动切换字幕 */
  const setSubTrack = useCallback((id) => {
    if (id === currentSub) return;
    setLoadingText('正在切换字幕...');
    setIsLoading(true);
    setCurrentSub(id);
    window.api.cmd(['set_property', 'sid', id]);
    setShowMenu(false);
  }, [currentSub]);

  /** 跳转到章节 */
  const seekToChapter = useCallback((time) => {
    setLoadingText('正在跳转章节...');
    setIsLoading(true);
    window.api.cmd(['seek', time, 'absolute']);
    setShowMenu(false);
  }, []);

  /** 切换蓝光标题 */
  const switchTitle = useCallback((edition) => {
    setLoadingText('正在切换标题...');
    setIsLoading(true);
    setPosition(0);
    setDuration(0);
    setAudioTracks([]);
    setSubTracks([]);
    setChapters([]);
    setCurrentTitle(edition);
    
    // 重置进度 ref，因为切换标题是全新的播放
    lastPositionRef.current = 0;
    
    window.api.switchTitle(edition);
    setShowMenu(false);
  }, []);

  // ==================== 工具函数 ====================
  
  /**
   * 格式化时间为 H:MM:SS 或 M:SS 格式
   * @param {number} s - 秒数
   */
  const formatTime = useCallback((s) => {
    if (!s || isNaN(s)) return '0:00';
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = Math.floor(s % 60);
    if (h > 0) {
      return `${h}:${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
    }
    return `${m}:${sec.toString().padStart(2, '0')}`;
  }, []);

  /** 阻止右键菜单 */
  const handleRightClick = useCallback((e) => e.preventDefault(), []);

  // ==================== 子组件 ====================
  
  // 获取当前音轨详情 (格式: TrueHD 7.1 - 中文)
  const getCurrentAudioTrack = () => {
    const track = audioTracks.find(t => t.id === currentAudio);
    if (!track) return '无';
    // 格式化声道
    const ch = track.channels || '';
    const chStr = ch.replace('立体声', '2.0').replace('环绕', '');
    return `${track.codec || ''} ${chStr} - ${track.lang || '未知'}`.trim();
  };
  
  // 获取当前字幕详情 (格式: PGS - 中文)
  const getCurrentSubTrack = () => {
    const track = subTracks.find(t => t.id === currentSub);
    if (!track) return '无';
    return `${track.type || 'SUB'} - ${track.lang || '未知'}`;
  };
  
  // 获取当前章节详情
  const getCurrentChapterInfo = () => {
    if (chapters.length === 0) return '无';
    const ch = chapters[currentChapter];
    return ch ? `${currentChapter + 1}/${chapters.length} - ${ch.title || '章节 ' + (currentChapter + 1)}` : '无';
  };
  
  /** 媒体信息面板 */
  const InfoPanel = () => (
    <div className="info-panel">
      {/* TMDB 信息 */}
      {tmdbInfo && (
        <div className="info-section">
          {/* 左右布局：左侧海报，右侧信息 */}
          <div className="info-header">
            {/* 左侧：海报图片 */}
            {tmdbInfo.posterUrl && (
              <div className="info-poster">
                <img src={tmdbInfo.posterUrl} alt={tmdbInfo.title} />
              </div>
            )}
            
            {/* 右侧：标题、年份、评分、演员 */}
            <div className="info-details">
              <div className="info-title">{tmdbInfo.title}</div>
              {tmdbInfo.originalTitle !== tmdbInfo.title && (
                <div className="info-subtitle">{tmdbInfo.originalTitle}</div>
              )}
              <div className="info-meta">
                {tmdbInfo.releaseDate?.split('-')[0]} · 评分 {tmdbInfo.rating?.toFixed(1)}
              </div>
              {tmdbInfo.cast.length > 0 && (
                <div className="info-cast">
                  {tmdbInfo.cast.join(' / ')}
                </div>
              )}
            </div>
          </div>
          
          {/* 简介 - 独立一行，支持换行 */}
          <div className="info-overview">
            {tmdbInfo.overview}
          </div>
        </div>
      )}
      
      {!tmdbInfo && currentFileName && (
        <div className="info-section">
          <div className="info-title">{currentFileName}</div>
        </div>
      )}
      
      <div className="info-divider" />
      
      {/* 技术信息 */}
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
        <span>{getCurrentAudioTrack()}</span>
      </div>
      <div className="info-row">
        <span>字幕</span>
        <span>{getCurrentSubTrack()}</span>
      </div>
      <div className="info-row">
        <span>码率</span>
        <span>{videoBitrate > 0 ? `${(videoBitrate / 1000).toFixed(2)} Mbps` : '计算中...'}</span>
      </div>
    </div>
  );

  // 是否显示首页
  const showHome = pageState === 'home';
  
  // 检查菜单是否有内容
  const hasMenuContent = subTracks.length > 0 || audioTracks.length > 0 || 
                         chapters.length > 0 || blurayTitles.length > 0;
  
  // 获取第一个有内容的标签
  const getFirstAvailableTab = useCallback(() => {
    if (subTracks.length > 0) return 'sub';
    if (audioTracks.length > 0) return 'audio';
    if (chapters.length > 0) return 'chapter';
    if (blurayTitles.length > 0) return 'title';
    return 'chapter';
  }, [subTracks.length, audioTracks.length, chapters.length, blurayTitles.length]);
  
  // 打开菜单时自动选中第一个有内容的标签
  const handleToggleMenu = useCallback(() => {
    if (!showMenu && hasMenuContent) {
      setActiveTab(getFirstAvailableTab());
    }
    setShowMenu(!showMenu);
  }, [showMenu, hasMenuContent, getFirstAvailableTab]);

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
          <div className="welcome-subtitle">基于 MPV 的现代化播放器</div>
          <div className="welcome-buttons">
            <button onClick={handleOpenFile}>
              <FolderOpen size={20} /> 打开文件
            </button>
          </div>
          <div className="welcome-features">
            <div className="welcome-feature">
              <Info size={16} /> 支持蓝光原盘
            </div>
            <div className="welcome-feature">
              <Info size={16} /> HDR / 杜比视界
            </div>
            <div className="welcome-feature">
              <Info size={16} /> 音频透传
            </div>
            <div className="welcome-feature">
              <Info size={16} /> GPU 硬件加速
            </div>
          </div>
        </div>
      )}

      {/* ========== 加载提示 ========== */}
      {(isLoading || isBuffering) && (
        <div className="loading-overlay">
          <div className="loading-text">
            {isBuffering ? '缓冲中...' : loadingText}
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
            {/* 左右布局容器 */}
            <div className="menu-layout">
              {/* 左侧标签栏 */}
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
              
              {/* 右侧内容区 */}
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
            {/* menu-layout 关闭 */}
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
