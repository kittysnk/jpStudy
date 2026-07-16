import { useState, useEffect } from "react";
import { 
  ArrowLeft, 
  HelpCircle, 
  CheckCircle2, 
  XCircle, 
  RotateCcw, 
  Sparkles,
  Trophy,
  Info,
  Volume2
} from "lucide-react";
import type { LearningData, VocabularyItem } from "../utils/gemini";
import { updateWordWeight, weightedShuffle } from "../utils/weight";

// HTML 루비 태그를 제거하고 순수 일본어 텍스트만 추출하는 헬퍼 함수
const removeRubyTags = (html: string): string => {
  if (!html) return "";
  return html.replace(/<rt>[^<]*<\/rt>/g, "").replace(/<\/?[^>]+(>|$)/g, "");
};

interface VocabularyProps {
  data: LearningData;
  onBack: () => void;
  onUpdateQuizProgress: (
    videoId: string, 
    vocabularyList: VocabularyItem[], 
    progress: number, 
    correctRate: number
  ) => void;
}

type Mode = "list" | "quiz" | "result";

export default function Vocabulary({ data, onBack, onUpdateQuizProgress }: VocabularyProps) {
  const [mode, setMode] = useState<Mode>("list");
  const [quizList, setQuizList] = useState<VocabularyItem[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  
  // 퀴즈 결과 트래킹
  const [correctCount, setCorrectCount] = useState(0);
  const [incorrectCount, setIncorrectCount] = useState(0);
  const [passCount, setPassCount] = useState(0);
  
  // 현재 퀴즈 세션의 단어 리스트 상태 (가중치가 업데이트된 단어 리스트)
  const [vocabList, setVocabList] = useState<VocabularyItem[]>(data.vocabulary_list);

  useEffect(() => {
    setVocabList(data.vocabulary_list);
  }, [data.vocabulary_list]);

  // 퀴즈 시작 (가중치 비례 확률 셔플 적용 후 상위 10개만 무작위 출제)
  const handleStartQuiz = () => {
    const shuffled = weightedShuffle(vocabList);
    // 전체 단어 중 가중치 우선순위가 높게 적용된 10개만 슬라이스하여 출제
    setQuizList(shuffled.slice(0, 10));
    setCurrentIdx(0);
    setIsFlipped(false);
    setCorrectCount(0);
    setIncorrectCount(0);
    setPassCount(0);
    setMode("quiz");
  };

  // 단어 퀴즈 응답 처리
  const handleAnswer = (result: "correct" | "incorrect" | "pass") => {
    const currentWord = quizList[currentIdx];
    
    // 가중치 계산 및 업데이트
    const newWeight = updateWordWeight(currentWord.weight, result);
    
    // 전체 단어 상태 업데이트
    const updatedVocabList = vocabList.map((vocab) => 
      vocab.id === currentWord.id ? { ...vocab, weight: newWeight } : vocab
    );
    setVocabList(updatedVocabList);

    // 결과 누적
    if (result === "correct") {
      setCorrectCount((prev) => prev + 1);
    } else if (result === "incorrect") {
      setIncorrectCount((prev) => prev + 1);
    } else {
      setPassCount((prev) => prev + 1);
    }

    // 다음 카드로 이동
    if (currentIdx + 1 < quizList.length) {
      setIsFlipped(false);
      // 카드 뒤집기 애니메이션을 고려하여 시간 지연 후 인덱스 증가
      setTimeout(() => {
        setCurrentIdx((prev) => prev + 1);
      }, 200);
    } else {
      // 퀴즈 종료 및 최종 리포트 계산
      setMode("result");
      
      const totalQuestions = quizList.length;
      const finalCorrectCount = result === "correct" ? correctCount + 1 : correctCount;
      
      const progress = 100; // 완료 시 진행률 100%
      const correctRate = Math.round((finalCorrectCount / totalQuestions) * 100);
      
      // 상위 App 컴포넌트로 진행 상태 업데이트 호출
      onUpdateQuizProgress(data.video_id, updatedVocabList, progress, correctRate);
    }
  };

  return (
    <div className="space-y-6 min-h-[calc(100vh-1rem)] flex flex-col justify-between pb-6">
      
      {/* 상단 네비게이션 헤더 */}
      <div className="flex justify-between items-center bg-slate-800/40 p-4 rounded-2xl border border-slate-700/50 backdrop-blur-md shrink-0">
        <button 
          onClick={onBack}
          className="flex items-center gap-1.5 text-xs font-semibold text-slate-300 hover:text-slate-100 transition touch-target"
        >
          <ArrowLeft size={16} />
          <span>대시보드</span>
        </button>
        <span className="text-xs font-bold text-slate-300 truncate max-w-[200px]">
          {data.video_title}
        </span>
      </div>

      {/* 메인 콘텐츠 영역 */}
      <div className="flex-1 flex flex-col justify-center my-2">
        {mode === "list" && (
          <div className="space-y-5 animate-fade-in w-full">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-sm font-semibold text-slate-200">단어 리스트 학습</h3>
                <p className="text-[10px] text-slate-500">본 영상에서 추출된 핵심 어휘 10개입니다.</p>
              </div>
              <button
                onClick={handleStartQuiz}
                className="bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:opacity-95 active:scale-95 text-white text-xs font-bold px-4 py-2.5 rounded-xl transition shadow-lg shadow-violet-900/20 flex items-center gap-1.5 touch-target"
              >
                <Sparkles size={14} />
                <span>스마트 퀴즈 시작</span>
              </button>
            </div>

            {/* 단어장 리스트 */}
            <div className="space-y-3.5 max-h-[60vh] overflow-y-auto pr-1">
              {vocabList.map((item) => (
                <div 
                  key={item.id} 
                  className="glass-panel p-4 rounded-2xl border border-slate-800 flex flex-col gap-2 relative overflow-hidden"
                >
                  {/* JLPT 뱃지 및 가중치 표시 */}
                  <div className="flex justify-between items-center text-[10px]">
                    <span className="bg-slate-900 px-2 py-0.5 rounded-md font-semibold text-violet-400 border border-slate-800">
                      JLPT {item.jlpt_level || "N3"}
                    </span>
                    <span className="text-slate-500 font-mono">
                      오답 가중치: <span className="font-semibold text-slate-400">{item.weight.toFixed(1)}</span>
                    </span>
                  </div>

                  {/* 단어 및 의미 */}
                  <div className="mt-1">
                    <h4 
                      className="japanese-text text-2xl text-white font-bold leading-normal"
                      dangerouslySetInnerHTML={{ __html: item.word }}
                    />
                    <p className="text-base text-slate-200 font-medium mt-1">뜻: {item.meaning}</p>
                  </div>

                  {/* 예문 (드롭다운이나 간이 노출) */}
                  <div className="border-t border-slate-800/60 pt-2 mt-1 space-y-1">
                    <p className="text-sm text-slate-400 flex items-center gap-1">
                      <Info size={14} />
                      <span>예문</span>
                    </p>
                    <p 
                      className="japanese-text text-[18px] text-slate-300 leading-relaxed"
                      dangerouslySetInnerHTML={{ __html: item.example_sentence }}
                    />
                    <p className="text-sm text-slate-400">
                      해석: {item.example_meaning}
                    </p>
                  </div>

                  {/* 유사어 및 반대어 */}
                  <div className="grid grid-cols-2 gap-4 border-t border-slate-800/60 pt-2.5 mt-1">
                    <div>
                      <span className="text-slate-400 text-xs font-semibold block">유사 표현</span>
                      <span 
                        className="japanese-text text-white font-bold text-[18px] block mt-0.5"
                        dangerouslySetInnerHTML={{ __html: item.synonym || "없음" }}
                      />
                    </div>
                    <div>
                      <span className="text-slate-400 text-xs font-semibold block">반대 표현</span>
                      <span 
                        className="japanese-text text-white font-bold text-[18px] block mt-0.5"
                        dangerouslySetInnerHTML={{ __html: item.antonym || "없음" }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {mode === "quiz" && quizList.length > 0 && (
          <div className="flex flex-col items-center justify-center space-y-6 w-full animate-fade-in">
            {/* 진행률 인디케이터 */}
            <div className="w-full max-w-sm space-y-1.5 px-2">
              <div className="flex justify-between text-[10px] text-slate-500 font-semibold font-mono">
                <span>QUIZ PROGRESS</span>
                <span>{currentIdx + 1} / {quizList.length}</span>
              </div>
              <div className="w-full bg-slate-950/60 h-1.5 rounded-full overflow-hidden border border-slate-900/50">
                <div 
                  className="bg-gradient-to-r from-violet-500 to-fuchsia-500 h-full rounded-full transition-all duration-300"
                  style={{ width: `${((currentIdx + 1) / quizList.length) * 100}%` }}
                />
              </div>
            </div>

            {/* 3D 플래시 카드 컨테이너 */}
            <div 
              onClick={() => setIsFlipped(!isFlipped)}
              className="w-full max-w-sm aspect-[4/5] perspective-1000 cursor-pointer"
            >
              <div className={`
                w-full h-full preserve-3d transition-transform duration-500 relative rounded-3xl shadow-2xl
                ${isFlipped ? "rotate-y-180" : ""}
              `}>
                
                {/* 1) 카드 앞면 (단어와 레벨 노출) */}
                <div className="absolute inset-0 bg-gradient-to-br from-slate-800 to-slate-900 border-2 border-slate-700/50 rounded-3xl backface-hidden p-6 flex flex-col justify-between items-center shadow-lg text-center">
                  <span className="self-start bg-slate-950/80 text-violet-400 text-[10px] font-bold px-3 py-1 rounded-xl border border-slate-800">
                    JLPT {quizList[currentIdx].jlpt_level || "N3"}
                  </span>

                  <div className="space-y-4">
                    <h3 
                      className="japanese-text text-4xl text-white font-bold leading-normal select-none"
                      dangerouslySetInnerHTML={{ __html: quizList[currentIdx].word }}
                    />
                    <p className="text-slate-400 text-sm animate-pulse">카드를 터치하면 뒤집힙니다</p>
                  </div>

                  <span className="text-[10px] text-slate-600 font-mono font-medium">
                    가중치 순번 우선순위 출제 중
                  </span>
                </div>

                {/* 2) 카드 뒷면 (뜻, 예문 및 상세정보 노출) */}
                <div className="absolute inset-0 bg-gradient-to-br from-slate-900 to-slate-950 border-2 border-violet-900/50 rounded-3xl backface-hidden rotate-y-180 p-6 flex flex-col justify-between shadow-xl">
                  
                  {/* 헤더 */}
                  <div className="flex justify-between items-center text-[10px] border-b border-slate-850 pb-2.5">
                    <span className="text-violet-400 font-bold bg-violet-950/30 px-2 py-0.5 rounded border border-violet-900/40">
                      뜻 해설
                    </span>
                    <span className="text-slate-500 font-mono">
                      가중치: {quizList[currentIdx].weight.toFixed(1)}
                    </span>
                  </div>

                  {/* 뜻 요약 */}
                  <div className="text-center py-2.5">
                    <p className="text-xs text-slate-500 font-medium">단어 의미</p>
                    <h4 className="text-3xl font-bold text-white mt-1">
                      {quizList[currentIdx].meaning}
                    </h4>
                  </div>

                  {/* 예시 문장 영역 및 영상 대사 연동 */}
                  {(() => {
                    const currentWord = quizList[currentIdx];
                    const cleanWord = removeRubyTags(currentWord.word);
                    // 스크립트 중 순수 텍스트에 이 단어가 포함되는 행을 찾음
                    const matchedScriptLine = data.script_data.find(s => 
                      removeRubyTags(s.japanese).includes(cleanWord)
                    );

                    return (
                      <div className="bg-slate-900/60 p-4.5 rounded-2xl border border-slate-850 space-y-3.5 flex-1 flex flex-col justify-center overflow-y-auto max-h-[220px]">
                        {/* 1) AI 추출 예문 */}
                        <div className="space-y-1">
                          <p className="text-[10px] text-slate-400 font-bold tracking-wider uppercase">학습 예시 문장</p>
                          <p 
                            className="japanese-text text-slate-200 text-[20px] leading-relaxed"
                            dangerouslySetInnerHTML={{ __html: currentWord.example_sentence }}
                          />
                          <p className="text-xs text-slate-400 leading-normal">
                            뜻: {currentWord.example_meaning}
                          </p>
                        </div>

                        {/* 2) 영상 속 실제 대사 (존재할 경우에만 동적 노출) */}
                        {matchedScriptLine && (
                          <div className="border-t border-slate-800/80 pt-3 space-y-1">
                            <p className="text-[10px] text-violet-400 font-bold tracking-wider uppercase flex items-center gap-1">
                              <Volume2 size={10} />
                              <span>영상 속 실제 대사 [{matchedScriptLine.time_code}]</span>
                            </p>
                            <p 
                              className="japanese-text text-slate-100 text-[20px] leading-relaxed"
                              dangerouslySetInnerHTML={{ __html: matchedScriptLine.japanese }}
                            />
                            <p className="text-xs text-slate-400 leading-normal">
                              번역: {matchedScriptLine.korean}
                            </p>
                          </div>
                        )}
                      </div>
                    );
                  })()}

                  {/* 유사어 및 반대어 */}
                  <div className="grid grid-cols-2 gap-4.5 pt-3.5 border-t border-slate-800/80">
                    <div>
                      <span className="text-slate-400 text-xs font-semibold block">유사 표현</span>
                      <span 
                        className="japanese-text text-white font-bold text-[20px] block mt-1 break-words"
                        dangerouslySetInnerHTML={{ __html: quizList[currentIdx].synonym || "없음" }}
                      />
                    </div>
                    <div>
                      <span className="text-slate-400 text-xs font-semibold block">반대 표현</span>
                      <span 
                        className="japanese-text text-white font-bold text-[20px] block mt-1 break-words"
                        dangerouslySetInnerHTML={{ __html: quizList[currentIdx].antonym || "없음" }}
                      />
                    </div>
                  </div>
                </div>

              </div>
            </div>

            {/* 카드 액션 제어 버튼 (카드 뒤집혔을 때 렌더링) */}
            <div className={`w-full max-w-sm flex gap-3 transition-opacity duration-300 ${
              isFlipped ? "opacity-100 pointer-events-auto" : "opacity-35 pointer-events-none"
            }`}>
              {/* 1) 오답 버튼 */}
              <button
                onClick={() => handleAnswer("incorrect")}
                className="flex-1 bg-red-950/40 hover:bg-red-950/60 active:scale-95 text-red-400 border border-red-900/50 rounded-2xl py-3 px-2 text-xs font-bold transition flex flex-col items-center gap-1 touch-target shadow-lg shadow-red-950/10"
              >
                <XCircle size={18} />
                <span>틀림 (+1.0)</span>
              </button>

              {/* 2) 모름/패스 버튼 */}
              <button
                onClick={() => handleAnswer("pass")}
                className="flex-1 bg-amber-950/40 hover:bg-amber-950/60 active:scale-95 text-amber-400 border border-amber-900/50 rounded-2xl py-3 px-2 text-xs font-bold transition flex flex-col items-center gap-1 touch-target shadow-lg shadow-amber-950/10"
              >
                <HelpCircle size={18} />
                <span>모름 (+1.5)</span>
              </button>

              {/* 3) 정답 버튼 */}
              <button
                onClick={() => handleAnswer("correct")}
                className="flex-1 bg-emerald-950/40 hover:bg-emerald-950/60 active:scale-95 text-emerald-400 border border-emerald-900/50 rounded-2xl py-3 px-2 text-xs font-bold transition flex flex-col items-center gap-1 touch-target shadow-lg shadow-emerald-950/10"
              >
                <CheckCircle2 size={18} />
                <span>맞춤 (-0.5)</span>
              </button>
            </div>
          </div>
        )}

        {mode === "result" && (
          <div className="glass-panel p-6 rounded-3xl text-center max-w-sm mx-auto w-full space-y-6 shadow-2xl border border-slate-800 animate-fade-in">
            <div className="relative">
              {/* 트로피 후광 */}
              <div className="absolute inset-0 bg-violet-600/20 blur-2xl rounded-full w-24 h-24 mx-auto" />
              <div className="bg-slate-900 p-4 rounded-full w-20 h-20 mx-auto flex items-center justify-center border border-slate-800 shadow-inner relative">
                <Trophy size={42} className="text-amber-400" />
              </div>
            </div>

            <div className="space-y-1.5">
              <h3 className="text-lg font-bold text-white">퀴즈 종료!</h3>
              <p className="text-xs text-slate-400">단어 가중치가 실시간 보정되어 학습 리스트에 반영되었습니다.</p>
            </div>

            {/* 정답 리포트 */}
            <div className="bg-slate-950/60 p-4 rounded-2xl border border-slate-850 divide-y divide-slate-800/80 text-xs">
              <div className="flex justify-between py-2.5">
                <span className="text-slate-500">전체 질문 수</span>
                <span className="text-slate-200 font-semibold">{quizList.length}개</span>
              </div>
              <div className="flex justify-between py-2.5">
                <span className="text-slate-500">정답을 맞춘 단어</span>
                <span className="text-emerald-400 font-semibold flex items-center gap-1">
                  <CheckCircle2 size={12} /> {correctCount}개
                </span>
              </div>
              <div className="flex justify-between py-2.5">
                <span className="text-slate-500">틀린 단어</span>
                <span className="text-red-400 font-semibold flex items-center gap-1">
                  <XCircle size={12} /> {incorrectCount}개
                </span>
              </div>
              <div className="flex justify-between py-2.5">
                <span className="text-slate-500">패스한 단어</span>
                <span className="text-amber-400 font-semibold flex items-center gap-1">
                  <HelpCircle size={12} /> {passCount}개
                </span>
              </div>
              <div className="flex justify-between py-2.5">
                <span className="text-slate-500">최종 퀴즈 정답률</span>
                <span className="text-violet-400 font-bold text-sm">
                  {Math.round((correctCount / quizList.length) * 100)}%
                </span>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setMode("list")}
                className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700/50 rounded-xl py-3 text-xs font-bold transition flex items-center justify-center gap-1.5 active:scale-95 touch-target"
              >
                <ArrowLeft size={14} />
                <span>단어 리스트</span>
              </button>
              <button
                onClick={handleStartQuiz}
                className="flex-1 bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:opacity-95 text-white rounded-xl py-3 text-xs font-bold transition flex items-center justify-center gap-1.5 active:scale-95 touch-target shadow-lg shadow-violet-900/20"
              >
                <RotateCcw size={14} />
                <span>퀴즈 다시 풀기</span>
              </button>
            </div>
          </div>
        )}
      </div>

    </div>
  );
}
