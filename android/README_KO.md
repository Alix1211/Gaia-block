# GAIA HEART BREAKER — 오프라인 Android APK

이 프로젝트는 기존 GAIA BLOCK의 HTML/CSS/JS 및 원본 이미지·음원을 Android WebView에 **그대로** 담습니다. 새로운 게임으로 다시 만드는 작업이 아닙니다.

## 직접 진동
`GaiaNativeVibration.vibrate("[26]")` JavaScript 브리지가 Android `Vibrator` 및 `VibrationEffect.createWaveform`를 직접 호출합니다.
패들 / 신체 충돌 / 큰 폭발 패턴은 기존 `js/gaia-options.js`에 정의되어 있고, 사용자가 설정에서 진동을 끌 수 있습니다. `VIBRATE` 권한 외에 인터넷 권한은 필요하지 않습니다.

## 배경 폴더
설정의 '배경 폴더 선택'은 Android 시스템 파일 선택기를 열고 해당 폴더의 이미지에 **지속적 읽기 권한**을 받아서 앱에만 저장합니다. 다음 실행 때 자동으로 마지막 폴더를 다시 불러옵니다. 사진은 외부로 업로드하지 않습니다. 슬라이드쇼는 4~20초 주기로 화면에 가득 채우고 랜덤 재생합니다.

## 빌드
GitHub Actions `Build Android APK` 워크플로가 코드 및 게임 에셋을 `android/app/src/main/assets/www/`에 복사해 오프라인 APK를 빌드합니다. GitHub 저장소 Actions 탭에서 최신 성공한 실행을 선택해 `gaia-heart-breaker-apk` 압축파일을 받으면 설치형 `.apk`가 있습니다.

개발용 debug 서명으로 빌드하므로 앱 업데이트를 위한 **장기간 고정 서명키/배포용 release 서명** 설정이 별도로 필요합니다. 동일한 서명키가 아니면 재설치가 필요할 수 있습니다. 처음 설치한 앱을 삭제하면 기존 기기 내부 저장 데이터도 제거됩니다. HTML 브라우저의 로컬 저장과 APK 앱 저장 공간은 별개입니다.

## 실기 테스트 체크
- 40판 스토리 모드 / 이어하기 / 가로 UI (좌측 캐릭터, 가운데 게임판, 우측 UI)
- 패들 진동 짧게 / 신체 충돌 진동 2회 / 큰 폭발 3회
- 배경 폴더 선택 → 슬라이드쇼 → 종료 후 재실행 → 마지막 폴더 자동 복원
- 대사 / BGM / 효과음 / 저장 진행 / 전체화면 버튼

※ 이 문서는 빌드 소스를 제공하며 APK 빌드 성공과 Android 실기 진동의 확인은 CI/실기 결과로 따로 기록합니다.

## 0.16.2 진동 수정
실제 패들 반사·신체 반사·골대 몸통 충돌·특수 의상 반사·폭탄 폭발의 **충돌 확정 위치**에서 JS가 즉시 `GaiaNativeVibration.vibrate`를 호출하도록 변경했습니다. 이전 버전처럼 충돌 직후 공의 위치를 다시 판정하는 조건을 두지 않습니다. 게임에서 직접 충돌 이벤트를 발생시켜 Android 브리지에 전달되는 진동 패턴을 검증하는 `node tools/test-game-haptics.cjs` 자동테스트를 GitHub Actions에 추가했습니다. 태블릿 실제 진동은 사용자가 APK 설치 후 검증해야 합니다.
