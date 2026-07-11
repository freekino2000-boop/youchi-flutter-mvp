class AppConstants {
  static const apiBase = String.fromEnvironment(
    'YOUCHI_API_BASE',
    defaultValue: 'http://127.0.0.1:8787',
  );

  static const savedBoardKey = 'youchi-saved-board';
  static const suggestionKeywords = [
    '#사이버펑크_네온',
    '#여름_해변_휴가',
    '#고급스러운_미니멀리즘',
    '#박진감_넘치는_스포츠',
  ];
}
