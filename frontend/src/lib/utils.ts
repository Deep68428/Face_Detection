import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDateTime(ts: string | null | undefined): string {
  if (!ts) return "—";
  try {
    // Standardize 'YYYY-MM-DD HH:MM:SS' to 'YYYY-MM-DDTHH:MM:SS'
    // Do NOT append 'Z' because the DB is already in local timezone (Asia/Kolkata)
    const dateStr = ts.includes('Z') || ts.includes('+') 
      ? ts 
      : ts.trim().replace(' ', 'T');
      
    const date = new Date(dateStr);
    
    // Check if valid date
    if (isNaN(date.getTime())) return ts;

    return new Intl.DateTimeFormat('en-GB', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).format(date).replace(',', '');
  } catch (e) {
    return ts;
  }
}
