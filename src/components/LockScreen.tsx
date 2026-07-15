import { useState } from "react";
import { ShieldCheck, ShieldAlert, Sparkles, Delete } from "lucide-react";

interface LockScreenProps {
  onUnlock: () => void;
}

export default function LockScreen({ onUnlock }: LockScreenProps) {
  // 로컬 스토리지에 등록된 PIN 이 있는지 확인
  const [savedPin, setSavedPin] = useState<string | null>(() => {
    return localStorage.getItem("my_jptube_pin");
  });

  const isSetupMode = !savedPin; // 저장된 PIN이 없으면 초기 설정 모드

  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [setupStep, setSetupStep] = useState<"initial" | "confirm">("initial");
  const [errorMsg, setErrorMsg] = useState("");
  const [shake, setShake] = useState(false);

  const handleKeyPress = (num: string) => {
    setErrorMsg("");
    const currentPin = setupStep === "initial" ? pin : confirmPin;
    
    if (currentPin.length >= 4) return;

    const newPin = currentPin + num;
    
    if (setupStep === "initial") {
      setPin(newPin);
      if (!isSetupMode && newPin.length === 4) {
        // 일반 잠금 해제 모드: 4자리 입력 시 즉각 검증
        verifyLock(newPin);
      }
    } else {
      setConfirmPin(newPin);
      if (newPin.length === 4) {
        // PIN 설정 확인 단계
        handleSetupConfirm(newPin);
      }
    }
  };

  const handleBackspace = () => {
    if (setupStep === "initial") {
      setPin((prev) => prev.slice(0, -1));
    } else {
      setConfirmPin((prev) => prev.slice(0, -1));
    }
  };

  // 일반 잠금 해제 검증
  const verifyLock = (input: string) => {
    if (input === savedPin) {
      onUnlock();
    } else {
      triggerError("PIN 번호가 일치하지 않습니다.");
      setPin("");
    }
  };

  // 최초 PIN 설정 프로세스
  const handleSetupNext = () => {
    if (pin.length < 4) {
      setErrorMsg("PIN 번호는 4자리여야 합니다.");
      return;
    }
    setSetupStep("confirm");
  };

  const handleSetupConfirm = (input: string) => {
    if (pin === input) {
      localStorage.setItem("my_jptube_pin", pin);
      setSavedPin(pin);
      onUnlock();
    } else {
      triggerError("처음 입력한 PIN 번호와 일치하지 않습니다. 다시 입력해 주세요.");
      setConfirmPin("");
      setSetupStep("initial");
      setPin("");
    }
  };

  const triggerError = (msg: string) => {
    setErrorMsg(msg);
    setShake(true);
    setTimeout(() => setShake(false), 500);
  };

  const getStepTitle = () => {
    if (isSetupMode) {
      return setupStep === "initial" 
        ? "나만의 공부방 PIN 설정" 
        : "PIN 번호 재입력 확인";
    }
    return "나만의 일어 공부방";
  };

  const getStepSubtitle = () => {
    if (isSetupMode) {
      return setupStep === "initial"
        ? "공부방 무단 사용을 방지할 4자리 PIN 번호를 지정해 주세요."
        : "보안을 위해 한 번 더 PIN 번호를 입력해 주세요.";
    }
    return "공부방 진입을 위해 4자리 PIN 번호를 입력해 주세요.";
  };

  const activeDotsCount = setupStep === "initial" ? pin.length : confirmPin.length;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950 flex flex-col justify-between p-6 max-w-[480px] mx-auto border-x border-slate-900 shadow-2xl">
      {/* 상단 브랜딩 */}
      <div className="flex-1 flex flex-col justify-center items-center text-center space-y-6">
        <div className="relative">
          <div className="absolute inset-0 bg-violet-600/20 blur-2xl rounded-full w-20 h-20 mx-auto" />
          <div className="bg-slate-900 p-4.5 rounded-full w-18 h-18 mx-auto flex items-center justify-center border border-slate-800 shadow-inner relative">
            {errorMsg ? (
              <ShieldAlert size={36} className="text-red-400 animate-pulse" />
            ) : (
              <ShieldCheck size={36} className="text-violet-400" />
            )}
          </div>
        </div>

        <div className="space-y-1.5 px-4">
          <h2 className="text-lg font-bold text-white tracking-tight flex items-center justify-center gap-1.5">
            {isSetupMode && <Sparkles size={16} className="text-amber-400 animate-spin" />}
            <span>{getStepTitle()}</span>
          </h2>
          <p className="text-xs text-slate-400 leading-relaxed max-w-[260px] mx-auto">
            {getStepSubtitle()}
          </p>
        </div>

        {/* PIN 도트 입력 인디케이터 */}
        <div className={`flex gap-4.5 py-4 ${shake ? "animate-shake" : ""}`}>
          {[...Array(4)].map((_, i) => (
            <div
              key={i}
              className={`w-3.5 h-3.5 rounded-full transition-all duration-200 border ${
                i < activeDotsCount
                  ? "bg-gradient-to-r from-violet-500 to-fuchsia-500 border-transparent scale-110 shadow-md shadow-violet-900/30"
                  : "bg-slate-900 border-slate-800"
              }`}
            />
          ))}
        </div>

        {/* 에러 메시지 */}
        {errorMsg && (
          <p className="text-red-400 text-xs font-medium px-4 text-center leading-relaxed">
            {errorMsg}
          </p>
        )}
      </div>

      {/* 2. 다이얼 패드 키패드 */}
      <div className="w-full max-w-xs mx-auto pb-8 space-y-4">
        <div className="grid grid-cols-3 gap-4">
          {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((num) => (
            <button
              key={num}
              onClick={() => handleKeyPress(num)}
              className="bg-slate-900/50 hover:bg-slate-900 active:scale-95 text-slate-200 hover:text-white rounded-2xl aspect-square text-lg font-bold font-sans border border-slate-800/40 flex items-center justify-center transition touch-target"
            >
              {num}
            </button>
          ))}
          
          {/* 빈 칸 또는 초기화 */}
          <div className="flex items-center justify-center">
            {isSetupMode && setupStep === "initial" && pin.length === 4 && (
              <button
                onClick={handleSetupNext}
                className="text-xs font-bold text-violet-400 hover:text-violet-300 transition"
              >
                다음 단계
              </button>
            )}
          </div>

          <button
            onClick={() => handleKeyPress("0")}
            className="bg-slate-900/50 hover:bg-slate-900 active:scale-95 text-slate-200 hover:text-white rounded-2xl aspect-square text-lg font-bold font-sans border border-slate-800/40 flex items-center justify-center transition touch-target"
          >
            0
          </button>

          <button
            onClick={handleBackspace}
            disabled={activeDotsCount === 0}
            className="text-slate-500 hover:text-slate-300 disabled:opacity-30 active:scale-95 flex items-center justify-center transition touch-target"
          >
            <Delete size={20} />
          </button>
        </div>
      </div>
    </div>
  );
}
