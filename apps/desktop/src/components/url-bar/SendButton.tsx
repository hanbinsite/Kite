import { Send, Loader2, Check, X } from "lucide-react";

export type SendButtonState = "idle" | "loading" | "success" | "error";

interface SendButtonProps {
  state: SendButtonState;
  disabled?: boolean;
  onClick: () => void;
}

export function SendButton({ state, disabled, onClick }: SendButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`
        flex items-center gap-1.5 h-8 px-4 rounded-md font-medium text-sm transition-all
        ${state === "loading" ? "animate-pulse-glow bg-brand text-white pointer-events-none" : ""}
        ${state === "success" ? "bg-accent-success text-white" : ""}
        ${state === "error" ? "bg-accent-danger text-white" : ""}
        ${state === "idle" ? "bg-brand text-white hover:bg-brand-hover hover:scale-[1.02] hover:glow-brand" : ""}
        disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:hover:shadow-none
      `}
    >
      {state === "loading" && <Loader2 className="w-4 h-4 animate-spin" />}
      {state === "success" && <Check className="w-4 h-4" />}
      {state === "error" && <X className="w-4 h-4" />}
      {state === "idle" && <Send className="w-4 h-4" />}
      <span>{state === "loading" ? "Cancel" : "Send"}</span>
    </button>
  );
}
