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
  HelpCircle,
  Lock,
  Palette
} from "lucide-react";
import { testGeminiApiKey, testOpenaiApiKey } from "../utils/gemini";
import type { LearningData } from "../utils/gemini";

interface SettingsProps {
  apiKey: string;
  openaiApiKey?: string;
  items: LearningData[];
  rtColor: string;
  fontScale: string;
  onSaveApiKey: (key: string) => void;
  onSaveOpenaiApiKey: (key: string) => void;
  onImportData: (importedKey: string, importedItems: LearningData[], importedOpenaiKey?: string) => void;
  onUpdateThemeSettings: (color: string, scale: string) => void;
  onBack: () => void;
}

export default function Settings({
  apiKey,
  openaiApiKey = "",
  items,
  rtColor,
  fontScale,
  onSaveApiKey,
  onSaveOpenaiApiKey,
  onImportData,
  onUpdateThemeSettings,
  onBack,
}: SettingsProps) {
  const [inputKey, setInputKey] = useState(apiKey);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<"none" | "success" | "fail">("none");

  const [inputOpenaiKey, setInputOpenaiKey] = useState(openaiApiKey);
  const [isOpenaiTesting, setIsOpenaiTesting] = useState(false);
  const [openaiTestResult, setOpenaiTestResult] = useState<"none" | "success" | "fail">("none");

  // 가독성 상태 동기화
  const [themeColor, setThemeColor] = useState(rtColor || "#facc15");
  const [scaleSize, setScaleSize] = useState(fontScale || "normal");

  const handleApplyTheme = (color: string, scale: string) => {
    setThemeColor(color);
    setScaleSize(scale);
    onUpdateThemeSettings(color, scale);
  };

  // 대시보드로 복귀할 때 변경된 키가 저장되어 있지 않으면 자동 저장되도록 보완
  const handleBackWithAutoSave = () => {
    if (inputKey.trim() !== apiKey) {
      onSaveApiKey(inputKey.trim());
    }
    if (inputOpenaiKey.trim() !== openaiApiKey) {
      onSaveOpenaiApiKey(inputOpenaiKey.trim());
    }
    onBack();
  };

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

  // OpenAI API Key 저장 및 테스트
  const handleSaveOpenaiKey = () => {
    onSaveOpenaiApiKey(inputOpenaiKey.trim());
    setOpenaiTestResult("none");
  };

  const handleTestOpenaiKey = async () => {
    if (!inputOpenaiKey.trim()) return;
    
    setIsOpenaiTesting(true);
    setOpenaiTestResult("none");
    try {
      const isValid = await testOpenaiApiKey(inputOpenaiKey.trim());
      setOpenaiTestResult(isValid ? "success" : "fail");
      if (isValid) {
        onSaveOpenaiApiKey(inputOpenaiKey.trim());
      }
    } catch (e) {
      setOpenaiTestResult("fail");
    } finally {
      setIsOpenaiTesting(false);
    }
  };

  // API Key 완전히 비우기 및 삭제
  const handleDeleteKey = () => {
    if (window.confirm("Gemini API Key를 완전히 삭제하시겠습니까?")) {
      setInputKey("");
      onSaveApiKey("");
      setTestResult("none");
      alert("Gemini API Key가 삭제되었습니다.");
    }
  };

  const handleDeleteOpenaiKey = () => {
    if (window.confirm("OpenAI API Key를 완전히 삭제하시겠습니까?")) {
      setInputOpenaiKey("");
      onSaveOpenaiApiKey("");
      setOpenaiTestResult("none");
      alert("OpenAI API Key가 삭제되었습니다.");
    }
  };

  // 데이터 백업 (Export JSON)
  const handleExportData = () => {
    const backupObj = {
      apiKey: apiKey,
      openaiApiKey: openaiApiKey,
      items: items,
      rtColor: themeColor,
      fontScale: scaleSize,
      version: "1.4",
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
        if (parsed && typeof parsed === "object") {
          const importedKey = parsed.apiKey || "";
          const importedOpenaiKey = parsed.openaiApiKey || "";
          const importedItems = Array.isArray(parsed.items) ? parsed.items : [];
          const importedColor = parsed.rtColor || "#facc15";
          const importedScale = parsed.fontScale || "normal";
          
          if (window.confirm(`백업 데이터(${importedItems.length}개 영상)를 현재 브라우저에 복원하시겠습니까?`)) {
            handleApplyTheme(importedColor, importedScale);
            onImportData(importedKey, importedItems, importedOpenaiKey);
            alert("데이터 복원이 안전하게 완료되었습니다!");
          }
        } else {
          alert("올바르지 않은 백업 파일 규격입니다.");
        }
      } catch (err) {
        alert("백업 파일을 분석하는 도중 에러가 발생했습니다: " + err);
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  return (
    <div className="space-y-6 animate-fade-in">
      
      {/* 상단 네비게이션 헤더 */}
      <div className="flex justify-between items-center bg-slate-800/40 p-4 rounded-2xl border border-slate-700/50 backdrop-blur-md">
        <button 
          onClick={handleBackWithAutoSave}
          className="flex items-center gap-1.5 text-xs font-semibold text-slate-300 hover:text-slate-100 transition touch-target"
        >
          <ArrowLeft size={16} />
          <span>대시보드</span>
        </button>
        <span className="text-xs font-bold text-slate-300">공부방 환경 설정</span>
      </div>

      {/* 1) 가독성 및 화면 테마 설정 */}
      <div className="glass-panel p-5 rounded-3xl space-y-4 shadow-xl">
        <div className="flex items-center gap-2 text-violet-400 font-semibold text-sm">
          <Palette size={16} />
          <span>화면 및 가독성 테마 설정</span>
        </div>

        <div className="space-y-4">
          {/* 후리가나(루비) 색상 설정 */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-400 block">후리가나(루비) 폰트 색상</label>
            <div className="grid grid-cols-4 gap-2">
              {[
                { name: "형광노랑", value: "#facc15", bg: "bg-yellow-400" },
                { name: "흰색", value: "#ffffff", bg: "bg-white" },
                { name: "형광녹색", value: "#22c55e", bg: "bg-green-500" },
                { name: "보라색", value: "#c084fc", bg: "bg-purple-400" }
              ].map((c) => (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => handleApplyTheme(c.value, scaleSize)}
                  className={`flex flex-col items-center gap-1.5 p-2 rounded-2xl border transition active:scale-95 touch-target ${
                    themeColor === c.value 
                      ? "border-violet-500 bg-violet-950/20 text-white font-bold" 
                      : "border-slate-800 bg-slate-900/40 text-slate-400 hover:text-slate-200"
                  }`}
                >
                  <span className={`w-5 h-5 rounded-full ${c.bg} border border-slate-700`} />
                  <span className="text-[10px] text-center leading-tight truncate w-full">{c.name}</span>
                </button>
              ))}
            </div>
          </div>

          {/* 전체 폰트 크기 조절 */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-400 block">화면 전체 글자 크기</label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: "기본 크기", value: "normal" },
                { label: "크게 (+15%)", value: "large" },
                { label: "더 크게 (+30%)", value: "xlarge" }
              ].map((s) => (
                <button
                  key={s.value}
                  type="button"
                  onClick={() => handleApplyTheme(themeColor, s.value)}
                  className={`py-3 px-2 rounded-2xl border text-xs font-bold transition active:scale-95 touch-target ${
                    scaleSize === s.value
                      ? "border-violet-500 bg-violet-950/30 text-violet-300"
                      : "border-slate-800 bg-slate-900/40 text-slate-400 hover:text-slate-200"
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* 2) Google Gemini API Key 설정 */}
      <div className="glass-panel p-5 rounded-3xl space-y-4 shadow-xl">
        <div className="flex items-center gap-2 text-violet-400 font-semibold text-sm">
          <Key size={16} />
          <span>Google Gemini API 인증 설정</span>
        </div>

        <div className="space-y-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-slate-400">Gemini API Key 등록</label>
            <input
              type="password"
              value={inputKey}
              onChange={(e) => setInputKey(e.target.value)}
              placeholder="AI Studio API Key를 입력하세요..."
              className="w-full bg-slate-950/60 border border-slate-800 focus:border-violet-500/50 outline-none rounded-xl px-4 py-2.5 text-xs text-slate-200 transition font-mono tracking-widest"
            />
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleSaveKey}
              className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700/50 rounded-xl py-2.5 text-xs font-bold transition active:scale-95 touch-target"
            >
              키 저장
            </button>
            <button
              onClick={handleTestKey}
              disabled={isTesting || !inputKey.trim()}
              className="flex-1 bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:opacity-95 text-white rounded-xl py-2.5 text-xs font-bold transition flex items-center justify-center gap-1.5 active:scale-95 disabled:opacity-50 touch-target shadow-md"
            >
              {isTesting ? (
                <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <ShieldCheck size={14} />
              )}
              <span>연결 테스트</span>
            </button>
            <button
              onClick={handleDeleteKey}
              disabled={!inputKey.trim() && !apiKey}
              className="bg-red-950/20 hover:bg-red-900/30 text-red-400 border border-red-900/30 rounded-xl px-3.5 py-2.5 text-xs font-bold transition active:scale-95 touch-target"
            >
              삭제
            </button>
          </div>

          {testResult === "success" && (
            <div className="flex items-center gap-1.5 text-xs text-green-400 font-semibold bg-green-950/20 border border-green-900/30 p-2.5 rounded-xl">
              <CheckCircle2 size={14} />
              <span>Gemini API 연결 테스트 성공! (자동 저장됨)</span>
            </div>
          )}
          {testResult === "fail" && (
            <div className="flex items-center gap-1.5 text-xs text-red-400 font-semibold bg-red-950/20 border border-red-900/30 p-2.5 rounded-xl">
              <XCircle size={14} />
              <span>연결에 실패했습니다. 올바른 키인지 다시 확인하세요.</span>
            </div>
          )}
        </div>
      </div>

      {/* 3) ChatGPT (OpenAI) API Key 설정 (Gemini 429 우회용 백업) */}
      <div className="glass-panel p-5 rounded-3xl space-y-4 shadow-xl">
        <div className="flex items-center gap-2 text-violet-400 font-semibold text-sm">
          <Key size={16} />
          <span>ChatGPT (OpenAI) API 인증 설정 (백업용)</span>
        </div>

        <div className="space-y-3">
          <p className="text-[10px] text-slate-400 leading-relaxed">
            Gemini API의 429 무료 쿼터 제한이나 호출 오류가 발생할 때 자동으로 ChatGPT를 사용하여 자막 파싱 및 학습 생성을 대체 수행합니다.
          </p>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-slate-400">OpenAI API Key 등록</label>
            <input
              type="password"
              value={inputOpenaiKey}
              onChange={(e) => setInputOpenaiKey(e.target.value)}
              placeholder="sk-proj-..."
              className="w-full bg-slate-950/60 border border-slate-800 focus:border-violet-500/50 outline-none rounded-xl px-4 py-2.5 text-xs text-slate-200 transition font-mono tracking-widest"
            />
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleSaveOpenaiKey}
              className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700/50 rounded-xl py-2.5 text-xs font-bold transition active:scale-95 touch-target"
            >
              키 저장
            </button>
            <button
              onClick={handleTestOpenaiKey}
              disabled={isOpenaiTesting || !inputOpenaiKey.trim()}
              className="flex-1 bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:opacity-95 text-white rounded-xl py-2.5 text-xs font-bold transition flex items-center justify-center gap-1.5 active:scale-95 disabled:opacity-50 touch-target shadow-md"
            >
              {isOpenaiTesting ? (
                <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <ShieldCheck size={14} />
              )}
              <span>연결 테스트</span>
            </button>
            <button
              onClick={handleDeleteOpenaiKey}
              disabled={!inputOpenaiKey.trim() && !openaiApiKey}
              className="bg-red-950/20 hover:bg-red-900/30 text-red-400 border border-red-900/30 rounded-xl px-3.5 py-2.5 text-xs font-bold transition active:scale-95 touch-target"
            >
              삭제
            </button>
          </div>

          {openaiTestResult === "success" && (
            <div className="flex items-center gap-1.5 text-xs text-green-400 font-semibold bg-green-950/20 border border-green-900/30 p-2.5 rounded-xl">
              <CheckCircle2 size={14} />
              <span>OpenAI API 연결 테스트 성공! (자동 저장됨)</span>
            </div>
          )}
          {openaiTestResult === "fail" && (
            <div className="flex items-center gap-1.5 text-xs text-red-400 font-semibold bg-red-950/20 border border-red-900/30 p-2.5 rounded-xl">
              <XCircle size={14} />
              <span>OpenAI API 연결에 실패했습니다. 키를 다시 확인하세요.</span>
            </div>
          )}
        </div>
      </div>

      {/* 4) 데이터 백업 및 마이그레이션 */}
      <div className="glass-panel p-5 rounded-3xl space-y-4 shadow-xl">
        <div className="flex items-center gap-2 text-violet-400 font-semibold text-sm">
          <Download size={16} />
          <span>데이터 백업 및 마이그레이션</span>
        </div>

        <div className="space-y-4">
          <p className="text-[11px] text-slate-400 leading-relaxed">
            브라우저 캐시 삭제로 인한 학습 데이터 분실을 막기 위해 정기적인 백업 파일 내보내기를 권장합니다.
          </p>

          <div className="bg-amber-950/20 border border-amber-900/40 text-amber-300/90 p-3 rounded-xl text-[10px] leading-relaxed flex gap-2">
            <AlertTriangle size={18} className="shrink-0 mt-0.5 text-amber-400" />
            <div>
              <span className="font-semibold block">주의사항</span>
              가져오기(Import)를 수행하면 현재 브라우저에 등록된 모든 학습 자료 및 단어장이 덮어써집니다.
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={handleExportData}
              disabled={items.length === 0 && !apiKey}
              className="bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-300 border border-slate-700/50 rounded-xl py-3 text-xs font-bold transition flex flex-col items-center justify-center gap-1.5 active:scale-95 touch-target"
            >
              <Download size={16} className="text-violet-400" />
              <span>백업 파일 내보내기</span>
            </button>

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

      {/* 5) 보안 잠금 설정 */}
      <div className="glass-panel p-5 rounded-3xl space-y-4 shadow-xl">
        <div className="flex items-center gap-2 text-violet-400 font-semibold text-sm">
          <Lock size={16} />
          <span>공부방 보안 잠금 설정 (PIN)</span>
        </div>

        <div className="space-y-3">
          <p className="text-[11px] text-slate-400 leading-relaxed">
            웹 주소를 통해 비인가 사용자가 접속하는 것을 방지합니다. 브라우저에 저장된 4자리 보안 PIN 번호를 완전히 해제합니다.
          </p>

          <button
            onClick={() => {
              if (window.confirm("PIN 비밀번호를 완전히 초기화하시겠습니까? 다음 접속부터는 입력이 요구되지 않습니다.")) {
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
          Google AI Studio (aistudio.google.com) 또는 OpenAI Platform (platform.openai.com) 사이트에서 개인 API Key를 즉시 무료 생성하거나 발급받으실 수 있습니다.
        </div>
      </div>
    </div>
  );
}
