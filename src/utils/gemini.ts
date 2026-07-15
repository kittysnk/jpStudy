import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";
import type { Schema } from "@google/generative-ai";

export interface ScriptItem {
  time: number;
  time_code: string;
  japanese: string;
  korean: string;
}

export interface VocabularyItem {
  word: string;
  meaning: string;
  jlpt_level: string;
  synonym: string;
  antonym: string;
  example_sentence: string;
  example_meaning: string;
  // 학습용 추가 필드
  weight: number;
  id: string;
}

export interface LearningData {
  video_id: string;
  video_title: string;
  added_date: string;
  script_data: ScriptItem[];
  vocabulary_list: VocabularyItem[];
  quiz_progress: number; // 퀴즈 진행률 (%)
  quiz_correct_rate: number; // 정답률 (%)
  status: "학습 중" | "완료";
}

// 대문자 리터럴 및 SchemaType 형식과 정적 타입 무결성 확보
const responseSchema: Schema = {
  type: SchemaType.OBJECT,
  properties: {
    video_title: {
      type: SchemaType.STRING,
      description: "유튜브 영상 제목",
    },
    script_data: {
      type: SchemaType.ARRAY,
      description: "일본어 대사 자막과 시간대 목록",
      items: {
        type: SchemaType.OBJECT,
        properties: {
          time: {
            type: SchemaType.NUMBER,
            description: "해당 자막 대사의 시작 시점 초 단위 시간 (예: 83)",
          },
          time_code: {
            type: SchemaType.STRING,
            description: "포맷팅된 타임코드 문자열 (예: '01:23')",
          },
          japanese: {
            type: SchemaType.STRING,
            description: "ruby 태그가 적용된 일본어 대사 한 줄 (예: <ruby>漢<rt>かん</rt>字<rt>じ</rt></ruby>)",
          },
          korean: {
            type: SchemaType.STRING,
            description: "대응하는 한국어 번역",
          },
        },
        required: ["time", "time_code", "japanese", "korean"],
      },
    },
    vocabulary_list: {
      type: SchemaType.ARRAY,
      description: "학습해야 할 핵심 단어 및 문형 10개 목록",
      items: {
        type: SchemaType.OBJECT,
        properties: {
          word: {
            type: SchemaType.STRING,
            description: "ruby 태그가 포함된 핵심 단어/문형",
          },
          meaning: {
            type: SchemaType.STRING,
            description: "단어의 뜻",
          },
          jlpt_level: {
            type: SchemaType.STRING,
            description: "N1, N2, N3, N4, N5 중 판단된 해당 단어의 등급",
          },
          synonym: {
            type: SchemaType.STRING,
            description: "유사 표현 (없으면 공백)",
          },
          antonym: {
            type: SchemaType.STRING,
            description: "반대 표현 (없으면 공백)",
          },
          example_sentence: {
            type: SchemaType.STRING,
            description: "ruby 태그가 포함된 실용 예문",
          },
          example_meaning: {
            type: SchemaType.STRING,
            description: "예문의 자연스러운 한국어 뜻 번역",
          },
        },
        required: [
          "word",
          "meaning",
          "jlpt_level",
          "synonym",
          "antonym",
          "example_sentence",
          "example_meaning",
        ],
      },
    },
  },
  required: ["video_title", "script_data", "vocabulary_list"],
};

const SYSTEM_INSTRUCTION = `당신은 전문적인 일본어 교육가이자 한국인 학습자를 돕는 언어 멘토입니다. 
제공되는 유튜브 스크립트 또는 관련 텍스트에서 학습자가 꼭 암기해야 할 가치 있는 핵심 어휘 및 문형 10개를 선별하십시오. 
한자가 포함된 모든 일어 단어와 문장(스크립트 포함)에는 반드시 HTML5의 \`<ruby>\` 및 \`<rt>\` 태그를 적용하여 한자 바로 위에 후리가나가 렌더링되도록 반환해야 합니다.
예: <ruby>漢<rt>かん</rt>字<rt>じ</rt></ruby>

제공되는 원본 텍스트에 시간 정보(예: [01:23] 또는 83초 등)가 포함되어 있다면, 이를 초단위 숫자(time) 및 포맷팅된 문자열(time_code)로 정확하게 매핑하십시오. 만약 원본 텍스트에 시간 정보가 없고 단순 스크립트 줄글만 있다면, 대사의 흐름에 맞게 가상으로 고르게 분산된 시간대(예: 5초 간격 등)를 할당하여 time 및 time_code를 채우십시오.

[중요 지시사항 - 자막 누락 절대 금지]:
입력으로 전달받은 스크립트 전체 대사 텍스트를 시작부터 끝까지 단 한 줄도 누락하거나 생략하지 말고 100% 전부 변환하여 JSON의 script_data 목록에 포함시켜야 합니다. 중간에 번역이나 후리가나 변환을 멈추고 생략하거나 요약해버리는 행위는 심각한 오류로 간주되니, 반드시 전체 원본 대사 목록을 처음부터 끝까지 빠짐없이 담아서 반환하십시오.

특히, 추출한 핵심 단어 및 문형의 예시 문장(example_sentence)을 구성할 때는 인위적인 교과서식 예문이 아니라, 제공된 유튜브 스크립트 본문 내에서 해당 단어가 실제 사용된 진짜 회화체/대화 내용 문장(문맥상 다소 긴 경우 핵심 위주로 다듬되 구어체 뉘앙스 보존)을 100% 최우선적으로 추출하여 예문으로 채택하십시오. 해당 예문 내의 한자들에도 빠짐없이 ruby 후리가나 태그를 적용해야 합니다.
출력 포맷은 반드시 제시된 JSON 스키마를 100% 준수해야 합니다.`;

// 대기 시간(503) 및 딜레이 최소화를 위해 응답성이 가장 빠른 모델 순으로 정렬 배치
const MODEL_FALLBACK_LIST = [
  "gemini-2.5-flash",        // 1순위: 현재 대기 지연(503)이 가장 적고 2초 이내로 즉각 응답하는 최고 효율 모델
  "gemini-flash-latest",     // 2순위: 1.5 flash 기반의 최신 고속 별칭
  "gemini-3.5-flash",        // 3순위: 기획서 타겟 모델 (부하 발생율이 높아 후순위 백업용 배치)
  "gemini-3.1-flash-lite",   // 4순위: 차세대 보급형 초고속 모델
  "gemini-2.0-flash"         // 5순위: 최후방 보루 모델
];

// 지정된 시간(ms) 이후 에러를 뱉는 타임아웃 프로미스 유틸
const timeoutPromise = (ms: number) => {
  return new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error("Timeout")), ms);
  });
};

/**
 * YouTube 영상 ID 추출 함수
 */
export function extractYoutubeVideoId(url: string): string | null {
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
  const match = url.match(regExp);
  return match && match[2].length === 11 ? match[2] : null;
}

/**
 * Gemini API를 사용하여 일본어 학습용 자막 및 단어 데이터를 파싱합니다.
 * (모델 지연 최소화를 위해 10초 타임아웃 레이스 및 모델 폴백 적용)
 */
export async function generateLearningData(
  apiKey: string,
  youtubeUrl: string,
  rawScriptText: string
): Promise<LearningData> {
  const videoId = extractYoutubeVideoId(youtubeUrl);
  if (!videoId) {
    throw new Error("유효한 유튜브 URL이 아닙니다.");
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  
  const prompt = `
유튜브 동영상 링크: ${youtubeUrl}
영상 내 자막/스크립트 텍스트:
"""
${rawScriptText || "시간 정보 및 대사를 알 수 없음. 유튜브 링크 내용을 기반으로 하거나, 임의의 유용한 일본어 회화/교육용 스크립트 10줄 내외와 단어 10개를 생성해 주세요."}
"""

위 자료를 분석하여 일본어 학습 데이터를 JSON으로 생성해 주세요.
`;

  let lastError: any = null;

  for (const modelName of MODEL_FALLBACK_LIST) {
    try {
      console.log(`Attempting data generation using model: ${modelName} (v1beta)`);
      
      const model = genAI.getGenerativeModel(
        { model: modelName, systemInstruction: SYSTEM_INSTRUCTION },
        { apiVersion: "v1beta" }
      );

      // 데이터 생성은 비교적 프롬프트 분석이 크므로 9초 타임아웃 레이스 적용
      const apiCall = model.generateContent({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: responseSchema,
          maxOutputTokens: 8192, // 자막이 중간에 짤리지 않도록 최대 출력 토큰을 8192로 대폭 상향 조정
        },
      });

      const result: any = await Promise.race([
        apiCall,
        timeoutPromise(9000)
      ]);

      const responseText = result.response.text();
      const parsedData = JSON.parse(responseText);

      // 단어장에 학습용 고유 ID와 초기 가중치(W = 1.0) 부여
      const vocabularyListWithMeta = (parsedData.vocabulary_list || []).map(
        (item: any, index: number) => ({
          ...item,
          id: `${videoId}_vocab_${index}_${Date.now()}`,
          weight: 1.0,
        })
      );

      const today = new Date().toISOString().split("T")[0];

      return {
        video_id: videoId,
        video_title: parsedData.video_title || "제목 없음",
        added_date: today,
        script_data: parsedData.script_data || [],
        vocabulary_list: vocabularyListWithMeta,
        quiz_progress: 0,
        quiz_correct_rate: 0,
        status: "학습 중",
      };
    } catch (error: any) {
      console.warn(`Model ${modelName} failed, timed out, or returned error:`, error);
      lastError = error;
      // 다음 모델로 즉각 대체 시도
    }
  }

  console.error("All fallback models failed. Last error:", lastError);
  throw new Error(`학습 데이터를 생성하는 중 에러가 발생했습니다. (최신 에러: ${lastError?.message || "Timeout/Network Error"})`);
}

/**
 * API Key 유효성 테스트용 함수
 * (연결성 극대화를 위해 4초 타임아웃 레이스 및 모델 폴백 적용)
 */
export async function testGeminiApiKey(apiKey: string): Promise<boolean> {
  const genAI = new GoogleGenerativeAI(apiKey);

  for (const modelName of MODEL_FALLBACK_LIST) {
    try {
      console.log(`Testing API key connection using model: ${modelName} (v1beta)`);
      
      const model = genAI.getGenerativeModel(
        { model: modelName },
        { apiVersion: "v1beta" }
      );
      
      // 연결성 검증은 4초 이내에 응답이 없으면 즉각 스킵 처리
      const apiCall = model.generateContent("Hello, respond in exactly one word: Success.");
      
      const result: any = await Promise.race([
        apiCall,
        timeoutPromise(4000)
      ]);

      const responseText = result.response.text().trim().toLowerCase();
      
      if (responseText.includes("success") || responseText.length > 0) {
        console.log(`Connection test succeeded with model: ${modelName}`);
        return true;
      }
    } catch (error) {
      console.warn(`Connection test failed/timeout with model ${modelName}:`, error);
      // 503, 404, 또는 4초 타임아웃 발생 시 다음 모델로 대체 테스트
    }
  }
  return false;
}
