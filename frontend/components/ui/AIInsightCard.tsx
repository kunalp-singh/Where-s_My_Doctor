import type { ReactNode } from "react";
import { Badge } from "./Badge";
import { Card, CardBody, CardDescription, CardHeader, CardTitle } from "./Card";

type AIInsightCardProps = {
  title: string;
  summary: string;
  insights?: string[];
  tone?: "calm" | "urgent" | "neutral";
  footer?: ReactNode;
};

const toneMap = {
  calm: { label: "Calm", variant: "info" as const },
  urgent: { label: "Urgent Triage", variant: "urgent" as const },
  neutral: { label: "AI Clinical Summary", variant: "neutral" as const },
};

export function AIInsightCard({ title, summary, insights = [], tone = "neutral", footer }: AIInsightCardProps) {
  const toneConfig = toneMap[tone];
  return (
    <Card className="relative overflow-hidden border-[#cce0d4] bg-gradient-to-br from-[#f4f8f5] via-[#f9f7f1] to-[#ebf3ee] shadow-[0_8px_30px_rgba(62,107,99,0.08)]">
      {/* Decorative leaf accent overlay */}
      <div className="pointer-events-none absolute -right-6 -top-6 h-28 w-28 rounded-full bg-[#3e6b63]/5 blur-xl" />
      
      <CardHeader className="relative z-10 border-b border-[#d7e2db]/60">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <svg className="h-4 w-4 text-[#3e6b63]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
              </svg>
              <CardTitle className="text-lg font-bold text-[#21322a]">{title}</CardTitle>
            </div>
            <CardDescription className="text-xs text-[#587066]">{summary}</CardDescription>
          </div>
          <Badge variant={toneConfig.variant}>{toneConfig.label}</Badge>
        </div>
      </CardHeader>

      <CardBody className="relative z-10">
        {insights.length > 0 ? (
          <ul className="space-y-2.5 text-sm text-[#42564f]">
            {insights.map((insight) => (
              <li key={insight} className="flex items-start gap-2.5 leading-relaxed">
                <span className="mt-1.5 h-2 w-2 flex-shrink-0 rounded-full bg-[#3e6b63]" />
                <span className="text-xs font-medium text-[#2f4239]">{insight}</span>
              </li>
            ))}
          </ul>
        ) : null}
        {footer ? <div className="mt-4">{footer}</div> : null}
      </CardBody>
    </Card>
  );
}
