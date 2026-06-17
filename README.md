# Review Project

Next.js App Router 기반의 익명 음식 리뷰 플랫폼 MVP입니다.

이 프로젝트는 읽기는 자유롭게 허용하고, 게시글 작성/수정/삭제/좋아요/내 정보 관리는 Google 로그인 사용자에게만 허용하는 구조로 구현되어 있습니다.

## 주요 기능

- Google 로그인/로그아웃
- 로그인 사용자와 Supabase `users` 테이블 동기화
- 가입 시 익명ID 자동 생성
- 커뮤니티 게시글 목록, 검색, 정렬, 더보기
- 게시글 상세 조회
- 로그인 사용자 기준 24시간 조회수 증가 제한
- 게시글 작성, 수정, 삭제
- 좋아요 토글
- 내 정보 조회
- 닉네임 변경
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

## 보안 원칙

- 브라우저에서 Supabase DB에 직접 접근하지 않습니다.
- 클라이언트는 Next.js Route Handler(`/api/...`)만 호출합니다.
- Supabase Service Role Key는 서버 코드에서만 사용합니다.
- Supabase Auth와 Supabase RLS는 사용하지 않습니다.
- 실제 환경변수 값은 Git에 포함하지 않습니다.
- `.env.local`은 Git에서 제외합니다.
- `.env.example`에는 변수 이름과 TODO만 유지합니다.

## 환경변수

`.env.local`에 아래 값을 직접 입력해야 합니다.

```env
AUTH_SECRET=
AUTH_GOOGLE_ID=
AUTH_GOOGLE_SECRET=
AUTH_URL=

SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

`AUTH_URL`은 로컬 개발 시 보통 아래 값을 사용합니다.

```env
AUTH_URL=http://localhost:3000
```

배포 환경에서는 배포 도메인에 맞게 변경해야 합니다.

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

## 배포 전 확인

- `.env.local`이 Git에 포함되지 않았는지 확인
- `.env.example`에 실제 키가 없는지 확인
- 배포 플랫폼에 환경변수를 직접 등록
- Google OAuth Redirect URI에 배포 콜백 URL 추가

예시:

```text
https://your-domain.com/api/auth/callback/google
```

## 데이터베이스

Supabase PostgreSQL을 사용합니다.

주요 테이블:

- `users`
- `posts`
- `likes`
- `post_views`

회원 탈퇴와 게시글 삭제는 Hard Delete 정책을 따릅니다. 관련 데이터 삭제는 외래키 `ON DELETE CASCADE` 설정을 기준으로 처리합니다.
