import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type MohWeekPickerProps = {
  weekStart: string;
  onChange: (weekStart: string) => void;
};

export function MohWeekPicker({ weekStart, onChange }: MohWeekPickerProps) {
  return (
    <div>
      <Label htmlFor="week" className="text-xs">
        Week starting (Monday)
      </Label>
      <Input
        id="week"
        type="date"
        value={weekStart}
        onChange={(event) => onChange(event.target.value)}
        className="w-44"
      />
    </div>
  );
}

/** ISO week start (Monday) for a given date, formatted as YYYY-MM-DD. */
export function getWeekStart(date: Date): string {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  return d.toISOString().slice(0, 10);
}
