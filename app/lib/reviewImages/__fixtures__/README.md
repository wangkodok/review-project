# HEIC 테스트 fixture

`single-frame.heic`는 자동 테스트에만 사용하는 작은 합성 HEIC fixture다.
top-level 이미지는 한 장이며 480 x 640 RGBA 프레임으로 디코딩된다. 원본
저장소 테스트가 확인하는 EXIF도 `TestCam`, `Model123`, 방향 `6`, ISO `800`
같은 합성 값이며 이 서비스의 사용자 데이터는 포함하지 않는다.

## 출처와 무결성

- 원본 저장소: https://github.com/gen2brain/heic
- 원본 commit: `b7851f2d60e80d5711edf5b852089010ad5a2a16`
- 원본 경로: `testdata/test_exif.heic`
- 고정 원본 URL: https://raw.githubusercontent.com/gen2brain/heic/b7851f2d60e80d5711edf5b852089010ad5a2a16/testdata/test_exif.heic
- 저장소 라이선스: MIT
- 고정 commit 라이선스: https://github.com/gen2brain/heic/blob/b7851f2d60e80d5711edf5b852089010ad5a2a16/LICENSE
- 로컬 파일명: `single-frame.heic`
- 파일 크기: `1130`바이트
- SHA-256: `49d881a7a87d91cdf79d4599a3f7ecf331fa9d940743954856dc1c66fdd2eae3`

로컬 파일은 고정 원본과 바이트 단위로 같아야 한다. 교체할 때는 원본 commit,
경로, 라이선스, 크기와 SHA-256을 함께 갱신한다.
