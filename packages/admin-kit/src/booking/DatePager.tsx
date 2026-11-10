import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button, Input } from '../components/ui';
import { addDaysStr, today } from './fmt';

/** ‹ date › control used by every daily board. */
export default function DatePager({ value, onChange }: { value: string; onChange: (d: string) => void }) {
  return <div className="flex items-center gap-1"><Button variant="outline" size="icon" aria-label="Previous day" onClick={() => onChange(addDaysStr(value, -1))}><ChevronLeft className="h-4 w-4" /></Button>
    <Input aria-label="Date" type="date" className="w-40" value={value} onChange={(e) => e.target.value && onChange(e.target.value)} />
    <Button variant="outline" size="icon" aria-label="Next day" onClick={() => onChange(addDaysStr(value, 1))}><ChevronRight className="h-4 w-4" /></Button>
    <Button variant="ghost" size="sm" onClick={() => onChange(today())}>Today</Button></div>;
}
