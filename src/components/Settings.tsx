import React, { useState } from "react";
import { 
  ArrowLeft, 
  Key, 
  ShieldCheck, 
  Download, 
  Upload, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle,
  Settings as SettingsIcon,
  HelpCircle,
  Lock
} from "lucide-react";
import { testGeminiApiKey } from "../utils/gemini";
import type { LearningData } from "../utils/gemini";

interface SettingsProps {
  apiKey: string;
  items: LearningData[];
  onSaveApiKey: (key: string) => void;
  onImportData: (importedKey: string, importedItems: LearningData[]) => void;
  onBack: () => void;
}

export default function Settings({
  apiKey,
  items,
  onSaveApiKey,
  onImportData,
  onBack,
}: SettingsProps) {
  const [inputKey, setInputKey] = useState(apiKey);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<"none" | "success" | "fail">("none");

  // API Key 저장 및 테스트
  const handleSaveKey = () => {
    onSaveApiKey(inputKey.trim());
    setTestResult("none");
  };

  const handleTestKey = async () => {
    if (!inputKey.trim()) return;
    
    setIsTesting(true);
    setTestResult("none");
    try {
      const isValid = await testGeminiApiKey(inputKey.trim());
      setTestResult(isValid ? "success" : "fail");
      if (isValid) {
        onSaveApiKey(inputKey.trim());
      }
    } catch (e) {
      setTestResult("fail");
    } finally {
      setIsTesting(false);
    }
  };

  // 데이터 백업 (Export JSON)
  const handleExportData = () => {
    const backupObj = {
      apiKey: apiKey,
      items: items,
      version: "1.2",
      exportedAt: new Date().toISOString()
    };

    const jsonString = JSON.stringify(backupObj, null, 2);
    const blob = new Blob([jsonString], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement("a");
    a.href = url;
    a.download = `my_jptube_runner_backup_${new Date().toISOString().split("T")[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // 데이터 복원 (Import JSON)
  const handleImportData = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        
        // 간단한 무결성 검증
        if (parsed && Array.isArray(parsed.items)) {
          if (window.confirm("가져온 백업 파일로 현재 데이터를 덮어쓰시겠습니까? 기존 학습 상태와 단어장 정보는 유실됩니다.")) {
            onImportData(parsed.apiKey || "", parsed.items);
            setInputKey(parsed.apiKey || "");
            alert("학습 데이터가 정상적으로 복원되었습니다!");
          }
        } else {
          alert("올바른 My JpTube Runner 백업 JSON 파일이 아닙니다.");
        }
      } catch (err) {
        alert("파일을 읽는 중 에러가 발생했습니다. 파일 형식을 확인해 주세요.");
      }
    };
    reader.readAsText(file);
    // 동일 파일 재선택 가능하게 초기화
    e.target.value = "";
  };

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex justify-between items-center bg-slate-800/40 p-4 rounded-2xl border border-slate-700/50 backdrop-blur-md">
        <button 
          onClick={onBack}
          className="flex items-center gap-1.5 text-xs font-semibold text-slate-300 hover:text-slate-100 transition touch-target"
        >
          <ArrowLeft size={16} />
          <span>대시보드</span>
        </button>
        <span className="text-xs font-bold text-slate-300 flex items-center gap-1">
          <SettingsIcon size={14} />
          <span>환경 설정 및 백업</span>
        </span>
      </div>

      {/* 1. API Key 관리 섹션 */}
      <div className="glass-panel p-5 rounded-3xl space-y-4 shadow-xl">
        <div className="flex items-center gap-2 text-violet-400 font-semibold text-sm">
          <Key size={16} />
          <span>Google Gemini API Key 관리</span>
        </div>

        <div className="space-y-3">
          <p className="text-[11px] text-slate-400 leading-relaxed">
            일본어 자막 파싱 및 핵심 단어 추출을 위해 Google AI Studio에서 발급받은 개인 API Key가 필요합니다. 
            입력된 API Key는 오직 본 브라우저(LocalStorage)에만 안전하게 보관됩니다.
          </p>

          <div className="flex flex-col gap-1.5">
            <input
              type="password"
              value={inputKey}
              onChange={(e) => setInputKey(e.target.value)}
              placeholder="AIzaSy..."
              className="bg-slate-950/60 border border-slate-800 focus:border-violet-500/50 outline-none rounded-xl px-4 py-2.5 text-sm text-slate-200 transition font-mono tracking-widest"
            />
          </div>

          {/* 연결 테스트 결과 */}
          {testResult === "success" && (
            <div className="flex items-center gap-1.5 bg-emerald-950/30 border border-emerald-900/40 text-emerald-400 p-3 rounded-xl text-xs font-semibold">
              <CheckCircle2 size={14} />
              <span>연결 성공! 정상적으로 API 호출이 가능합니다.</span>
            </div>
          )}
          {testResult === "fail" && (
            <div className="flex items-start gap-1.5 bg-red-950/30 border border-red-900/40 text-red-300 p-3 rounded-xl text-xs">
              <XCircle size={14} className="shrink-0 mt-0.5" />
              <span>연결 실패! API Key 문자열이 올바른지, 사용한 모델의 사용 한도(Quota)가 초과되지 않았는지 확인해 주세요.</span>
            </div>
          )}

          {/* 액션 버튼 */}
          <div className="flex gap-2">
            <button
              onClick={handleSaveKey}
              disabled={!inputKey.trim()}
              className="flex-1 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-200 border border-slate-700/50 rounded-xl py-2.5 text-xs font-bold transition active:scale-95 touch-target"
            >
              키 저장
            </button>
            <button
              onClick={handleTestKey}
              disabled={isTesting || !inputKey.trim()}
              className="flex-1 bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:opacity-95 text-white rounded-xl py-2.5 text-xs font-bold transition flex items-center justify-center gap-1.5 active:scale-95 disabled:opacity-50 disabled:active:scale-100 touch-target shadow-lg shadow-violet-900/20"
            >
              {isTesting ? (
                <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <ShieldCheck size={14} />
              )}
              <span>연결 테스트</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. 데이터 백업 및 마이그레이션 섹션 */}
      <div className="glass-panel p-5 rounded-3xl space-y-4 shadow-xl">
        <div className="flex items-center gap-2 text-violet-400 font-semibold text-sm">
          <Download size={16} />
          <span>데이터 백업 및 마이그레이션</span>
        </div>

        <div className="space-y-4">
          <p className="text-[11px] text-slate-400 leading-relaxed">
            브라우저 캐시 삭제나 웹 스토리지 용량 초과 등으로 인한 학습 데이터 손실을 방지하기 위해 정기적인 백업을 권장합니다.
          </p>

          <div className="bg-amber-950/20 border border-amber-900/40 text-amber-300/90 p-3 rounded-xl text-[10px] leading-relaxed flex gap-2">
            <AlertTriangle size={18} className="shrink-0 mt-0.5 text-amber-400" />
            <div>
              <span className="font-semibold block">주의사항</span>
              가져오기(Import)를 수행하면 현재 브라우저에 등록된 모든 일본어 학습 자료, 퀴즈 정답률, 각 단어의 오답 가중치가 파일 내 내용으로 덮어써집니다.
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {/* 데이터 내보내기 */}
            <button
              onClick={handleExportData}
              disabled={items.length === 0 && !apiKey}
              className="bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-300 border border-slate-700/50 rounded-xl py-3 text-xs font-bold transition flex flex-col items-center justify-center gap-1.5 active:scale-95 touch-target"
            >
              <Download size={16} className="text-violet-400" />
              <span>백업 파일 내보내기</span>
            </button>

            {/* 데이터 가져오기 */}
            <label className="bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700/50 rounded-xl py-3 text-xs font-bold transition flex flex-col items-center justify-center gap-1.5 active:scale-95 touch-target cursor-pointer text-center">
              <Upload size={16} className="text-fuchsia-400" />
              <span>백업 파일 가져오기</span>
              <input
                type="file"
                accept=".json"
                onChange={handleImportData}
                className="hidden"
              />
            </label>
          </div>
        </div>
      </div>
      {/* 3. 공부방 보안 잠금 설정 섹션 */}
      <div className="glass-panel p-5 rounded-3xl space-y-4 shadow-xl">
        <div className="flex items-center gap-2 text-violet-400 font-semibold text-sm">
          <Lock size={16} />
          <span>공부방 보안 잠금 설정 (PIN)</span>
        </div>

        <div className="space-y-3">
          <p className="text-[11px] text-slate-400 leading-relaxed">
            웹 주소(Vercel 등)를 통해 비인가 사용자가 공부방에 무단 접속하는 것을 방지합니다. 
            현재 브라우저에 저장된 4자리 보안 PIN 번호를 완전히 해제하거나 비활성화합니다.
          </p>

          <button
            onClick={() => {
              if (window.confirm("공부방 보안 PIN 비밀번호를 완전히 초기화(제거)하시겠습니까? 다음 접속부터는 PIN 입력이 요구되지 않습니다.")) {
                localStorage.removeItem("my_jptube_pin");
                alert("PIN 비밀번호가 제거되었습니다.");
                window.location.reload();
              }
            }}
            className="w-full bg-red-950/20 hover:bg-red-900/30 text-red-400 border border-red-900/30 rounded-xl py-2.5 text-xs font-bold transition active:scale-95 touch-target"
          >
            보안 PIN 비밀번호 초기화 및 제거
          </button>
        </div>
      </div>

      {/* 도움말 안내 */}
      <div className="bg-slate-900/50 border border-slate-800/80 p-4 rounded-2xl flex items-start gap-2.5 text-slate-500 text-[10px] leading-relaxed">
        <HelpCircle size={14} className="shrink-0 mt-0.5 text-slate-600" />
        <div>
          <span className="font-semibold text-slate-400 block mb-0.5">API Key 발급 방법</span>
          Google AI Studio 사이트(aistudio.google.com)에 로그인 후, 무료 요금제 탭에서 API Key를 간편하게 즉시 무료 생성할 수 있습니다.
        </div>
      </div>
    </div>
  );
}
