import { useState, useCallback } from "react";
import { useGrpcStore } from "../../stores/grpc-store";
import type { GrpcMethodInfo, GrpcServiceInfo } from "@api-client/core/grpc";
import { Send, FileCode, AlertCircle, Loader2, Search } from "lucide-react";
import { useTranslation } from "react-i18next";

interface GrpcPanelProps {
  connectionId: string;
}

export function GrpcPanel({ connectionId }: GrpcPanelProps) {
  const { t } = useTranslation();
  const [url, setUrl] = useState("http://localhost:50051");
  const [protoPath, setProtoPath] = useState("");
  const [serviceName, setServiceName] = useState("");
  const [methodName, setMethodName] = useState("");
  const [requestJson, setRequestJson] = useState("{}");
  const [selectedMethod, setSelectedMethod] = useState<GrpcMethodInfo | null>(null);

  const parsedProto = useGrpcStore((s) => s.parsedProtos[connectionId]);
  const requestState = useGrpcStore((s) => s.requests[connectionId]);
  const discoveredServices = useGrpcStore((s) => s.discoveredServices[connectionId]);
  const parseProto = useGrpcStore((s) => s.parseProto);
  const sendRequest = useGrpcStore((s) => s.sendRequest);
  const reflectServices = useGrpcStore((s) => s.reflectServices);

  const methods = parsedProto?.methods ?? [];
  const availableServices = discoveredServices ?? [];

  const uniqueServices = methods.length > 0
    ? [...new Set(methods.map((m) => m.serviceName))]
    : availableServices.map((s: GrpcServiceInfo) => s.serviceName);
  const serviceMethods = methods.length > 0
    ? methods.filter((m) => m.serviceName === serviceName)
    : (availableServices.find((s: GrpcServiceInfo) => s.serviceName === serviceName)?.methods ?? []);

  const loading = requestState?.loading ?? false;
  const response = requestState?.response;
  const error = requestState?.error;
  const streamMessages = requestState?.streamMessages ?? [];

  const handleDiscover = useCallback(async () => {
    if (!url.trim()) return;
    await reflectServices(connectionId, url.trim());
  }, [connectionId, url, reflectServices]);

  const handleParse = useCallback(async () => {
    if (!protoPath.trim()) return;
    await parseProto(connectionId, protoPath.trim());
  }, [connectionId, protoPath, parseProto]);

  const handleServiceChange = useCallback((svc: string) => {
    setServiceName(svc);
    setMethodName("");
    setSelectedMethod(null);
  }, []);

  const handleMethodChange = useCallback((name: string) => {
    setMethodName(name);
    const allMethods = methods.length > 0
      ? methods
      : availableServices.flatMap((s: GrpcServiceInfo) => s.methods);
    const method = allMethods.find(
      (m) => m.methodName === name && m.serviceName === serviceName,
    );
    setSelectedMethod(method ?? null);
  }, [methods, availableServices, serviceName]);

  const handleSend = useCallback(async () => {
    if (!serviceName || !methodName) return;
    await sendRequest({
      requestId: connectionId,
      url,
      serviceName,
      methodName,
      requestJson,
      protoFileId: connectionId,
    });
  }, [connectionId, url, serviceName, methodName, requestJson, sendRequest]);

  const hasMethods = uniqueServices.length > 0;

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 h-[44px] px-3 border-b border-border-muted shrink-0">
        <span className="shrink-0 font-mono text-[10px] font-semibold px-1.5 py-0.5 rounded bg-method-grpc/15 text-method-grpc">
          {t("grpc.label")}
        </span>
        <input
          type="text"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder={t("grpc.urlPlaceholder")}
          className="flex-1 h-[28px] px-2 bg-bg-input border border-border-muted rounded text-[12px] text-fg-primary placeholder:text-fg-tertiary outline-none focus:border-border-focus font-mono"
        />
        <button
          onClick={handleDiscover}
          disabled={loading || !url.trim()}
          className="flex items-center gap-1 h-[28px] px-3 rounded bg-method-grpc/15 text-method-grpc text-[11px] font-semibold cursor-pointer hover:bg-method-grpc/25 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? <Loader2 size={12} className="animate-spin" /> : <Search size={12} />}
          {t("grpc.discover")}
        </button>
        <button
          onClick={handleSend}
          disabled={loading || !serviceName || !methodName}
          className="flex items-center gap-1 h-[28px] px-3 rounded bg-brand text-white text-[11px] font-semibold cursor-pointer hover:bg-brand-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
          {loading ? t("grpc.sending") : t("grpc.invoke")}
        </button>
      </div>

      <div className="flex items-center gap-2 px-3 py-2 border-b border-border-muted shrink-0">
        <input
          type="text"
          value={protoPath}
          onChange={(e) => setProtoPath(e.target.value)}
          placeholder={t("grpc.protoPath")}
          className="flex-1 h-[28px] px-2 bg-bg-input border border-border-muted rounded text-[12px] text-fg-primary placeholder:text-fg-tertiary outline-none focus:border-border-focus font-mono"
        />
        <button
          onClick={handleParse}
          disabled={!protoPath.trim()}
          className="flex items-center gap-1 h-[28px] px-3 rounded bg-method-grpc/15 text-method-grpc text-[11px] font-semibold cursor-pointer hover:bg-method-grpc/25 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <FileCode size={12} />
          {t("grpc.parseProto")}
        </button>
      </div>

      {hasMethods && (
        <div className="flex items-center gap-2 px-3 py-2 border-b border-border-muted shrink-0">
          <select
            value={serviceName}
            onChange={(e) => handleServiceChange(e.target.value)}
            className="flex-1 h-[28px] px-2 bg-bg-input border border-border-muted rounded text-[12px] text-fg-primary outline-none cursor-pointer"
          >
            <option value="">{t("grpc.selectService")}</option>
            {uniqueServices.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <select
            value={methodName}
            onChange={(e) => handleMethodChange(e.target.value)}
            className="flex-1 h-[28px] px-2 bg-bg-input border border-border-muted rounded text-[12px] text-fg-primary outline-none cursor-pointer"
          >
            <option value="">{t("grpc.selectMethod")}</option>
            {serviceMethods.map((m) => (
              <option key={m.methodName} value={m.methodName}>
                {m.methodName} ({m.serverStreaming ? t("grpc.serverStreaming") : t("grpc.unary")})
              </option>
            ))}
          </select>
        </div>
      )}

      {selectedMethod && (
        <div className="px-3 py-1.5 border-b border-border-muted shrink-0">
          <span className="font-mono text-[10px] text-fg-tertiary">
            {selectedMethod.inputType} → {selectedMethod.outputType}
            {selectedMethod.serverStreaming && ` (${t("grpc.serverStreaming")})`}
          </span>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 px-3 py-1.5 bg-accent-danger/8 border-b border-border-muted text-[11px] text-accent-danger">
          <AlertCircle size={12} className="shrink-0" />
          <span className="truncate">{error}</span>
        </div>
      )}

      <div className="flex-1 flex flex-col min-h-0">
        <div className="flex items-center h-[28px] px-3 border-b border-border-muted shrink-0">
          <span className="font-sans text-[10px] font-semibold text-fg-tertiary uppercase tracking-[0.06em]">
            {t("grpc.requestJson")}
          </span>
        </div>
        <textarea
          value={requestJson}
          onChange={(e) => setRequestJson(e.target.value)}
          className="flex-1 min-h-[80px] p-3 bg-bg-input border-none outline-none resize-none font-mono text-[12px] text-fg-primary leading-snug"
          placeholder={t("grpc.requestPlaceholder")}
          spellCheck={false}
        />

        {(response || streamMessages.length > 0) && (
          <div className="flex flex-col border-t border-border-muted min-h-0">
            <div className="flex items-center h-[28px] px-3 border-b border-border-muted shrink-0">
              <span className="font-sans text-[10px] font-semibold text-fg-tertiary uppercase tracking-[0.06em]">
                {t("grpc.response")} {response?.timeMs ? `(${response.timeMs}ms)` : ""}
              </span>
              {response?.status && (
                <span className={`ml-2 font-mono text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                  response.status === "ok"
                    ? "bg-accent-success/15 text-accent-success"
                    : response.status === "streaming"
                      ? "bg-accent-warning/15 text-accent-warning"
                      : "bg-accent-danger/15 text-accent-danger"
                }`}>
                  {response.status}
                </span>
              )}
            </div>
            <div className="flex-1 overflow-auto min-h-[60px] max-h-[50%]">
              {streamMessages.length > 0 ? (
                <div className="flex flex-col">
                  {streamMessages.map((msg, i) => (
                    <div
                      key={i}
                      className={`px-3 py-1 border-b border-border-muted font-mono text-[12px] ${
                        msg.streamType === "error" ? "bg-accent-danger/8 text-accent-danger" :
                        msg.streamType === "end" ? "bg-bg-elevated text-fg-tertiary" :
                        ""
                      }`}
                    >
                      <pre className="whitespace-pre-wrap break-all">{msg.body}</pre>
                    </div>
                  ))}
                </div>
              ) : response?.body ? (
                <pre className="p-3 font-mono text-[12px] text-fg-primary whitespace-pre-wrap break-all">
                  {response.body}
                </pre>
              ) : null}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}