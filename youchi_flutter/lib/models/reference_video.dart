class ReferenceVideo {
  ReferenceVideo({
    required this.id,
    required this.title,
    required this.source,
    required this.image,
    required this.duration,
    required this.seconds,
    required this.match,
    required this.hasEvidence,
    required this.reason,
    required this.keywords,
    required this.matchedTerms,
    this.channel,
    this.category,
    this.originUrl,
    this.videoType,
    this.videoUrl,
    this.year,
    this.description,
    this.savedAt,
  });

  final String id;
  final String title;
  final String source;
  final String? channel;
  final String? category;
  final String image;
  final String? originUrl;
  final String? videoType;
  final String? videoUrl;
  final String duration;
  final int seconds;
  final int? year;
  final int match;
  final bool hasEvidence;
  final String reason;
  final String? description;
  final List<String> keywords;
  final List<String> matchedTerms;
  final String? savedAt;

  bool get isShortForm {
    final text = [
      source,
      videoType,
      originUrl,
      title,
      description,
      category,
      ...keywords,
    ].whereType<String>().join(' ').toLowerCase();
    return text.contains('tiktok') ||
        text.contains('/shorts/') ||
        RegExp(
          r'(^|\s|#)(shorts|쇼츠)(\s|#|$)',
          caseSensitive: false,
        ).hasMatch(text) ||
        (seconds > 0 && seconds <= 60);
  }

  factory ReferenceVideo.fromJson(Map<String, dynamic> json) {
    return ReferenceVideo(
      id: '${json['id'] ?? ''}',
      title: '${json['title'] ?? ''}',
      source: '${json['source'] ?? 'YOUCHI DB'}',
      channel: json['channel']?.toString(),
      category: json['category']?.toString(),
      image: '${json['image'] ?? ''}',
      originUrl: json['originUrl']?.toString(),
      videoType: json['videoType']?.toString(),
      videoUrl: json['videoUrl']?.toString(),
      duration: '${json['duration'] ?? ''}',
      seconds: _intOf(json['seconds']),
      year: json['year'] == null ? null : _intOf(json['year']),
      match: _intOf(json['match']),
      hasEvidence: json['hasEvidence'] != false,
      reason: '${json['reason'] ?? ''}',
      description: json['description']?.toString(),
      keywords: _stringList(json['keywords']),
      matchedTerms: _stringList(json['matchedTerms']),
      savedAt: json['savedAt']?.toString(),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'title': title,
      'source': source,
      'channel': channel,
      'category': category,
      'image': image,
      'originUrl': originUrl,
      'videoType': videoType,
      'videoUrl': videoUrl,
      'duration': duration,
      'seconds': seconds,
      'year': year,
      'match': match,
      'hasEvidence': hasEvidence,
      'reason': reason,
      'description': description,
      'keywords': keywords,
      'matchedTerms': matchedTerms,
      'savedAt': savedAt,
    };
  }

  ReferenceVideo savedCopy() {
    return ReferenceVideo(
      id: id,
      title: title,
      source: source,
      channel: channel,
      category: category,
      image: image,
      originUrl: originUrl,
      videoType: videoType,
      videoUrl: videoUrl,
      duration: duration,
      seconds: seconds,
      year: year,
      match: match,
      hasEvidence: hasEvidence,
      reason: reason,
      description: description,
      keywords: keywords,
      matchedTerms: matchedTerms,
      savedAt: DateTime.now().toIso8601String(),
    );
  }

  static int _intOf(dynamic value) {
    if (value is int) return value;
    if (value is num) return value.round();
    return int.tryParse('$value') ?? 0;
  }

  static List<String> _stringList(dynamic value) {
    if (value is List) return value.map((item) => '$item').toList();
    return const [];
  }
}
