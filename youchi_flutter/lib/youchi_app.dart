import 'dart:math';

import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

import 'core/constants.dart';
import 'core/youchi_theme.dart';
import 'models/keyword_insight.dart';
import 'models/reference_video.dart';
import 'models/storyboard_cut.dart';
import 'services/api_client.dart';
import 'services/saved_board_store.dart';

enum YouchiMode { home, search, saved }

enum SortType { related, latest, duration }

enum ContentFormat { long, shorts }

class YouchiApp extends StatelessWidget {
  const YouchiApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      debugShowCheckedModeBanner: false,
      title: 'YOUCHI',
      theme: youchiTheme(),
      home: const YouchiShell(),
    );
  }
}

class YouchiShell extends StatefulWidget {
  const YouchiShell({super.key});

  @override
  State<YouchiShell> createState() => _YouchiShellState();
}

class _YouchiShellState extends State<YouchiShell> {
  final _queryController = TextEditingController();
  final _api = YouchiApiClient();
  final _savedStore = SavedBoardStore();

  YouchiMode _mode = YouchiMode.home;
  SortType _sort = SortType.related;
  ContentFormat _contentFormat = ContentFormat.long;
  String _submittedQuery = '';
  bool _loading = false;
  String _error = '';
  List<ReferenceVideo> _results = [];
  List<ReferenceVideo> _saved = [];
  List<String> _intent = [];
  List<String> _queryTerms = [];
  List<String> _suggestions = [];
  KeywordInsight? _insight;
  ReferenceVideo? _selected;

  bool get _isSavedMode => _mode == YouchiMode.saved;
  bool get _hasSearched => _mode != YouchiMode.home;

  @override
  void initState() {
    super.initState();
    _suggestions = _randomSuggestions();
    _loadSaved();
  }

  @override
  void dispose() {
    _queryController.dispose();
    super.dispose();
  }

  Future<void> _loadSaved() async {
    final saved = await _savedStore.load();
    if (!mounted) return;
    setState(() => _saved = saved);
  }

  Future<void> _persistSaved() async {
    await _savedStore.save(_saved);
  }

  List<String> _randomSuggestions() {
    final items = [...AppConstants.suggestionKeywords];
    items.shuffle(Random());
    return items.take(4).toList();
  }

  Future<void> _submitSearch([String? overrideQuery]) async {
    final query = (overrideQuery ?? _queryController.text).trim();
    if (query.isEmpty) return;
    setState(() {
      _loading = true;
      _error = '';
      _mode = YouchiMode.search;
      _submittedQuery = query;
      _selected = null;
      _sort = SortType.related;
      _contentFormat = ContentFormat.long;
    });
    try {
      final response = await _api.search(query);
      if (!mounted) return;
      setState(() {
        _results = response.results;
        _intent = response.intent;
        _queryTerms = response.queryTerms;
        _insight = response.insight;
      });
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _error = '$error';
        _results = [];
        _intent = [];
        _queryTerms = [];
        _insight = KeywordInsight.fromJson({
          'provider': 'YOUCHI 로컬',
          'status': 'API 연결 필요',
          'headline': '$query 검색',
          'summary': 'YOUCHI DB API 서버를 먼저 실행해주세요.',
          'keywords': [query],
          'angles': ['레퍼런스 영상 검색'],
          'avoid': ['API 서버 미실행'],
          'fromGrok': false,
        });
      });
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  void _goHome() {
    setState(() {
      _mode = YouchiMode.home;
      _queryController.clear();
      _submittedQuery = '';
      _selected = null;
      _error = '';
      _sort = SortType.related;
      _contentFormat = ContentFormat.long;
      _intent = [];
      _queryTerms = [];
      _insight = null;
    });
  }

  void _showSavedBoard() {
    setState(() {
      _mode = YouchiMode.saved;
      _selected = null;
      _error = '';
      _sort = SortType.related;
      _contentFormat = ContentFormat.long;
    });
  }

  Future<void> _toggleSaved(ReferenceVideo reference) async {
    setState(() {
      final exists = _saved.any((item) => item.id == reference.id);
      if (exists) {
        _saved = _saved.where((item) => item.id != reference.id).toList();
      } else {
        _saved = [reference.savedCopy(), ..._saved];
      }
    });
    await _persistSaved();
  }

  List<ReferenceVideo> _visibleVideos() {
    final videos = [
      ...(_isSavedMode
          ? _saved
          : _results.where(
              (video) => _contentFormat == ContentFormat.shorts
                  ? video.isShortForm
                  : !video.isShortForm,
            )),
    ];
    switch (_sort) {
      case SortType.latest:
        videos.sort((a, b) => (b.year ?? 0).compareTo(a.year ?? 0));
      case SortType.duration:
        videos.sort((a, b) => a.seconds.compareTo(b.seconds));
      case SortType.related:
        if (_isSavedMode) {
          videos.sort((a, b) => (b.savedAt ?? '').compareTo(a.savedAt ?? ''));
        } else {
          videos.sort((a, b) => b.match.compareTo(a.match));
        }
    }
    return videos;
  }

  Map<ContentFormat, int> _formatCounts() {
    if (_isSavedMode) {
      return {ContentFormat.long: 0, ContentFormat.shorts: 0};
    }
    return {
      ContentFormat.long: _results.where((video) => !video.isShortForm).length,
      ContentFormat.shorts: _results.where((video) => video.isShortForm).length,
    };
  }

  @override
  Widget build(BuildContext context) {
    final videos = _visibleVideos();
    final width = MediaQuery.sizeOf(context).width;
    final isMobile = width < 760;
    return Scaffold(
      body: Stack(
        children: [
          const _BackgroundGlow(),
          SafeArea(
            child: Column(
              children: [
                _TopBar(
                  savedCount: _saved.length,
                  isSaved: _isSavedMode,
                  onHome: _goHome,
                  onSaved: _showSavedBoard,
                ),
                Expanded(
                  child: _mode == YouchiMode.home
                      ? _HomeView(
                          controller: _queryController,
                          loading: _loading,
                          suggestions: _suggestions,
                          onSubmit: _submitSearch,
                        )
                      : _ResultsView(
                          mode: _mode,
                          query: _submittedQuery,
                          controller: _queryController,
                          loading: _loading,
                          videos: videos,
                          savedIds: _saved.map((item) => item.id).toSet(),
                          selected: _selected,
                          insight: _insight,
                          intent: _intent,
                          queryTerms: _queryTerms,
                          sort: _sort,
                          contentFormat: _contentFormat,
                          formatCounts: _formatCounts(),
                          error: _error,
                          isMobile: isMobile,
                          api: _api,
                          onSort: (sort) => setState(() => _sort = sort),
                          onContentFormat: (format) => setState(() {
                            _contentFormat = format;
                            _selected = null;
                          }),
                          onSubmit: _submitSearch,
                          onSelect: (video) =>
                              setState(() => _selected = video),
                          onToggleSaved: _toggleSaved,
                          onHome: _goHome,
                          onKeyword: (keyword) {
                            final current = _queryController.text.trim();
                            _queryController.text = current.isEmpty
                                ? keyword
                                : '$current, $keyword';
                          },
                        ),
                ),
              ],
            ),
          ),
          if (_loading)
            Positioned(
              left: 0,
              right: 0,
              bottom: 24,
              child: Center(
                child: Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 16,
                    vertical: 11,
                  ),
                  decoration: glassDecoration(radius: 999),
                  child: const Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      SizedBox(
                        width: 16,
                        height: 16,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      ),
                      SizedBox(width: 10),
                      Text('YOUCHI DB에서 의미가 가까운 레퍼런스를 찾는 중…'),
                    ],
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }
}

class _BackgroundGlow extends StatelessWidget {
  const _BackgroundGlow();

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: const BoxDecoration(
        color: YouchiColors.bg,
        gradient: RadialGradient(
          center: Alignment(0, -0.15),
          radius: 0.9,
          colors: [Color(0x228B5CF6), YouchiColors.bg],
        ),
      ),
    );
  }
}

class _TopBar extends StatelessWidget {
  const _TopBar({
    required this.savedCount,
    required this.isSaved,
    required this.onHome,
    required this.onSaved,
  });

  final int savedCount;
  final bool isSaved;
  final VoidCallback onHome;
  final VoidCallback onSaved;

  @override
  Widget build(BuildContext context) {
    return Container(
      height: 64,
      padding: const EdgeInsets.symmetric(horizontal: 24),
      decoration: BoxDecoration(
        color: isSaved ? const Color(0x33131315) : Colors.transparent,
        border: const Border(bottom: BorderSide(color: YouchiColors.line)),
      ),
      child: Row(
        children: [
          TextButton(
            onPressed: onHome,
            child: const Text(
              'YOUCHI',
              style: TextStyle(
                color: YouchiColors.accentBright,
                fontSize: 18,
                fontWeight: FontWeight.w800,
              ),
            ),
          ),
          const Spacer(),
          TextButton(onPressed: onHome, child: const Text('홈으로')),
          const SizedBox(width: 14),
          TextButton.icon(
            onPressed: onSaved,
            icon: Icon(
              isSaved ? Icons.bookmark : Icons.bookmark_border,
              size: 19,
            ),
            label: Text('저장된 보드 ${savedCount > 0 ? savedCount : ''}'),
          ),
        ],
      ),
    );
  }
}

class _HomeView extends StatelessWidget {
  const _HomeView({
    required this.controller,
    required this.loading,
    required this.suggestions,
    required this.onSubmit,
  });

  final TextEditingController controller;
  final bool loading;
  final List<String> suggestions;
  final Future<void> Function([String? query]) onSubmit;

  @override
  Widget build(BuildContext context) {
    final isMobile = MediaQuery.sizeOf(context).width < 760;
    return SingleChildScrollView(
      padding: EdgeInsets.fromLTRB(
        isMobile ? 18 : 32,
        isMobile ? 44 : 86,
        isMobile ? 18 : 32,
        36,
      ),
      child: Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 960),
          child: Column(
            children: [
              Text(
                'AI Ad Conceptor',
                textAlign: TextAlign.center,
                style: Theme.of(context).textTheme.displayLarge?.copyWith(
                  fontSize: isMobile ? 54 : null,
                ),
              ),
              const SizedBox(height: 20),
              const Text(
                '단 한 줄의 키워드로 브랜드 스토리와 광고 소재를 즉시 시각화 하세요.',
                textAlign: TextAlign.center,
                style: TextStyle(
                  color: YouchiColors.muted,
                  fontSize: 18,
                  height: 1.65,
                ),
              ),
              const SizedBox(height: 42),
              _PromptCard(
                controller: controller,
                loading: loading,
                compact: false,
                onSubmit: onSubmit,
              ),
              const SizedBox(height: 34),
              Wrap(
                spacing: 10,
                runSpacing: 10,
                alignment: WrapAlignment.center,
                crossAxisAlignment: WrapCrossAlignment.center,
                children: [
                  const Text(
                    '추천 소재:',
                    style: TextStyle(color: YouchiColors.faint),
                  ),
                  for (final keyword in suggestions)
                    _ChipButton(
                      label: keyword,
                      onTap: () {
                        controller.text = keyword;
                        onSubmit(keyword);
                      },
                    ),
                ],
              ),
              const SizedBox(height: 58),
              const Text(
                '© 2026 YOUCHI AI Creative Suite. All rights reserved.',
                style: TextStyle(color: YouchiColors.faint),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _PromptCard extends StatelessWidget {
  const _PromptCard({
    required this.controller,
    required this.loading,
    required this.compact,
    required this.onSubmit,
  });

  final TextEditingController controller;
  final bool loading;
  final bool compact;
  final Future<void> Function([String? query]) onSubmit;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: EdgeInsets.all(compact ? 16 : 32),
      decoration: compact
          ? BoxDecoration(
              color: const Color(0x6B000000),
              borderRadius: BorderRadius.circular(24),
              border: Border.all(color: const Color(0x3DD0BCFF)),
              boxShadow: const [
                BoxShadow(
                  color: Color(0x55000000),
                  blurRadius: 42,
                  offset: Offset(0, 18),
                ),
              ],
            )
          : glassDecoration(radius: 24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(
                Icons.auto_awesome,
                color: YouchiColors.accentBright,
                size: 16,
              ),
              const SizedBox(width: 8),
              Text(
                compact ? 'SEARCH KEYWORD' : 'NEW GENERATION AI',
                style: const TextStyle(
                  color: YouchiColors.accentBright,
                  fontSize: 12,
                  letterSpacing: 1.2,
                  fontWeight: FontWeight.w800,
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),
          Row(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Expanded(
                child: TextField(
                  controller: controller,
                  minLines: compact ? 1 : 3,
                  maxLines: compact ? 2 : 4,
                  onSubmitted: (_) => onSubmit(),
                  style: TextStyle(
                    color: Colors.white,
                    fontSize: compact ? 16 : 20,
                    height: 1.45,
                  ),
                  decoration: InputDecoration(
                    border: InputBorder.none,
                    hintText: compact
                        ? '키워드를 입력해 주세요'
                        : '키워드를 입력해 주세요\n예: 도심 속의 시원한 수제 맥주, 미니멀한 라이프스타일 가구',
                    hintStyle: const TextStyle(color: Color(0x80CBC3D7)),
                  ),
                ),
              ),
              const SizedBox(width: 16),
              DecoratedBox(
                decoration: BoxDecoration(
                  gradient: youchiPurpleGradient(),
                  borderRadius: BorderRadius.circular(compact ? 12 : 14),
                ),
                child: ElevatedButton.icon(
                  style: ElevatedButton.styleFrom(
                    elevation: 0,
                    backgroundColor: Colors.transparent,
                    shadowColor: Colors.transparent,
                    foregroundColor: Colors.white,
                    minimumSize: Size(compact ? 116 : 148, compact ? 48 : 56),
                  ),
                  onPressed: loading ? null : () => onSubmit(),
                  icon: loading
                      ? const SizedBox(
                          width: 16,
                          height: 16,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : const Icon(Icons.arrow_forward),
                  label: Text(compact ? '검색' : '생성하기'),
                ),
              ),
            ],
          ),
          if (!compact) ...[
            const Divider(height: 34, color: YouchiColors.line),
            const Wrap(
              spacing: 10,
              children: [_SoftPill('옵션 설정'), _SoftPill('한국어')],
            ),
          ],
        ],
      ),
    );
  }
}

class _ResultsView extends StatelessWidget {
  const _ResultsView({
    required this.mode,
    required this.query,
    required this.controller,
    required this.loading,
    required this.videos,
    required this.savedIds,
    required this.selected,
    required this.insight,
    required this.intent,
    required this.queryTerms,
    required this.sort,
    required this.contentFormat,
    required this.formatCounts,
    required this.error,
    required this.isMobile,
    required this.api,
    required this.onSort,
    required this.onContentFormat,
    required this.onSubmit,
    required this.onSelect,
    required this.onToggleSaved,
    required this.onHome,
    required this.onKeyword,
  });

  final YouchiMode mode;
  final String query;
  final TextEditingController controller;
  final bool loading;
  final List<ReferenceVideo> videos;
  final Set<String> savedIds;
  final ReferenceVideo? selected;
  final KeywordInsight? insight;
  final List<String> intent;
  final List<String> queryTerms;
  final SortType sort;
  final ContentFormat contentFormat;
  final Map<ContentFormat, int> formatCounts;
  final String error;
  final bool isMobile;
  final YouchiApiClient api;
  final ValueChanged<SortType> onSort;
  final ValueChanged<ContentFormat> onContentFormat;
  final Future<void> Function([String? query]) onSubmit;
  final ValueChanged<ReferenceVideo> onSelect;
  final ValueChanged<ReferenceVideo> onToggleSaved;
  final VoidCallback onHome;
  final ValueChanged<String> onKeyword;

  bool get isSaved => mode == YouchiMode.saved;

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      child: Column(
        children: [
          if (!isSaved)
            Padding(
              padding: const EdgeInsets.fromLTRB(24, 18, 24, 0),
              child: Column(
                children: [
                  _PromptCard(
                    controller: controller,
                    loading: loading,
                    compact: true,
                    onSubmit: onSubmit,
                  ),
                  const SizedBox(height: 14),
                  _AnalysisChips(
                    intent: intent,
                    queryTerms: queryTerms,
                    onKeyword: onKeyword,
                  ),
                ],
              ),
            ),
          Padding(
            padding: EdgeInsets.fromLTRB(
              isMobile ? 16 : 28,
              22,
              isMobile ? 16 : 0,
              38,
            ),
            child: isSaved || isMobile
                ? Column(
                    children: [
                      _ReferenceSection(
                        isSaved: isSaved,
                        query: query,
                        videos: videos,
                        savedIds: savedIds,
                        selected: selected,
                        sort: sort,
                        contentFormat: contentFormat,
                        formatCounts: formatCounts,
                        error: error,
                        onSort: onSort,
                        onContentFormat: onContentFormat,
                        onSelect: onSelect,
                        onToggleSaved: onToggleSaved,
                        onHome: onHome,
                      ),
                      if (!isSaved) ...[
                        const SizedBox(height: 24),
                        _KeywordPanel(
                          query: query,
                          insight: insight,
                          selected: selected,
                          api: api,
                          onKeyword: onKeyword,
                        ),
                      ],
                    ],
                  )
                : Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Expanded(
                        child: _ReferenceSection(
                          isSaved: false,
                          query: query,
                          videos: videos,
                          savedIds: savedIds,
                          selected: selected,
                          sort: sort,
                          contentFormat: contentFormat,
                          formatCounts: formatCounts,
                          error: error,
                          onSort: onSort,
                          onContentFormat: onContentFormat,
                          onSelect: onSelect,
                          onToggleSaved: onToggleSaved,
                          onHome: onHome,
                        ),
                      ),
                      const SizedBox(width: 28),
                      SizedBox(
                        width: 340,
                        child: _KeywordPanel(
                          query: query,
                          insight: insight,
                          selected: selected,
                          api: api,
                          onKeyword: onKeyword,
                        ),
                      ),
                    ],
                  ),
          ),
        ],
      ),
    );
  }
}

class _AnalysisChips extends StatelessWidget {
  const _AnalysisChips({
    required this.intent,
    required this.queryTerms,
    required this.onKeyword,
  });

  final List<String> intent;
  final List<String> queryTerms;
  final ValueChanged<String> onKeyword;

  @override
  Widget build(BuildContext context) {
    if (intent.isEmpty && queryTerms.isEmpty) return const SizedBox.shrink();
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(14),
      decoration: glassDecoration(radius: 16, color: const Color(0x33000000)),
      child: Wrap(
        spacing: 8,
        runSpacing: 8,
        crossAxisAlignment: WrapCrossAlignment.center,
        children: [
          if (intent.isNotEmpty)
            const Text('의도 파악', style: TextStyle(color: YouchiColors.faint)),
          for (final item in intent)
            _ChipButton(label: item, onTap: () => onKeyword(item)),
          if (queryTerms.isNotEmpty)
            const Padding(
              padding: EdgeInsets.only(left: 8),
              child: Text('검색 조합', style: TextStyle(color: YouchiColors.faint)),
            ),
          for (final item in queryTerms.take(12))
            _ChipButton(label: item, onTap: () => onKeyword(item)),
        ],
      ),
    );
  }
}

class _ReferenceSection extends StatelessWidget {
  const _ReferenceSection({
    required this.isSaved,
    required this.query,
    required this.videos,
    required this.savedIds,
    required this.selected,
    required this.sort,
    required this.contentFormat,
    required this.formatCounts,
    required this.error,
    required this.onSort,
    required this.onContentFormat,
    required this.onSelect,
    required this.onToggleSaved,
    required this.onHome,
  });

  final bool isSaved;
  final String query;
  final List<ReferenceVideo> videos;
  final Set<String> savedIds;
  final ReferenceVideo? selected;
  final SortType sort;
  final ContentFormat contentFormat;
  final Map<ContentFormat, int> formatCounts;
  final String error;
  final ValueChanged<SortType> onSort;
  final ValueChanged<ContentFormat> onContentFormat;
  final ValueChanged<ReferenceVideo> onSelect;
  final ValueChanged<ReferenceVideo> onToggleSaved;
  final VoidCallback onHome;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _ResultsHeader(
          isSaved: isSaved,
          title: isSaved ? '저장된 보드' : query,
          count: videos.length,
          sort: sort,
          contentFormat: contentFormat,
          formatCounts: formatCounts,
          onSort: onSort,
          onContentFormat: onContentFormat,
        ),
        const SizedBox(height: 22),
        if (videos.isEmpty)
          _EmptyState(
            title: isSaved ? '저장된 영상이 아직 없습니다' : '검색 결과가 없습니다',
            message: error.isNotEmpty
                ? error
                : isSaved
                ? '마음에 드는 레퍼런스를 열고 보드에 저장해보세요.'
                : '현재 인덱스에 해당 카테고리의 실제 레퍼런스가 없습니다.',
            actionLabel: isSaved ? '홈으로' : null,
            onAction: isSaved ? onHome : null,
          )
        else
          LayoutBuilder(
            builder: (context, constraints) {
              final width = constraints.maxWidth;
              final crossAxisCount = width > 1180
                  ? (isSaved ? 4 : 3)
                  : width > 760
                  ? 2
                  : 1;
              return GridView.builder(
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                itemCount: videos.length,
                gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
                  crossAxisCount: crossAxisCount,
                  mainAxisSpacing: 22,
                  crossAxisSpacing: 18,
                  childAspectRatio: isSaved ? 0.86 : 0.92,
                ),
                itemBuilder: (context, index) {
                  final video = videos[index];
                  return _ReferenceCard(
                    video: video,
                    selected: selected?.id == video.id,
                    saved: savedIds.contains(video.id),
                    boardCard: isSaved,
                    onTap: () => onSelect(video),
                    onSaved: () => onToggleSaved(video),
                  );
                },
              );
            },
          ),
      ],
    );
  }
}

class _ResultsHeader extends StatelessWidget {
  const _ResultsHeader({
    required this.isSaved,
    required this.title,
    required this.count,
    required this.sort,
    required this.contentFormat,
    required this.formatCounts,
    required this.onSort,
    required this.onContentFormat,
  });

  final bool isSaved;
  final String title;
  final int count;
  final SortType sort;
  final ContentFormat contentFormat;
  final Map<ContentFormat, int> formatCounts;
  final ValueChanged<SortType> onSort;
  final ValueChanged<ContentFormat> onContentFormat;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.only(bottom: 20),
      decoration: const BoxDecoration(
        border: Border(bottom: BorderSide(color: YouchiColors.line)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.end,
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  isSaved ? 'SAVED BOARD' : 'REFERENCE SEARCH',
                  style: const TextStyle(
                    color: YouchiColors.accentBright,
                    fontSize: 11,
                    fontWeight: FontWeight.w900,
                    letterSpacing: 1.4,
                  ),
                ),
                const SizedBox(height: 10),
                Text(
                  title.isEmpty ? '검색 결과' : title,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: Theme.of(context).textTheme.headlineLarge,
                ),
                const SizedBox(height: 12),
                Wrap(
                  spacing: 10,
                  runSpacing: 8,
                  crossAxisAlignment: WrapCrossAlignment.center,
                  children: [
                    Text(
                      isSaved
                          ? '저장해 둔 레퍼런스 영상만 모아 보여줍니다.'
                          : 'YOUCHI DB에서 의미가 가까운 영상 레퍼런스를 정렬했습니다.',
                      style: const TextStyle(color: YouchiColors.faint),
                    ),
                    _CountBadge('$count개'),
                  ],
                ),
              ],
            ),
          ),
          const SizedBox(width: 18),
          if (!isSaved) ...[
            _FormatToggle(
              value: contentFormat,
              counts: formatCounts,
              onChanged: onContentFormat,
            ),
            const SizedBox(width: 12),
          ],
          DropdownButton<SortType>(
            value: sort,
            dropdownColor: const Color(0xFF151316),
            borderRadius: BorderRadius.circular(12),
            items: const [
              DropdownMenuItem(value: SortType.related, child: Text('관련도순')),
              DropdownMenuItem(value: SortType.latest, child: Text('최신순')),
              DropdownMenuItem(value: SortType.duration, child: Text('짧은 영상순')),
            ],
            onChanged: (value) {
              if (value != null) onSort(value);
            },
          ),
        ],
      ),
    );
  }
}

class _FormatToggle extends StatelessWidget {
  const _FormatToggle({
    required this.value,
    required this.counts,
    required this.onChanged,
  });

  final ContentFormat value;
  final Map<ContentFormat, int> counts;
  final ValueChanged<ContentFormat> onChanged;

  String _label(ContentFormat format) {
    return switch (format) {
      ContentFormat.long => '롱폼',
      ContentFormat.shorts => '숏츠',
    };
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(4),
      decoration: BoxDecoration(
        color: const Color(0x44000000),
        border: Border.all(color: YouchiColors.line),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          for (final format in ContentFormat.values) ...[
            _FormatButton(
              label: _label(format),
              count: counts[format] ?? 0,
              selected: value == format,
              onTap: () => onChanged(format),
            ),
            if (format != ContentFormat.values.last) const SizedBox(width: 4),
          ],
        ],
      ),
    );
  }
}

class _FormatButton extends StatelessWidget {
  const _FormatButton({
    required this.label,
    required this.count,
    required this.selected,
    required this.onTap,
  });

  final String label;
  final int count;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(999),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 180),
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 9),
        decoration: BoxDecoration(
          color: selected ? YouchiColors.accent : Colors.transparent,
          borderRadius: BorderRadius.circular(999),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              label,
              maxLines: 1,
              softWrap: false,
              overflow: TextOverflow.visible,
              style: TextStyle(
                color: selected ? Colors.white : YouchiColors.faint,
                fontWeight: FontWeight.w800,
                fontSize: 13,
              ),
            ),
            const SizedBox(width: 6),
            _CountBadge('$count'),
          ],
        ),
      ),
    );
  }
}

class _ReferenceCard extends StatelessWidget {
  const _ReferenceCard({
    required this.video,
    required this.selected,
    required this.saved,
    required this.boardCard,
    required this.onTap,
    required this.onSaved,
  });

  final ReferenceVideo video;
  final bool selected;
  final bool saved;
  final bool boardCard;
  final VoidCallback onTap;
  final VoidCallback onSaved;

  Future<void> _openOrigin() async {
    final rawUrl = video.originUrl;
    if (rawUrl == null || rawUrl.isEmpty) return;
    final uri = Uri.tryParse(rawUrl);
    if (uri == null) return;
    await launchUrl(uri, webOnlyWindowName: '_blank');
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: EdgeInsets.all(boardCard ? 10 : 0),
      decoration: boardCard
          ? glassDecoration(radius: 18, color: const Color(0x33000000))
          : null,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(
            flex: 6,
            child: InkWell(
              onTap: onTap,
              borderRadius: BorderRadius.circular(boardCard ? 14 : 12),
              child: Stack(
                children: [
                  Positioned.fill(
                    child: ClipRRect(
                      borderRadius: BorderRadius.circular(boardCard ? 14 : 12),
                      child: Container(
                        decoration: BoxDecoration(
                          border: Border.all(
                            color: selected
                                ? YouchiColors.accentBright
                                : YouchiColors.line,
                            width: selected ? 2 : 1,
                          ),
                          borderRadius: BorderRadius.circular(
                            boardCard ? 14 : 12,
                          ),
                        ),
                        child: Image.network(
                          video.image,
                          fit: BoxFit.cover,
                          errorBuilder: (_, __, ___) => Container(
                            color: const Color(0xFF111116),
                            child: const Icon(Icons.movie, size: 42),
                          ),
                        ),
                      ),
                    ),
                  ),
                  Positioned.fill(
                    child: DecoratedBox(
                      decoration: BoxDecoration(
                        borderRadius: BorderRadius.circular(
                          boardCard ? 14 : 12,
                        ),
                        gradient: const LinearGradient(
                          begin: Alignment.topCenter,
                          end: Alignment.bottomCenter,
                          colors: [Colors.transparent, Color(0xAA000000)],
                        ),
                      ),
                    ),
                  ),
                  Positioned(
                    right: 10,
                    bottom: 10,
                    child: _CountBadge(video.duration),
                  ),
                  const Center(
                    child: CircleAvatar(
                      backgroundColor: Color(0x33208BFF),
                      child: Icon(Icons.arrow_forward, color: Colors.white),
                    ),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 12),
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: InkWell(
                  onTap: _openOrigin,
                  child: Text(
                    video.title,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      color: Color(0xFFF2EEF8),
                      fontSize: 15,
                      fontWeight: FontWeight.w800,
                      height: 1.35,
                      decoration: TextDecoration.none,
                    ),
                  ),
                ),
              ),
              const SizedBox(width: 8),
              InkWell(
                onTap: _openOrigin,
                borderRadius: BorderRadius.circular(8),
                child: _SourceBadge(video.channel ?? video.source),
              ),
            ],
          ),
          const SizedBox(height: 10),
          OutlinedButton.icon(
            onPressed: onSaved,
            icon: Icon(
              saved ? Icons.bookmark : Icons.bookmark_border,
              size: 16,
            ),
            label: Text(saved ? '저장됨' : '보드 저장'),
            style: OutlinedButton.styleFrom(
              foregroundColor: saved
                  ? YouchiColors.accentBright
                  : YouchiColors.muted,
              side: BorderSide(
                color: saved ? YouchiColors.accent : YouchiColors.line,
              ),
            ),
          ),
          const SizedBox(height: 8),
          Text(
            video.reason,
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
            style: const TextStyle(color: YouchiColors.faint, fontSize: 12),
          ),
          if (video.matchedTerms.isNotEmpty) ...[
            const SizedBox(height: 8),
            Wrap(
              spacing: 6,
              runSpacing: 6,
              children: [
                for (final term in video.matchedTerms.take(4)) _MiniPill(term),
              ],
            ),
          ],
        ],
      ),
    );
  }
}

class _KeywordPanel extends StatelessWidget {
  const _KeywordPanel({
    required this.query,
    required this.insight,
    required this.selected,
    required this.api,
    required this.onKeyword,
  });

  final String query;
  final KeywordInsight? insight;
  final ReferenceVideo? selected;
  final YouchiApiClient api;
  final ValueChanged<String> onKeyword;

  @override
  Widget build(BuildContext context) {
    final data =
        insight ??
        KeywordInsight.fromJson({
          'provider': 'YOUCHI',
          'status': 'SEO 추천',
          'headline': 'SEO 키워드·제목 추천',
          'summary': 'SEO 최적화를 추천합니다. 검색어를 입력하면 구글 검색 노출에 유리한 키워드와 제목이 표시됩니다.',
          'keywords': <String>[],
          'angles': <String>[],
          'avoid': <String>[],
          'fromGrok': false,
        });
    final seoTips = [
      '"$query"처럼 핵심 키워드는 제목 앞쪽에 배치하세요.',
      '제품군, 사용 상황, 기대 효과를 한 문장 안에 함께 넣으면 검색 의도가 더 선명해집니다.',
      '영상 썸네일·제목·설명 첫 문장의 키워드를 같은 방향으로 맞추면 SEO 일관성이 좋아집니다.',
    ];
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: glassDecoration(radius: 0, color: const Color(0x66131315)),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'GOOGLE SEO INSIGHT',
                      style: TextStyle(
                        color: YouchiColors.accentBright,
                        fontSize: 10,
                        letterSpacing: 1.1,
                        fontWeight: FontWeight.w900,
                      ),
                    ),
                    SizedBox(height: 6),
                    Text(
                      'SEO Keyword & Title Assistant',
                      style: TextStyle(
                        color: Colors.white,
                        fontSize: 20,
                        fontWeight: FontWeight.w900,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 18),
          _SelectedReference(reference: selected),
          const SizedBox(height: 18),
          _PanelBox(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text('검색어', style: TextStyle(color: YouchiColors.faint)),
                const SizedBox(height: 6),
                Text(
                  query,
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 18,
                    fontWeight: FontWeight.w800,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 14),
          Text(
            data.summary,
            style: const TextStyle(color: YouchiColors.muted, height: 1.65),
          ),
          const SizedBox(height: 18),
          _BulletSection(
            title: 'SEO 최적화 제목 샘플 3개',
            items: data.angles.take(3).toList(),
          ),
          const SizedBox(height: 18),
          const Text(
            '키워드 검색 추천 5–6개',
            style: TextStyle(
              color: Colors.white,
              fontSize: 14,
              fontWeight: FontWeight.w900,
            ),
          ),
          const SizedBox(height: 10),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              for (final keyword in data.keywords.take(6))
                _ChipButton(label: keyword, onTap: () => onKeyword(keyword)),
            ],
          ),
          const SizedBox(height: 18),
          _BulletSection(title: 'TIP. SEO 최적화 가이드', items: seoTips),
          const SizedBox(height: 18),
          _BulletSection(
            title: 'TIP. 피해야 할 사항',
            items: data.avoid.take(3).toList(),
          ),
          const SizedBox(height: 20),
          _ProductionFlow(
            query: query,
            insight: data,
            reference: selected,
            api: api,
          ),
        ],
      ),
    );
  }
}

class _SelectedReference extends StatelessWidget {
  const _SelectedReference({required this.reference});

  final ReferenceVideo? reference;

  @override
  Widget build(BuildContext context) {
    if (reference == null) {
      return const _PanelBox(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Selected reference',
              style: TextStyle(color: YouchiColors.accentBright),
            ),
            SizedBox(height: 8),
            Text(
              '왼쪽에서 레퍼런스 영상을 선택해 주세요',
              style: TextStyle(
                color: Colors.white,
                fontWeight: FontWeight.w800,
              ),
            ),
            SizedBox(height: 6),
            Text(
              '선택한 영상 정보를 바탕으로 유사한 6컷 이미지 제작 플로우가 시작됩니다.',
              style: TextStyle(color: YouchiColors.faint, height: 1.5),
            ),
          ],
        ),
      );
    }
    final video = reference!;
    return _PanelBox(
      child: Row(
        children: [
          ClipRRect(
            borderRadius: BorderRadius.circular(12),
            child: Image.network(
              video.image,
              width: 92,
              height: 54,
              fit: BoxFit.cover,
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  video.title,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    color: Colors.white,
                    fontWeight: FontWeight.w800,
                  ),
                ),
                const SizedBox(height: 6),
                Text(
                  '${video.source} · ${video.category ?? '카테고리 없음'} · ${video.duration}',
                  style: const TextStyle(
                    color: YouchiColors.faint,
                    fontSize: 11,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _ProductionFlow extends StatefulWidget {
  const _ProductionFlow({
    required this.query,
    required this.insight,
    required this.reference,
    required this.api,
  });

  final String query;
  final KeywordInsight insight;
  final ReferenceVideo? reference;
  final YouchiApiClient api;

  @override
  State<_ProductionFlow> createState() => _ProductionFlowState();
}

class _ProductionFlowState extends State<_ProductionFlow> {
  String _ratio = '9:16';
  bool _generating = false;
  String _error = '';
  String? _finalOutput;
  List<StoryboardCut> _cuts = [];

  bool get _hasImages => _cuts.length == 6;
  bool get _allImagesApproved =>
      _hasImages &&
      _cuts.every((cut) => cut.imageUrl != null && cut.imageApproved);
  bool get _hasVideos =>
      _hasImages && _cuts.every((cut) => cut.videoVersion > 0);
  bool get _allVideosApproved =>
      _hasVideos && _cuts.every((cut) => cut.videoApproved);

  @override
  void didUpdateWidget(covariant _ProductionFlow oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.reference?.id != widget.reference?.id) {
      setState(() {
        _cuts = [];
        _error = '';
        _finalOutput = null;
      });
    }
  }

  Future<void> _createStoryboard() async {
    if (widget.reference == null) return;
    final cuts = _makeCuts();
    setState(() {
      _cuts = cuts.map((cut) => cut.copyWith(isGenerating: true)).toList();
      _generating = true;
      _error = '';
      _finalOutput = null;
    });
    try {
      final images = await widget.api.createImages(
        query: widget.query,
        ratio: _ratio,
        reference: widget.reference!,
        cuts: cuts,
      );
      final byCut = {for (final image in images) image.cutId: image};
      setState(() {
        _cuts = _cuts.map((cut) {
          final image = byCut[cut.id];
          return cut.copyWith(
            isGenerating: false,
            imageUrl: image?.imageUrl,
            revisedPrompt: image?.revisedPrompt,
          );
        }).toList();
      });
    } catch (error) {
      setState(() {
        _error = '$error';
        _cuts = _cuts.map((cut) => cut.copyWith(isGenerating: false)).toList();
      });
    } finally {
      if (mounted) setState(() => _generating = false);
    }
  }

  List<StoryboardCut> _makeCuts() {
    const blueprints = [
      ('후킹', '첫눈에 제품군이 보이는 장면', '제품과 사용 상황을 동시에 보여주는 강한 첫 컷', '천천히 줌인'),
      (
        '문제 상황',
        '소비자가 공감할 사용 전 상황',
        '불편함이나 필요가 자연스럽게 드러나는 장면',
        '인물을 따라가는 부드러운 이동',
      ),
      (
        '제품 등장',
        '제품이 자연스럽게 등장하는 장면',
        '제품이 문제 해결의 중심으로 들어오는 장면',
        '제품 쪽으로 카메라 이동',
      ),
      ('기능 강조', '핵심 장점이 보이는 디테일 컷', '제품 기능과 소재감이 명확하게 보이는 클로즈업', '디테일을 훑는 패닝'),
      ('사용 결과', '사용 후 감정과 효과가 보이는 장면', '사용자가 얻는 만족감과 변화가 드러나는 장면', '느린 슬로우 모션'),
      ('엔딩', '브랜드와 제품을 기억시키는 마무리', '제품 클로즈업과 메시지로 마무리하는 엔딩 컷', '고정 컷 후 페이드아웃'),
    ];
    final reference = widget.reference!;
    return [
      for (var i = 0; i < blueprints.length; i++)
        StoryboardCut(
          id: 'cut-${i + 1}',
          number: i + 1,
          role: blueprints[i].$1,
          title: blueprints[i].$2,
          scene: blueprints[i].$3,
          motion: blueprints[i].$4,
          ratio: _ratio,
          imagePrompt:
              '${widget.query} 광고 ${i + 1}컷\n참고 레퍼런스: ${reference.title}\n역할: ${blueprints[i].$1}\n장면: ${blueprints[i].$3}\n스타일: 프리미엄 브랜드 광고, 실제 촬영 느낌\n화면비: $_ratio',
        ),
    ];
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text(
          'AD PRODUCTION FLOW',
          style: TextStyle(
            color: YouchiColors.accentBright,
            fontSize: 10,
            letterSpacing: 1.1,
            fontWeight: FontWeight.w900,
          ),
        ),
        const SizedBox(height: 6),
        const Text(
          '레퍼런스 기반 제작 플로우',
          style: TextStyle(
            color: Colors.white,
            fontSize: 16,
            fontWeight: FontWeight.w900,
          ),
        ),
        const SizedBox(height: 8),
        const Text(
          '선택한 영상을 바탕으로 유사한 6컷 이미지를 만들고 영상화합니다.',
          style: TextStyle(color: YouchiColors.faint, height: 1.5),
        ),
        const SizedBox(height: 14),
        _PanelBox(
          child: Column(
            children: [
              Row(
                children: [
                  Expanded(
                    child: _RatioButton(
                      '16:9',
                      _ratio,
                      (value) => setState(() => _ratio = value),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: _RatioButton(
                      '9:16',
                      _ratio,
                      (value) => setState(() => _ratio = value),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 10),
              SizedBox(
                width: double.infinity,
                child: _PrimaryButton(
                  label: _generating ? 'AI 이미지 생성 중…' : '레퍼런스 기반 이미지 6컷 만들기',
                  disabled: widget.reference == null || _generating,
                  onTap: _createStoryboard,
                ),
              ),
            ],
          ),
        ),
        if (_error.isNotEmpty) ...[
          const SizedBox(height: 10),
          Text(_error, style: const TextStyle(color: YouchiColors.danger)),
        ],
        if (_cuts.isNotEmpty) ...[
          const SizedBox(height: 12),
          for (final cut in _cuts)
            _CutCard(
              cut: cut,
              onApproveImage: () {
                setState(() {
                  _cuts = _cuts
                      .map(
                        (item) => item.id == cut.id
                            ? item.copyWith(imageApproved: !item.imageApproved)
                            : item,
                      )
                      .toList();
                });
              },
            ),
        ],
        const SizedBox(height: 12),
        _PanelBox(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text(
                '2. 영상화 하기',
                style: TextStyle(
                  color: Colors.white,
                  fontWeight: FontWeight.w800,
                ),
              ),
              const SizedBox(height: 10),
              _PrimaryButton(
                label: '영상화 하기',
                disabled: !_allImagesApproved,
                onTap: () {
                  setState(() {
                    _cuts = _cuts
                        .map(
                          (cut) =>
                              cut.copyWith(videoVersion: cut.videoVersion + 1),
                        )
                        .toList();
                  });
                },
              ),
            ],
          ),
        ),
        if (_hasVideos)
          for (final cut in _cuts)
            Padding(
              padding: const EdgeInsets.only(top: 8),
              child: Row(
                children: [
                  Expanded(child: Text('CUT ${cut.number} · ${cut.motion}')),
                  TextButton(
                    onPressed: () {
                      setState(() {
                        _cuts = _cuts
                            .map(
                              (item) => item.id == cut.id
                                  ? item.copyWith(
                                      videoApproved: !item.videoApproved,
                                    )
                                  : item,
                            )
                            .toList();
                      });
                    },
                    child: Text(cut.videoApproved ? '확정됨' : '영상 확정'),
                  ),
                ],
              ),
            ),
        const SizedBox(height: 12),
        _PanelBox(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text(
                '3. 최종 결과물 생성',
                style: TextStyle(
                  color: Colors.white,
                  fontWeight: FontWeight.w800,
                ),
              ),
              const SizedBox(height: 10),
              _PrimaryButton(
                label: '최종 결과물 생성',
                disabled: !_allVideosApproved,
                onTap: () {
                  setState(() {
                    _finalOutput =
                        'YOUCHI_${widget.query.replaceAll(RegExp(r"\\s+"), "_")}_${_ratio.replaceAll(':', 'x')}_reference_based_6cuts.mp4';
                  });
                },
              ),
              if (_finalOutput != null) ...[
                const SizedBox(height: 12),
                Text(
                  _finalOutput!,
                  style: const TextStyle(color: YouchiColors.success),
                ),
              ],
            ],
          ),
        ),
      ],
    );
  }
}

class _CutCard extends StatelessWidget {
  const _CutCard({required this.cut, required this.onApproveImage});

  final StoryboardCut cut;
  final VoidCallback onApproveImage;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: _PanelBox(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            AspectRatio(
              aspectRatio: cut.ratio == '16:9' ? 16 / 9 : 9 / 16,
              child: ClipRRect(
                borderRadius: BorderRadius.circular(12),
                child: Container(
                  color: const Color(0xFF151316),
                  child: cut.imageUrl == null
                      ? Center(
                          child: Text(
                            cut.isGenerating
                                ? 'AI 이미지 생성 중'
                                : 'CUT ${cut.number}',
                            style: const TextStyle(color: Colors.white),
                          ),
                        )
                      : Image.network(cut.imageUrl!, fit: BoxFit.cover),
                ),
              ),
            ),
            const SizedBox(height: 10),
            Text(
              cut.title,
              style: const TextStyle(
                color: Colors.white,
                fontWeight: FontWeight.w800,
              ),
            ),
            const SizedBox(height: 4),
            Text(cut.scene, style: const TextStyle(color: YouchiColors.faint)),
            const SizedBox(height: 8),
            OutlinedButton(
              onPressed: cut.imageUrl == null ? null : onApproveImage,
              child: Text(cut.imageApproved ? '확정됨' : '이 컷 확정'),
            ),
          ],
        ),
      ),
    );
  }
}

class _BulletSection extends StatelessWidget {
  const _BulletSection({required this.title, required this.items});

  final String title;
  final List<String> items;

  @override
  Widget build(BuildContext context) {
    if (items.isEmpty) return const SizedBox.shrink();
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          title,
          style: const TextStyle(
            color: Colors.white,
            fontWeight: FontWeight.w800,
          ),
        ),
        const SizedBox(height: 8),
        for (final item in items.take(4))
          Padding(
            padding: const EdgeInsets.only(bottom: 6),
            child: Text(
              '• $item',
              style: const TextStyle(color: YouchiColors.muted, height: 1.45),
            ),
          ),
      ],
    );
  }
}

class _PanelBox extends StatelessWidget {
  const _PanelBox({required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(14),
      decoration: glassDecoration(radius: 16, color: const Color(0x33000000)),
      child: child,
    );
  }
}

class _PrimaryButton extends StatelessWidget {
  const _PrimaryButton({
    required this.label,
    required this.disabled,
    required this.onTap,
  });

  final String label;
  final bool disabled;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: BoxDecoration(
        gradient: disabled ? null : youchiPurpleGradient(),
        color: disabled ? const Color(0x221E1E24) : null,
        borderRadius: BorderRadius.circular(12),
      ),
      child: ElevatedButton(
        style: ElevatedButton.styleFrom(
          elevation: 0,
          backgroundColor: Colors.transparent,
          shadowColor: Colors.transparent,
          foregroundColor: Colors.white,
          disabledForegroundColor: YouchiColors.faint,
          minimumSize: const Size.fromHeight(42),
        ),
        onPressed: disabled ? null : onTap,
        child: Text(label),
      ),
    );
  }
}

class _RatioButton extends StatelessWidget {
  const _RatioButton(this.value, this.selected, this.onChanged);

  final String value;
  final String selected;
  final ValueChanged<String> onChanged;

  @override
  Widget build(BuildContext context) {
    final active = value == selected;
    return OutlinedButton(
      onPressed: () => onChanged(value),
      style: OutlinedButton.styleFrom(
        foregroundColor: active ? Colors.white : YouchiColors.muted,
        side: BorderSide(
          color: active ? YouchiColors.accentBright : YouchiColors.line,
        ),
        backgroundColor: active ? const Color(0x338B5CF6) : Colors.transparent,
      ),
      child: Text(value == '16:9' ? '16:9 가로형' : '9:16 숏폼형'),
    );
  }
}

class _ChipButton extends StatelessWidget {
  const _ChipButton({required this.label, required this.onTap});

  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return ActionChip(
      label: Text(label),
      onPressed: onTap,
      side: const BorderSide(color: YouchiColors.line),
      backgroundColor: const Color(0x18000000),
      labelStyle: const TextStyle(color: YouchiColors.accentBright),
    );
  }
}

class _SoftPill extends StatelessWidget {
  const _SoftPill(this.label);

  final String label;

  @override
  Widget build(BuildContext context) => _MiniPill(label);
}

class _MiniPill extends StatelessWidget {
  const _MiniPill(this.label);

  final String label;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: const Color(0x18FFFFFF),
        border: Border.all(color: YouchiColors.line),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(
        label,
        maxLines: 1,
        overflow: TextOverflow.ellipsis,
        style: const TextStyle(color: YouchiColors.muted, fontSize: 11),
      ),
    );
  }
}

class _CountBadge extends StatelessWidget {
  const _CountBadge(this.label);

  final String label;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(
        color: const Color(0x228B5CF6),
        border: Border.all(color: const Color(0x55D0BCFF)),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(
        label,
        style: const TextStyle(
          color: YouchiColors.accentBright,
          fontSize: 12,
          fontWeight: FontWeight.w800,
        ),
      ),
    );
  }
}

class _SourceBadge extends StatelessWidget {
  const _SourceBadge(this.label);

  final String label;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 7),
      decoration: BoxDecoration(
        border: Border.all(color: YouchiColors.accent),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Text(
        label,
        style: const TextStyle(
          color: YouchiColors.accentBright,
          fontSize: 12,
          fontWeight: FontWeight.w800,
        ),
      ),
    );
  }
}

class _EmptyState extends StatelessWidget {
  const _EmptyState({
    required this.title,
    required this.message,
    this.actionLabel,
    this.onAction,
  });

  final String title;
  final String message;
  final String? actionLabel;
  final VoidCallback? onAction;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      constraints: const BoxConstraints(minHeight: 360),
      padding: const EdgeInsets.all(28),
      decoration: glassDecoration(radius: 18, color: const Color(0x22000000)),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          const Icon(Icons.search_off, size: 38, color: YouchiColors.faint),
          const SizedBox(height: 16),
          Text(
            title,
            style: const TextStyle(
              color: Colors.white,
              fontSize: 18,
              fontWeight: FontWeight.w800,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            message,
            textAlign: TextAlign.center,
            style: const TextStyle(color: YouchiColors.faint),
          ),
          if (actionLabel != null && onAction != null) ...[
            const SizedBox(height: 14),
            OutlinedButton(onPressed: onAction, child: Text(actionLabel!)),
          ],
        ],
      ),
    );
  }
}
