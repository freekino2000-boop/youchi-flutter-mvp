enum VideoStatus { idle, generating, generated, failed }

class StoryboardCut {
  StoryboardCut({
    required this.id,
    required this.number,
    required this.role,
    required this.title,
    required this.scene,
    required this.motion,
    required this.ratio,
    required this.imagePrompt,
    this.imageUrl,
    this.revisedPrompt,
    this.imageApproved = false,
    this.videoApproved = false,
    this.videoVersion = 0,
    this.videoUrl,
    this.videoDurationSeconds,
    this.videoStatus = VideoStatus.idle,
    this.isGenerating = false,
  });

  final String id;
  final int number;
  final String role;
  final String title;
  final String scene;
  final String motion;
  final String ratio;
  final String imagePrompt;
  final String? imageUrl;
  final String? revisedPrompt;
  final bool imageApproved;
  final bool videoApproved;
  final int videoVersion;
  final String? videoUrl;
  final int? videoDurationSeconds;
  final VideoStatus videoStatus;
  final bool isGenerating;

  StoryboardCut copyWith({
    String? imageUrl,
    String? revisedPrompt,
    bool? imageApproved,
    bool? videoApproved,
    int? videoVersion,
    String? videoUrl,
    int? videoDurationSeconds,
    VideoStatus? videoStatus,
    bool? isGenerating,
    bool clearVideo = false,
  }) {
    return StoryboardCut(
      id: id,
      number: number,
      role: role,
      title: title,
      scene: scene,
      motion: motion,
      ratio: ratio,
      imagePrompt: imagePrompt,
      imageUrl: imageUrl ?? this.imageUrl,
      revisedPrompt: revisedPrompt ?? this.revisedPrompt,
      imageApproved: imageApproved ?? this.imageApproved,
      videoApproved: clearVideo ? false : (videoApproved ?? this.videoApproved),
      videoVersion: clearVideo ? 0 : (videoVersion ?? this.videoVersion),
      videoUrl: clearVideo ? null : (videoUrl ?? this.videoUrl),
      videoDurationSeconds: clearVideo
          ? null
          : (videoDurationSeconds ?? this.videoDurationSeconds),
      videoStatus: clearVideo ? VideoStatus.idle : (videoStatus ?? this.videoStatus),
      isGenerating: isGenerating ?? this.isGenerating,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'number': number,
      'role': role,
      'title': title,
      'scene': scene,
      'motion': motion,
      'ratio': ratio,
      'imagePrompt': imagePrompt,
      'imageUrl': imageUrl,
      'videoUrl': videoUrl,
      'videoDurationSeconds': videoDurationSeconds,
    };
  }
}
