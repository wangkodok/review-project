"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { usePathname } from "next/navigation";
import { Square } from "lucide-react";
import { analytics } from "@/app/lib/analytics/runtime";
import { isAnalyticsPrivacyBlocked } from "@/app/lib/analytics/config";
import { getOperatorQaConfig } from "@/app/lib/analytics/operatorQa";
import { loadOperatorQaDriver } from "@/app/lib/analytics/operatorQaDriver";

export default function OperatorQaObserver() {
  const pathname = usePathname();
  const [status, setStatus] = useState<"off" | "loading" | "active" | "stopped" | "error">("off");
  const [projectToken, setProjectToken] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [eventCount, setEventCount] = useState(0);
  const [lastEvent, setLastEvent] = useState("");
  const [error, setError] = useState("");
  const started = useRef(false);
  const current = useRef(false);

  useEffect(() => {
    current.current = true;
    const update = () => {
      if (document.visibilityState !== "hidden") analytics.updateLocation(window.location.pathname);
    };
    update();
    window.addEventListener("pageshow", update);
    document.addEventListener("visibilitychange", update);
    return () => {
      current.current = false;
      if (started.current) { started.current = false; analytics.stop(); setStatus("stopped"); }
      window.removeEventListener("pageshow", update);
      document.removeEventListener("visibilitychange", update);
    };
  }, []);
  useEffect(() => { analytics.updateLocation(window.location.pathname); }, [pathname]);

  async function start(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (started.current || process.env.NODE_ENV !== "development") return;
    const config = getOperatorQaConfig({ nodeEnv: process.env.NODE_ENV, flag: "true",
      appOrigin: window.location.origin, projectToken: projectToken.trim(), confirmed });
    if (!config) { setError("로컬 주소, 공개 프로젝트 토큰과 운영자 QA 확인란을 확인해 주세요."); return; }
    if (isAnalyticsPrivacyBlocked()) { setError("브라우저의 추적 거부(DNT/GPC) 설정으로 수집이 차단되어 있습니다."); return; }
    started.current = true;
    setProjectToken(""); setError(""); setStatus("loading");
    let connected = false;
    analytics.configure(config, async (_config, runtimeActive) => {
      const active = () => current.current && started.current && runtimeActive();
      try {
        const driver = await loadOperatorQaDriver(config, active, (name) => {
          if (!current.current || !active()) return;
          setEventCount((count) => count + 1); setLastEvent(name);
        }, () => { if (current.current && active()) setError("PostHog 전송 오류가 발생했습니다. Network에서 차단 여부를 확인해 주세요."); });
        if (active()) { connected = true; setStatus("active"); }
        return driver;
      } catch {
        if (current.current && active()) { setStatus("error"); setError("QA 수집을 시작하지 못했습니다. 새로고침 후 다시 시도해 주세요."); }
        throw new Error("operator_qa_unavailable");
      }
    });
    analytics.updateLocation(window.location.pathname);
    await analytics.start();
    if (!connected && current.current && started.current) {
      setStatus("error"); setError("QA 수집을 시작하지 못했습니다. 새로고침 후 다시 시도해 주세요.");
    }
  }

  if (process.env.NODE_ENV !== "development") return null;
  return (
    <aside aria-label="운영자 PostHog QA" className="mx-auto w-full max-w-[var(--app-frame-max-width)] border-b border-neutral-300 bg-neutral-100 p-4 text-sm text-neutral-900">
      <div className="flex items-center justify-between gap-3">
        <strong>PostHog 운영자 QA</strong>
        {status === "active" || status === "loading" ? (
          <button type="button" aria-label="QA 수집 중지" title="QA 수집 중지" className="flex h-9 w-9 shrink-0 items-center justify-center rounded border border-neutral-400 bg-white" onClick={() => { started.current = false; analytics.stop(); setStatus("stopped"); }}>
            <Square aria-hidden="true" size={16} />
          </button>
        ) : null}
      </div>
      {status === "off" ? (
        <form onSubmit={start} className="mt-3 space-y-3">
          <label className="block">공개 프로젝트 토큰 (phc_)
            <input type="password" autoComplete="off" spellCheck={false} value={projectToken} onChange={(event) => setProjectToken(event.target.value)} className="mt-1 h-10 w-full min-w-0 rounded border border-neutral-400 bg-white px-2" required />
          </label>
          <p>화면 조회·리뷰 작성 진입·저장 시도·성공·실패를 environment=test로 PostHog US Cloud에 전송합니다. 계정 정보·입력 원문·사진·화면 녹화는 제외합니다. 쿠키리스 처리에도 전송 연결 정보가 사용됩니다.</p>
          <label className="flex items-start gap-2"><input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} className="mt-1" required />운영자 테스트 전송임을 확인했습니다.</label>
          <button type="submit" className="h-10 w-full rounded border border-neutral-400 bg-white font-medium">QA 수집 시작</button>
        </form>
      ) : <p role="status" className="mt-2 break-words">{status === "active" ? "수집 중" : status === "loading" ? "준비 중" : status === "stopped" ? "새 수집 중지됨" : "시작 실패"} · SDK 전달 {eventCount}건{lastEvent ? ` · ${lastEvent}` : ""}</p>}
      {status === "stopped" ? <p className="mt-2">이미 전달된 기록은 늦게 도착할 수 있습니다. 다시 시작하려면 새로고침이 필요합니다.</p> : null}
      {error ? <p role="alert" className="mt-2 text-red-700">{error}</p> : null}
    </aside>
  );
}
