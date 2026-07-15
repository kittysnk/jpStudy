/**
 * 단어 퀴즈 결과에 따라 가중치를 업데이트합니다.
 * - 최초 등록 가중치: W = 1.0
 * - 오답(틀림) 판정 시: W = W + 1.0
 * - 모름/Pass 선택 시: W = W + 1.5
 * - 정답을 맞춘 경우: W = max(W - 0.5, 0.5) (최소 하한선 0.5)
 */
export function updateWordWeight(
  currentWeight: number,
  result: "correct" | "incorrect" | "pass"
): number {
  const W = typeof currentWeight === "number" && !isNaN(currentWeight) ? currentWeight : 1.0;
  
  switch (result) {
    case "incorrect":
      return W + 1.0;
    case "pass":
      return W + 1.5;
    case "correct":
      return Math.max(W - 0.5, 0.5);
    default:
      return W;
  }
}

/**
 * 가중치 비례 확률 셔플 알고리즘 (Weighted Random Sampling without Replacement)
 * - 각 아이템에 대해 난수 u (0 < u <= 1)를 생성한 뒤, key = u ^ (1 / weight)을 계산합니다.
 * - 계산된 key 값이 큰 순서(내림차순)로 정렬하여 반환합니다.
 * - 가중치(weight)가 높을수록 앞쪽에 배치될 확률이 통계적으로 높아집니다.
 */
export function weightedShuffle<T extends { weight: number }>(items: T[]): T[] {
  if (!items || items.length === 0) return [];
  
  // 원본 배열을 훼손하지 않기 위해 복사본을 만들어 진행합니다.
  const itemsWithKeys = items.map((item) => {
    const w = typeof item.weight === "number" && item.weight > 0 ? item.weight : 0.5;
    // 0 < u <= 1 인 난수 생성 (u가 0이 되면 Math.log(0) 등으로 인해 계산이 잘못되는 것을 방지하기 위함)
    const u = Math.random() || 0.0001; 
    const key = Math.pow(u, 1 / w);
    return { item, key };
  });

  // key 값 기준 내림차순 정렬
  itemsWithKeys.sort((a, b) => b.key - a.key);

  return itemsWithKeys.map((x) => x.item);
}
