import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type MohMonthPickerProps = {
  month: string;
  onChange: (month: string) => void;
};

export function MohMonthPicker({ month, onChange }: MohMonthPickerProps) {
  return (
    <div>
      <Label htmlFor="month" className="text-xs">
        Reporting month
      </Label>
      <Input
        id="month"
        type="month"
        value={month}
        onChange={(event) => onChange(event.target.value)}
        className="w-48"
      />
    </div>
  );
}

export function getDefaultMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
