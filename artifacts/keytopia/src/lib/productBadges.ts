export function formatProductTag(value: string): string {
  return value.replaceAll('_', ' ');
}

export function getAvailabilityBadgeClass(availability: string): string {
  switch (availability) {
    case 'in_stock':
      return 'border-emerald-200 bg-emerald-50/95 text-emerald-800';
    case 'low_stock':
      return 'border-amber-200 bg-amber-50/95 text-amber-800';
    case 'out_of_stock':
      return 'border-rose-200 bg-rose-50/95 text-rose-800';
    case 'coming_soon':
      return 'border-violet-200 bg-violet-50/95 text-violet-800';
    default:
      return 'border-slate-200 bg-slate-50/95 text-slate-700';
  }
}

export function getProductBadgeClass(badge: string): string {
  switch (badge) {
    case 'best_seller':
      return 'border-amber-300/80 bg-gradient-to-r from-amber-400 to-orange-400 text-white shadow-amber-200/50';
    case 'new':
      return 'border-violet-300/80 bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white shadow-violet-200/50';
    case 'flash_sale':
      return 'border-rose-300/80 bg-gradient-to-r from-rose-500 to-pink-500 text-white shadow-rose-200/50';
    case 'limited_stock':
      return 'border-orange-300/80 bg-gradient-to-r from-orange-400 to-red-500 text-white shadow-orange-200/50';
    case 'popular':
      return 'border-sky-300/80 bg-gradient-to-r from-sky-500 to-blue-600 text-white shadow-sky-200/50';
    case 'best_value':
      return 'border-emerald-300/80 bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-emerald-200/50';
    default:
      return 'border-primary/30 bg-primary text-primary-foreground shadow-primary/20';
  }
}

export const productTagBaseClass =
  'inline-flex items-center rounded-full border px-2 py-1 font-display text-[10px] font-extrabold leading-none capitalize shadow-sm backdrop-blur-sm';