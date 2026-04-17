import { useState, useRef, useEffect } from "react";
import { ChevronDown } from "lucide-react";
import type { HttpMethod } from "@api-client/types";

const HTTP_METHODS: HttpMethod[] = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"];

const METHOD_STYLES: Record<HttpMethod, { color: string; bg: string }> = {
  GET: { color: "text-method-get", bg: "bg-method-get/10" },
  POST: { color: "text-method-post", bg: "bg-method-post/10" },
  PUT: { color: "text-method-put", bg: "bg-method-put/10" },
  PATCH: { color: "text-method-patch", bg: "bg-method-patch/10" },
  DELETE: { color: "text-method-delete", bg: "bg-method-delete/10" },
  HEAD: { color: "text-method-head", bg: "bg-method-head/10" },
  OPTIONS: { color: "text-method-options", bg: "bg-method-options/10" },
};

interface MethodSelectorProps {
  method: HttpMethod;
  onChange: (method: HttpMethod) => void;
}

export function MethodSelector({ method, onChange }: MethodSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const style = METHOD_STYLES[method];

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-1 px-2 h-8 rounded-md font-mono text-xs font-bold ${style.color} ${style.bg} hover:brightness-125 transition-all`}
      >
        {method}
        <ChevronDown className="w-3 h-3" />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-1 w-28 bg-bg-elevated border border-border-default rounded-md shadow-lg z-50 overflow-hidden animate-fade-in-up">
          {HTTP_METHODS.map((m) => {
            const mStyle = METHOD_STYLES[m];
            return (
              <button
                key={m}
                onClick={() => {
                  onChange(m);
                  setIsOpen(false);
                }}
                className={`w-full px-3 py-2 text-left font-mono text-xs font-bold hover:bg-bg-hover transition-colors ${mStyle.color}`}
              >
                {m}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
