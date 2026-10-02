import type { Metadata } from "next";
import Link from "next/link";
import PageBackHeader from "@/app/components/common/PageBackHeader";

export const metadata: Metadata = {
  title: "서비스 이용약관 | 쓸래",
  description: "쓸래 서비스 이용약관",
};

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-base font-normal leading-8 text-[#303030]">
      {children}
    </h2>
  );
}

export default function TermsPage() {
  return (
    <>
      <PageBackHeader
        backIconStrokeWidth={1.25}
        fullHeightActions
        title="서비스 이용약관"
        titleClassName="text-base font-normal leading-6 text-[#121212]"
      />

      <article className="-mx-1 -mb-24 pb-10 pt-[18px] text-base font-normal leading-8 text-[#303030]">
        <header>
          <p>서비스 이용약관 (시행일 2026년 10월 2일)</p>
          <p className="mt-8">
            이 약관은 쓸래(익명 리뷰 서비스)가 제공하는 서비스의 이용 조건과
            운영자와 이용자의 권리·의무를 정합니다. 서비스를 이용하면 이
            약관에 동의한 것으로 봅니다.
          </p>
        </header>

        <section className="mt-8">
          <SectionTitle>1. 목적과 적용</SectionTitle>
          <p className="mt-1">
            이 약관은 쓸래의 회원 가입, 로그인, 리뷰 작성·조회와 그 밖의 관련
            기능에 적용됩니다. 이 약관에서 정하지 않은 사항은 관련 법령과
            서비스에 별도로 안내한 정책을 따릅니다.
          </p>
        </section>

        <section className="mt-8">
          <SectionTitle>2. 계정과 로그인</SectionTitle>
          <p className="mt-1">
            이용자는 Google 또는 Kakao 계정으로 로그인해 서비스 계정을 만들 수
            있습니다. 이용자는 자신의 로그인 계정을 안전하게 관리해야 하며,
            다른 사람의 계정을 사용하거나 계정을 양도해서는 안 됩니다. 서비스는
            법정대리인 동의 절차를 마련하지 않았으므로 만 14세 미만 이용자는
            가입하거나 서비스를 이용할 수 없습니다.
          </p>
        </section>

        <section className="mt-8">
          <SectionTitle>3. 제공하는 서비스</SectionTitle>
          <p className="mt-1">
            서비스는 음식과 장소에 관한 익명 리뷰 작성·조회, 사진 첨부, 좋아요,
            조회, 검색, 신고와 계정 관리 기능을 제공합니다. 구체적인 기능과 제공
            방식은 운영 과정에서 추가·변경되거나 종료될 수 있습니다.
          </p>
        </section>

        <section className="mt-8">
          <SectionTitle>4. 이용자의 의무</SectionTitle>
          <p className="mt-1">이용자는 다음 행위를 해서는 안 됩니다.</p>
          <ul className="mt-1 list-disc pl-6">
            <li>허위 사실, 불법 정보 또는 타인의 권리를 침해하는 내용 게시</li>
            <li>욕설, 혐오, 괴롭힘, 광고, 도배 또는 서비스 목적과 무관한 게시</li>
            <li>타인의 개인정보나 비공개 정보를 동의 없이 게시</li>
            <li>서비스의 정상적인 운영을 방해하거나 보안을 침해하려는 행위</li>
            <li>관련 법령이나 이 약관을 위반하는 그 밖의 행위</li>
          </ul>
        </section>

        <section className="mt-8">
          <SectionTitle>5. 작성한 리뷰와 권리</SectionTitle>
          <p className="mt-1">
            이용자가 작성한 리뷰의 저작권은 해당 이용자에게 있습니다. 이용자는
            자신이 작성한 내용과 첨부한 사진을 서비스에 게시할 권한이 있어야
            합니다. 서비스는 리뷰를 저장·표시하고 서비스 운영과 개선에 필요한
            범위에서만 해당 콘텐츠를 이용할 수 있습니다. 이용자가 리뷰를
            삭제하거나 회원 탈퇴로 콘텐츠가 삭제되면 서비스는 이를 더 이상
            공개하지 않습니다.
          </p>
        </section>

        <section className="mt-8">
          <SectionTitle>6. 신고, 콘텐츠 조치와 이용 제한</SectionTitle>
          <p className="mt-1">
            운영자는 신고가 접수되었거나 이 약관·법령을 위반한 콘텐츠를 확인한
            경우 해당 리뷰를 숨기거나 삭제할 수 있습니다. 반복적이거나 중대한
            위반, 서비스 운영 방해 또는 보안 위험이 확인되면 이용을 제한하거나
            계정을 삭제할 수 있습니다. 긴급한 조치가 필요한 경우에는 사전 안내
            없이 조치한 뒤 가능한 범위에서 사유를 안내할 수 있습니다.
          </p>
        </section>

        <section className="mt-8">
          <SectionTitle>7. 서비스 변경과 중단</SectionTitle>
          <p className="mt-1">
            운영자는 점검, 장애, 외부 서비스 변경 또는 운영상 필요한 사유가 있을
            때 서비스의 전부나 일부를 변경하거나 일시 중단할 수 있습니다. 중요한
            변경이나 장기간 중단은 가능한 범위에서 미리 안내합니다.
          </p>
        </section>

        <section className="mt-8">
          <SectionTitle>8. 책임의 제한</SectionTitle>
          <p className="mt-1">
            서비스의 리뷰는 이용자가 작성한 주관적인 경험과 의견이며 운영자가 그
            정확성이나 완전성을 보증하지 않습니다. 운영자는 고의 또는 중대한
            과실이 없는 한 이용자 사이의 분쟁, 외부 로그인 제공자나 통신 장애,
            이용자의 귀책사유로 발생한 손해에 책임을 지지 않습니다. 관련 법령상
            제한할 수 없는 책임은 제외합니다.
          </p>
        </section>

        <section className="mt-8">
          <SectionTitle>9. 회원 탈퇴와 개인정보</SectionTitle>
          <p className="mt-1">
            이용자는 내 정보에서 언제든지 회원 탈퇴를 요청할 수 있습니다. 탈퇴가
            완료되면 서비스 계정과 관련 데이터는 현재 공개된 삭제 정책에 따라
            처리됩니다. 개인정보의 처리 항목, 보유기간과 이용자 권리는{" "}
            <Link
              className="underline decoration-[#777777] underline-offset-4"
              href="/privacy"
            >
              개인정보처리방침
            </Link>
            에서 확인할 수 있습니다.
          </p>
        </section>

        <section className="mt-8">
          <SectionTitle>10. 약관 변경과 문의</SectionTitle>
          <p className="mt-1">
            이 약관이 변경되면 적용 전에 서비스에서 변경 내용과 시행일을
            안내합니다. 약관이나 서비스 이용에 관한 문의는{" "}
            <a
              className="underline decoration-[#777777] underline-offset-4"
              href="mailto:sseullae@gmail.com"
            >
              sseullae@gmail.com
            </a>
            으로 접수해 주세요.
          </p>
          <ul className="mt-6">
            <li>최초 공고일·시행일: 2026년 10월 2일</li>
          </ul>
        </section>
      </article>
    </>
  );
}
