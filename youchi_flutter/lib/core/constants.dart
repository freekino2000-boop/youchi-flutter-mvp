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
  ];
}
