import React, { useState } from "react";
import { 
  Play, 
  Trash2, 
  ExternalLink, 
  Plus, 
  Sparkles, 
  BookOpen, 
  Clock, 
  FileText, 
  ChevronDown, 
  ChevronUp, 
  AlertCircle, 
  Settings as SettingsIcon 
} from "lucide-react";
import { generateLearningData, extractYoutubeVideoId } from "../utils/gemini";
import type { LearningData } from "../utils/gemini";
import { getYoutubeJapaneseSubtitle } from "../utils/youtubeSubtitle";

interface DashboardProps {
  apiKey: string;
  items: LearningData[];
  onAddVideo: (newItem: LearningData) => void;
  onDeleteVideo: (videoId: string) => void;
  onSelectVideo: (videoId: string, targetTab: "study" | "quiz") => void;
  onNavigateToSettings: () => void;
}

export default function Dashboard({
  apiKey,
  items,
  onAddVideo,
  onDeleteVideo,
  onSelectVideo,
  onNavigateToSettings,
}: DashboardProps) {
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [rawScriptText, setRawScriptText] = useState("");
  const [showScriptInput, setShowScriptInput] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");

    if (!apiKey) {
      setErrorMsg("Gemini API Key가 등록되지 않았습니다. 설정 화면에서 API Key를 먼저 입력해 주세요.");
      return;
    }

    const videoId = extractYoutubeVideoId(youtubeUrl);
    if (!videoId) {
      setErrorMsg("올바른 유튜브 URL을 입력해 주세요. (예: https://www.youtube.com/watch?v=...)");
      return;
    }

    // 중복 체크
    if (items.some((item) => item.video_id === videoId)) {
      setErrorMsg("이미 등록된 유튜브 영상입니다.");
      return;
    }

    setIsLoading(true);
    try {
      let scriptTextToSend = rawScriptText;
      // 수동 스크립트가 비어있는 경우에만 백그라운드 자동 자막 수집 기동
      if (!scriptTextToSend.trim()) {
        try {
          const autoSub = await getYoutubeJapaneseSubtitle(videoId);
          if (autoSub) {
            scriptTextToSend = autoSub;
            console.log("자동으로 추출된 유튜브 자막을 사용합니다.");
          }
        } catch (subErr) {
          console.warn("자막 자동 추출 실패, Fallback으로 계속 진행합니다.", subErr);
        }
      }

      const result = await generateLearningData(apiKey, youtubeUrl, scriptTextToSend);
      onAddVideo(result);
      // 초기화
      setYoutubeUrl("");
      setRawScriptText("");
      setShowScriptInput(false);
    } catch (error: any) {
      setErrorMsg(error.message || "학습 데이터를 생성하는 중에 실패했습니다.");
    } finally {
      setIsLoading(false);
    }
  };

  // 날짜별 정렬 (최신순)
  const sortedItems = [...items].sort((a, b) => b.added_date.localeCompare(a.added_date));

  return (
    <div className="space-y-6">
      {/* 타이틀 헤더 */}
      <div className="flex justify-between items-center bg-slate-800/40 p-4 rounded-2xl border border-slate-700/50 backdrop-blur-md">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-400 to-fuchsia-400">
              My JpTube Runner
            </span>
          </h1>
          <p className="text-xs text-slate-400">유튜브로 시작하는 스마트한 나만의 일어 공부방</p>
        </div>
        <button 
          onClick={onNavigateToSettings}
          className="p-2 bg-slate-700/50 hover:bg-slate-700 rounded-xl transition text-slate-300"
          title="설정 이동"
        >
          <SettingsIcon size={20} />
        </button>
      </div>

      {/* 동영상 등록 폼 */}
      <div className="glass-panel p-5 rounded-3xl shadow-xl space-y-4">
        <div className="flex items-center gap-2 text-violet-400 font-semibold text-sm">
          <Sparkles size={16} />
          <span>새로운 학습 영상 추가</span>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-slate-400">유튜브 URL</label>
            <div className="flex flex-col sm:flex-row gap-2.5">
              <input
                type="text"
                value={youtubeUrl}
                onChange={(e) => setYoutubeUrl(e.target.value)}
                placeholder="https://www.youtube.com/watch?v=..."
                disabled={isLoading}
                className="w-full sm:flex-1 bg-slate-950/60 border border-slate-800 focus:border-violet-500/50 outline-none rounded-xl px-4 py-2.5 text-sm text-slate-200 transition"
              />
              <button
                type="submit"
                disabled={isLoading || !youtubeUrl}
                className="bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:opacity-95 active:scale-95 disabled:opacity-50 disabled:active:scale-100 text-white rounded-xl px-5 py-2.5 text-sm font-semibold transition flex items-center justify-center gap-1.5 w-full sm:w-auto sm:shrink-0 shadow-lg shadow-violet-900/20"
              >
                {isLoading ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <Plus size={16} />
                )}
                <span>가져오기</span>
              </button>
            </div>
          </div>

          {/* 에러 메시지 */}
          {errorMsg && (
            <div className="flex items-start gap-2 bg-red-950/30 border border-red-900/40 text-red-300 p-3 rounded-xl text-xs">
              <AlertCircle size={16} className="shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* 스크립트 붙여넣기 토글 */}
          <div className="border-t border-slate-800/80 pt-3">
            <button
              type="button"
              onClick={() => setShowScriptInput(!showScriptInput)}
              className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 transition"
            >
              <FileText size={14} />
              <span>스크립트 텍스트 수동 제공 (자막 파싱 향상)</span>
              {showScriptInput ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>

            {showScriptInput && (
              <div className="mt-2.5 space-y-1">
                <p className="text-[10px] text-slate-500">
                  자막 파일이나 스크립트 내용(시간 정보 포함 권장)을 입력하면 AI가 훨씬 정교하게 후리가나 매핑과 단어를 추출합니다.
                </p>
                <textarea
                  value={rawScriptText}
                  onChange={(e) => setRawScriptText(e.target.value)}
                  placeholder="대사 또는 자막 복사본을 여기에 입력해 주세요..."
                  disabled={isLoading}
                  rows={4}
                  className="w-full bg-slate-950/60 border border-slate-800 focus:border-violet-500/50 outline-none rounded-xl p-3 text-xs text-slate-300 transition resize-none font-mono"
                />
              </div>
            )}
          </div>
        </form>
      </div>

      {/* 로딩 오버레이 */}
      {isLoading && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex flex-col justify-center items-center p-6 text-center animate-fade-in">
          <div className="w-16 h-16 border-4 border-violet-500/30 border-t-violet-500 rounded-full animate-spin mb-4" />
          <h3 className="text-lg font-bold text-white mb-1.5">Gemini AI 일본어 분석 중...</h3>
          <p className="text-xs text-slate-400 max-w-xs leading-relaxed">
            영상 콘텐츠를 분석하여 완벽한 후리가나 자막, JLPT 등급 단어 리스트 및 실용 예문을 구성하고 있습니다. 잠시만 기다려 주세요!
          </p>
        </div>
      )}

      {/* 학습 리스트 타임라인 */}
      <div className="space-y-4">
        <div className="text-sm font-semibold text-slate-300 px-1">학습 타임라인 ({items.length}개)</div>

        {sortedItems.length === 0 ? (
          <div className="glass-panel p-8 rounded-3xl text-center text-slate-500 border-dashed border-slate-800/80">
            <BookOpen size={36} className="mx-auto mb-2.5 opacity-40 text-violet-400" />
            <p className="text-sm">등록된 학습 영상이 없습니다.</p>
            <p className="text-xs text-slate-600 mt-1">상단에 일본어 유튜브 링크를 등록하고 시작해 보세요!</p>
          </div>
        ) : (
          <div className="relative pl-4 border-l-2 border-slate-800 space-y-6">
            {sortedItems.map((item) => {
              const thumbnailUrl = `https://img.youtube.com/vi/${item.video_id}/hqdefault.jpg`;
              return (
                <div key={item.video_id} className="relative group animate-slide-up">
                  {/* 타임라인 점 */}
                  <div className="absolute -left-[23px] top-4 w-3.5 h-3.5 rounded-full bg-violet-600 border-2 border-slate-900 shadow-sm" />

                  {/* 카드 내부 */}
                  <div className="glass-panel rounded-2xl overflow-hidden hover:border-violet-500/30 transition-all duration-300">
                    <div className="p-4 flex gap-4">
                      {/* 썸네일 */}
                      <div className="relative w-28 h-20 bg-slate-950 rounded-lg overflow-hidden shrink-0 shadow-md">
                        <img 
                          src={thumbnailUrl} 
                          alt="Thumbnail" 
                          className="w-full h-full object-cover" 
                          onError={(e) => {
                            // 로드 실패 시 대체 이미지
                            (e.target as HTMLImageElement).src = "https://images.unsplash.com/photo-1542838132-92c53300491e?w=200&auto=format&fit=crop";
                          }}
                        />
                        <div className="absolute bottom-1 right-1 bg-black/60 text-[9px] text-white px-1 py-0.5 rounded">
                          10 Vocab
                        </div>
                      </div>

                      {/* 정보 */}
                      <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5">
                        <div>
                          <h4 className="text-sm font-semibold text-slate-200 leading-snug truncate">
                            {item.video_title}
                          </h4>
                          <div className="flex items-center gap-3 text-[10px] text-slate-500 mt-1">
                            <span className="flex items-center gap-1">
                              <Clock size={10} />
                              {item.added_date}
                            </span>
                            <span className={`px-1.5 py-0.5 rounded-full font-medium ${
                              item.status === "완료" 
                                ? "bg-emerald-950/60 text-emerald-400 border border-emerald-900/50" 
                                : "bg-violet-950/60 text-violet-400 border border-violet-900/50"
                            }`}>
                              {item.status}
                            </span>
                          </div>
                        </div>

                        {/* 진행률 바 */}
                        <div className="mt-2 space-y-1">
                          <div className="flex justify-between text-[9px] text-slate-500">
                            <span>퀴즈 진행률</span>
                            <span className="font-medium text-slate-400">{item.quiz_progress}% (정답률 {item.quiz_correct_rate}%)</span>
                          </div>
                          <div className="w-full bg-slate-950/60 h-1 rounded-full overflow-hidden">
                            <div 
                              className="bg-gradient-to-r from-violet-500 to-fuchsia-500 h-full rounded-full transition-all duration-500" 
                              style={{ width: `${item.quiz_progress}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* 액션 버튼 */}
                    <div className="bg-slate-950/40 px-4 py-2.5 border-t border-slate-800/80 flex justify-between items-center gap-2">
                      <div className="flex gap-2">
                        <button
                          onClick={() => onSelectVideo(item.video_id, "study")}
                          className="bg-violet-600/90 hover:bg-violet-600 text-white rounded-lg text-xs font-semibold px-3 py-1.5 transition flex items-center gap-1 active:scale-95 touch-target"
                        >
                          <Play size={12} fill="currentColor" />
                          <span>학습 시작</span>
                        </button>
                        <button
                          onClick={() => onSelectVideo(item.video_id, "quiz")}
                          className="bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700/50 rounded-lg text-xs font-semibold px-3 py-1.5 transition flex items-center gap-1 active:scale-95 touch-target"
                        >
                          <BookOpen size={12} />
                          <span>퀴즈 풀기</span>
                        </button>
                      </div>

                      <div className="flex gap-1">
                        <a
                          href={`https://www.youtube.com/watch?v=${item.video_id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1.5 bg-slate-850 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-slate-200 transition touch-target flex items-center justify-center"
                          title="유튜브 원본 열기"
                        >
                          <ExternalLink size={14} />
                        </a>
                        <button
                          onClick={() => {
                            if (window.confirm("정말 이 학습 영상을 목록에서 삭제하시겠습니까? 관련 단어 가중치 및 진도 데이터가 모두 제거됩니다.")) {
                              onDeleteVideo(item.video_id);
                            }
                          }}
                          className="p-1.5 hover:bg-red-950/40 rounded-lg text-slate-500 hover:text-red-400 transition touch-target flex items-center justify-center"
                          title="학습 영상 삭제"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
