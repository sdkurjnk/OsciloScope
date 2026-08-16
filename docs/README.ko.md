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

OsciloScope는 [oscilo](https://github.com/sdkurjnk/oscilo)가 남긴 `.jsonl` 로그를 읽어 각 변수의
이력을 인터랙티브 타임라인으로 보여줍니다 — 스코프별로 묶고, 재귀 호출에서도 인스턴스를 구분하며,
스텝마다 변화 태그를 답니다.

## 목차

- [개요](#개요)
- [설치](#설치)
- [빠른 시작](#빠른-시작)
- [화면 구성](#화면-구성)
- [분석 도구](#분석-도구)
- [동작 방식](#동작-방식)
- [요구 사항](#요구-사항)
- [문서](#문서)
- [관련](#관련)
- [라이선스](#라이선스)

## 개요

모니터링 로그는 변화마다 JSON 한 줄이 쌓인 평면 스트림입니다:

```json
{"name":"acc","var_id":47,"data":0,"event":"init","domain":"LOCAL","line":12,"func":"process","call_id":47}
{"name":"acc","var_id":47,"data":1,"event":"updated","domain":"LOCAL","line":14,"func":"process","call_id":47}
```

OsciloScope는 이걸 변수별 타임라인으로 접습니다: 어떤 변수가 어떤 스코프에 있고, 값이 어떻게 움직였는지.

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
3. **SOURCE**에서 `.jsonl` 파일을 고릅니다. 필요하면 **TOOLS**에서 분석 도구를 선택합니다.
4. **START**를 누릅니다.
5. 목록에서 변수를 선택하면 스텝별 이력이 나타납니다.

## 화면 구성

<p align="center">
  <img src="https://raw.githubusercontent.com/sdkurjnk/OsciloScope/master/docs/assets/OsciloScope-test.png" alt="OsciloScope 타임라인 화면" width="100%">
</p>

| 영역 | 표시 내용 |
| --- | --- |
| **SOURCE**(사이드바) | `.jsonl` 로그 선택 후 **START**로 렌더링 |
| **TOOLS**(사이드바) | 분석 도구 선택·생성·검사 |
| **Variables**(사이드바) | 스코프(Local / Global)별 변수 목록. 재귀·반복 호출은 call 프레임(`#call_id`)으로 구분 |
| **타임라인 헤더** | 선택한 변수의 함수·call id·부모 호출·깊이 |
| **타임라인** | 각 스텝의 값·소스 라인·변화 태그 |

위 변수 목록과 타임라인은 기본 도구 `change-detector`가 그린 화면입니다. 다른 도구를 고르면
전혀 다른 화면이 나올 수 있습니다.

변화 태그:

| 태그 | 의미 |
| --- | --- |
| `init` | 첫 기록 값 |
| `+n` / `-n` / `±0` | 이전 스텝 대비 숫자 증감 |
| `changed` | 숫자가 아닌 값이 바뀜 |
| `deleted` | 변수가 스코프에서 사라짐 |

## 분석 도구

분석 화면은 **도구(tool)** 가 그립니다. `analyze`(계산)와 `render`(표현) 두 훅을 가진 작은 ES
모듈이며, 기본으로 두 개가 함께 배포되고 직접 만들 수도 있습니다.

- 사이드바의 **+ 만들기**를 누르면 `.osciloscope/tools/<id>.tool.js`가 타입 정의와 함께
  만들어져, 편집하는 동안 자동완성이 동작합니다.
- 생성된 파일은 **그 상태로 이미 동작합니다.** 빈 껍데기가 아니라 돌아가는 것에서 시작합니다.
- **✓** 버튼을 누르면 블랙박스 검사가 돕니다 — 표준 입력 5종(normal, empty, deleted,
  recursive, legacy)에 대해 12개 항목을 봅니다.

작성 가이드: [plugin-tools.md](./plugin-tools.md).

## 동작 방식

VS Code의 프로세스 분리를 따라 두 부분으로 나뉩니다 — 로그를 읽고 파일·패널을 관리하는
**Extension Host**, 도구를 실행하고 결과를 그리는 **Webview**. 둘은 `postMessage`로만 통신합니다.

도구는 Extension Host가 아니라 웹뷰에서 실행됩니다. 사용자 코드가 파일 시스템·네트워크·확장
API에 닿을 통로가 없습니다. 정체성은 oscilo의 `var_id`로 키잉하므로 재귀 호출에서 같은 이름이
나와도 분리됩니다. 자세한 내용은 [설계 문서](./)에 있습니다.

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
