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
  final bool isGenerating;

  StoryboardCut copyWith({
    String? imageUrl,
    String? revisedPrompt,
    bool? imageApproved,
    bool? videoApproved,
    int? videoVersion,
    bool? isGenerating,
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
      videoApproved: videoApproved ?? this.videoApproved,
      videoVersion: videoVersion ?? this.videoVersion,
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
    };
  }
}
