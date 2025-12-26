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
  FolderOpen, Info, Music, Subtitles, BookOpen, Film
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
  if (!codec) return '';
  const lowerCodec = codec.toLowerCase();
  
  // H.265/HEVC
  if (lowerCodec.includes('hevc') || lowerCodec.includes('h265')) {
    if (lowerCodec.includes('main 10') || lowerCodec.includes('main10')) return 'HEVC 10bit';
    return 'HEVC';
  }
  
  // H.264/AVC
  if (lowerCodec.includes('h264') || lowerCodec.includes('avc')) {
    return 'H.264';
  }
  
  // 其他格式
  if (lowerCodec.includes('av1')) return 'AV1';
  if (lowerCodec.includes('vp9')) return 'VP9';
  if (lowerCodec.includes('mpeg2')) return 'MPEG-2';
  
  return codec.substring(0, 10).toUpperCase();
};

/**
 * 格式化声道数
 * @param {number|string} channels - 声道数
 * @returns {string} 格式化后的声道描述
 * 
 * @example
 * getChannels(2) // 返回 '2.0'
 * getChannels(6) // 返回 '5.1'
 */
const getChannels = (channels) => {
  if (!channels || channels === 'undefined') return '';
  
  // 处理字符串形式
  if (typeof channels === 'string') {
    const num = parseInt(channels);
    if (!isNaN(num)) channels = num;
    else return channels;
  }
  
  // 数字映射为声道格式
  const map = { 1: '1.0', 2: '2.0', 6: '5.1', 8: '7.1' };
  return map[channels] || `${channels}.0`;
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

/**
 * 根据分辨率获取视频质量标签
 * @param {number} width - 视频宽度
 * @param {number} height - 视频高度
 * @returns {string} 质量标签
 */
const getVideoQuality = (width, height) => {
  if (!width || !height) return 'SD';
  
  // 按高度判断
  if (height >= 2160 || width >= 3840) return '4K';
  if (height >= 1440 || width >= 2560) return '2K';
  if (height >= 1080 || width >= 1920) return 'FHD';
  if (height >= 720 || width >= 1280) return 'HD';
  return 'SD';
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
  const [activePopup, setActivePopup] = useState(null);    // 当前打开的弹出菜单: 'audio' | 'sub' | 'chapter' | 'title' | null
  const [showInfo, setShowInfo] = useState(false);         // INFO 是独立的，不受其他菜单影响
  
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
  const [tmdbInfo, setTmdbInfo] = useState(null);          // 当前TMDB电影数据
  const [currentFileName, setCurrentFileName] = useState(''); // 当前文件名
  
  // 合集电影支持
  const [movieTitles, setMovieTitles] = useState([]);      // 所有标题列表 [{title, year}, ...]
  const [currentMovieIndex, setCurrentMovieIndex] = useState(0);  // 当前显示索引
  const [tmdbCache, setTmdbCache] = useState({});          // TMDB缓存 {"title_year": tmdbInfo}
  
  // 实时码率
  const [videoBitrate, setVideoBitrate] = useState(0);     // 视频码率 (kbps)
  const [audioBitrate, setAudioBitrate] = useState(0);     // 音频码率 (kbps)
  
  // 退出确认对话框
  const [showExitConfirm, setShowExitConfirm] = useState(false);

  // 派生状态
  const showHome = pageState === 'home';

  // ==================== Refs ====================
  
  const initialized = useRef(false);           // 防止重复初始化
  const hideTimer = useRef(null);              // 控制栏隐藏定时器
  const lastPositionRef = useRef(0);           // 上一次播放位置（用于检测进度变化）
  const isLoadingRef = useRef(false);          // Loading 状态的 ref
  const tmdbTimer = useRef(null);              // TMDB请求延迟定时器
  const lastMoveTimeRef = useRef(0);           // 鼠标移动节流
  
  // 按钮 refs（用于计算弹出菜单位置）
  const audioButtonRef = useRef(null);
  const subButtonRef = useRef(null);
  const chapterButtonRef = useRef(null);
  const titleButtonRef = useRef(null);
  
  // 弹出菜单位置
  const [popupPosition, setPopupPosition] = useState({ right: '50%' });

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
      setIsBuffering(false);
      setActivePopup(null);  // 关闭所有弹出菜单
      setShowInfo(false);    // 关闭 INFO
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
      // 节流：100ms
      const now = Date.now();
      if (now - lastMoveTimeRef.current < 100) return;
      lastMoveTimeRef.current = now;

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

  // 控制栏隐藏时关闭弹出菜单（但保留 INFO）
  useEffect(() => {
    if (!showControls && activePopup) {
      setActivePopup(null);
    }
  }, [showControls, activePopup]);
  
  // 弹出菜单打开时保持控制栏显示
  useEffect(() => {
    if (activePopup) {
      setShowControls(true);
      // 清除自动隐藏定时器
      if (hideTimer.current) {
        clearTimeout(hideTimer.current);
        hideTimer.current = null;
      }
    }
  }, [activePopup]);
  
  // 同步 isLoading 到 ref（用于事件处理器访问最新值）
  useEffect(() => {
    isLoadingRef.current = isLoading;
  }, [isLoading]);

  // ==================== 文件操作 ====================
  
  // TMDB Bearer Token
  const TMDB_BEARER_TOKEN = 'eyJhbGciOiJIUzI1NiJ9.eyJhdWQiOiIyZjFkYWM4MGFlODA4YjBhNjNhNTI0YmU1Mjc3YmMyNSIsIm5iZiI6MTY3OTY2MDE5Ni4yODQsInN1YiI6IjY0MWQ5NGE0OGRlMGFlMDA4MzlhOTA5NiIsInNjb3BlcyI6WyJhcGlfcmVhZCJdLCJ2ZXJzaW9uIjoxfQ.0gCSVC3FRm6C37XrAuZ2hBYlAV3Ff2yPNTB4faiSPS4';
  
  // 从文件名提取电影标题和年份（支持合集返回数组）
  // 策略：从文件名提取英文标题 + 年份
  const extractTitlesFromFileName = (filePath) => {
    const fileName = filePath.split(/[\\/]/).pop() || '';
    
    // 清理单个标题片段，提取英文标题和年份
    const cleanTitle = (segment) => {
      // 提取年份
      const yearMatch = segment.match(/\b(19\d{2}|20\d{2})\b/);
      const year = yearMatch ? yearMatch[1] : null;
      
      // 清理标题
      let title = segment
        .replace(/\.[^.]+$/, '')  // 移除扩展名
        .replace(/\[(.*?)\]/g, '')  // 移除方括号内容
        .replace(/@[\w]+/g, '')  // 移除@组名
        .replace(/\b(19\d{2}|20\d{2})\b/g, '')  // 移除年份
        .replace(/\d{4}p?/gi, '')  // 移除分辨率
        .replace(/(MULTi|COMPLETE|UHD|4K|2160p|1080p|720p|HDR|DV|SDR|REMUX)/gi, '')
        .replace(/(BluRay|BDRip|WEB-DL|WEBRip|HDRip|DVDRip|BRRip|HDTV)/gi, '')
        .replace(/(x264|x265|HEVC|AVC|H\.264|H\.265|10bit)/gi, '')
        .replace(/(AAC|DTS|TrueHD|Atmos|FLAC|DD|AC3|EAC3|LPCM)/gi, '')
        .replace(/(DIY|Repack|Proper|EXTENDED|Directors\.Cut)/gi, '')
        .replace(/\b(GBR|USA|FRA|JPN|CHN|KOR|HKG|TWN)\b/gi, '')
        .replace(/(\d+)in1/gi, '')
        .replace(/[._-]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      
      return { title, year };
    };
    
    // 检测是否是合集：2in1/3in1 等标记
    const multiMatch = fileName.match(/(\d+)in1/i);
    
    if (multiMatch) {
      // 合集：取 XinX 之前的部分，用 + 分割
      const baseName = fileName.replace(/\.[^.]+$/, '');
      const collectionPart = baseName.split(/\.\d+in1/i)[0];
      const segments = collectionPart.split('+');
      
      const titles = segments.map(seg => cleanTitle(seg)).filter(t => t.title);
      
      console.log('检测到合集:', multiMatch[1] + 'in1');
      console.log('解析出标题:', titles);
      
      return titles;
    }
    
    // 普通单片
    const result = cleanTitle(fileName);
    console.log('单片标题:', result.title, '年份:', result.year);
    return [result];
  };
  
  // 获取TMDB电影信息
  const fetchTMDBInfo = useCallback(async (titleInfo) => {
    if (!titleInfo.title) return;
    
    try {
      // 1. 搜索电影
      const searchRes = await fetch(
        `https://api.themoviedb.org/3/search/movie?query=${encodeURIComponent(titleInfo.title)}&language=zh-CN&year=${titleInfo.year}`,
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
      
      // 按评分降序排序
      const sortedResults = [...searchData.results].sort((a, b) => 
        (b.vote_average || 0) - (a.vote_average || 0)
      );

      console.log('TMDB搜索结果:', sortedResults);
      
      // 2. 精确匹配 最高评分
      let bestMatch = sortedResults[0];
      
      // 3. 获取详细信息（包含分级信息）
      const detailRes = await fetch(
        `https://api.themoviedb.org/3/movie/${bestMatch.id}?language=zh-CN&append_to_response=release_dates`,
        {
          headers: {
            'Authorization': `Bearer ${TMDB_BEARER_TOKEN}`,
            'Content-Type': 'application/json'
          }
        }
      );
      const detailData = await detailRes.json();
      
      // 4. 获取演职员信息（包含导演）
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
      
      // 5. 筛选导演
      const directors = creditsData.crew
        ?.filter(person => person.job === 'Director')
        .map(person => person.name) || [];
      
      // 6. 筛选领衔主演
      const mainCast = creditsData.cast
        ?.filter(actor => actor.order < 5)  // 前5位演员
        .map(actor => actor.name) || [];
      
      // 7. 获取分级（优先中国、美国、其他）
      let certification = '';
      const releaseDates = detailData.release_dates?.results || [];
      const cnRelease = releaseDates.find(r => r.iso_3166_1 === 'CN');
      const usRelease = releaseDates.find(r => r.iso_3166_1 === 'US');
      const anyRelease = releaseDates.find(r => r.release_dates?.[0]?.certification);
      
      if (cnRelease?.release_dates?.[0]?.certification) {
        certification = cnRelease.release_dates[0].certification;
      } else if (usRelease?.release_dates?.[0]?.certification) {
        certification = usRelease.release_dates[0].certification;
      } else if (anyRelease?.release_dates?.[0]?.certification) {
        certification = anyRelease.release_dates[0].certification;
      }
      
      // 8. 获取制作国家/地区（取第一个）
      const countries = detailData.production_countries || [];
      const region = countries.length > 0 
        ? (countries[0].iso_3166_1 === 'US' ? '美国' 
            : countries[0].iso_3166_1 === 'CN' ? '中国'
            : countries[0].iso_3166_1 === 'HK' ? '中国香港'
            : countries[0].iso_3166_1 === 'TW' ? '中国台湾'
            : countries[0].iso_3166_1 === 'JP' ? '日本'
            : countries[0].iso_3166_1 === 'KR' ? '韩国'
            : countries[0].iso_3166_1 === 'GB' ? '英国'
            : countries[0].iso_3166_1 === 'FR' ? '法国'
            : countries[0].iso_3166_1 === 'DE' ? '德国'
            : countries[0].name)
        : '';
      
      // 9. 获取类型
      const genres = detailData.genres?.map(g => g.name) || [];
      
      // 10. 构建海报URL
      const posterUrl = detailData.poster_path 
        ? `https://media.themoviedb.org/t/p/w300_and_h450_face${detailData.poster_path}`
        : null;
      
      const tmdbData = {
        title: detailData.title || bestMatch.title,
        originalTitle: detailData.original_title,
        overview: (detailData.overview || '暂无简介').trimStart(),
        releaseDate: detailData.release_date,
        rating: detailData.vote_average,
        runtime: detailData.runtime,
        certification: certification,
        region: region,
        genres: genres,
        directors: directors,
        cast: mainCast,
        posterUrl: posterUrl
      };
      
      console.log('TMDB信息获取成功:', {
        '标题': detailData.title,
        '年份': detailData.release_date?.split('-')[0],
        '时长': detailData.runtime,
        '分级': certification,
        '地区': region,
        '类型': genres,
        '导演': directors,
        '演员': mainCast,
        '海报': posterUrl
      });
      
      return tmdbData;
      
    } catch (e) {
      console.log('TMDB获取失败:', e.message);
      return null;
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
      setTmdbCache({});  // 清空缓存
      setCurrentMovieIndex(0);  // 重置索引
      
      // 重置进度 ref，因为打开文件是全新的播放
      lastPositionRef.current = 0;
      
      // 解析文件名获取标题列表（支持合集）
      const titles = extractTitlesFromFileName(filePath);
      setMovieTitles(titles);
      setCurrentFileName(titles[0]?.title || '');
      
      // 请求所有标题的TMDB信息并缓存
      titles.forEach((titleInfo, index) => {
        fetchTMDBInfo(titleInfo).then(data => {
          if (data) {
            const cacheKey = `${titleInfo.title}_${titleInfo.year || ''}`;
            setTmdbCache(prev => ({ ...prev, [cacheKey]: data }));
            // 第一个标题默认显示
            if (index === 0) {
              setTmdbInfo(data);
            }
          }
        });
      });
      
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
    window.api.cmd(['set_property', 'volume', val]);
  }, []);

  // ==================== 轨道切换 ====================
  
  /** 手动切换音轨 */
  const setAudioTrack = useCallback((id) => {
    if (id === currentAudio) return;
    setLoadingText('正在切换音轨...');
    setIsLoading(true);
    setCurrentAudio(id);
    window.api.cmd(['set_property', 'aid', id]);
    setActivePopup(null);  // 关闭弹出菜单
  }, [currentAudio]);

  /** 手动切换字幕 */
  const setSubTrack = useCallback((id) => {
    if (id === currentSub) return;
    setLoadingText('正在切换字幕...');
    setIsLoading(true);
    setCurrentSub(id);
    window.api.cmd(['set_property', 'sid', id]);
    setActivePopup(null);  // 关闭弹出菜单
  }, [currentSub]);

  /** 跳转到章节 */
  const seekToChapter = useCallback((time) => {
    setLoadingText('正在跳转章节...');
    setIsLoading(true);
    window.api.cmd(['seek', time, 'absolute']);
    setActivePopup(null);  // 关闭弹出菜单
  }, []);

  /** 切换合集电影（INFO面板用） */
  const switchMovie = useCallback((direction) => {
    if (movieTitles.length <= 1) return;
    
    let newIndex;
    if (direction === 'next') {
      newIndex = (currentMovieIndex + 1) % movieTitles.length;
    } else {
      newIndex = (currentMovieIndex - 1 + movieTitles.length) % movieTitles.length;
    }
    
    setCurrentMovieIndex(newIndex);
    
    const newMovie = movieTitles[newIndex];
    const cacheKey = `${newMovie.title}_${newMovie.year || ''}`;
    
    if (tmdbCache[cacheKey]) {
      // 缓存中有数据，直接使用
      setTmdbInfo(tmdbCache[cacheKey]);
    } else {
      // 缓存中没有，请求 TMDB
      setTmdbInfo(null);  // 先清空，显示加载状态
      fetchTMDBInfo(newMovie);
    }
    
    console.log('切换到电影:', newMovie.title, '索引:', newIndex);
  }, [movieTitles, currentMovieIndex, tmdbCache, fetchTMDBInfo]);

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
    setActivePopup(null);  // 关闭弹出菜单
  }, []);

  // ==================== 工具函数 ====================
  
  /**
   * 格式化时间为 HH:MM:SS 格式（始终显示6位数字+2个冒号）
   * @param {number} s - 秒数
   * @returns {string} 格式化后的时间字符串，如 "01:23:45" 或 "00:00:49"
   */
  const formatTime = useCallback((s) => {
    if (!s || isNaN(s)) return '00:00:00';
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = Math.floor(s % 60);
    // 始终显示 HH:MM:SS 格式
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
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


  /**
   * 切换弹出菜单
   * @param {string} type - 菜单类型: 'audio' | 'sub' | 'chapter' | 'title' | 'info'
   * 
   * INFO 是独立的，不受其他菜单影响
   * 其他菜单（音频、字幕、章节、标题）互斥
   */
  const togglePopup = useCallback((type) => {
    // INFO 是独立的，不受其他菜单影响
    if (type === 'info') {
      setShowInfo(!showInfo);
      return;
    }
    
    // 其他菜单（音频、字幕、章节、标题）互斥
    if (activePopup === type) {
      setActivePopup(null);
      return;
    }
    
    // 计算按钮位置
    let buttonRef = null;
    if (type === 'audio') buttonRef = audioButtonRef;
    else if (type === 'sub') buttonRef = subButtonRef;
    else if (type === 'chapter') buttonRef = chapterButtonRef;
    else if (type === 'title') buttonRef = titleButtonRef;
    
    if (buttonRef?.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const buttonCenter = rect.left + rect.width / 2;
      const menuWidth = 135;  // 更新菜单宽度
      const rightPosition = window.innerWidth - buttonCenter - menuWidth / 2;
      setPopupPosition({ 
        right: `${rightPosition}px`, 
        left: 'auto',
        top: 'auto',
        bottom: '80px',
        transform: 'none'
      });
    }
    
    setActivePopup(type);
  }, [activePopup, showInfo]);

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

      {/* ========== 弹出菜单 ========== */}
      {/* 音频弹出菜单 */}
      {activePopup === 'audio' && audioTracks.length > 0 && (
        <div 
          className={`popup-menu ${activePopup === 'audio' ? 'visible' : ''}`}
          style={popupPosition}
        >
          {audioTracks.map((audio, i) => (
            <div 
              key={i} 
              className={`popup-menu-item ${audio.id === currentAudio ? 'active' : ''}`}
              onClick={() => setAudioTrack(audio.id)}
            >
              <span className="popup-menu-item-left">
                {audio.codec || '音频'} {audio.channels}
              </span>
              <span className="popup-menu-item-right">
                {audio.lang || '未知'}
              </span>
            </div>
          ))}
        </div>
      )}
      
      {/* 字幕弹出菜单 */}
      {activePopup === 'sub' && subTracks.length > 0 && (
        <div 
          className={`popup-menu ${activePopup === 'sub' ? 'visible' : ''}`}
          style={popupPosition}
        >
          {subTracks.map((sub, i) => (
            <div 
              key={i} 
              className={`popup-menu-item ${sub.id === currentSub ? 'active' : ''}`}
              onClick={() => setSubTrack(sub.id)}
            >
              <span className="popup-menu-item-left">
                {sub.type || '字幕'}
              </span>
              <span className="popup-menu-item-right">
                {sub.lang || '未知'}
              </span>
            </div>
          ))}
        </div>
      )}
      
      {/* 章节弹出菜单 */}
      {activePopup === 'chapter' && chapters.length > 0 && (
        <div 
          className={`popup-menu ${activePopup === 'chapter' ? 'visible' : ''}`}
          style={popupPosition}
        >
          {chapters.map((chapter, i) => (
            <div 
              key={i} 
              className={`popup-menu-item ${i === currentChapter ? 'active' : ''}`}
              onClick={() => seekToChapter(chapter.time)}
            >
              <span className="popup-menu-item-left">
                章节 {i + 1}
              </span>
              <span className="popup-menu-item-right">
                {formatTime(chapter.time)}
              </span>
            </div>
          ))}
        </div>
      )}
      
      {/* 标题弹出菜单 */}
      {activePopup === 'title' && blurayTitles.length > 0 && (
        <div 
          className={`popup-menu ${activePopup === 'title' ? 'visible' : ''}`}
          style={popupPosition}
        >
          {blurayTitles.map((title, i) => (
            <div 
              key={i} 
              className={`popup-menu-item ${title.edition === currentTitle ? 'active' : ''}`}
              onClick={() => switchTitle(title.edition)}
            >
              <span className="popup-menu-item-left">
                标题 {title.displayIndex}{title.isMain ? ' ★' : ''}
              </span>
              <span className="popup-menu-item-right">
                {formatTime(title.durationSeconds || 0)}
              </span>
            </div>
          ))}
        </div>
      )}
      
      {/* INFO 弹出菜单 - Netflix/Apple TV 沉浸式风格 */}
      {showInfo && (
        <div 
          className="popup-menu visible"
          style={{ 
            left: '2%',
            right: 'auto',
            top: '50px',
            bottom: 'auto',
            transform: 'none',
            width: '420px', 
            height: 'auto',
            maxHeight: 'calc(100vh - 150px)',
            cursor: 'default',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            position: 'relative',
            background: 'transparent'
          }}
        >
          {/* 高斯模糊背景层 */}
          {tmdbInfo?.posterUrl && (
            <div style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundImage: `url(${tmdbInfo.posterUrl})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              filter: 'blur(30px) brightness(0.3)',
              transform: 'scale(1.2)',
              zIndex: 0
            }}></div>
          )}
          
          {/* 深色蒙层 */}
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.6)',
            backdropFilter: 'blur(12px)',
            zIndex: 1
          }}></div>
          
          {/* 内容层 */}
          <div style={{ 
            position: 'relative', 
            zIndex: 2, 
            display: 'flex', 
            flexDirection: 'column',
            flex: 1,
            minHeight: 0,
            overflow: 'hidden'
          }}>

            {/* ===== 顶部：封面 + 标题信息 ===== */}
            <div style={{ 
              display: 'flex',
              padding: '20px 20px 10px 20px',
              gap: '18px',
              alignItems: 'flex-start'
            }}>
              {/* 悬浮封面图 */}
              {tmdbInfo?.posterUrl && (
                <div style={{
                  flexShrink: 0,
                  width: '115px',
                  borderRadius: '6px',
                  overflow: 'hidden',
                  boxShadow: '0 10px 30px rgba(0, 0, 0, 0.5)'
                }}>
                  <img 
                    src={tmdbInfo.posterUrl} 
                    alt={tmdbInfo?.title || ''}
                    style={{
                      width: '100%',
                      height: 'auto',
                      display: 'block'
                    }}
                  />
                </div>
              )}
              
              {/* 右侧：标题区 */}
              <div style={{ 
                flex: 1,
                minWidth: 0,
                display: 'flex',
                flexDirection: 'column',
                gap: '4px' // 极度压缩间距
              }}>
                {/* 第一层：大标题（独占一行，允许换行） */}
                <div style={{ 
                  fontSize: '22px', 
                  fontWeight: '700', 
                  color: '#888', 
                  lineHeight: '1.3',
                  letterSpacing: '0.5px'
                }}>
                  {tmdbInfo?.title || currentFileName || '未知影片'}
                </div>
                
                {/* 第二层：评分 + 分级 + 合集切换（胶囊风格） */}
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  flexWrap: 'wrap',
                  gap: '10px',
                  marginTop: '2px'
                }}>
                  {/* 评分 */}
                  {tmdbInfo?.rating && (
                    <span style={{
                      color: '#FFD700',
                      fontWeight: '700',
                      fontSize: '13px',
                      textShadow: '0 0 8px rgba(255, 215, 0, 0.5)'
                    }}>
                      ★ {tmdbInfo.rating.toFixed(1)}
                    </span>
                  )}
                  
                  {/* 分级 */}
                  {tmdbInfo?.certification && (
                    <span style={{
                      padding: '1px 6px',
                      border: '1px solid #e74c3c',
                      borderRadius: '3px',
                      fontSize: '10px',
                      color: '#e74c3c',
                      fontWeight: '600'
                    }}>
                      {tmdbInfo.certification}
                    </span>
                  )}
                  
                  {/* 合集切换（仅有合集时显示，胶囊样式） */}
                  {movieTitles.length > 1 && (
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      border: '1px solid rgba(255,255,255,0.3)',
                      borderRadius: '3px',
                      padding: '1px 6px',
                      fontSize: '10px',
                      color: '#888'
                    }}>
                      <button
                        onClick={() => switchMovie('prev')}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#888',
                          cursor: 'pointer',
                          padding: '0 2px'
                        }}
                      >◀</button>
                      <span>
                        {currentMovieIndex + 1}/{movieTitles.length}
                      </span>
                      <button
                        onClick={() => switchMovie('next')}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#888',
                          cursor: 'pointer',
                          padding: '0 2px'
                        }}
                      >▶</button>
                    </div>
                  )}
                </div>
                
                {/* 第三层：元数据 */}
                {tmdbInfo && (
                  <div style={{ 
                    fontSize: '12px', 
                    color: '#888', 
                    letterSpacing: '0.5px',
                    marginTop: '2px'
                  }}>
                    {[
                      tmdbInfo.releaseDate?.split('-')[0],
                      tmdbInfo.region,
                      tmdbInfo.runtime && `${tmdbInfo.runtime}分钟`,
                      tmdbInfo.genres?.slice(0, 2).join('/')
                    ].filter(Boolean).join(' · ')}
                  </div>
                )}

                
                {/* 第三层：技术特征标签 */}
                <div style={{ 
                  display: 'flex', 
                  flexWrap: 'wrap', 
                  gap: '6px',
                  marginTop: '2px'
                }}>
                  {/* 分辨率标签 - 主色调紫蓝 */}
                  <span style={{
                    padding: '3px 10px',
                    background: 'linear-gradient(135deg, rgba(102, 126, 234, 0.4), rgba(118, 75, 162, 0.4))',
                    borderRadius: '4px',
                    fontSize: '10px',
                    color: '#c4b5fd',
                    fontWeight: '600',
                    letterSpacing: '0.5px'
                  }}>
                    {getVideoQuality(videoParams?.w, videoParams?.h)}
                  </span>
                  {/* 编码标签 - 蓝绿色 */}
                  {getVideoCodec(videoCodec) && (
                    <span style={{
                      padding: '3px 10px',
                      background: 'rgba(46, 204, 113, 0.15)',
                      border: '1px solid rgba(46, 204, 113, 0.4)',
                      borderRadius: '4px',
                      fontSize: '10px',
                      color: '#2ecc71'
                    }}>
                      {getVideoCodec(videoCodec)}
                    </span>
                  )}
                  {/* HDR/DV 标签 - 亮色突出 */}
                  {videoCodec && (videoCodec.toLowerCase().includes('main 10') || videoCodec.toLowerCase().includes('main10')) && (
                    <span style={{
                      padding: '3px 10px',
                      background: 'linear-gradient(135deg, rgba(255, 193, 7, 0.3), rgba(255, 152, 0, 0.3))',
                      borderRadius: '4px',
                      fontSize: '10px',
                      color: '#FFD54F',
                      fontWeight: '600'
                    }}>
                      HDR
                    </span>
                  )}
                  {/* 码率标签 - 青色 */}
                  <span style={{
                    padding: '3px 10px',
                    background: 'rgba(52, 152, 219, 0.15)',
                    border: '1px solid rgba(52, 152, 219, 0.4)',
                    borderRadius: '4px',
                    fontSize: '10px',
                    color: '#3498db'
                  }}>
                    {videoBitrate > 0 ? `${(videoBitrate / 1000).toFixed(1)} Mbps` : '...'}
                  </span>
                </div>
                
                {/* 第四层：演职员 */}
                {tmdbInfo && (
                  <div style={{ 
                    fontSize: '11px', 
                    color: '#888', 
                    lineHeight: '1.6',
                    marginTop: '2px'
                  }}>
                    {tmdbInfo.directors?.length > 0 && (
                      <div>
                        <span style={{ color: '#888' }}>导演：</span>
                        <span style={{ fontWeight: '500', color: '#888' }}>
                          {tmdbInfo.directors.join(' / ')}
                        </span>
                      </div>
                    )}
                    {tmdbInfo.cast?.length > 0 && (
                      <div style={{ marginTop: '3px' }}>
                        <span style={{ color: '#888' }}>主演：</span>
                        <span>{tmdbInfo.cast.slice(0, 5).join(' / ')}</span>
                      </div>
                    )}
                  </div>
                )}
                
                {/* 音频/字幕信息 */}
                <div style={{ 
                  fontSize: '10px', 
                  color: '#888', 
                  marginTop: '4px',
                  display: 'flex',
                  gap: '12px'
                }}>
                  <span>🔊 {getCurrentAudioTrack()}</span>
                  <span>💬 {getCurrentSubTrack()}</span>
                </div>
              </div>
            </div>
            
            {/* ===== 简介区域（flex:1 填充剩余空间） ===== */}
            <div style={{ 
              flex: 1,
              padding: '0 20px 0 20px', // 减少顶部padding，让横线往上提
              textIndent: '25px',
              marginBottom: '10px',
              overflowY: 'auto',
              scrollbarWidth: 'none',
              msOverflowStyle: 'none',
              minHeight: '60px'
            }}
            className="info-overview-scroll"
            >
              {tmdbInfo?.overview ? (
                <div style={{ 
                  fontSize: '12px', 
                  color: '#888', 
                  lineHeight: '1.8',
                  textAlign: 'justify'
                }}>
                  {tmdbInfo.overview}
                </div>
              ) : (
                <div style={{ 
                  fontSize: '12px', 
                  color: '#555', 
                  textAlign: 'center'
                }}>
                  暂无简介
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
              
              {/* 音频按钮 */}
              {audioTracks.length > 0 && (
                <button 
                  ref={audioButtonRef}
                  className={`icon-btn ${activePopup === 'audio' ? 'active' : ''}`}
                  onClick={() => togglePopup('audio')}
                >
                  <Music size={20} />
                </button>
              )}
              
              {/* 字幕按钮 */}
              {subTracks.length > 0 && (
                <button 
                  ref={subButtonRef}
                  className={`icon-btn ${activePopup === 'sub' ? 'active' : ''}`}
                  onClick={() => togglePopup('sub')}
                >
                  <Subtitles size={20} />
                </button>
              )}
              
              {/* 章节按钮 */}
              {chapters.length > 0 && (
                <button 
                  ref={chapterButtonRef}
                  className={`icon-btn ${activePopup === 'chapter' ? 'active' : ''}`}
                  onClick={() => togglePopup('chapter')}
                >
                  <BookOpen size={20} />
                </button>
              )}
              
              {/* 标题按钮 */}
              {blurayTitles.length > 0 && (
                <button 
                  ref={titleButtonRef}
                  className={`icon-btn ${activePopup === 'title' ? 'active' : ''}`}
                  onClick={() => togglePopup('title')}
                >
                  <Film size={20} />
                </button>
              )}
              
              {/* 信息按钮 */}
              <button 
                className={`icon-btn ${showInfo ? 'active' : ''}`}
                onClick={() => togglePopup('info')}
              >
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
