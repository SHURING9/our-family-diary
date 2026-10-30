# 우리 가족의 하루 🌿

가족 일정, 할 일, 장보기, 육아 기록, 식단을 함께 관리하는 모바일 친화적 웹사이트입니다.

## 파일 구성

- `index.html` — 화면 구조
- `style.css` — 따뜻한 가족 다이어리 스타일
- `app.js` — 로그인, 가족 공간, 기록 CRUD 기능
- `supabase-schema.sql` — 데이터베이스와 접근 권한 정책

## 1. Supabase 프로젝트 준비

1. https://supabase.com 에서 프로젝트를 만듭니다.
2. 왼쪽 **SQL Editor**에서 `supabase-schema.sql`의 전체 내용을 붙여넣고 실행합니다.
3. **Project Settings → API**에서 Project URL과 Publishable key를 확인합니다.
4. `app.js`의 다음 두 값을 본인의 값으로 교체합니다.

```js
const SUPABASE_URL = "YOUR_SUPABASE_PROJECT_URL";
const SUPABASE_PUBLISHABLE_KEY = "YOUR_SUPABASE_PUBLISHABLE_KEY";
```

Publishable key(구형 프로젝트의 anon key)는 브라우저에서 사용할 수 있지만, 반드시 RLS 정책과 함께 사용해야 합니다. **service_role 또는 secret key는 절대로 `app.js`에 넣지 마세요.**

## 2. GitHub에 올리기

1. GitHub에서 새 저장소 `our-family-diary`를 만듭니다.
2. 저장소에 `index.html`, `style.css`, `app.js`, `supabase-schema.sql`, `README.md`를 올립니다.
3. 개인·가족 기록을 저장하지 마세요. 저장소와 GitHub Pages 사이트의 파일은 공개될 수 있습니다.
4. 저장소의 **Settings → Pages**로 이동합니다.
5. **Build and deployment → Source**에서 `Deploy from a branch`를 선택합니다.
6. Branch는 `main`, 폴더는 `/(root)`로 선택하고 저장합니다.
7. 배포가 끝나면 Pages 화면의 `Visit site`로 접속합니다.

GitHub Pages는 정적 사이트 호스팅이므로 데이터베이스는 Supabase가 담당합니다.

## 3. Supabase 인증 설정

1. Supabase **Authentication → URL Configuration**으로 이동합니다.
2. Site URL에 실제 GitHub Pages 주소를 입력합니다. 예: `https://YOUR-USERNAME.github.io/our-family-diary/`
3. Redirect URLs에도 같은 주소를 추가합니다.
4. 처음에는 가족 중 한 명이 회원가입하고 이메일 인증이 켜져 있다면 이메일 인증을 마친 뒤 로그인합니다.
5. `새 가족 공간 만들기`에서 가족 공간을 생성합니다.
6. 화면에 나타난 초대 코드를 가족에게 직접 전달합니다.
7. 다른 가족 구성원은 각자 회원가입·로그인한 뒤 `초대 코드로 참여하기`를 선택합니다.

## 4. 사용법

- 상단 메뉴에서 가족 일정, 할 일, 장보기, 육아 기록, 식단을 선택합니다.
- `추가하기` 버튼으로 기록을 등록합니다.
- 할 일과 장보기 항목은 체크 버튼으로 완료 처리할 수 있습니다.
- 잘못 만든 기록은 `×` 버튼으로 삭제할 수 있습니다.
- 로그인한 가족 구성원이 같은 가족 공간에 참여하면 동일한 기록을 함께 봅니다.

## 보안 및 운영 메모

- 가족 기록은 공개 저장소의 파일에 쓰지 않습니다. 데이터는 Supabase 데이터베이스에 저장됩니다.
- `supabase-schema.sql`은 RLS를 켜고, 로그인 사용자가 소속된 가족의 기록만 읽고 수정할 수 있도록 정책을 설정합니다.
- 초대 코드는 가족에게 직접 전달하고 공개 게시물에 올리지 마세요. 코드를 분실하거나 외부에 노출했다면 코드 변경 기능을 추가해 교체하는 것이 좋습니다.
- 이 첫 버전은 가족 공간당 사용자 한 개의 공간 참여를 전제로 합니다.
- 가족 데이터에는 민감한 의료정보나 꼭 필요하지 않은 개인정보를 기록하지 않는 것을 권장합니다.
- 처음 배포한 뒤 가족 구성원 두 계정으로 로그인, 초대, 기록 추가/삭제, 다른 기기 동기화를 확인하세요.
