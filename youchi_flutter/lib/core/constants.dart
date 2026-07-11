class AppConstants {
  static const apiBase = String.fromEnvironment(
    'YOUCHI_API_BASE',
    defaultValue: 'http://127.0.0.1:8787',
  );

  static const savedBoardKey = 'youchi-saved-board';
  static const suggestionKeywords = [
    '신제품 런칭 광고를 만들고 싶어요',
    '고객 후기를 활용한 제품 광고가 필요해요',
    '시즌 프로모션용 숏폼 광고를 찾고 있어요',
    '제품 사용 장면이 잘 보이는 광고를 만들고 싶어요',
    '브랜드 인지도를 높이는 감성 광고를 찾고 있어요',
    '오프라인 매장 방문을 유도하는 광고가 필요해요',
    '프리미엄한 제품 이미지를 보여주는 광고를 만들고 싶어요',
    '짧은 시간 안에 장점이 바로 보이는 광고가 필요해요',
    'SNS에서 공유되기 좋은 숏폼 광고를 찾고 있어요',
    '구매 전환을 높이는 제품 비교 광고를 만들고 싶어요',
    '시즌 한정 이벤트를 알리는 광고가 필요해요',
    '처음 보는 고객도 이해하기 쉬운 설명형 광고를 찾고 있어요',
  ];
}
