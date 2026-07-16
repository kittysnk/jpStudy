import { useEffect, useRef, useState } from "react";
import { 
  ArrowLeft, 
  ChevronUp, 
  ChevronDown, 
  Volume2, 
  Eye, 
  EyeOff, 
  Play, 
  Pause, 
  Sparkles,
  Gauge
} from "lucide-react";
import type { LearningData } from "../utils/gemini";

interface StudyRoomProps {
  data: LearningData;
  onBack: () => void;
}

declare global {
  interface Window {
    onYouTubeIframeAPIReady?: () => void;
    YT?: any;
  }
}

export default function StudyRoom({ data, onBack }: StudyRoomProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [showTranslation, setShowTranslation] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [currentTime, setCurrentTime] = useState(0);

  const playerRef = useRef<any>(null);
  const progressInterval = useRef<number | null>(null);

  // YouTube API Script 로드 및 플레이어 초기화
  useEffect(() => {
    let active = true;
    let timerId: number | null = null;

    // 이미 로드되었는지 확인
    if (!window.YT) {
      const tag = document.createElement("script");
      tag.src = "https://www.youtube.com/iframe_api";
      const firstScriptTag = document.getElementsByTagName("script")[0];
      firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);
    }

    // API Ready 콜백 설정
    const initPlayer = () => {
      if (!active) return;

      // DOM 마운트가 완전히 끝날 때까지 150ms 딜레이 후 생성 (수동 추가 시 레이스 컨디션 방지)
      timerId = window.setTimeout(() => {
        const el = document.getElementById("youtube-embed-player");
        if (!el || !active) return;

        try {
          if (playerRef.current && typeof playerRef.current.destroy === "function") {
            playerRef.current.destroy();
          }
        } catch (e) {
          console.warn("Failed to destroy previous player:", e);
        }

        playerRef.current = new window.YT.Player("youtube-embed-player", {
          events: {
            onReady: (event: any) => {
              if (active) {
                console.log("YouTube Player Ready");
                // 배속 세팅 초기화
                setPlaybackRate(event.target.getPlaybackRate() || 1);
              }
            },
            onStateChange: (event: any) => {
              if (!active) return;
              // YT.PlayerState.PLAYING = 1
              if (event.data === 1) {
                setIsPlaying(true);
                startTrackingProgress();
              } else {
                setIsPlaying(false);
                stopTrackingProgress();
              }
            },
          },
        });
      }, 150);
    };

    if (window.YT && window.YT.Player) {
      initPlayer();
    } else {
      window.onYouTubeIframeAPIReady = initPlayer;
    }

    return () => {
      active = false;
      if (timerId !== null) {
        clearTimeout(timerId);
      }
      stopTrackingProgress();
      if (playerRef.current && typeof playerRef.current.destroy === "function") {
        try {
          playerRef.current.destroy();
        } catch (e) {
          console.warn("Failed to destroy player on unmount:", e);
        }
        playerRef.current = null;
      }
    };
  }, [data.video_id]);

  // 재생 위치 트래킹
  const startTrackingProgress = () => {
    stopTrackingProgress();
    progressInterval.current = window.setInterval(() => {
      if (playerRef.current && typeof playerRef.current.getCurrentTime === "function") {
        setCurrentTime(playerRef.current.getCurrentTime());
      }
    }, 500);
  };

  const stopTrackingProgress = () => {
    if (progressInterval.current !== null) {
      clearInterval(progressInterval.current);
      progressInterval.current = null;
    }
  };

  // 시간 이동 (Tap to Seek)
  const handleSeek = (seconds: number) => {
    if (playerRef.current && typeof playerRef.current.seekTo === "function") {
      playerRef.current.seekTo(seconds, true);
      // 일시정지 상태라면 재생시킴
      if (playerRef.current.getPlayerState() !== 1) {
        playerRef.current.playVideo();
      }
    }
  };

  // 재생 / 일시정지 제어
  const togglePlay = () => {
    if (playerRef.current) {
      if (isPlaying) {
        playerRef.current.pauseVideo();
      } else {
        playerRef.current.playVideo();
      }
    }
  };

  // 배속 변경
  const handleSpeedChange = (rate: number) => {
    if (playerRef.current && typeof playerRef.current.setPlaybackRate === "function") {
      playerRef.current.setPlaybackRate(rate);
      setPlaybackRate(rate);
    }
  };

  // 현재 대사와 매치되는지 확인 (하이라이트용)
  const getActiveScriptIndex = (): number => {
    let activeIndex = -1;
    for (let i = 0; i < data.script_data.length; i++) {
      if (currentTime >= data.script_data[i].time) {
        activeIndex = i;
      } else {
        break;
      }
    }
    return activeIndex;
  };

  const activeIndex = getActiveScriptIndex();

  // activeIndex 변경 시 스크롤 자동 이동 훅
  useEffect(() => {
    if (activeIndex !== -1) {
      const activeEl = document.getElementById(`script-item-${activeIndex}`);
      if (activeEl) {
        activeEl.scrollIntoView({
          behavior: "smooth",
          block: "nearest",
        });
      }
    }
  }, [activeIndex]);

  return (
    <div className="flex flex-col hybrid-landscape-row h-[calc(100vh-1rem)] landscape:h-[calc(100vh-2rem)] w-full overflow-hidden bg-slate-950 rounded-3xl border border-slate-800 shadow-2xl relative">
      
      {/* 뒤로가기 플로팅 버튼 */}
      <button 
        onClick={onBack}
        className="absolute top-4 left-4 z-40 bg-slate-900/80 hover:bg-slate-800 text-slate-200 p-2.5 rounded-xl border border-slate-700/50 backdrop-blur-md transition shadow-md touch-target"
        title="대시보드로 돌아가기"
      >
        <ArrowLeft size={18} />
      </button>

      <div className={`
        relative bg-black transition-all duration-300 shrink-0 flex items-center justify-center
        ${isCollapsed ? "h-[1px] opacity-0 overflow-hidden" : "w-full aspect-video"}
        hybrid-landscape-w-half landscape:opacity-100 landscape:visible
      `}>
        {/* 유튜브 Iframe Embed 가 가로/세로 모두에서 16:9 화면 종횡비를 깨지 않도록 래퍼에 aspect-video 및 max-h-full 지정 */}
        <div className={`w-full aspect-video max-h-full max-w-full relative ${isCollapsed ? "hidden" : "block"}`}>
          <iframe
            id="youtube-embed-player"
            src={`https://www.youtube.com/embed/${data.video_id}?enablejsapi=1&rel=0&playsinline=1&controls=1&showinfo=0`}
            className="absolute top-0 left-0 w-full h-full border-none pointer-events-auto"
            allow="autoplay; encrypted-media"
            title="YouTube Study Player"
          />
        </div>

        {/* 세로모드 전용 접기/펼치기 플로팅 토글 버튼 (플레이어 오른쪽 아래 배치) */}
        {!isCollapsed && (
          <button
            onClick={() => setIsCollapsed(true)}
            className="absolute bottom-3 right-3 z-30 bg-black/70 hover:bg-black/90 text-white px-2 py-1.5 rounded-lg border border-white/20 text-xs flex items-center gap-1 backdrop-blur-sm transition active:scale-95 touch-target hybrid-landscape-hide"
          >
            <ChevronUp size={14} />
            <span>접기</span>
          </button>
        )}
      </div>

      {/* 접혔을 때 플레이어 최소 제어 컨트롤러 패널 */}
      {isCollapsed && (
        <div className="hybrid-landscape-hide bg-slate-900 border-b border-slate-800 px-4 py-3 flex items-center justify-between z-10 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <button
              onClick={togglePlay}
              className="bg-violet-600 hover:bg-violet-500 text-white p-2 rounded-lg transition active:scale-95 touch-target shrink-0"
            >
              {isPlaying ? <Pause size={14} fill="currentColor" /> : <Play size={14} fill="currentColor" />}
            </button>
            <span className="text-xs font-semibold text-slate-200 truncate">
              {data.video_title}
            </span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <span className="text-[10px] text-slate-400 font-mono">
              {window.YT ? "음성 재생 중" : "로딩 중"}
            </span>
            <button
              onClick={() => setIsCollapsed(false)}
              className="bg-slate-800 hover:bg-slate-700 text-slate-200 px-2 py-1.5 rounded-lg border border-slate-700/50 text-xs flex items-center gap-1 transition active:scale-95 touch-target"
            >
              <ChevronDown size={14} />
              <span>화면 켜기</span>
            </button>
          </div>
        </div>
      )}

      {/* ② 하단 스크립트 스크롤 영역 (가로 모드에서는 우측 50% 영역) */}
      <div className="flex-1 flex flex-col min-h-0 bg-slate-900/60 backdrop-blur-md hybrid-landscape-w-half">
        {/* 상단 컨트롤 헤더 */}
        <div className="px-4 py-3 bg-slate-950/40 border-b border-slate-850 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2 text-slate-300">
            <Volume2 size={16} className="text-violet-400" />
            <span className="text-xs font-semibold">동시 번역 학습</span>
          </div>

          {/* 옵션 버튼그룹 (번역 토글, 배속 조절) */}
          <div className="flex items-center gap-2">
            {/* 배속 조절 셀렉트 */}
            <div className="flex items-center gap-1 bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-700/50 text-xs text-slate-300">
              <Gauge size={12} className="text-slate-400" />
              <select
                value={playbackRate}
                onChange={(e) => handleSpeedChange(parseFloat(e.target.value))}
                className="bg-transparent outline-none cursor-pointer pr-1 text-[11px] font-medium font-sans"
              >
                <option value="0.5" className="bg-slate-900">0.5x (느림)</option>
                <option value="0.75" className="bg-slate-900">0.75x</option>
                <option value="1.0" className="bg-slate-900">1.0x (보통)</option>
                <option value="1.25" className="bg-slate-900">1.25x</option>
                <option value="1.5" className="bg-slate-900">1.5x (빠름)</option>
                <option value="2.0" className="bg-slate-900">2.0x</option>
              </select>
            </div>

            {/* 번역 토글 버튼 */}
            <button
              onClick={() => setShowTranslation(!showTranslation)}
              className={`px-2.5 py-1 rounded-lg border text-xs font-medium transition flex items-center gap-1 active:scale-95 touch-target ${
                showTranslation
                  ? "bg-violet-950/60 text-violet-300 border-violet-800/80"
                  : "bg-slate-800/80 text-slate-400 border-slate-700/50"
              }`}
            >
              {showTranslation ? <Eye size={12} /> : <EyeOff size={12} />}
              <span>{showTranslation ? "번역 ON" : "번역 OFF"}</span>
            </button>
          </div>
        </div>

        {/* 스크립트 리스트 */}
        <div className="flex-1 overflow-y-auto px-4 py-6 space-y-4">
          {data.script_data.map((item, idx) => {
            const isActive = idx === activeIndex;
            return (
              <div
                key={idx}
                id={`script-item-${idx}`}
                onClick={() => handleSeek(item.time)}
                className={`p-3.5 rounded-xl border transition-all duration-300 cursor-pointer flex gap-3 ${
                  isActive
                    ? "bg-violet-950/40 border-violet-500/50 shadow-md shadow-violet-950/20 scale-[1.01]"
                    : "bg-slate-950/30 border-slate-850 hover:bg-slate-950/50 hover:border-slate-800"
                }`}
              >
                {/* 타임코드 */}
                <div className={`text-sm font-mono shrink-0 pt-1 font-bold ${
                  isActive ? "text-violet-400 animate-pulse" : "text-slate-500"
                }`}>
                  [{item.time_code}]
                </div>

                {/* 대사 내용 */}
                <div className="flex-1 space-y-1.5 min-w-0">
                  <p 
                    className="japanese-text text-slate-100 text-[23px] leading-relaxed break-words"
                    dangerouslySetInnerHTML={{ __html: item.japanese }}
                  />
                  {showTranslation && (
                    <p className={`text-[16px] leading-relaxed break-words transition-all duration-300 ${
                      isActive ? "text-violet-200 font-medium" : "text-slate-400"
                    }`}>
                      {item.korean}
                    </p>
                  )}
                </div>
              </div>
            );
          })}

          {data.script_data.length === 0 && (
            <div className="text-center py-12 text-slate-500">
              <Sparkles size={24} className="mx-auto mb-2 opacity-30 text-violet-400" />
              <p className="text-xs">스크립트 자막 정보가 존재하지 않습니다.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
