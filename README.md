# 익명 음식 리뷰 플랫폼 MVP

Next.js App Router 기반의 익명 음식 리뷰 커뮤니티 MVP입니다.

읽기는 누구나 가능하고, 게시글 작성/수정/삭제/좋아요/내 정보 관리는 Google 로그인 사용자만 사용할 수 있습니다. 서비스의 기본 방향은 익명성, 복구 불가 삭제 정책, 브라우저 DB 직접 접근 차단, 빠른 MVP 검증입니다.

## 주요 기능

- Google 로그인/로그아웃
- 로그인 사용자와 Supabase `users` 테이블 동기화
- 가입 시 익명ID 자동 생성
- 닉네임 조회 및 변경
- 커뮤니티 게시글 목록, 카테고리 필터, 더보기
- 게시글 작성, 상세 조회, 수정, 삭제
- 구조화된 음식 리뷰 작성
  - 카테고리 선택
  - 메뉴 이름 입력
  - 좋았던 점 선택
  - 아쉬웠던 점 선택
- 게시글 좋아요 토글
- 로그인 사용자 기준 24시간 단위 조회수 증가 제한
- 검색 전용 페이지
- 로그인 사용자 최근 검색어 저장 및 삭제
- 내가 작성한 게시글 목록
- 회원 탈퇴

## 기술 스택

- Next.js App Router
- TypeScript
- Tailwind CSS
- NextAuth.js Google Provider
- Supabase PostgreSQL
- TanStack Query
- Lucide React

## 아키텍처 원칙

브라우저에서 Supabase DB에 직접 접근하지 않습니다.

```text
Client
-> Next.js Route Handler
-> Server-side service
-> Supabase PostgreSQL
```

- 클라이언트는 `/api/...` Route Handler만 호출합니다.
- Supabase Service Role Key는 서버 코드에서만 사용합니다.
- Supabase Auth는 사용하지 않습니다.
- Supabase RLS는 사용하지 않습니다.
- API 직접 접근은 가능하지만 Route Handler에서 인증과 권한을 검증합니다.

## 데이터베이스

Supabase PostgreSQL을 사용합니다.

주요 테이블:

- `users`
- `categories`
- `posts`
- `likes`
- `post_views`
- `search_histories`

게시글 삭제와 회원 탈퇴는 Hard Delete 정책을 따릅니다. `likes`, `post_views`, `search_histories` 등 사용자 또는 게시글에 종속된 데이터는 외래키와 서버 로직을 기준으로 함께 정리됩니다.

## API 개요

- `GET /api/categories`
- `GET /api/posts`
- `POST /api/posts`
- `GET /api/posts/:postId`
- `PATCH /api/posts/:postId`
- `DELETE /api/posts/:postId`
- `POST /api/posts/:postId/like`
- `GET /api/search/posts`
- `GET /api/search/histories`
- `DELETE /api/search/histories`
- `DELETE /api/search/histories/:historyId`
- `GET /api/profile`
- `PATCH /api/profile`
- `GET /api/my/posts`
- `DELETE /api/withdraw`

모든 API 응답은 `success`, `data`, `message`, `code` 형식을 기준으로 반환합니다.

## 환경변수

실제 값은 Git에 포함하지 않습니다. 로컬 개발 시 `.env.local`에 직접 입력합니다.

```env
AUTH_SECRET=
AUTH_GOOGLE_ID=
AUTH_GOOGLE_SECRET=
AUTH_URL=

SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

로컬 개발 예시:

```env
AUTH_URL=http://localhost:3000
```

Vercel 배포 환경에서는 배포 도메인을 기준으로 `AUTH_URL`을 설정하고, Google Cloud Console의 승인된 리디렉션 URI에 아래 형식의 콜백 주소를 등록해야 합니다.

```text
https://your-domain.com/api/auth/callback/google
```

로컬 Google 로그인 테스트가 필요하면 아래 주소도 등록합니다.

```text
http://localhost:3000/api/auth/callback/google
```

## 로컬 실행

```bash
npm install
npm run dev
```

브라우저에서 아래 주소를 엽니다.

```text
http://localhost:3000
```

## 검증

```bash
npm run lint
npm run build
```

배포 전에는 다음 항목을 확인합니다.

- `.env.local`이 Git에 포함되지 않았는지 확인
- `.env.example`에 실제 키가 없는지 확인
- 브라우저 Sources, Network 응답, Storage에 Supabase Service Role Key가 노출되지 않는지 확인
- 비로그인 상태에서 작성/수정/삭제/좋아요 API가 차단되는지 확인
- 작성자가 아닌 계정에서 수정/삭제 API가 차단되는지 확인
- Vercel 환경변수와 Google OAuth Redirect URI가 배포 도메인 기준으로 설정되었는지 확인

## MVP 제외 범위

현재 MVP와 이번 확장 범위에서는 아래 기능을 구현하지 않습니다.

- 댓글
- 신고
- 관리자 페이지
- 이미지 업로드
- 프로필 이미지
- 알림
- 팔로우
- 북마크
- Supabase Auth
- Supabase RLS
