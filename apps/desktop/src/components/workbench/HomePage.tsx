import { Zap, Clock, FolderOpen } from "lucide-react";
import { useTabStore, useUIStore } from "@api-client/core";

export function HomePage() {
  const openTab = useTabStore((s) => s.openTab);
  const toggleSidebar = useUIStore((s) => s.toggleSidebar);

  return (
    <div className="flex-1 flex flex-col items-center justify-center bg-bg-base overflow-y-auto p-8">
      <div className="max-w-2xl w-full">
        <div className="flex flex-col items-center mb-12">
          <div className="w-16 h-16 rounded-2xl bg-brand/20 flex items-center justify-center mb-4">
            <Zap className="w-8 h-8 text-brand" />
          </div>
          <h1 className="text-2xl font-semibold text-fg-primary mb-2">Welcome Back</h1>
          <p className="text-fg-secondary">
            Start by creating a new request or selecting an existing collection
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-8">
          <button
            onClick={() => openTab({ name: "New Request", method: "GET", url: "" })}
            className="flex items-center gap-3 p-4 bg-bg-surface border border-border-default rounded-lg hover:border-brand transition-colors text-left"
          >
            <div className="w-10 h-10 rounded-lg bg-brand/20 flex items-center justify-center">
              <Zap className="w-5 h-5 text-brand" />
            </div>
            <div>
              <div className="font-medium text-fg-primary">New Request</div>
              <div className="text-xs text-fg-secondary">Cmd + N</div>
            </div>
          </button>

          <button
            onClick={toggleSidebar}
            className="flex items-center gap-3 p-4 bg-bg-surface border border-border-default rounded-lg hover:border-brand transition-colors text-left"
          >
            <div className="w-10 h-10 rounded-lg bg-accent-info/20 flex items-center justify-center">
              <FolderOpen className="w-5 h-5 text-accent-info" />
            </div>
            <div>
              <div className="font-medium text-fg-primary">Open Collection</div>
              <div className="text-xs text-fg-secondary">Browse your collections</div>
            </div>
          </button>
        </div>

        <div className="border-t border-border-muted pt-8">
          <div className="flex items-center gap-2 mb-4">
            <Clock className="w-4 h-4 text-fg-tertiary" />
            <h2 className="text-sm font-medium text-fg-secondary">Recent Requests</h2>
          </div>
          <div className="space-y-2">
            {[
              { method: "GET", url: "/api/users", time: "2 min ago" },
              { method: "POST", url: "/api/auth/login", time: "5 min ago" },
              { method: "PUT", url: "/api/users/123", time: "10 min ago" },
            ].map((item, i) => (
              <button
                key={i}
                onClick={() =>
                  openTab({
                    name: item.url,
                    method: item.method,
                    url: `https://api.example.com${item.url}`,
                  })
                }
                className="w-full flex items-center gap-3 p-3 bg-bg-surface border border-border-default rounded-lg hover:border-brand transition-colors"
              >
                <span
                  className={`px-1.5 py-0.5 rounded text-[10px] font-bold text-white bg-method-${item.method.toLowerCase()}`}
                >
                  {item.method}
                </span>
                <span className="flex-1 text-sm text-fg-primary text-left truncate">
                  {item.url}
                </span>
                <span className="text-xs text-fg-tertiary">{item.time}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
