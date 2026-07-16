import React, { useState } from "react";
import { 
  Play, 
  Trash2, 
  Sparkles, 
  BookOpen, 
  Clock, 
  FileText, 
  AlertCircle, 
  Settings as SettingsIcon,
  Loader2,
  ListRestart,
  Copy,
  Check
} from "lucide-react";
import { generateLearningData, extractYoutubeVideoId, generateWebChatPrompt, parseWebAiJson } from "../utils/gemini";
import type { LearningData } from "../utils/gemini";
import { getYoutubeJapaneseSubtitle } from "../utils/youtubeSubtitle";

interface DashboardProps {
  apiKey: string;
  openaiApiKey?: string;
  items: LearningData[];
  onAddVideo: (newItem: LearningData) => void;
  onDeleteVideo: (videoId: string) => void;
  onSelectVideo: (videoId: string, targetTab: "study" | "quiz") => void;
  onNavigateToSettings: () => void;
}

// HTML 루비 태그를 날리고 순수 단어 텍스트만 뽑아주는 헬퍼
const removeRubyTags = (html: string): string => {
  if (!html) return "";
  return html.replace(/<rt>[^<]*<\/rt>/g, "").replace(/<\/?[^>]+(>|$)/g, "");
};

export default function Dashboard({
  apiKey,
  openaiApiKey = "",
  items,
  onAddVideo,
  onDeleteVideo,
  onSelectVideo,
  onNavigateToSettings,
}: DashboardProps) {
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [rawScriptText, setRawScriptText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isFetchingSubtitle, setIsFetchingSubtitle] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  
  // 등록 모드 상태 ("api": 원클릭 API, "webChat": AI 웹챗 복붙, "local": AI 없음 단순 싱크)
  type RegMode = "api" | "webChat" | "local";
  const [registrationMode, setRegistrationMode] = useState<RegMode>("api");
  const [customVideoTitle, setCustomVideoTitle] = useState("");
  const [pastedJsonText, setPastedJsonText] = useState("");
  const [isCopied, setIsCopied] = useState(false);

  // 로컬 자막 텍스트 파싱 헬퍼 함수
  const parseLocalScriptText = (rawText: string, videoId: string) => {
    const lines = rawText.split("\n");
    const parsedItems: any[] = [];
    
    // [01:23] 혹은 [1:23:45] 형태를 매칭하는 정규식
    const timeRegex = /^\[(\d{1,2}:)?(\d{1,2}):(\d{1,2})\]/;

    let lastSeconds = 0;

    lines.forEach((line, index) => {
      const trimmed = line.trim();
      if (!trimmed) return;

      const match = trimmed.match(timeRegex);
      let timeCode = "";
      let seconds = 0;
      let content = trimmed;

      if (match) {
        timeCode = match[0].slice(1, -1); // 괄호 제거
        content = trimmed.substring(match[0].length).trim();
        
        // 초단위 계산
        const parts = timeCode.split(":").map(Number);
        if (parts.length === 3) {
          seconds = parts[0] * 3600 + parts[1] * 60 + parts[2];
        } else if (parts.length === 2) {
          seconds = parts[0] * 60 + parts[1];
        }
        lastSeconds = seconds;
      } else {
        // 시간 정보가 없을 시 이전 라인에서 5초 누적
        seconds = lastSeconds + (index > 0 ? 5 : 0);
        lastSeconds = seconds;
        
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        timeCode = `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
      }

      // 일본어 / 한국어 파싱 (구분자 '|' 또는 '/')
      let japanese = content;
      let korean = "";
      const splitIndex = content.search(/[|/]/);
      if (splitIndex !== -1) {
        japanese = content.substring(0, splitIndex).trim();
        korean = content.substring(splitIndex + 1).trim();
      }

      parsedItems.push({
        time: seconds,
        time_code: timeCode,
        japanese: japanese || "대사 없음",
        korean: korean
      });
    });

    return parsedItems;
  };

  // 1단계: 유튜브 자막만 별도로 먼저 긁어오기
  const handleFetchSubtitleOnly = async () => {
    setErrorMsg("");
    const videoId = extractYoutubeVideoId(youtubeUrl);
    if (!videoId) {
      setErrorMsg("올바른 유튜브 URL을 입력해 주세요. (예: https://www.youtube.com/watch?v=...)");
      return;
    }

    setIsFetchingSubtitle(true);
    try {
      console.log(`Starting isolated subtitle fetch for video: ${videoId}`);
      const autoSub = await getYoutubeJapaneseSubtitle(videoId);
      
      if (autoSub && autoSub.trim()) {
        setRawScriptText(autoSub);
        console.log("유튜브 자막을 성공적으로 불러와 입력창에 바인딩했습니다.");
      } else {
        throw new Error("가져온 자막 텍스트가 비어 있습니다.");
      }
    } catch (err: any) {
      console.warn("자막 자동 추출 실패:", err);
      window.alert("⚠️ 유튜브 공식 자막 자동 추출에 실패했습니다.\n\n해당 영상의 자막 복사본(또는 준비된 일본어 대사)을 아래 [스크립트 자막 텍스트 직접 입력] 창에 수동으로 복사해 붙여넣어 주세요!");
    } finally {
      setIsFetchingSubtitle(false);
    }
  };

  // 2단계: 최종 AI 학습 콘텐츠 생성 진행
  // AI 웹챗용 프롬프트 복사 핸들러
  const handleCopyPrompt = async () => {
    const videoId = extractYoutubeVideoId(youtubeUrl);
    if (!videoId) {
      setErrorMsg("프롬프트를 생성하려면 올바른 유튜브 URL을 먼저 입력해 주세요.");
      return;
    }
    if (!rawScriptText.trim()) {
      setErrorMsg("자막/스크립트 내용이 비어 있습니다. [자막 불러오기]를 수행하거나 직접 텍스트를 입력한 뒤 복사해 주세요.");
      return;
    }

    try {
      const prompt = generateWebChatPrompt(youtubeUrl, rawScriptText);
      await navigator.clipboard.writeText(prompt);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch (err) {
      console.error("복사 실패:", err);
      alert("클립보드 복사에 실패했습니다.");
    }
  };

  // 2단계: 최종 AI 학습 콘텐츠 생성 진행
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");

    const videoId = extractYoutubeVideoId(youtubeUrl);
    if (!videoId) {
      setErrorMsg("올바른 유튜브 URL을 입력해 주세요.");
      return;
    }

    // 중복 등록 방지
    if (items.some((item) => item.video_id === videoId)) {
      setErrorMsg("이미 등록된 유튜브 영상입니다.");
      return;
    }

    // AI 자동 분석(API Key)인 경우에만 API Key 체크
    if (registrationMode === "api" && !apiKey && !openaiApiKey) {
      setErrorMsg("API Key가 등록되지 않았습니다. 설정 화면에서 Gemini 또는 OpenAI API Key를 먼저 입력해 주세요. (또는 '무료 웹챗 연동'이나 '로컬 단순 등록' 모드를 선택하세요)");
      return;
    }

    // AI 무료 웹챗 연동인 경우 JSON 입력값 필수 체크
    if (registrationMode === "webChat" && !pastedJsonText.trim()) {
      setErrorMsg("무료 AI 웹챗에서 생성된 JSON 결과 데이터를 붙여넣어 주세요.");
      return;
    }

    setIsLoading(true);
    try {
      if (registrationMode === "api") {
        // 1. 원클릭 API 자동 분석 모드
        const result = await generateLearningData(apiKey, youtubeUrl, rawScriptText, openaiApiKey);

        // [기존 DB 중복 어휘 제거 필터링]
        const existingWords = new Set<string>();
        items.forEach((item) => {
          item.vocabulary_list.forEach((v) => {
            existingWords.add(removeRubyTags(v.word).trim());
          });
        });

        const filteredVocabList = result.vocabulary_list.filter((v) => {
          const cleanWord = removeRubyTags(v.word).trim();
          return !existingWords.has(cleanWord);
        });

        const finalResult: LearningData = {
          ...result,
          vocabulary_list: filteredVocabList,
        };

        onAddVideo(finalResult);
      } else if (registrationMode === "webChat") {
        // 2. AI 무료 웹챗 연동 모드
        const result = parseWebAiJson(pastedJsonText, videoId);

        // 중복 제거 필터링 동일 적용
        const existingWords = new Set<string>();
        items.forEach((item) => {
          item.vocabulary_list.forEach((v) => {
            existingWords.add(removeRubyTags(v.word).trim());
          });
        });

        const filteredVocabList = result.vocabulary_list.filter((v) => {
          const cleanWord = removeRubyTags(v.word).trim();
          return !existingWords.has(cleanWord);
        });

        const finalResult: LearningData = {
          ...result,
          video_id: videoId, // URL이 변경되었을 수 있으므로 강제 보장
          vocabulary_list: filteredVocabList,
        };

        onAddVideo(finalResult);
      } else {
        // 3. AI 분석을 거치지 않는 로컬 단순 등록 진행
        const localScriptData = parseLocalScriptText(rawScriptText, videoId);
        
        const today = new Date().toISOString().split("T")[0];
        const finalResult: LearningData = {
          video_id: videoId,
          video_title: customVideoTitle.trim() || `유튜브 영상 (${videoId})`,
          added_date: today,
          script_data: localScriptData,
          vocabulary_list: [],
          quiz_progress: 0,
          quiz_correct_rate: 0,
          status: "학습 중",
        };

        onAddVideo(finalResult);
      }
      
      // 상태 초기화
      setYoutubeUrl("");
      setRawScriptText("");
      setCustomVideoTitle("");
      setPastedJsonText("");
    } catch (error: any) {
      setErrorMsg(error.message || "학습 데이터를 생성하는 중에 실패했습니다. 형식을 다시 확인해 주세요.");
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
          className="p-2.5 bg-slate-700/50 hover:bg-slate-700 rounded-xl transition text-slate-300 touch-target"
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

        <form onSubmit={handleSubmit} className="space-y-4.5">
          {/* 등록 모드 선택 탭 */}
          <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-950/80 rounded-2xl border border-slate-800">
            {(["api", "webChat", "local"] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => {
                  setRegistrationMode(mode);
                  setErrorMsg("");
                }}
                className={`py-2 px-1 rounded-xl text-[10px] sm:text-xs font-bold transition-all ${
                  registrationMode === mode
                    ? "bg-violet-600/35 border border-violet-500/40 text-violet-200 shadow-md"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                {mode === "api" ? "원클릭 AI 분석" : mode === "webChat" ? "무료 웹 AI 연동" : "로컬 단순 싱크"}
              </button>
            ))}
          </div>

          {/* 1단계: URL 입력 및 자막 호출 */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-slate-400">유튜브 URL 등록</label>
            <div className="flex flex-col sm:flex-row gap-2.5">
              <input
                type="text"
                value={youtubeUrl}
                onChange={(e) => setYoutubeUrl(e.target.value)}
                placeholder="https://www.youtube.com/watch?v=..."
                disabled={isLoading || isFetchingSubtitle}
                className="w-full sm:flex-1 bg-slate-950/60 border border-slate-800 focus:border-violet-500/50 outline-none rounded-xl px-4 py-2.5 text-sm text-slate-200 transition"
              />
              <button
                type="button"
                onClick={handleFetchSubtitleOnly}
                disabled={isFetchingSubtitle || isLoading || !youtubeUrl}
                className="bg-slate-800 hover:bg-slate-750 text-slate-200 border border-slate-700/50 rounded-xl px-5 py-2.5 text-xs font-bold transition flex items-center justify-center gap-1.5 w-full sm:w-auto sm:shrink-0 active:scale-95 touch-target shadow-md"
              >
                {isFetchingSubtitle ? (
                  <Loader2 size={14} className="animate-spin text-violet-400" />
                ) : (
                  <ListRestart size={14} />
                )}
                <span>자막 불러오기</span>
              </button>
            </div>
          </div>

          {/* 동영상 제목 입력 필드 (로컬 단순 등록 시 또는 임의 지정용) */}
          {registrationMode !== "api" && (
            <div className="flex flex-col gap-1.5 animate-fade-in">
              <label className="text-xs font-semibold text-slate-400">동영상 제목 입력 {registrationMode === "webChat" && "(선택)"}</label>
              <input
                type="text"
                value={customVideoTitle}
                onChange={(e) => setCustomVideoTitle(e.target.value)}
                placeholder="학습방에 표시될 영상의 제목을 입력하세요..."
                className="w-full bg-slate-950/60 border border-slate-800 focus:border-violet-500/50 outline-none rounded-xl px-4 py-2.5 text-sm text-slate-200 transition"
              />
            </div>
          )}

          {/* 2단계: 스크립트 붙여넣기 패널 */}
          <div className="border-t border-slate-800/80 pt-4 space-y-3">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-300">
              <FileText size={14} className="text-violet-400" />
              <span>
                {registrationMode === "webChat" ? "원천 대사 스크립트 내용 (프롬프트 구성용)" : "스크립트 자막 텍스트 직접 입력 및 편집"}
              </span>
            </div>

            <div className="bg-amber-950/20 border border-amber-900/40 text-amber-300/90 p-3 rounded-2xl text-[10px] leading-relaxed flex gap-2">
              <AlertCircle size={18} className="shrink-0 mt-0.5 text-amber-400" />
              <div>
                <span className="font-bold block text-amber-300">
                  {registrationMode === "api" ? "원클릭 AI 분석 모드" : registrationMode === "webChat" ? "무료 웹 AI 연동 모드" : "로컬 단순 싱크 모드"}
                </span>
                {registrationMode === "api" && (
                  "[자막 불러오기]를 누르거나 대사를 입력창에 붙여넣고 아래 생성 버튼을 누르면 AI가 즉시 후리가나 변환과 단어장을 만들어 등록합니다."
                )}
                {registrationMode === "webChat" && (
                  "자막을 불러오거나 붙여넣은 뒤, 아래 [AI 프롬프트 복사]를 눌러 ChatGPT/클로드 웹 사이트에 복사-붙여넣기하여 응답 JSON을 생성해 오세요."
                )}
                {registrationMode === "local" && (
                  "AI 호출 없이 타임라인 싱크만 맞춥니다. 입력창에 [분:초] 대사 형태로 적으시면 영상과 싱크가 맞춰집니다. 예: [01:23] こんにちは | 안녕하세요"
                )}
              </div>
            </div>

            <div className="space-y-1.5">
              <textarea
                value={rawScriptText}
                onChange={(e) => setRawScriptText(e.target.value)}
                placeholder={registrationMode === "local"
                  ? "형식: [01:23] 일본어대사 | 한국어대사 (시간 정보가 없으면 순차적으로 5초 간격 싱크가 적용됩니다)"
                  : "자막 불러오기를 실행하거나 일본어 대사/자막 복사본을 여기에 수동으로 붙여넣어 주세요..."}
                disabled={isLoading}
                rows={3}
                className="w-full bg-slate-950/60 border border-slate-800 focus:border-violet-500/50 outline-none rounded-2xl p-3.5 text-xs text-slate-355 transition resize-none font-mono leading-relaxed"
              />
            </div>
          </div>

          {/* webChat 전용 프롬프트 복사 및 결과 JSON 입력 패널 */}
          {registrationMode === "webChat" && (
            <div className="border-t border-slate-800/80 pt-4 space-y-4 animate-fade-in">
              <div className="flex flex-col gap-2">
                <span className="text-xs font-semibold text-slate-400">1) 아래 버튼을 클릭해 생성된 프롬프트를 복사하여 무료 ChatGPT/Claude 등에 보냅니다.</span>
                <button
                  type="button"
                  onClick={handleCopyPrompt}
                  disabled={!youtubeUrl || !rawScriptText.trim()}
                  className="bg-slate-800 hover:bg-slate-750 text-slate-200 border border-slate-700/50 rounded-xl py-2.5 text-xs font-bold transition flex items-center justify-center gap-1.5 w-full active:scale-95 disabled:opacity-50 touch-target shadow-md"
                >
                  {isCopied ? (
                    <>
                      <Check size={14} className="text-emerald-400" />
                      <span className="text-emerald-400">프롬프트 클립보드 복사 완료!</span>
                    </>
                  ) : (
                    <>
                      <Copy size={14} className="text-violet-400" />
                      <span>📋 AI 프롬프트 클립보드 복사하기</span>
                    </>
                  )}
                </button>
              </div>

              <div className="flex flex-col gap-2">
                <span className="text-xs font-semibold text-slate-400">2) AI가 출력해 준 JSON 코드 전체를 복사해서 아래 붙여넣어 주세요.</span>
                <textarea
                  value={pastedJsonText}
                  onChange={(e) => setPastedJsonText(e.target.value)}
                  placeholder='AI가 출력한 {"video_title": ..., "script_data": ..., "vocabulary_list": ...} 형식의 JSON 코드를 복사해서 그대로 붙여넣으세요.'
                  disabled={isLoading}
                  rows={4}
                  className="w-full bg-slate-950/60 border border-slate-800 focus:border-violet-500/50 outline-none rounded-2xl p-3.5 text-xs text-slate-355 transition resize-none font-mono leading-relaxed"
                />
              </div>
            </div>
          )}

          {/* 최종 생성 제출 버튼 */}
          <button
            type="submit"
            disabled={isLoading || isFetchingSubtitle || !youtubeUrl || (registrationMode === "webChat" ? !pastedJsonText.trim() : !rawScriptText.trim())}
            className="w-full bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:opacity-95 active:scale-95 disabled:opacity-50 disabled:active:scale-100 text-white rounded-xl py-3 text-sm font-bold transition flex items-center justify-center gap-2 touch-target shadow-lg shadow-violet-900/20"
          >
            {isLoading ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Sparkles size={16} />
            )}
            <span>
              {registrationMode === "api" 
                ? "✨ AI 일본어 학습방 생성 시작" 
                : registrationMode === "webChat" 
                ? "📋 AI 웹 결과로 학습방 생성 완료" 
                : "🎬 로컬 자막 싱크 학습방 생성 시작"}
            </span>
          </button>
        </form>
      </div>

      {/* 에러 메시지 */}
      {errorMsg && (
        <div className="flex items-start gap-2 bg-red-950/30 border border-red-900/40 text-red-300 p-3.5 rounded-2xl text-xs">
          <AlertCircle size={16} className="shrink-0 mt-0.5" />
          <span>{errorMsg}</span>
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
          <div className="space-y-4">
            {sortedItems.map((item) => (
              <div 
                key={item.video_id}
                className="glass-panel p-4.5 rounded-3xl border border-slate-800 flex flex-col gap-3.5 relative overflow-hidden transition hover:border-slate-700/80 shadow-md"
              >
                {/* 썸네일 및 제목 정보 */}
                <div className="flex gap-3">
                  <div className="relative w-24 aspect-video rounded-xl overflow-hidden bg-slate-950 border border-slate-850 shrink-0">
                    <img 
                      src={`https://img.youtube.com/vi/${item.video_id}/0.jpg`} 
                      alt={item.video_title}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-slate-950/20" />
                  </div>

                  <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5">
                    <h2 className="text-sm font-bold text-white line-clamp-2 leading-snug">
                      {item.video_title}
                    </h2>
                    <div className="flex items-center gap-2.5 text-[10px] text-slate-500 font-semibold font-mono mt-1">
                      <span className="flex items-center gap-0.5">
                        <Clock size={10} />
                        {item.added_date}
                      </span>
                      <span className="bg-slate-900 px-2 py-0.5 rounded text-[9px] text-violet-400 border border-slate-850">
                        {item.vocabulary_list.length}단어
                      </span>
                    </div>
                  </div>
                </div>

                {/* 학습 통계 프로그레스바 */}
                <div className="space-y-1.5 border-t border-slate-850 pt-3">
                  <div className="flex justify-between text-[9px] font-semibold text-slate-500 font-mono">
                    <span>퀴즈 진행률: {item.quiz_progress}%</span>
                    <span>평균 정답률: {item.quiz_correct_rate}%</span>
                  </div>
                  <div className="w-full bg-slate-950/60 h-1.5 rounded-full overflow-hidden border border-slate-900/50">
                    <div 
                      className="bg-gradient-to-r from-violet-500 to-fuchsia-500 h-full rounded-full transition-all duration-300"
                      style={{ width: `${item.quiz_progress}%` }}
                    />
                  </div>
                </div>

                {/* 액션 버튼 그룹 */}
                <div className="flex justify-between items-center gap-2 mt-1 shrink-0">
                  <button
                    onClick={() => onDeleteVideo(item.video_id)}
                    className="p-2.5 bg-slate-900 hover:bg-red-950/40 text-slate-500 hover:text-red-400 rounded-xl border border-slate-850 hover:border-red-900/30 transition active:scale-95 touch-target"
                    title="학습 삭제"
                  >
                    <Trash2 size={16} />
                  </button>

                  <div className="flex-1 flex gap-2">
                    <button
                      onClick={() => onSelectVideo(item.video_id, "study")}
                      className="flex-1 bg-slate-800/80 hover:bg-slate-700 text-slate-200 border border-slate-700/50 py-2.5 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1 active:scale-95 touch-target"
                    >
                      <Play size={12} fill="currentColor" />
                      <span>학습 시작</span>
                    </button>
                    <button
                      onClick={() => onSelectVideo(item.video_id, "quiz")}
                      disabled={item.vocabulary_list.length === 0}
                      className="flex-1 bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:opacity-95 disabled:opacity-50 text-white py-2.5 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1 active:scale-95 touch-target shadow-md shadow-violet-900/10"
                    >
                      <Sparkles size={12} />
                      <span>퀴즈 풀기</span>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
