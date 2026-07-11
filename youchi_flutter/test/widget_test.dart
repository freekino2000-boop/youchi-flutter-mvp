import 'package:flutter_test/flutter_test.dart';
import 'package:youchi_flutter/youchi_app.dart';

void main() {
  testWidgets('YOUCHI home renders', (tester) async {
    await tester.pumpWidget(const YouchiApp());

    expect(find.text('YOUCHI'), findsOneWidget);
    expect(find.text('AI Ad Conceptor'), findsOneWidget);
    expect(find.textContaining('키워드를 입력해 주세요'), findsOneWidget);
  });
}
