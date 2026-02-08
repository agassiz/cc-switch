import { useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useRequestDetail, useRequestPayload } from "@/lib/query/usage";
import { Copy, Check, ChevronDown, ChevronRight, X } from "lucide-react";

interface RequestDetailPanelProps {
  requestId: string;
  onClose: () => void;
}

// JSON 语法高亮渲染器
function SyntaxHighlightedJson({ data }: { data: unknown }) {
  const jsonStr = JSON.stringify(data, null, 2);

  // 逐行渲染，对 key/value 分别着色
  const lines = jsonStr.split("\n");

  return (
    <pre className="text-xs font-mono leading-relaxed">
      {lines.map((line, i) => (
        <div key={i} className="hover:bg-muted/40">
          <JsonLine line={line} />
        </div>
      ))}
    </pre>
  );
}

function JsonLine({ line }: { line: string }) {
  // 匹配 "key": value 模式
  const keyValueMatch = line.match(/^(\s*)"(.+?)":\s*(.*)$/);
  if (keyValueMatch) {
    const [, indent, key, rest] = keyValueMatch;
    return (
      <>
        {indent}
        <span className="text-purple-600 dark:text-purple-400">
          &quot;{key}&quot;
        </span>
        <span className="text-foreground">: </span>
        <JsonValue value={rest} />
      </>
    );
  }

  // 纯值行（数组元素等）
  const valueMatch = line.match(/^(\s*)(.*)$/);
  if (valueMatch) {
    const [, indent, value] = valueMatch;
    return (
      <>
        {indent}
        <JsonValue value={value} />
      </>
    );
  }

  return <>{line}</>;
}

function JsonValue({ value }: { value: string }) {
  const trimmed = value.replace(/,\s*$/, "");
  const trailing = value.slice(trimmed.length);

  // 字符串值
  if (trimmed.startsWith('"')) {
    return (
      <>
        <span className="text-green-600 dark:text-green-400">{trimmed}</span>
        {trailing}
      </>
    );
  }

  // 数字
  if (/^-?\d/.test(trimmed)) {
    return (
      <>
        <span className="text-blue-600 dark:text-blue-400">{trimmed}</span>
        {trailing}
      </>
    );
  }

  // 布尔值 / null
  if (
    trimmed === "true" ||
    trimmed === "false" ||
    trimmed === "null"
  ) {
    return (
      <>
        <span className="text-orange-600 dark:text-orange-400">{trimmed}</span>
        {trailing}
      </>
    );
  }

  // 结构符号 { } [ ]
  return <span className="text-foreground">{value}</span>;
}

function JsonViewer({
  label,
  data,
  defaultOpen = false,
}: {
  label: string;
  data: unknown;
  defaultOpen?: boolean;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(defaultOpen);
  const [copied, setCopied] = useState(false);
  const jsonStr = JSON.stringify(data, null, 2);

  const handleCopy = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      navigator.clipboard.writeText(jsonStr).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      });
    },
    [jsonStr],
  );

  // 数据大小提示
  const sizeHint =
    jsonStr.length > 1024 * 1024
      ? `${(jsonStr.length / 1024 / 1024).toFixed(1)} MB`
      : jsonStr.length > 1024
        ? `${(jsonStr.length / 1024).toFixed(1)} KB`
        : `${jsonStr.length} B`;

  return (
    <div className="rounded-lg border">
      <button
        type="button"
        className="flex w-full items-center justify-between p-3 text-left hover:bg-muted/50 transition-colors"
        onClick={() => setOpen(!open)}
      >
        <div className="flex items-center gap-2">
          {open ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          )}
          <span className="font-semibold text-sm">{label}</span>
          <span className="text-[10px] text-muted-foreground">{sizeHint}</span>
        </div>
        {open && (
          <Button
            size="sm"
            variant="ghost"
            className="h-6 px-2"
            onClick={handleCopy}
          >
            {copied ? (
              <Check className="h-3 w-3 text-green-600" />
            ) : (
              <Copy className="h-3 w-3" />
            )}
            <span className="ml-1 text-xs">
              {copied
                ? t("common.copied", "已复制")
                : t("common.copy", "复制")}
            </span>
          </Button>
        )}
      </button>
      {open && (
        <div className="max-h-[400px] overflow-auto border-t bg-muted/20 p-3">
          <SyntaxHighlightedJson data={data} />
        </div>
      )}
    </div>
  );
}

export function RequestDetailPanel({
  requestId,
  onClose,
}: RequestDetailPanelProps) {
  const { t, i18n } = useTranslation();
  const { data: request, isLoading, error } = useRequestDetail(requestId);
  const { data: payload, isLoading: payloadLoading } =
    useRequestPayload(requestId);
  const dateLocale =
    i18n.language === "zh"
      ? "zh-CN"
      : i18n.language === "ja"
        ? "ja-JP"
        : "en-US";

  if (isLoading) {
    return (
      <Dialog open onOpenChange={onClose}>
        <DialogContent className="max-w-2xl">
          <div className="h-[400px] animate-pulse rounded bg-gray-100" />
        </DialogContent>
      </Dialog>
    );
  }

  if (!request) {
    return (
      <Dialog open onOpenChange={onClose}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t("usage.requestDetail", "请求详情")}</DialogTitle>
            <DialogClose asChild>
              <Button variant="ghost" size="sm" className="absolute right-4 top-4 h-7 w-7 p-0">
                <X className="h-4 w-4" />
              </Button>
            </DialogClose>
          </DialogHeader>
          <div className="text-center text-muted-foreground">
            {error
              ? `${t("usage.queryError", "查询出错")}: ${error instanceof Error ? error.message : String(error)}`
              : t("usage.requestNotFound", "请求未找到")}
          </div>
          <div className="text-center text-xs text-muted-foreground font-mono break-all">
            ID: {requestId}
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("usage.requestDetail", "请求详情")}</DialogTitle>
          <DialogClose asChild>
            <Button variant="ghost" size="sm" className="absolute right-4 top-4 h-7 w-7 p-0">
              <X className="h-4 w-4" />
            </Button>
          </DialogClose>
        </DialogHeader>

        <div className="space-y-4">
          {/* 基本信息 */}
          <div className="rounded-lg border p-4">
            <h3 className="mb-3 font-semibold">
              {t("usage.basicInfo", "基本信息")}
            </h3>
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <dt className="text-muted-foreground">
                  {t("usage.requestId", "请求ID")}
                </dt>
                <dd className="font-mono text-xs break-all">{request.requestId}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">
                  {t("usage.time", "时间")}
                </dt>
                <dd>
                  {new Date(request.createdAt * 1000).toLocaleString(
                    dateLocale,
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">
                  {t("usage.provider", "供应商")}
                </dt>
                <dd className="text-sm">
                  <span className="font-medium">
                    {request.providerName || t("usage.unknownProvider", "未知")}
                  </span>
                  <span className="ml-2 font-mono text-xs text-muted-foreground">
                    {request.providerId}
                  </span>
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">
                  {t("usage.appType", "应用类型")}
                </dt>
                <dd>{request.appType}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">
                  {t("usage.model", "模型")}
                </dt>
                <dd className="font-mono text-xs">{request.model}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">
                  {t("usage.status", "状态")}
                </dt>
                <dd>
                  <span
                    className={`inline-flex rounded-full px-2 py-1 text-xs ${
                      request.statusCode >= 200 && request.statusCode < 300
                        ? "bg-green-100 text-green-800"
                        : "bg-red-100 text-red-800"
                    }`}
                  >
                    {request.statusCode}
                  </span>
                </dd>
              </div>
            </dl>
          </div>

          {/* Token 使用量 */}
          <div className="rounded-lg border p-4">
            <h3 className="mb-3 font-semibold">
              {t("usage.tokenUsage", "Token 使用量")}
            </h3>
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <dt className="text-muted-foreground">
                  {t("usage.inputTokens", "输入 Tokens")}
                </dt>
                <dd className="font-mono">
                  {request.inputTokens.toLocaleString()}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">
                  {t("usage.outputTokens", "输出 Tokens")}
                </dt>
                <dd className="font-mono">
                  {request.outputTokens.toLocaleString()}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">
                  {t("usage.cacheReadTokens", "缓存读取")}
                </dt>
                <dd className="font-mono">
                  {request.cacheReadTokens.toLocaleString()}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">
                  {t("usage.cacheCreationTokens", "缓存写入")}
                </dt>
                <dd className="font-mono">
                  {request.cacheCreationTokens.toLocaleString()}
                </dd>
              </div>
              <div className="col-span-2">
                <dt className="text-muted-foreground">
                  {t("usage.totalTokens", "总计")}
                </dt>
                <dd className="text-lg font-semibold">
                  {(
                    request.inputTokens + request.outputTokens
                  ).toLocaleString()}
                </dd>
              </div>
            </dl>
          </div>

          {/* 成本明细 */}
          <div className="rounded-lg border p-4">
            <h3 className="mb-3 font-semibold">
              {t("usage.costBreakdown", "成本明细")}
            </h3>
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <dt className="text-muted-foreground">
                  {t("usage.inputCost", "输入成本")}
                  <span className="ml-1 text-xs">
                    ({t("usage.baseCost", "基础")})
                  </span>
                </dt>
                <dd className="font-mono">
                  ${parseFloat(request.inputCostUsd).toFixed(6)}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">
                  {t("usage.outputCost", "输出成本")}
                  <span className="ml-1 text-xs">
                    ({t("usage.baseCost", "基础")})
                  </span>
                </dt>
                <dd className="font-mono">
                  ${parseFloat(request.outputCostUsd).toFixed(6)}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">
                  {t("usage.cacheReadCost", "缓存读取成本")}
                  <span className="ml-1 text-xs">
                    ({t("usage.baseCost", "基础")})
                  </span>
                </dt>
                <dd className="font-mono">
                  ${parseFloat(request.cacheReadCostUsd).toFixed(6)}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">
                  {t("usage.cacheCreationCost", "缓存写入成本")}
                  <span className="ml-1 text-xs">
                    ({t("usage.baseCost", "基础")})
                  </span>
                </dt>
                <dd className="font-mono">
                  ${parseFloat(request.cacheCreationCostUsd).toFixed(6)}
                </dd>
              </div>
              {/* 显示成本倍率（如果不等于1） */}
              {request.costMultiplier &&
                parseFloat(request.costMultiplier) !== 1 && (
                  <div className="col-span-2 border-t pt-3">
                    <dt className="text-muted-foreground">
                      {t("usage.costMultiplier", "成本倍率")}
                    </dt>
                    <dd className="font-mono">×{request.costMultiplier}</dd>
                  </div>
                )}
              <div
                className={`col-span-2 ${request.costMultiplier && parseFloat(request.costMultiplier) !== 1 ? "" : "border-t"} pt-3`}
              >
                <dt className="text-muted-foreground">
                  {t("usage.totalCost", "总成本")}
                  {request.costMultiplier &&
                    parseFloat(request.costMultiplier) !== 1 && (
                      <span className="ml-1 text-xs">
                        ({t("usage.withMultiplier", "含倍率")})
                      </span>
                    )}
                </dt>
                <dd className="text-lg font-semibold text-primary">
                  ${parseFloat(request.totalCostUsd).toFixed(6)}
                </dd>
              </div>
            </dl>
          </div>

          {/* 性能信息 */}
          <div className="rounded-lg border p-4">
            <h3 className="mb-3 font-semibold">
              {t("usage.performance", "性能信息")}
            </h3>
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <dt className="text-muted-foreground">
                  {t("usage.latency", "延迟")}
                </dt>
                <dd className="font-mono">{request.latencyMs}ms</dd>
              </div>
            </dl>
          </div>

          {/* 错误信息 */}
          {request.errorMessage && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-4">
              <h3 className="mb-2 font-semibold text-red-800">
                {t("usage.errorMessage", "错误信息")}
              </h3>
              <p className="text-sm text-red-700">{request.errorMessage}</p>
            </div>
          )}

          {/* 请求/响应数据 */}
          {payloadLoading && (
            <div className="rounded-lg border p-4">
              <div className="h-8 animate-pulse rounded bg-gray-100" />
            </div>
          )}
          {payload && (
            <div className="space-y-2">
              <JsonViewer
                label={`${t("usage.requestBody", "请求数据")}${payload.isStreaming ? " (streaming)" : ""}`}
                data={payload.request}
              />
              <JsonViewer
                label={
                  payload.isStreaming
                    ? t("usage.responseEvents", "响应事件 (SSE)")
                    : t("usage.responseBody", "响应数据")
                }
                data={payload.response}
              />
            </div>
          )}
          {!payloadLoading && !payload && (
            <div className="rounded-lg border p-3 text-center text-xs text-muted-foreground">
              {t(
                "usage.noPayloadData",
                "无请求/响应数据（仅记录新请求的数据）",
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
