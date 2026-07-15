import { useState, useEffect } from "react";
import { 
  Home, 
  Settings as SettingsIcon
} from "lucide-react";
import Dashboard from "./components/Dashboard";
import StudyRoom from "./components/StudyRoom";
import Vocabulary from "./components/Vocabulary";
import Settings from "./components/Settings";
import LockScreen from "./components/LockScreen";
import type { LearningData, VocabularyItem } from "./utils/gemini";


type Tab = "dashboard" | "study" | "quiz" | "settings";

function App() {
  // 보안 잠금 상태 관리
  const [isLocked, setIsLocked] = useState(true);
  
  // LocalStorage 데이터 읽어오기
  const [apiKey, setApiKey] = useState<string>(() => {
    return localStorage.getItem("my_jptube_apiKey") || "";
  });

  const [items, setItems] = useState<LearningData[]>(() => {
    const raw = localStorage.getItem("my_jptube_items");
    try {
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });

  const [activeTab, setActiveTab] = useState<Tab>("dashboard");
  const [selectedVideoId, setSelectedVideoId] = useState<string>("");

  // 상태 변경 시 LocalStorage 저장
  useEffect(() => {
    localStorage.setItem("my_jptube_apiKey", apiKey);
  }, [apiKey]);

  useEffect(() => {
    localStorage.setItem("my_jptube_items", JSON.stringify(items));
  }, [items]);

  // 비디오 추가
  const handleAddVideo = (newItem: LearningData) => {
    setItems((prev) => [newItem, ...prev]);
  };

  // 비디오 삭제
  const handleDeleteVideo = (videoId: string) => {
    setItems((prev) => prev.filter((item) => item.video_id !== videoId));
    if (selectedVideoId === videoId) {
      setSelectedVideoId("");
      setActiveTab("dashboard");
    }
  };

  // 비디오 선택
  const handleSelectVideo = (videoId: string, targetTab: "study" | "quiz") => {
    setSelectedVideoId(videoId);
    setActiveTab(targetTab === "study" ? "study" : "quiz");
  };

  // 퀴즈 결과 진도 업데이트
  const handleUpdateQuizProgress = (
    videoId: string,
    updatedVocabList: VocabularyItem[],
    progress: number,
    correctRate: number
  ) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.video_id === videoId) {
          return {
            ...item,
            vocabulary_list: updatedVocabList,
            quiz_progress: progress,
            quiz_correct_rate: correctRate,
            status: "완료" as const, // 퀴즈 완료 시 완료 처리
          };
        }
        return item;
      })
    );
  };

  // 복원 데이터 셋
  const handleImportData = (importedKey: string, importedItems: LearningData[]) => {
    setApiKey(importedKey);
    setItems(importedItems);
    setActiveTab("dashboard");
  };

  const selectedItem = items.find((item) => item.video_id === selectedVideoId);

  // 탭 네비게이션이 보이는 상태인지 여부 (학습 중에는 숨김)
  const showTabBar = activeTab === "dashboard" || activeTab === "settings";

  if (isLocked) {
    return <LockScreen onUnlock={() => setIsLocked(false)} />;
  }

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col justify-between max-w-[480px] mx-auto relative shadow-2xl border-x border-slate-800/60 pb-16">
      
      {/* 본문 콘텐츠 뷰 */}
      <main className="flex-1 p-4 overflow-y-auto">
        {activeTab === "dashboard" && (
          <Dashboard
            apiKey={apiKey}
            items={items}
            onAddVideo={handleAddVideo}
            onDeleteVideo={handleDeleteVideo}
            onSelectVideo={handleSelectVideo}
            onNavigateToSettings={() => setActiveTab("settings")}
          />
        )}

        {activeTab === "study" && selectedItem && (
          <StudyRoom
            data={selectedItem}
            onBack={() => setActiveTab("dashboard")}
          />
        )}

        {activeTab === "quiz" && selectedItem && (
          <Vocabulary
            data={selectedItem}
            onBack={() => setActiveTab("dashboard")}
            onUpdateQuizProgress={handleUpdateQuizProgress}
          />
        )}

        {activeTab === "settings" && (
          <Settings
            apiKey={apiKey}
            items={items}
            onSaveApiKey={setApiKey}
            onImportData={handleImportData}
            onBack={() => setActiveTab("dashboard")}
          />
        )}
      </main>

      {/* 하단 모바일 스타일 탭바 (학습 중에는 숨김) */}
      {showTabBar && (
        <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[480px] bg-slate-950/90 border-t border-slate-800/80 px-8 py-2.5 flex justify-around items-center z-40 backdrop-blur-lg">
          <button
            onClick={() => setActiveTab("dashboard")}
            className={`flex flex-col items-center gap-1 transition ${
              activeTab === "dashboard" ? "text-violet-400" : "text-slate-500 hover:text-slate-300"
            }`}
          >
            <Home size={20} />
            <span className="text-[10px] font-semibold">홈</span>
          </button>
          
          <button
            onClick={() => setActiveTab("settings")}
            className={`flex flex-col items-center gap-1 transition ${
              activeTab === "settings" ? "text-violet-400" : "text-slate-500 hover:text-slate-300"
            }`}
          >
            <SettingsIcon size={20} />
            <span className="text-[10px] font-semibold">설정</span>
          </button>
        </nav>
      )}
    </div>
  );
}

export default App;
