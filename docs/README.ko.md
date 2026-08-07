<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)"  srcset="https://raw.githubusercontent.com/sdkurjnk/OsciloScope/master/docs/assets/OsciloScope-banner-dark@2x.png">
    <source media="(prefers-color-scheme: light)" srcset="https://raw.githubusercontent.com/sdkurjnk/OsciloScope/master/docs/assets/OsciloScope-banner-light@2x.png">
    <img src="https://raw.githubusercontent.com/sdkurjnk/OsciloScope/master/docs/assets/OsciloScope-banner-dark@2x.png" alt="OsciloScope" width="100%">
  </picture>
</p>

[![Open VSX](https://img.shields.io/open-vsx/v/sdkurjnk/osciloscope)](https://open-vsx.org/extension/sdkurjnk/osciloscope)

변수 모니터링 로그를 읽어 변수 값이 시간에 따라 어떻게 변하는지 시각화하는 Visual Studio Code Extension입니다.

> 🌐 English: [`README.md`](../README.md) · 내부 설계 문서: [`docs/`](./)

## 기능

- `log.jsonl`(JSON Lines) 모니터링 로그를 파싱합니다.
- 변수를 스코프(Local / Global)별로 그룹화하고, 스텝 단위로 값 이력을 추적합니다.
- 결과를 Webview 패널에 렌더링합니다.

## 사용법

1. 활동 표시줄에서 **OsciloScope** 뷰를 엽니다.
2. **SOURCE**에서 `.jsonl` 로그 파일을 선택합니다.
3. **START**를 누르면 메인 패널에 값 타임라인이 렌더링됩니다.

## 요구 사항

- VS Code `^1.120.0` 이상.

## 릴리스 노트

릴리스 이력은 `CHANGELOG.md`를 참고하세요.
