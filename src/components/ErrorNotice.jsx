import { useEffect, useRef } from "react";

export default function ErrorNotice({ error }) {
  const notice = useRef(null);
  const describe = (value) => {
    if (typeof value === "string") return value;
    if (Array.isArray(value)) return value.map(describe).join("; ");
    if (value && typeof value === "object") return value.msg || value.message || describe(value.detail) || "The request could not be completed.";
    return "";
  };
  const message = describe(error);
  useEffect(() => { if (message) notice.current?.scrollIntoView?.({ block: "nearest", behavior: "smooth" }); }, [message]);
  return message ? <div ref={notice} role="alert" className="my-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800 break-words">{message}</div> : null;
}
