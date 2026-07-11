import 'package:flutter/material.dart';

class YouchiColors {
  static const bg = Color(0xFF0A0A0C);
  static const panel = Color(0x991C1B1D);
  static const glass = Color(0x66000000);
  static const text = Color(0xFFE5E1E4);
  static const muted = Color(0xFFCBC3D7);
  static const faint = Color(0xA3CBC3D7);
  static const accent = Color(0xFF8B5CF6);
  static const accentBright = Color(0xFFD0BCFF);
  static const accentDeep = Color(0xFF6D28D9);
  static const danger = Color(0xFFFFB9B9);
  static const success = Color(0xFFB9F8CA);
  static const line = Color(0x52494454);
}

ThemeData youchiTheme() {
  return ThemeData(
    useMaterial3: true,
    brightness: Brightness.dark,
    scaffoldBackgroundColor: YouchiColors.bg,
    fontFamily: 'Noto Sans KR',
    colorScheme: const ColorScheme.dark(
      primary: YouchiColors.accent,
      secondary: YouchiColors.accentBright,
      surface: YouchiColors.bg,
      onSurface: YouchiColors.text,
    ),
    textTheme: const TextTheme(
      displayLarge: TextStyle(
        color: Colors.white,
        fontSize: 82,
        height: 1,
        fontWeight: FontWeight.w800,
        letterSpacing: -5,
      ),
      headlineLarge: TextStyle(
        color: Colors.white,
        fontSize: 44,
        height: 1.05,
        fontWeight: FontWeight.w800,
        letterSpacing: -2,
      ),
      titleLarge: TextStyle(
        color: YouchiColors.text,
        fontSize: 20,
        fontWeight: FontWeight.w800,
      ),
      bodyMedium: TextStyle(color: YouchiColors.muted, height: 1.6),
    ),
  );
}

BoxDecoration glassDecoration({
  double radius = 18,
  Color color = YouchiColors.glass,
  Color borderColor = YouchiColors.line,
}) {
  return BoxDecoration(
    color: color,
    borderRadius: BorderRadius.circular(radius),
    border: Border.all(color: borderColor),
    boxShadow: const [
      BoxShadow(
        color: Color(0x55000000),
        blurRadius: 36,
        offset: Offset(0, 18),
      ),
    ],
  );
}

LinearGradient youchiPurpleGradient() {
  return const LinearGradient(
    colors: [YouchiColors.accent, YouchiColors.accentDeep],
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
  );
}
