import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import dayjs from 'dayjs';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: string | Date) {
  return dayjs(date).format('MMM D, YYYY');
}

export function formatDateTime(date: string | Date) {
  return dayjs(date).format('MMM D, YYYY HH:mm');
}

export function formatCurrency(amount: number, currency = 'USD') {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatNumber(num: number) {
  return new Intl.NumberFormat('en-US').format(num);
}

export function getStatusColor(status: string) {
  const colors: Record<string, string> = {
    DRAFT: 'bg-gray-100 text-gray-800',
    PENDING_APPROVAL: 'bg-amber-100 text-amber-800',
    SCHEDULED: 'bg-blue-100 text-blue-800',
    ACTIVE: 'bg-green-100 text-green-800',
    DRAW_DAY: 'bg-purple-100 text-purple-800',
    DRAWN: 'bg-yellow-100 text-yellow-800',
    CLOSED: 'bg-gray-100 text-gray-800',
    CANCELLED: 'bg-red-100 text-red-800',
    APPROVED: 'bg-green-100 text-green-800',
    REJECTED: 'bg-red-100 text-red-800',
    SELECTED: 'bg-blue-100 text-blue-800',
    VERIFIED: 'bg-green-100 text-green-800',
    CONTACTED: 'bg-yellow-100 text-yellow-800',
    ACCEPTED: 'bg-green-100 text-green-800',
    DECLINED: 'bg-red-100 text-red-800',
    FULFILLED: 'bg-green-100 text-green-800',
    EXPIRED: 'bg-gray-100 text-gray-800',
    SUBMITTED: 'bg-blue-100 text-blue-800',
    PENDING: 'bg-yellow-100 text-yellow-800',
  };
  return colors[status] || 'bg-gray-100 text-gray-800';
}

export function getCampaignTypeIcon(type: string) {
  const icons: Record<string, string> = {
    TRANSACTION_BASED: '💳',
    DEPOSIT_BASED: '💰',
    ACCOUNT_OPENING: '🏦',
    MILESTONE: '🎯',
    REFERRAL: '👥',
    HYBRID: '🔄',
  };
  return icons[type] || '📋';
}

export function getPrizeCategoryIcon(category: string) {
  const icons: Record<string, string> = {
    VEHICLE: '🚗',
    ELECTRONICS: '📱',
    GOLD: '🥇',
    JEWELRY: '💎',
    CASH: '💵',
    TRAVEL: '✈️',
    SERVICE: '🎁',
    MERCHANDISE: '📦',
  };
  return icons[category] || '🎁';
}
