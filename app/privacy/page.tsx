import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "개인정보처리방침 | 리뷰쓸래",
  description: "리뷰쓸래 개인정보처리방침",
};

const handledInformation = [
  {
    title: "Google·Kakao 로그인",
    detail:
      "로그인 제공자, Provider 계정 식별자, 제공되는 경우 이메일·이메일 확인 여부·표시 이름·프로필 이미지를 회원 식별과 로그인에 이용합니다.",
  },
  {
    title: "서비스 계정과 이용 기록",
    detail:
      "내부 사용자 ID, 익명 ID, 닉네임, 게시글, 좋아요, 조회 기록, 검색어와 검색 시각을 서비스 제공과 계정 관리에 이용합니다.",
  },
  {
    title: "로그인과 보안",
    detail:
      "세션·CSRF 쿠키, 요청 IP의 일시적 처리, HMAC 기반 Rate Limit 식별자와 제한 상태를 로그인 유지, 요청 위조와 과도한 요청 방지에 이용합니다.",
  },
  {
    title: "회원 탈퇴 재인증",
    detail:
      "재인증 상태와 시각, Provider access token을 동일 계정 확인과 Provider 연결 해제를 위해 최대 10분 동안 일시적으로 처리합니다.",
  },
  {
    title: "Kakao 계정 상태 이벤트",
    detail:
      "Provider, 이벤트·트랜잭션 ID, 이벤트 유형·사유, 처리 상태·결과·전송 횟수와 시각을 연결 해제 이벤트 감사와 중복 처리 방지에 이용합니다.",
  },
];

const retentionItems = [
  ["서비스 계정과 외부 로그인 정보", "회원 탈퇴 완료 시까지"],
  ["게시글·좋아요·조회 기록", "이용자가 삭제하거나 회원 탈퇴를 완료할 때까지"],
  ["검색 기록", "최근 5개를 유지하며 삭제 또는 회원 탈퇴 완료 시까지"],
  ["로그인 세션", "발급 후 최대 7일 또는 로그아웃·탈퇴·만료 시까지"],
  ["회원 탈퇴 재인증 상태", "최대 10분 또는 취소·탈퇴 완료 시까지"],
  ["Rate Limit 상태", "정책에 따라 약 1분 또는 10분"],
  ["Vercel Runtime Logs", "현재 Hobby 요금제 기준 1시간"],
  [
    "Kakao 계정 상태 감사 기록",
    "수신일로부터 최대 90일. 자동 삭제 도입 전에는 운영자가 정기적으로 확인하여 삭제",
  ],
];

const externalServices = [
  ["Supabase", "운영 DB와 Data API", "대한민국 서울(ap-northeast-2)"],
  ["Vercel", "웹 호스팅, 서버 함수와 Runtime Logs", "서버 함수 대한민국 서울(icn1)"],
  [
    "Upstash",
    "Rate Limit과 회원 탈퇴 재인증 임시 상태",
    "GCP 도쿄(asia-northeast1) 및 Global 인프라",
  ],
  ["Google", "Google 로그인과 계정 연결 해제", "Google의 글로벌 인프라"],
  ["Kakao", "Kakao 로그인, 연결 해제와 계정 상태 웹훅", "대한민국"],
];

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-lg font-bold tracking-normal text-neutral-950">
      {children}
    </h2>
  );
}

export default function PrivacyPage() {
  return (
    <article className="space-y-10 pb-2 text-sm leading-7 text-neutral-700">
      <header className="space-y-3">
        <p className="text-xs font-semibold text-neutral-500">
          시행일 2026년 8월 23일
        </p>
        <p>
          쓸래(익명 리뷰 서비스)는 서비스 제공에 필요한 범위에서만
          개인정보를 처리하고 안전하게 관리하기 위해 다음과 같이
          개인정보처리방침을 공개합니다.
        </p>
      </header>

      <section className="space-y-4">
        <SectionTitle>1. 운영 주체와 문의처</SectionTitle>
        <dl className="divide-y divide-neutral-100 border-y border-neutral-100">
          <div className="py-3">
            <dt className="font-semibold text-neutral-900">운영자</dt>
            <dd>쓸래(익명 리뷰 서비스) 운영자</dd>
          </div>
          <div className="py-3">
            <dt className="font-semibold text-neutral-900">
              개인정보 보호 및 고충처리 담당
            </dt>
            <dd>쓸래 개발자</dd>
          </div>
          <div className="py-3">
            <dt className="font-semibold text-neutral-900">문의 이메일</dt>
            <dd>
              <a
                className="underline decoration-neutral-300 underline-offset-4"
                href="mailto:sseullae@gmail.com"
              >
                sseullae@gmail.com
              </a>
            </dd>
          </div>
        </dl>
      </section>

      <section className="space-y-4">
        <SectionTitle>2. 처리하는 개인정보와 목적</SectionTitle>
        <div className="divide-y divide-neutral-100 border-y border-neutral-100">
          {handledInformation.map((item) => (
            <div className="py-4" key={item.title}>
              <h3 className="font-semibold text-neutral-900">{item.title}</h3>
              <p className="mt-1">{item.detail}</p>
            </div>
          ))}
        </div>
        <p>
          서비스는 Google·Kakao 비밀번호를 수집하거나 저장하지 않습니다.
          Rate Limit 처리 시 원본 IP 대신 서버 비밀값으로 만든 HMAC 식별자를
          저장하며, Kakao 감사 기록에는 Provider 계정 ID, 이메일, 내부 사용자
          ID와 OAuth 토큰을 저장하지 않습니다.
        </p>
      </section>

      <section className="space-y-4">
        <SectionTitle>3. 보유기간과 삭제</SectionTitle>
        <dl className="divide-y divide-neutral-100 border-y border-neutral-100">
          {retentionItems.map(([name, period]) => (
            <div className="py-3" key={name}>
              <dt className="font-semibold text-neutral-900">{name}</dt>
              <dd>{period}</dd>
            </div>
          ))}
        </dl>
        <p>
          회원 탈퇴가 완료되면 Google 또는 Kakao 연결을 해제하고 내부 계정과
          연결된 게시글, 좋아요, 조회 기록과 검색 기록을 삭제합니다. 관계
          법령에 따라 별도 보존이 필요한 정보가 생기면 항목, 근거와 기간을 이
          방침에 추가합니다.
        </p>
      </section>

      <section className="space-y-4">
        <SectionTitle>4. 외부 서비스 이용과 국외 처리</SectionTitle>
        <p>
          서비스는 운영을 위해 아래 외부 서비스를 이용합니다. 각 제공자의
          인프라 운영에 따라 실제 처리 위치가 추가되거나 변경될 수 있습니다.
        </p>
        <dl className="divide-y divide-neutral-100 border-y border-neutral-100">
          {externalServices.map(([service, purpose, region]) => (
            <div className="py-4" key={service}>
              <dt className="font-semibold text-neutral-900">{service}</dt>
              <dd className="mt-1">{purpose}</dd>
              <dd className="text-xs leading-5 text-neutral-500">{region}</dd>
            </div>
          ))}
        </dl>
        <p>
          서비스는 이용자의 개인정보를 판매하지 않으며 법령상 근거 또는
          이용자의 동의 없이 제3자에게 제공하지 않습니다.
        </p>
      </section>

      <section className="space-y-3">
        <SectionTitle>5. 이용자의 권리</SectionTitle>
        <p>
          이용자는 프로필 조회·수정, 검색 기록과 게시글 삭제, 회원 탈퇴 기능을
          이용할 수 있으며 개인정보 열람·정정·삭제·처리정지를 요청할 수
          있습니다. 서비스 기능으로 처리하기 어려운 요청은
          sseullae@gmail.com으로 접수해 주세요.
        </p>
        <p>
          로그아웃 상태의 민감한 요청에는 현재 로그인 Provider를 통한 재인증이
          필요할 수 있습니다. 서비스는 이메일로 비밀번호, OAuth 토큰, 세션
          값이나 신분증 사본을 요구하지 않습니다.
        </p>
      </section>

      <section className="space-y-3">
        <SectionTitle>6. 쿠키</SectionTitle>
        <p>
          서비스는 로그인 유지, OAuth 요청 보호, CSRF 방지와 회원 탈퇴
          재인증을 위해 쿠키를 사용합니다. 브라우저에서 쿠키를 삭제하거나
          차단할 수 있지만 로그인과 회원 탈퇴 등 일부 기능이 동작하지 않을 수
          있습니다. 현재 맞춤형 광고나 행동 분석 SDK는 사용하지 않습니다.
        </p>
      </section>

      <section className="space-y-3">
        <SectionTitle>7. 안전성 확보조치</SectionTitle>
        <p>
          브라우저의 직접 DB 접근 차단, 서버 전용 DB 권한, 역할별 최소 권한,
          HTTPS, 인증·소유권 검사, Rate Limit, 원자적 DB 처리와 비밀값의
          클라이언트 노출 방지 등 필요한 보호조치를 적용합니다.
        </p>
      </section>

      <section className="space-y-3">
        <SectionTitle>8. 만 14세 미만 이용자</SectionTitle>
        <p>
          서비스는 현재 만 14세 미만을 대상으로 제공하지 않으며 연령을 별도로
          수집하지 않습니다. 법정대리인 동의와 확인 절차가 마련되기 전까지 만
          14세 미만은 가입하거나 이용하지 말아 주세요.
        </p>
      </section>

      <section className="space-y-3">
        <SectionTitle>9. 방침의 변경</SectionTitle>
        <p>
          이 방침이 변경되면 적용 전에 서비스에서 변경 내용과 시행일을
          안내합니다.
        </p>
        <ul className="text-neutral-600">
          <li>공고일: 2026년 8월 23일</li>
          <li>시행일: 2026년 8월 23일</li>
        </ul>
      </section>
    </article>
  );
}
