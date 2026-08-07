<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)"  srcset="https://raw.githubusercontent.com/sdkurjnk/OsciloScope/master/docs/assets/OsciloScope-banner-dark@2x.png">
    <source media="(prefers-color-scheme: light)" srcset="https://raw.githubusercontent.com/sdkurjnk/OsciloScope/master/docs/assets/OsciloScope-banner-light@2x.png">
    <img src="https://raw.githubusercontent.com/sdkurjnk/OsciloScope/master/docs/assets/OsciloScope-banner-dark@2x.png" alt="OsciloScope" width="100%">
  </picture>
</p>

[![Open VSX](https://img.shields.io/open-vsx/v/sdkurjnk/osciloscope)](https://open-vsx.org/extension/sdkurjnk/osciloscope)

> 🌐 English: [`README.md`](../README.md) · 내부 설계 문서: [`docs/`](./)

OsciloScope는 변수 값의 시간에 따른 변화를 시각화하는 VS Code 확장입니다.
[oscilo](https://github.com/sdkurjnk/oscilo)가 남긴 `.jsonl` 로그를 읽어 각 변수의 이력을 인터랙티브 타임라인으로 보여줍니다.

## 기능

- **임의 로그**: 사이드바에서 `.jsonl` 파일 선택.
- **스코프 그룹화**: Local / Global로 분류, 재귀·반복 호출 인스턴스도 구분.
- **값 타임라인**: 스텝별 값·소스 라인·변화 태그(`init`, `+/-`, `changed`, `deleted`).
- **호출 맥락**: 헤더에 함수·call id·부모·깊이.

## 사용법

1. 활동 표시줄에서 **OsciloScope** 뷰를 엽니다.
2. **SOURCE**에서 `.jsonl` 로그를 선택합니다.
3. **START**를 눌러 타임라인을 렌더링합니다.
4. 변수를 선택하면 이력이 나타납니다.

## 요구 사항

- VS Code `^1.120.0` 이상.
- [oscilo](https://github.com/sdkurjnk/oscilo)가 생성한 `.jsonl` 로그.

## 더 보기

- 설계 문서: [`docs/`](./)
- 릴리스 이력: [`CHANGELOG.md`](../CHANGELOG.md)
