/**
 * 유튜브 자막 데이터를 CORS 프록시를 통해 안전하고 효율적으로 가져오는 유틸리티
 */

// 다중 CORS 프록시 서버 목록 (첫 번째 프록시 실패 시 순차적으로 fallback 수행)
const CORS_PROXY_LIST = [
  (url: string) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`, // JSON 랩핑이 없는 Raw 모드를 최우선으로 시도
  (url: string) => `https://api.codetabs.com/v1/proxy?queryString=${encodeURIComponent(url)}`,
  (url: string) => `https://corsproxy.io/?${encodeURIComponent(url)}`,
  (url: string) => `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`,
  (url: string) => `https://thingproxy.freeboard.io/fetch/${url}`
];

/**
 * 다중 프록시를 순회하며 안전하게 원격 콘텐츠를 가져오는 함수 (AllOrigins /get 은 JSON으로 랩핑되어 오므로 분기 처리)
 */
async function fetchWithProxyFallback(targetUrl: string): Promise<string> {
  let lastError: any = null;

  for (const getProxyUrl of CORS_PROXY_LIST) {
    const proxyUrl = getProxyUrl(targetUrl);
    try {
      console.log(`Trying proxy: ${proxyUrl}`);
      const response = await fetch(proxyUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36"
        }
      });

      if (!response.ok) {
        throw new Error(`Proxy status error: ${response.status}`);
      }

      // AllOrigins JSON 랩핑 포맷 분기 (/get 포함 시)
      if (proxyUrl.includes("allorigins.win/get")) {
        const data = await response.json();
        if (data && data.contents) {
          return data.contents;
        }
        throw new Error("AllOrigins response does not contain contents field");
      }

      // 타 프록시는 원본 텍스트를 그대로 반환함
      const text = await response.text();
      if (text && text.trim()) {
        return text;
      }
    } catch (error: any) {
      console.warn(`Proxy ${proxyUrl} failed:`, error.message || error);
      lastError = error;
    }
  }

  throw new Error(`모든 CORS 프록시 요청에 실패했습니다. (최종 에러: ${lastError?.message || "Unknown"})`);
}

/**
 * 초 단위 숫자를 포맷팅된 타임코드 문자열(예: '01:23')로 변환합니다.
 */
function formatTimeCode(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return "00:00";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${pad(mins)}:${pad(secs)}`;
}

/**
 * 메모리 누수와 브라우저 종속성을 제거한 순수 JS 기반 HTML 엔티티 디코더
 */
function decodeHtmlEntities(str: string): string {
  const entityMap: Record<string, string> = {
    "&amp;": "&",
    "&lt;": "<",
    "&gt;": ">",
    "&quot;": '"',
    "&#39;": "'",
    "&apos;": "'",
    "&nbsp;": " "
  };
  return str.replace(/(&amp;|&lt;|&gt;|&quot;|&#39;|&apos;|&nbsp;)/g, (match) => entityMap[match] || match);
}

/**
 * 브라우저 환경에서 안전하게 작동하는 XML 파서 유틸
 */
function parseXml(xmlText: string): Document | null {
  try {
    const parser = new DOMParser();
    return parser.parseFromString(xmlText, "text/xml");
  } catch (error) {
    console.error("DOMParser 파싱 오류:", error);
    return null;
  }
}

/**
 * 유튜브 timedtext API를 통해 자막 목록을 조회하고, 일본어 자막 트랙(자동 생성 포함)을 파싱해 반환합니다.
 */
export async function getYoutubeJapaneseSubtitle(videoId: string): Promise<string> {
  try {
    const listUrl = `https://www.youtube.com/api/timedtext?v=${videoId}&type=list`;
    console.log(`Fetching subtitle list for video: ${videoId}`);
    const listXmlText = await fetchWithProxyFallback(listUrl);

    const xmlDoc = parseXml(listXmlText);
    if (!xmlDoc) {
      throw new Error("자막 목록 XML 파싱에 실패했습니다.");
    }

    const tracks = xmlDoc.getElementsByTagName("track");
    if (tracks.length === 0) {
      console.warn("이 영상에는 이용 가능한 자막 트랙 정보가 존재하지 않습니다.");
      return "";
    }

    let selectedLangCode = "";
    // 일본어 공식 자막(ja)을 최우선적으로 탐색
    for (let i = 0; i < tracks.length; i++) {
      const langCode = tracks[i].getAttribute("lang_code");
      if (langCode === "ja") {
        selectedLangCode = "ja";
        break;
      }
    }

    // 일본어가 없으면 첫 번째로 존재하는 임의의 자막 트랙 적용
    if (!selectedLangCode && tracks.length > 0) {
      selectedLangCode = tracks[0].getAttribute("lang_code") || "";
    }

    if (!selectedLangCode) {
      return "";
    }

    // srv1 형식(XML 기반 구조)으로 실제 자막 스크립트를 가져옴
    const subUrl = `https://www.youtube.com/api/timedtext?v=${videoId}&lang=${selectedLangCode}&fmt=srv1`;
    console.log(`Fetching subtitle data in lang: ${selectedLangCode}`);
    const subXmlText = await fetchWithProxyFallback(subUrl);

    const subDoc = parseXml(subXmlText);
    if (!subDoc) {
      throw new Error("자막 상세 XML 파싱에 실패했습니다.");
    }

    const textNodes = subDoc.getElementsByTagName("text");
    if (textNodes.length === 0) {
      return "";
    }

    const parsedLines: string[] = [];
    for (let i = 0; i < textNodes.length; i++) {
      const node = textNodes[i];
      const startStr = node.getAttribute("start");
      const rawText = node.textContent || "";

      if (startStr && rawText.trim()) {
        const startSec = parseFloat(startStr);
        const timeCode = formatTimeCode(startSec);
        // 메모리 효율적인 엔티티 디코더를 활용하여 정제
        const decodedText = decodeHtmlEntities(rawText);
        parsedLines.push(`[${timeCode}] ${decodedText.replace(/\n/g, " ").trim()}`);
      }
    }

    console.log(`Successfully fetched and parsed ${parsedLines.length} subtitle lines.`);
    return parsedLines.join("\n");
  } catch (error) {
    console.error("유튜브 자막을 자동으로 파싱하는 도중 에러가 발생했습니다:", error);
    throw error; // 에러를 호출처로 위임하여 팝업 연동 기동
  }
}
