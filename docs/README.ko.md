<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)"  srcset="https://raw.githubusercontent.com/sdkurjnk/OsciloScope/master/docs/assets/OsciloScope-banner-dark@2x.png">
    <source media="(prefers-color-scheme: light)" srcset="https://raw.githubusercontent.com/sdkurjnk/OsciloScope/master/docs/assets/OsciloScope-banner-light@2x.png">
    <img src="https://raw.githubusercontent.com/sdkurjnk/OsciloScope/master/docs/assets/OsciloScope-banner-dark@2x.png" alt="OsciloScope" width="100%">
  </picture>
</p>

[![Open VSX](https://img.shields.io/open-vsx/v/sdkurjnk/osciloscope)](https://open-vsx.org/extension/sdkurjnk/osciloscope)

> 🌐 English: [`README.md`](../README.md) · 내부 설계 문서: [`docs/`](./)

OsciloScope는 변수 값이 시간에 따라 어떻게 변하는지 시각화하는 Visual Studio Code 확장입니다.
[oscilo](https://github.com/sdkurjnk/oscilo)가 남긴 `.jsonl` 모니터링 로그를 읽어 각 변수의
이력을 인터랙티브 타임라인으로 보여줍니다 — VS Code에서 따로 계측할 것 없이 로그만 열면 됩니다.

## 기능

- **임의의 oscilo 로그를 읽음.** 사이드바에서 `.jsonl` 파일을 고르면 됩니다 — 경로·파일명 고정 없음.
- **스코프 그룹화.** 변수를 스코프(Local / Global)별로 묶습니다. 재귀나 반복 호출로 이름이 겹쳐도
  변수가 정의된 소유 프레임 기준으로 인스턴스를 구분합니다.
- **값 타임라인.** 선택한 변수의 각 스텝마다 값·소스 라인·변화 태그(`init`, 숫자 `+/-` 증감,
  `changed`, `deleted`)를 표시합니다.
- **호출 맥락 표시.** 타임라인 헤더에 함수·call id·부모 호출·깊이를 함께 보여줍니다.

## 사용법

1. 활동 표시줄에서 **OsciloScope** 뷰를 엽니다.
2. **SOURCE**에서 oscilo가 만든 `.jsonl` 로그 파일을 선택합니다.
3. **START**를 누르면 메인 패널에 값 타임라인이 렌더링됩니다.
4. 왼쪽 목록에서 변수를 선택하면 스텝별 이력이 나타납니다.

## 요구 사항

- VS Code `^1.120.0` 이상.
- [oscilo](https://github.com/sdkurjnk/oscilo)가 생성한 `.jsonl` 로그.

## 문서

아키텍처·데이터 모델·메시지 프로토콜·FE/BE API 명세 등 설계 문서는 [`docs/`](./)에 있습니다.

## 릴리스 노트

릴리스 이력은 [`CHANGELOG.md`](../CHANGELOG.md)를 참고하세요.
