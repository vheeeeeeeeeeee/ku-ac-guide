# KU창업클럽 학생창업액셀러레이터(AC) 업무 안내

AC 단체 운영진이 지원 항목, 제출 양식과 시기, 증빙 기준을 혼자 확인할 수 있게 만든 정적 사이트.

- 내용 수정: [관리자-수정가이드.md](관리자-수정가이드.md)
- 기준 자료: 대학혁신지원사업 업무매뉴얼 3주기 2nd Edition(2026. 3.), 창업지원센터 양식 1~11

## 폴더 구조

```
index.html            화면 틀
assets/               스타일, 스크립트, 로고(img/), 라이브러리(vendor/: marked 12.0.2, JSZip 3.10.1, 모두 MIT)
content/              관리자가 고치는 내용 (마크다운·JSON)
forms/                양식 hwpx 15개 (공개용으로 개인정보 정리본)
.nojekyll             GitHub Pages가 .md 파일을 변환하지 않도록 하는 설정
```

## 배포: GitHub Pages

1. GitHub에 공개 저장소를 만들고 이 폴더 전체를 올린다
2. 저장소 `Settings` → `Pages`
3. `Source`: Deploy from a branch, `Branch`: main, 폴더 `/ (root)` → Save
4. 1~2분 뒤 `https://<계정>.github.io/<저장소>/` 주소로 열린다

선택 이유

- 관리자가 GitHub 웹 화면에서 텍스트 파일만 고치면 반영되고 설치가 필요 없다
- 수정 이력이 남아 금액·기준을 누가 언제 바꿨는지 추적할 수 있다
- 무료이고, 학교 서버로 옮길 때는 폴더를 그대로 복사하면 된다

## 로컬에서 미리 보기

`index.html`을 더블클릭하면 내용이 표시되지 않는다(브라우저 보안 정책). 폴더에서 아래 명령을 실행한 뒤 `http://localhost:8000`을 연다.

```
python3 -m http.server 8000
```
