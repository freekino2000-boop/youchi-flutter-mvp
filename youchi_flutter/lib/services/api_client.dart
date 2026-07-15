import 'dart:convert';

import 'package:http/http.dart' as http;

import '../core/constants.dart';
import '../models/keyword_insight.dart';
import '../models/reference_video.dart';
import '../models/storyboard_cut.dart';

class SearchResult {
  SearchResult({
    required this.results,
    required this.intent,
    required this.queryTerms,
    required this.insight,
  });

  final List<ReferenceVideo> results;
  final List<String> intent;
  final List<String> queryTerms;
  final KeywordInsight insight;
}

class GeneratedImage {
  GeneratedImage({
    required this.cutId,
    required this.imageUrl,
    this.revisedPrompt,
  });

  final String cutId;
  final String imageUrl;
  final String? revisedPrompt;

  factory GeneratedImage.fromJson(Map<String, dynamic> json) {
    return GeneratedImage(
      cutId: '${json['cutId'] ?? ''}',
      imageUrl: '${json['imageUrl'] ?? ''}',
      revisedPrompt: json['revisedPrompt']?.toString(),
    );
  }
}

class GeneratedVideo {
  GeneratedVideo({
    required this.cutId,
    required this.videoUrl,
    this.durationSeconds,
  });

  final String cutId;
  final String videoUrl;
  final int? durationSeconds;

  factory GeneratedVideo.fromJson(Map<String, dynamic> json) {
    return GeneratedVideo(
      cutId: '${json['cutId'] ?? ''}',
      videoUrl: '${json['videoUrl'] ?? ''}',
      durationSeconds: (json['durationSeconds'] as num?)?.toInt(),
    );
  }
}

class FinalRenderOutput {
  FinalRenderOutput({
    required this.name,
    required this.videoUrl,
    required this.duration,
    required this.cutCount,
    required this.status,
  });

  final String name;
  final String videoUrl;
  final String duration;
  final int cutCount;
  final String status;

  factory FinalRenderOutput.fromJson(Map<String, dynamic> json) {
    return FinalRenderOutput(
      name: '${json['name'] ?? ''}',
      videoUrl: '${json['videoUrl'] ?? ''}',
      duration: '${json['duration'] ?? ''}',
      cutCount: (json['cutCount'] as num?)?.toInt() ?? 0,
      status: '${json['status'] ?? ''}',
    );
  }
}

String resolveYouchiUrl(String baseUrl, String? path) {
  if (path == null || path.isEmpty) return '';
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  return '$baseUrl$path';
}

class YouchiApiClient {
  YouchiApiClient({this.baseUrl = AppConstants.apiBase});

  final String baseUrl;

  Future<SearchResult> search(String query, {int limit = 120}) async {
    final uri = Uri.parse(
      '$baseUrl/api/search',
    ).replace(queryParameters: {'q': query, 'limit': '$limit'});
    final response = await http.get(uri);
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw Exception('YOUCHI DB 검색 API 오류 ${response.statusCode}');
    }
    final payload = jsonDecode(response.body) as Map<String, dynamic>;
    final rawResults = payload['results'];
    final results = rawResults is List
        ? rawResults
              .whereType<Map<String, dynamic>>()
              .map(ReferenceVideo.fromJson)
              .toList()
        : <ReferenceVideo>[];
    return SearchResult(
      results: results,
      intent: _stringList(payload['intent']),
      queryTerms: _stringList(payload['queryTerms']),
      insight: KeywordInsight.fromJson(
        payload['insights'] is Map<String, dynamic>
            ? payload['insights'] as Map<String, dynamic>
            : null,
      ),
    );
  }

  Future<List<GeneratedImage>> createImages({
    required String query,
    required String ratio,
    required ReferenceVideo reference,
    required List<StoryboardCut> cuts,
  }) async {
    final response = await http.post(
      Uri.parse('$baseUrl/api/creative/images'),
      headers: {'content-type': 'application/json'},
      body: jsonEncode({
        'query': query,
        'ratio': ratio,
        'reference': reference.toJson(),
        'cuts': cuts.map((cut) => cut.toJson()).toList(),
      }),
    );
    final payload = jsonDecode(response.body) as Map<String, dynamic>;
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw Exception(payload['message'] ?? '이미지 생성 실패');
    }
    final images = payload['images'];
    if (images is! List) return const [];
    return images
        .whereType<Map<String, dynamic>>()
        .map(GeneratedImage.fromJson)
        .toList();
  }

  Future<GeneratedImage> createImage({
    required String query,
    required String ratio,
    required ReferenceVideo reference,
    required StoryboardCut cut,
  }) async {
    final response = await http.post(
      Uri.parse('$baseUrl/api/creative/image'),
      headers: {'content-type': 'application/json'},
      body: jsonEncode({
        'query': query,
        'ratio': ratio,
        'reference': reference.toJson(),
        'cut': cut.toJson(),
      }),
    );
    final payload = jsonDecode(response.body) as Map<String, dynamic>;
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw Exception(payload['message'] ?? '이미지 재생성 실패');
    }
    return GeneratedImage.fromJson(
      payload['image'] is Map<String, dynamic>
          ? payload['image'] as Map<String, dynamic>
          : const {},
    );
  }

  Future<List<GeneratedVideo>> createVideos({
    required String query,
    required String ratio,
    required ReferenceVideo reference,
    required List<StoryboardCut> cuts,
  }) async {
    final response = await http.post(
      Uri.parse('$baseUrl/api/creative/videos'),
      headers: {'content-type': 'application/json'},
      body: jsonEncode({
        'query': query,
        'ratio': ratio,
        'reference': reference.toJson(),
        'cuts': cuts.map((cut) => cut.toJson()).toList(),
      }),
    );
    final payload = jsonDecode(response.body) as Map<String, dynamic>;
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw Exception(payload['message'] ?? '영상 생성 실패');
    }
    final videos = payload['videos'];
    if (videos is! List) return const [];
    return videos
        .whereType<Map<String, dynamic>>()
        .map(GeneratedVideo.fromJson)
        .toList();
  }

  Future<GeneratedVideo> createVideo({
    required String query,
    required String ratio,
    required ReferenceVideo reference,
    required StoryboardCut cut,
  }) async {
    final response = await http.post(
      Uri.parse('$baseUrl/api/creative/video'),
      headers: {'content-type': 'application/json'},
      body: jsonEncode({
        'query': query,
        'ratio': ratio,
        'reference': reference.toJson(),
        'cut': cut.toJson(),
      }),
    );
    final payload = jsonDecode(response.body) as Map<String, dynamic>;
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw Exception(payload['message'] ?? '영상 재생성 실패');
    }
    return GeneratedVideo.fromJson(
      payload['video'] is Map<String, dynamic>
          ? payload['video'] as Map<String, dynamic>
          : const {},
    );
  }

  Future<FinalRenderOutput> renderFinal({
    required String query,
    required String ratio,
    required List<StoryboardCut> cuts,
  }) async {
    final response = await http.post(
      Uri.parse('$baseUrl/api/creative/render'),
      headers: {'content-type': 'application/json'},
      body: jsonEncode({
        'query': query,
        'ratio': ratio,
        'cuts': cuts.map((cut) => cut.toJson()).toList(),
      }),
    );
    final payload = jsonDecode(response.body) as Map<String, dynamic>;
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw Exception(payload['message'] ?? '최종 렌더링 실패');
    }
    return FinalRenderOutput.fromJson(
      payload['finalOutput'] is Map<String, dynamic>
          ? payload['finalOutput'] as Map<String, dynamic>
          : const {},
    );
  }

  static List<String> _stringList(dynamic value) {
    if (value is List) return value.map((item) => '$item').toList();
    return const [];
  }
}
