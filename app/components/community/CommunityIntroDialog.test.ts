import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CommunityIntroDialogContent } from "./CommunityIntroDialog";
import {
  hasSeenCommunityIntro,
  markCommunityIntroSeen,
} from "./communityIntroStorage";

function createStorage(initialValue: string | null = null) {
  let value = initialValue;

  return {
    getItem: () => value,
    setItem: (_key: string, nextValue: string) => {
      value = nextValue;
    },
  };
}

describe("CommunityIntroDialogContent", () => {
  it("최초 방문자에게 서비스 안내와 닫기 버튼을 제공한다", () => {
    const html = renderToStaticMarkup(
      createElement(CommunityIntroDialogContent, { onClose: () => undefined }),
    );

    expect(html).toContain('role="dialog"');
    expect(html).toContain("다른 소비자에게 정보를");
    expect(html).toContain("공익 목적의");
    expect(html).toContain("익명 리뷰 서비스입니다.");
    expect(html).toContain("각자가 느꼈던 좋았던 점과 아쉬웠던 점을");
    expect(html).toContain("솔직하게 선택하고 리뷰를 공유합니다.");
    expect(html).toContain(">닫기</button>");
  });
});

describe("community intro visit storage", () => {
  it("확인 기록이 없으면 최초 방문으로 판단하고 닫을 때 기록한다", () => {
    const storage = createStorage();

    expect(hasSeenCommunityIntro(storage)).toBe(false);

    markCommunityIntroSeen(storage);

    expect(hasSeenCommunityIntro(storage)).toBe(true);
  });

  it("브라우저가 저장소 접근을 거부해도 팝업 흐름을 중단하지 않는다", () => {
    const blockedStorage = {
      getItem: () => {
        throw new Error("storage blocked");
      },
      setItem: () => {
        throw new Error("storage blocked");
      },
    };

    expect(hasSeenCommunityIntro(blockedStorage)).toBe(false);
    expect(() => markCommunityIntroSeen(blockedStorage)).not.toThrow();
  });
});
