/**
 * 유튜브 자막 데이터를 CORS 프록시를 통해 자동으로 긁어오는 유틸리티
 */

/**
 * AllOrigins 무료 CORS 프록시를 사용해 URL의 텍스트 콘텐츠를 가져옵니다.
 */
async function fetchWithProxy(targetUrl: string): Promise<string> {
  const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(targetUrl)}`;
  const response = await fetch(proxyUrl);
  if (!response.ok) {
    throw new Error("CORS 프록시 서버 응답에 실패했습니다.");
  }
  const data = await response.json();
  return data.contents;
}

/**
 * 초 단위 숫자를 포맷팅된 타임코드 문자열(예: '01:23')로 변환합니다.
 */
function formatTimeCode(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${pad(mins)}:${pad(secs)}`;
}

/**
 * 유튜브 timedtext API를 통해 자막 목록을 조회하고, 일본어 자막 트랙을 파싱해 텍스트 형태로 반환합니다.
 */
export async function getYoutubeJapaneseSubtitle(videoId: string): Promise<string> {
  try {
    // 1. 자막 목록 조회
    // 포맷: xml 형태의 자막 트랙 리스트를 가져옵니다.
    const listUrl = `https://www.youtube.com/api/timedtext?v=${videoId}&type=list`;
    console.log(`Fetching subtitle list for video: ${videoId}`);
    const listXmlText = await fetchWithProxy(listUrl);

    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(listXmlText, "text/xml");
    const tracks = xmlDoc.getElementsByTagName("track");

    if (tracks.length === 0) {
      console.warn("이 영상에는 공식 자막 데이터 트랙이 존재하지 않습니다.");
      return "";
    }

    // 2. 일본어 자막 트랙 찾기 (lang_code가 'ja'인 트랙 우선 탐색, 없으면 자동 생성 자막 'ja' 탐색)
    let selectedLangCode = "";
    for (let i = 0; i < tracks.length; i++) {
      const langCode = tracks[i].getAttribute("lang_code");
      if (langCode === "ja") {
        selectedLangCode = "ja";
        break;
      }
    }

    // 만약 일본어 자막이 없다면 첫 번째 자막이라도 가져옵니다. (없으면 빈값 반환)
    if (!selectedLangCode && tracks.length > 0) {
      selectedLangCode = tracks[0].getAttribute("lang_code") || "";
    }

    if (!selectedLangCode) {
      return "";
    }

    // 3. 자막 상세 데이터 fetch (fmt=srv1 포맷은 간단한 XML로 리턴됩니다.)
    const subUrl = `https://www.youtube.com/api/timedtext?v=${videoId}&lang=${selectedLangCode}&fmt=srv1`;
    console.log(`Fetching subtitle data in lang: ${selectedLangCode}`);
    const subXmlText = await fetchWithProxy(subUrl);

    const subDoc = parser.parseFromString(subXmlText, "text/xml");
    const textNodes = subDoc.getElementsByTagName("text");

    if (textNodes.length === 0) {
      return "";
    }

    // 4. 자막을 '[01:23] 대사' 포맷으로 병합 파싱
    const parsedLines: string[] = [];
    for (let i = 0; i < textNodes.length; i++) {
      const node = textNodes[i];
      const startStr = node.getAttribute("start");
      const text = node.textContent || "";
      
      if (startStr && text.trim()) {
        const startSec = parseFloat(startStr);
        const timeCode = formatTimeCode(startSec);
        // HTML Entity 디코딩 처리 (예: &#39; -> ' 등)
        const tempDiv = document.createElement("div");
        tempDiv.innerHTML = text;
        const decodedText = tempDiv.textContent || tempDiv.innerText || text;
        
        parsedLines.push(`[${timeCode}] ${decodedText.replace(/\n/g, " ").trim()}`);
      }
    }

    console.log(`Successfully fetched and parsed ${parsedLines.length} subtitle lines.`);
    return parsedLines.join("\n");
  } catch (error) {
    console.error("유튜브 자막을 자동으로 파싱하는 도중 에러가 발생했습니다:", error);
    return ""; // 에러 발생 시 빈 값을 반환하여 폴백 동작 유도
  }
}
