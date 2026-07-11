import 'dart:convert';

import 'package:shared_preferences/shared_preferences.dart';

import '../core/constants.dart';
import '../models/reference_video.dart';

class SavedBoardStore {
  Future<List<ReferenceVideo>> load() async {
    final preferences = await SharedPreferences.getInstance();
    final raw = preferences.getString(AppConstants.savedBoardKey);
    if (raw == null || raw.isEmpty) return [];
    try {
      final decoded = jsonDecode(raw);
      if (decoded is! List) return [];
      return decoded
          .whereType<Map<String, dynamic>>()
          .map(ReferenceVideo.fromJson)
          .where((video) => video.id.isNotEmpty)
          .toList();
    } catch (_) {
      return [];
    }
  }

  Future<void> save(List<ReferenceVideo> videos) async {
    final preferences = await SharedPreferences.getInstance();
    await preferences.setString(
      AppConstants.savedBoardKey,
      jsonEncode(videos.map((video) => video.toJson()).toList()),
    );
  }
}
