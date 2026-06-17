import Button from "../components/common/Button";

export default function HomePage() {
  return (
    <section className="space-y-8">
      <div className="space-y-3">
        <p className="text-sm font-medium text-neutral-500">MVP 준비 중</p>
        <h1 className="text-2xl font-bold leading-8 text-neutral-950">
          익명으로 남기는 음식 경험
        </h1>
        <p className="text-base leading-7 text-neutral-600">
          읽기는 자유롭게, 참여는 로그인 후 안전하게 시작합니다.
        </p>
      </div>

      <Button href="/community">
        <span className="text-white">게시글 목록 보기</span>
      </Button>
    </section>
  );
}
