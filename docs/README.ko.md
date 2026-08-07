<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)"  srcset="https://raw.githubusercontent.com/sdkurjnk/OsciloScope/master/docs/assets/OsciloScope-banner-dark@2x.png">
    <source media="(prefers-color-scheme: light)" srcset="https://raw.githubusercontent.com/sdkurjnk/OsciloScope/master/docs/assets/OsciloScope-banner-light@2x.png">
    <img src="https://raw.githubusercontent.com/sdkurjnk/OsciloScope/master/docs/assets/OsciloScope-banner-dark@2x.png" alt="OsciloScope" width="100%">
  </picture>
</p>

<p align="center">변수 값이 시간에 따라 어떻게 변하는지 VS Code 안에서 바로 시각화합니다.</p>

<p align="center">
  <a href="https://open-vsx.org/extension/sdkurjnk/osciloscope"><img src="https://img.shields.io/open-vsx/v/sdkurjnk/osciloscope" alt="Open VSX Version"></a>
  <a href="https://open-vsx.org/extension/sdkurjnk/osciloscope"><img src="https://img.shields.io/open-vsx/dt/sdkurjnk/osciloscope" alt="Open VSX Downloads"></a>
  <a href="../LICENSE"><img src="https://img.shields.io/badge/License-MIT-yellow.svg" alt="License: MIT"></a>
</p>

[English](../README.md) | **한국어**

OsciloScope는 [oscilo](https://github.com/sdkurjnk/oscilo)가 남긴 `.jsonl` 모니터링 로그를 읽어
각 변수의 이력을 인터랙티브 타임라인으로 보여줍니다. 둘은 짝입니다 — oscilo가 파이썬 변수의 변화를
기록하면, OsciloScope가 그것을 스코프별로 묶고, 재귀 호출에서도 인스턴스를 구분하고, 스텝마다
변화 태그를 달아 보여줍니다.

## 목차

- [개요](#개요)
- [설치](#설치)
- [빠른 시작](#빠른-시작)
- [화면 구성](#화면-구성)
- [동작 방식](#동작-방식)
- [요구 사항](#요구-사항)
- [문서](#문서)
- [관련](#관련)
- [라이선스](#라이선스)

## 개요

모니터링 로그는 변화 이벤트의 평면 스트림입니다 — 한 줄에 JSON 하나라 그대로 읽기는 어렵습니다:

```json
{"name":"acc","var_id":47,"data":0,"event":"init","domain":"LOCAL","line":12,"func":"process","call_id":47}
{"name":"acc","var_id":47,"data":1,"event":"updated","domain":"LOCAL","line":14,"func":"process","call_id":47}
```

OsciloScope는 이 스트림을 변수별 타임라인으로 접어, 어떤 변수가 어떤 스코프에 있고 값이 스텝마다
어떻게 움직였는지 한눈에 보게 합니다.

## 설치

[Open VSX Registry](https://open-vsx.org/extension/sdkurjnk/osciloscope)에서 설치합니다:

- VS Code에서 — **Extensions** 뷰를 열고 **OsciloScope**를 검색해 **Install**.
- `.vsix`로 — **Extensions** 뷰 → **⋯** 메뉴 → **Install from VSIX…**

## 빠른 시작

1. oscilo로 로그를 만듭니다:

   ```python
   import oscilo

   def run():
       acc = 0
       oscilo.register("acc")   # 이후 acc의 모든 변화가 기록됨
       for x in range(3):
           acc += x

   run()
   # 종료 시 oscilo.jsonl 생성
   ```

2. 활동 표시줄에서 **OsciloScope** 뷰를 엽니다.
3. **SOURCE**에서 `.jsonl` 파일을 고른 뒤 **START**를 누릅니다.
4. 목록에서 변수를 선택하면 스텝별 이력이 나타납니다.

## 화면 구성

<p align="center">
  <img src="https://raw.githubusercontent.com/sdkurjnk/OsciloScope/master/docs/assets/OsciloScope-test.png" alt="OsciloScope 타임라인 화면" width="100%">
</p>

| 영역 | 표시 내용 |
| --- | --- |
| **SOURCE**(사이드바) | `.jsonl` 로그 선택 후 **START**로 렌더링 |
| **Variables**(사이드바) | 스코프(Local / Global)별 변수 목록. 재귀·반복 호출은 call 프레임(`#call_id`)으로 구분 |
| **타임라인 헤더** | 선택한 변수의 함수·call id·부모 호출·깊이 |
| **타임라인** | 각 스텝의 값·소스 라인·변화 태그 |

변화 태그:

| 태그 | 의미 |
| --- | --- |
| `init` | 첫 기록 값 |
| `+n` / `-n` / `±0` | 이전 스텝 대비 숫자 증감 |
| `changed` | 숫자가 아닌 값이 바뀜 |
| `deleted` | 변수가 스코프에서 사라짐 |

## 동작 방식

OsciloScope는 VS Code의 프로세스 분리를 그대로 따라 두 부분으로 나뉩니다:

- 로그를 읽고 파싱해 변수를 정체성별로 묶는 **Extension Host** 측,
- 사이드바와 타임라인을 그리는 **Webview** 측.

둘은 오직 `postMessage`로만 통신합니다. 변수 정체성은 oscilo의 `var_id`로 키잉하므로, 재귀 호출에서
같은 이름이 나와도 서로 분리됩니다. 자세한 내용은 [설계 문서](./)에 있습니다.

## 요구 사항

- VS Code `^1.120.0` 이상.
- [oscilo](https://github.com/sdkurjnk/oscilo)가 생성한 `.jsonl` 로그.

## 문서

아키텍처·데이터 모델·메시지 프로토콜·FE/BE API 명세는 [`docs/`](./)에 있습니다.
릴리스 이력은 [`CHANGELOG.md`](../CHANGELOG.md)를 참고하세요.

## 관련

- [oscilo](https://github.com/sdkurjnk/oscilo) — OsciloScope가 읽는 로그를 만드는 코드 무침습 파이썬 변수 추적기.

## 라이선스

[MIT](../LICENSE) © 2026 [sdkurjnk](https://github.com/sdkurjnk)
