"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";

interface DateRangeFilterProps {
  dateFrom: string;
  dateTo: string;
  onDateFromChange: (v: string) => void;
  onDateToChange: (v: string) => void;
  onApply: () => void;
  csvUrl?: string;
}

export function DateRangeFilter({
  dateFrom,
  dateTo,
  onDateFromChange,
  onDateToChange,
  onApply,
  csvUrl,
}: DateRangeFilterProps) {
  return (
    <div className="flex flex-wrap items-end gap-3">
      <div>
        <Label className="text-xs text-muted-foreground">開始日</Label>
        <Input
          type="date"
          value={dateFrom}
          onChange={(e) => onDateFromChange(e.target.value)}
          className="w-40"
        />
      </div>
      <div>
        <Label className="text-xs text-muted-foreground">終了日</Label>
        <Input
          type="date"
          value={dateTo}
          onChange={(e) => onDateToChange(e.target.value)}
          className="w-40"
        />
      </div>
      <Button onClick={onApply} variant="secondary">
        表示
      </Button>
      {csvUrl && (
        <a href={csvUrl} download>
          <Button variant="outline" size="sm">
            <Download className="mr-1 h-3 w-3" />
            CSV
          </Button>
        </a>
      )}
      <Button
        variant="outline"
        size="sm"
        onClick={() => window.print()}
      >
        印刷
      </Button>
    </div>
  );
}
