class KeywordInsight {
  KeywordInsight({
    required this.provider,
    required this.status,
    required this.headline,
    required this.summary,
    required this.keywords,
    required this.angles,
    required this.avoid,
    required this.fromGrok,
  });

  final String provider;
  final String status;
  final String headline;
  final String summary;
  final List<String> keywords;
  final List<String> angles;
  final List<String> avoid;
  final bool fromGrok;

  factory KeywordInsight.fromJson(Map<String, dynamic>? json) {
    final source = json ?? const <String, dynamic>{};
    return KeywordInsight(
      provider: '${source['provider'] ?? 'YOUCHI'}',
      status: '${source['status'] ?? '로컬 제안'}',
      headline: '${source['headline'] ?? 'SEO 키워드·제목 추천'}',
      summary: '${source['summary'] ?? 'SEO 최적화를 추천합니다.'}',
      keywords: _stringList(source['keywords']),
      angles: _stringList(source['angles']),
      avoid: _stringList(source['avoid']),
      fromGrok: source['fromGrok'] == true,
    );
  }

  static List<String> _stringList(dynamic value) {
    if (value is List) return value.map((item) => '$item').toList();
    return const [];
  }
}
