'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { publicApi } from '@/lib/api';
import { formatDate, getPrizeCategoryIcon } from '@/lib/utils';
import toast from 'react-hot-toast';
import { HiSparkles, HiArrowLeft, HiTrophy } from 'react-icons/hi2';

interface PublicWinner {
  winnerId: string;
  rank: number;
  prize: { rank: number; name: string; category: string };
  drawDate: string;
  auditHash: string;
  customerCode: string;
}

export default function CampaignWinnersPage() {
  const params = useParams();
  const campaignId = params.id as string;
  const [winners, setWinners] = useState<PublicWinner[]>([]);
  const [drawDate, setDrawDate] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchWinners();
  }, [campaignId]);

  const fetchWinners = async () => {
    try {
      const winnersResponse = await publicApi.campaignWinners(campaignId);
      const list = winnersResponse.data.data;
      setWinners(list);
      if (list.length > 0) {
        setDrawDate(list[0].drawDate);
      }
    } catch (error) {
      toast.error('Failed to load winners');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
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
              <Link href="/campaigns" className="text-gray-600 hover:text-primary-600 font-medium">
                Campaigns
              </Link>
              <Link href="/dashboard" className="text-gray-600 hover:text-primary-600 font-medium">
                Dashboard
              </Link>
            </nav>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Link
          href={`/campaigns/${campaignId}`}
          className="inline-flex items-center gap-2 text-gray-600 hover:text-primary-600 mb-6"
        >
          <HiArrowLeft className="w-5 h-5" />
          Back to Campaign
        </Link>

        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="animate-pulse flex items-center gap-4 p-4 bg-gray-50 rounded-lg">
                <div className="w-12 h-12 bg-gray-200 rounded-lg"></div>
                <div className="flex-1">
                  <div className="h-4 bg-gray-200 rounded w-1/3 mb-2"></div>
                  <div className="h-3 bg-gray-200 rounded w-1/4"></div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <>
            <div className="card mb-6 text-center py-10">
              <HiTrophy className="w-16 h-16 text-yellow-500 mx-auto mb-4" />
              <h1 className="text-2xl font-bold text-gray-900">Official Winners List</h1>
              {drawDate && (
                <p className="text-gray-500 mt-2">Drawn on {formatDate(drawDate)}</p>
              )}
            </div>

            {winners.length === 0 ? (
              <div className="card text-center py-12">
                <p className="text-gray-500">
                  Winners have not been announced yet. Check back after the draw.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {winners.map((winner) => (
                  <div
                    key={winner.winnerId}
                    className="card flex items-center gap-4"
                  >
                    <div className="w-14 h-14 rounded-full bg-primary-100 flex items-center justify-center">
                      <span className="text-2xl">
                        {winner.rank === 1 ? '🥇' : winner.rank === 2 ? '🥈' : winner.rank === 3 ? '🥉' : '🎖️'}
                      </span>
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-gray-900">
                        {getPrizeCategoryIcon(winner.prize.category)} {winner.prize.name}
                      </p>
                      <p className="text-sm text-gray-500">
                        Customer {winner.customerCode} • Draw Date: {formatDate(winner.drawDate)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-gray-400">Audit Hash</p>
                      <p className="text-xs font-mono text-gray-500 truncate max-w-[180px]">
                        {winner.auditHash}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}