import React, { useEffect, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  AreaChart,
  Area,
} from 'recharts';
import { Leaf, Fuel, Route as RouteIcon, CheckCircle2, Info } from 'lucide-react';
import type { EnvironmentalImpactReport } from '../types.ts';

interface Props {
  initialImpact?: EnvironmentalImpactReport | null;
  compact?: boolean;
}

export function ImpactSection({ initialImpact, compact = false }: Props) {
  const [impact, setImpact] = useState<EnvironmentalImpactReport | null>(initialImpact || null);
  const [co2Factor, setCo2Factor] = useState<number>(2.68);
  const [avoidanceFactor, setAvoidanceFactor] = useState<number>(0.85);
  const [loading, setLoading] = useState<boolean>(!initialImpact);

  useEffect(() => {
    let active = true;
    setLoading(true);
    fetch(`/api/impact?co2Factor=${co2Factor}&avoidanceFactor=${avoidanceFactor}`)
      .then((r) => r.json())
      .then((data: { impact?: EnvironmentalImpactReport }) => {
        if (active && data.impact) {
          setImpact(data.impact);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [co2Factor, avoidanceFactor]);

  if (!impact && loading) {
    return (
      <div className="p-8 rounded-xl border border-slate-200 bg-white text-sm text-slate-500">
        Loading environmental impact calculations...
      </div>
    );
  }

  if (!impact) return null;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-xl border border-slate-200 bg-white">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-2">
            <span>Empty km Avoided (Est.)</span>
            <RouteIcon className="w-4 h-4 text-slate-700" />
          </div>
          <div className="text-2xl font-bold text-slate-900 tabular-nums font-display">
            {impact.emptyKmAvoided.toLocaleString('en-IN')} km
          </div>
          <p className="text-xs text-slate-500 mt-1">Across matched return legs</p>
        </div>

        <div className="p-5 rounded-xl border border-slate-200 bg-white">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-2">
            <span>Est. Diesel Saved</span>
            <Fuel className="w-4 h-4 text-emerald-700" />
          </div>
          <div className="text-2xl font-bold text-slate-900 tabular-nums font-display">
            {impact.estimatedFuelSavedLitres.toLocaleString('en-IN')} L
          </div>
          <p className="text-xs text-slate-500 mt-1">Based on vehicle class efficiency</p>
        </div>

        <div className="p-5 rounded-xl border border-slate-200 bg-white">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-2">
            <span>Est. CO2 Avoided</span>
            <Leaf className="w-4 h-4 text-emerald-700" />
          </div>
          <div className="text-2xl font-bold text-emerald-700 tabular-nums font-display">
            {impact.estimatedCo2AvoidedKg.toLocaleString('en-IN')} kg
          </div>
          <p className="text-xs text-slate-500 mt-1 tabular-nums">
            ~{impact.estimatedCo2AvoidedTonnes} metric tonnes
          </p>
        </div>

        <div className="p-5 rounded-xl border border-slate-200 bg-white">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-2">
            <span>Completed Return Loads</span>
            <CheckCircle2 className="w-4 h-4 text-slate-700" />
          </div>
          <div className="text-2xl font-bold text-slate-900 tabular-nums font-display">
            {impact.successfulReturnTrips}
          </div>
          <p className="text-xs text-slate-500 mt-1 tabular-nums">
            {impact.activeMatchedTrips} total matched trips
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="p-5 rounded-xl border border-slate-200 bg-white">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h4 className="text-sm font-semibold text-slate-900">
                Estimated CO2 Avoided by Corridor (kg)
              </h4>
              <p className="text-xs text-slate-500">
                Modelled from confirmed &amp; delivered return-trip bookings
              </p>
            </div>
          </div>
          <div className="h-60 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={impact.corridorBreakdown}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="corridor" tick={{ fontSize: 11, fill: '#475569' }} />
                <YAxis tick={{ fontSize: 11, fill: '#475569' }} />
                <Tooltip />
                <Bar dataKey="co2AvoidedKg" name="Est. CO2 Avoided (kg)" fill="#16A34A" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="p-5 rounded-xl border border-slate-200 bg-white">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h4 className="text-sm font-semibold text-slate-900">
                Empty Kilometres Avoided Trend
              </h4>
              <p className="text-xs text-slate-500">Monthly corridor utilization progression</p>
            </div>
          </div>
          <div className="h-60 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={impact.monthlyTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#475569' }} />
                <YAxis tick={{ fontSize: 11, fill: '#475569' }} />
                <Tooltip />
                <Area
                  type="monotone"
                  dataKey="kmAvoided"
                  name="Empty km Avoided (Est.)"
                  stroke="#0F172A"
                  fill="#0F172A"
                  fillOpacity={0.12}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {!compact && (
        <div className="p-5 rounded-xl border border-slate-200 bg-slate-50 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h4 className="text-sm font-semibold text-slate-900">
              Configurable Estimation Assumptions
            </h4>
            <span className="text-xs text-slate-500">
              Adjust parameters to inspect sensitivity
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <div className="flex justify-between text-xs font-medium text-slate-700 mb-1.5">
                <span>Diesel Emission Factor (kg CO2 / Litre)</span>
                <span className="font-mono tabular-nums">{co2Factor.toFixed(2)} kg/L</span>
              </div>
              <input
                type="range"
                min="2.4"
                max="3.0"
                step="0.02"
                value={co2Factor}
                onChange={(e) => setCo2Factor(Number(e.target.value))}
                className="w-full accent-emerald-700"
              />
            </div>

            <div>
              <div className="flex justify-between text-xs font-medium text-slate-700 mb-1.5">
                <span>Empty-Return Avoidance Ratio</span>
                <span className="font-mono tabular-nums">{Math.round(avoidanceFactor * 100)}%</span>
              </div>
              <input
                type="range"
                min="0.5"
                max="1.0"
                step="0.05"
                value={avoidanceFactor}
                onChange={(e) => setAvoidanceFactor(Number(e.target.value))}
                className="w-full accent-slate-900"
              />
            </div>
          </div>

          <div className="flex items-start gap-2 text-xs text-slate-600 pt-2 border-t border-slate-200">
            <Info className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
            <p>{impact.assumptions.disclaimer}</p>
          </div>
        </div>
      )}
    </div>
  );
}
