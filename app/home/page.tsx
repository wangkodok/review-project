import Button from "../components/common/Button";

export default function HomePage() {
  return (
    <section className="space-y-8">
      <div className="space-y-3 text-black">
        <p className="text-2xl font-bold">서비스 1차 베타 런칭</p>
        <p>어떤 의견이든 좋으니 말씀해 주시면 반영할게요.</p>
        <p>개선 문의: sseullae@gmail.com</p>
      </div>
      <hr />
      <div className="space-y-3 text-black">
        <h1 className="text-2xl font-bold">솔직한 리뷰 문화 함께 만들래?</h1>
        <p>먹고 리뷰로 알려주세요.</p>
      </div>

      <Button href="/community">
        <span className="text-white">커뮤니티 바로 가기</span>
      </Button>
    </section>
  );
}
