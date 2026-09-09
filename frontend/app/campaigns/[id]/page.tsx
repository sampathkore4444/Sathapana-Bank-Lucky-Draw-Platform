'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { campaignApi, entryApi, prizeApi } from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import { formatDate, formatCurrency, formatNumber, getStatusColor, getPrizeCategoryIcon } from '@/lib/utils';
import toast from 'react-hot-toast';
import { HiSparkles, HiGift, HiArrowLeft, HiCheckCircle } from 'react-icons/hi2';

interface Campaign {
  id: string;
  name: string;
  description: string;
  type: string;
  status: string;
  startDate: string;
  endDate: string;
  drawDate: string;
  eligibilityCriteria: any;
  entryRules: any[];
  termsAndConditions: string;
  prizes: Prize[];
  _count: { entries: number };
}

interface Prize {
  id: string;
  rank: number;
  name: string;
  category: string;
  description: string;
  quantity: number;
  estimatedValue: number;
  currency: string;
}

export default function CampaignDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuthStore();
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [eligibility, setEligibility] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isJoining, setIsJoining] = useState(false);

  useEffect(() => {
    fetchCampaign();
    if (user) {
      checkEligibility();
    }
  }, [user]);

  const fetchCampaign = async () => {
    try {
      const response = await campaignApi.getById(params.id as string);
      setCampaign(response.data.data);
    } catch (error) {
      toast.error('Failed to load campaign');
    } finally {
      setIsLoading(false);
    }
  };

  const checkEligibility = async () => {
    try {
      const response = await entryApi.checkEligibility(user!.id, params.id as string);
      setEligibility(response.data.data);
    } catch (error) {
      console.error('Failed to check eligibility');
    }
  };

  const handleJoin = async () => {
    if (!user) {
      router.push('/login');
      return;
    }

    setIsJoining(true);
    try {
      await entryApi.register({
        customerId: user.id,
        campaignId: params.id as string,
        entryType: 'ACCOUNT_OPENED',
      });
      toast.success('You earned 5 entries! 🎉');
      fetchCampaign();
      checkEligibility();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to join campaign');
    } finally {
      setIsJoining(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full"></div>
      </div>
    );
  }

  if (!campaign) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-500">Campaign not found</p>
          <Link href="/" className="btn btn-primary mt-4">
            Go Home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <Link href="/" className="flex items-center gap-3">
              <div className="w-10 h-10 bg-primary-600 rounded-lg flex items-center justify-center">
                <HiSparkles className="w-6 h-6 text-white" />
              </div>
              <span className="text-xl font-bold text-gray-900">Sathapana Lucky Draw</span>
            </Link>
            <nav className="flex items-center gap-4">
              <Link href="/dashboard" className="text-gray-600 hover:text-primary-600 font-medium">
                Dashboard
              </Link>
            </nav>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Back Button */}
        <Link href="/" className="inline-flex items-center gap-2 text-gray-600 hover:text-primary-600 mb-6">
          <HiArrowLeft className="w-5 h-5" />
          Back to Campaigns
        </Link>

        {/* Campaign Header */}
        <div className="card mb-8">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{campaign.name}</h1>
              <p className="text-gray-600 mt-1">{campaign.description}</p>
            </div>
            <span className={`badge ${getStatusColor(campaign.status)}`}>
              {campaign.status}
            </span>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
            <div>
              <p className="text-sm text-gray-500">Start Date</p>
              <p className="font-medium">{formatDate(campaign.startDate)}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">End Date</p>
              <p className="font-medium">{formatDate(campaign.endDate)}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Draw Date</p>
              <p className="font-medium">{formatDate(campaign.drawDate)}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Total Entries</p>
              <p className="font-medium">{formatNumber(campaign._count.entries)}</p>
            </div>
          </div>

          {/* Join Button */}
          {campaign.status === 'ACTIVE' && (
            <div className="mt-6 pt-6 border-t">
              {eligibility && !eligibility.eligible ? (
                <div className="text-center">
                  <p className="text-gray-500 mb-2">You've reached the maximum entries</p>
                  <p className="text-sm text-gray-400">
                    Current: {eligibility.currentEntries} / Max: {eligibility.maxEntries}
                  </p>
                </div>
              ) : (
                <button
                  onClick={handleJoin}
                  disabled={isJoining}
                  className="btn btn-primary w-full text-lg py-3"
                >
                  {isJoining ? (
                    'Joining...'
                  ) : (
                    <>
                      <HiGift className="w-5 h-5 inline mr-2" />
                      Join Now & Earn Entries
                    </>
                  )}
                </button>
              )}
            </div>
          )}
        </div>

        {/* Prizes */}
        <div className="card mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">🏆 Prizes</h2>
          <div className="space-y-4">
            {campaign.prizes.map((prize) => (
              <div
                key={prize.id}
                className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg"
              >
                <div className="text-3xl">
                  {getPrizeCategoryIcon(prize.category)}
                </div>
                <div className="flex-1">
                  <h3 className="font-medium text-gray-900">{prize.name}</h3>
                  <p className="text-sm text-gray-600">{prize.description}</p>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-primary-600">
                    {formatCurrency(prize.estimatedValue)}
                  </p>
                  <p className="text-xs text-gray-500">Qty: {prize.quantity}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Entry Rules */}
        <div className="card mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">📋 How to Earn Entries</h2>
          <div className="space-y-4">
            {campaign.entryRules.map((rule, index) => (
              <div
                key={index}
                className="flex items-start gap-4 p-4 bg-gray-50 rounded-lg"
              >
                <div className="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center">
                  <span className="text-sm font-bold text-primary-700">{index + 1}</span>
                </div>
                <div>
                  <p className="font-medium text-gray-900">{rule.description}</p>
                  <p className="text-sm text-gray-600">
                    Max entries: {rule.maxEntriesPerCustomer || 'Unlimited'}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Terms & Conditions */}
        {campaign.termsAndConditions && (
          <div className="card">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">📝 Terms & Conditions</h2>
            <p className="text-gray-600 text-sm">{campaign.termsAndConditions}</p>
          </div>
        )}
      </main>
    </div>
  );
}
