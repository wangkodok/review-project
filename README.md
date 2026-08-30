# 쓸래

Next.js App Router 기반의 익명 리뷰 커뮤니티 서비스입니다. 현재는 음식점 리뷰만 있습니다.

게시 글은 누구나 읽을 수 있고, Google 또는 Kakao로 로그인하면 게시 글 작성·수정·삭제, 좋아요, 검색 기록, 프로필 관리와 회원 탈퇴 기능을 사용할 수 있습니다. 공식 서비스 주소는 `https://www.sseullae.com`입니다.

## 주요 기능

- Google·Kakao 로그인과 로그아웃
- 외부 로그인 계정과 내부 사용자 계정의 안전한 연결
- 가입 시 익명 ID와 기본 닉네임 생성
- 닉네임 조회 및 변경
- 커뮤니티 게시 글 목록, 카테고리 필터와 `더보기`
- 구조화된 음식 리뷰 작성, 상세 조회, 수정과 삭제
- 게시 글 좋아요 토글과 사용자별 조회수 중복 방지
- 게시 글 검색과 로그인 사용자의 최근 검색어 저장·삭제
- 내가 작성한 게시 글과 활동 통계 조회
- 최근 로그인 재인증과 외부 Provider 연결 해제를 포함한 회원 탈퇴
- 개인정보처리방침 공개

## 기술 스택

- Next.js 16 App Router, React 19, TypeScript
- Tailwind CSS 4
- NextAuth.js Google·Kakao Provider
- Supabase PostgreSQL과 서버 전용 Supabase 클라이언트
- TanStack Query
- Upstash Redis·Rate Limit
- Lucide React
- Vitest, ESLint, GitHub Actions, Vercel

## 아키텍처 원칙

브라우저에서 Supabase DB에 직접 접근하지 않습니다.

```text
Client
-> Next.js Route Handler
-> Server-side service
-> Supabase PostgreSQL
```

- 클라이언트는 `/api/...` Route Handler만 호출합니다.
- 인증과 리소스 소유권은 서버에서 검증합니다.
- Supabase Service Role Key는 서버 전용 코드에서만 사용합니다.
- Supabase Auth는 사용하지 않고 NextAuth.js를 인증 계층으로 사용합니다.
- 현재 서버 전용 구조에서는 Supabase RLS를 사용하지 않습니다.
- `PUBLIC`, `anon`, `authenticated` 역할의 직접 DB 권한을 차단하고 필요한 `service_role` 접근만 허용합니다.
- 공개 API의 일부 경로에는 Upstash 기반 Rate Limit과 HMAC 가명 식별자를 적용합니다.

## 데이터베이스

주요 테이블은 다음과 같습니다.

- `users`
- `auth_accounts`
- `categories`
- `posts`
- `likes`
- `post_views`
- `search_histories`
- `external_auth_events`

게시 글 삭제와 회원 탈퇴는 Hard Delete 정책을 따릅니다. 사용자 또는 게시 글에 종속된 데이터는 외래키와 서버 로직을 기준으로 함께 정리합니다. Kakao 계정 상태 웹훅은 현재 감사 기록만 저장하는 `observe-only` 방식이며 자동 계정 삭제는 활성화하지 않았습니다.

## API 개요

- `GET /api/categories`
- `GET|POST /api/posts`
- `GET|PATCH|DELETE /api/posts/:postId`
- `POST /api/posts/:postId/like`
- `GET /api/search/posts`
- `GET|POST|DELETE /api/search/histories`
- `DELETE /api/search/histories/:historyId`
- `GET|PATCH /api/profile`
- `GET /api/my/posts`
- `GET|POST|DELETE /api/withdraw/reauth`
- `DELETE /api/withdraw`
- `POST /api/webhooks/kakao/account-events`

애플리케이션 API는 `success`, `data`, `message`, `code` 형식의 JSON 응답을 기본으로 사용합니다. NextAuth와 Kakao 웹훅은 각 외부 프로토콜의 응답 형식을 따릅니다.

## 환경변수

`.env.example`을 기준으로 `.env.local`을 구성합니다. 실제 값은 코드, 문서와 Git에 포함하지 않습니다.

```dotenv
AUTH_SECRET=
AUTH_GOOGLE_ID=
AUTH_GOOGLE_SECRET=
AUTH_KAKAO_ENABLED=false
AUTH_KAKAO_ID=
AUTH_KAKAO_SECRET=
AUTH_KAKAO_ACCOUNT_EVENTS_ENABLED=false
AUTH_URL=

SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
RATE_LIMIT_IDENTIFIER_SECRET=
```

로컬 개발에서는 다음 URL을 사용합니다.

```dotenv
AUTH_URL=http://localhost:3000
```

OAuth 콘솔에는 환경별 콜백 주소를 등록해야 합니다.

```text
https://your-domain.com/api/auth/callback/google
https://your-domain.com/api/auth/callback/kakao
http://localhost:3000/api/auth/callback/google
http://localhost:3000/api/auth/callback/kakao
```

`AUTH_KAKAO_ENABLED`와 `AUTH_KAKAO_ACCOUNT_EVENTS_ENABLED`는 각각 Kakao 로그인과 계정 상태 웹훅을 명시적으로 활성화하는 서버 환경변수입니다. `RATE_LIMIT_IDENTIFIER_SECRET`은 32자 이상의 별도 서버 전용 비밀값을 사용합니다.

## 로컬 실행

```bash
npm install
npm run dev
```

브라우저에서 `http://localhost:3000`을 엽니다.

## 검증

```bash
npm run test:run
npm run lint
npm run build
```

배포 전에는 다음 항목을 확인합니다.

- `.env.local`과 실제 비밀값이 Git에 포함되지 않았는지 확인
- 브라우저 Sources, Network 응답과 Storage에 서버 비밀값이 노출되지 않는지 확인
- 비로그인 및 리소스 비소유자의 변경 API 접근이 차단되는지 확인
- Vercel 환경변수와 OAuth Redirect URI가 배포 환경별로 올바른지 확인
- 배포된 공식 도메인에서 로그인, 게시 글, 프로필과 탈퇴 핵심 흐름 확인

## 현재 MVP 제외 범위

- 댓글
- 신고와 관리자 페이지
- 이미지 업로드와 프로필 이미지
- 알림, 팔로우와 북마크
- Supabase Auth와 브라우저 직접 DB 접근
- Supabase RLS
- Kakao 계정 상태 웹훅을 통한 내부 계정 자동 삭제
