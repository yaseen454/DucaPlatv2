/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import React from 'react';
import { HelpCircle, Star, Sparkles, TrendingUp, Cpu, Info } from 'lucide-react';
import platinumIcon from '../data/platinum.png';
import ducatIcon from '../data/480px-OrokinDucats.png';

function PlatValue({ val, size = "w-3 h-3", className = "" }: { val: string | number; size?: string; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-0.5 font-mono ${className}`}>
      <span>{val}</span>
      <img 
        src={platinumIcon} 
        className={`${size} object-contain inline-block ml-0.5`} 
        alt="Pt" 
        referrerPolicy="no-referrer"
      />
    </span>
  );
}

function DucatValue({ val, size = "w-3 h-3", className = "" }: { val: string | number; size?: string; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-0.5 font-mono ${className}`}>
      <span>{val}</span>
      <img 
        src={ducatIcon} 
        className={`${size} object-contain inline-block ml-0.5`} 
        alt="Ducats" 
        referrerPolicy="no-referrer"
      />
    </span>
  );
}

export default function AboutInfo() {
  return (
    <div className="bg-[#14161c] border border-[#2a2c33] rounded-xl p-6 shadow-2xl space-y-8">
      {/* Introduction */}
      <div className="space-y-3">
        <h2 className="text-2xl font-light text-[#e0e1e6] flex items-center gap-2 uppercase tracking-wider" style={{ fontFamily: "'Georgia', serif" }}>
          <Info className="w-6 h-6 text-[#d4af37]" />
          Trade Analytics & Educational Concepts
        </h2>
        <p className="text-sm text-[#c4c5cc] leading-relaxed max-w-4xl">
          DucaPlat integrates real-time inventory counts with trade economics and mathematical modeling. By running hundreds of pricing combinations across distinct rarity tiers, we deliver the most reliable analysis of Warframe's second-hand prime trade markets.
        </p>
      </div>

      {/* NEW: Trade Chat Integration & The "Weight of Gold" Explanation */}
      <div className="bg-[#0b0c0f] border border-[#d4af37]/15 rounded-xl p-5.5 space-y-5 shadow-inner">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 border-b border-[#2a2c33]/70 pb-3">
          <div>
            <h3 className="text-sm font-bold text-[#d4af37] uppercase tracking-wider flex items-center gap-1.5" style={{ fontFamily: "'Georgia', serif" }}>
              <TrendingUp className="w-4 h-4 text-[#d4af37]" />
              Trade Chat Economics & "Prime Junk" Multipliers
            </h3>
            <p className="text-xs text-[#8e9299]">
              How actual players trade in bulk, and why we partition statistics around rare gold items.
            </p>
          </div>
          <span className="text-[10px] bg-[#d4af37]/10 text-[#d4af37] border border-[#d4af37]/35 px-2.5 py-0.5 rounded font-mono font-bold uppercase tracking-wider">
            Market Microstructure
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Column 1: Trade Chat Simulation */}
          <div className="lg:col-span-5 space-y-3">
            <h4 className="text-[11px] font-bold uppercase text-[#8e9299] tracking-wider font-mono">
              Warframe Trade Chat Simulator
            </h4>
            
            <div className="bg-[#060709] border border-[#1e2026] rounded-lg p-3.5 space-y-2.5 font-mono text-[11px] text-[#cfd1d6] leading-relaxed shadow-lg">
              <div className="flex items-center gap-1.5 text-zinc-500 border-b border-[#111216] pb-1.5 mb-1 text-[10px]">
                <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></span>
                <span>CHANNEL: TRADE</span>
              </div>
              
              <div className="space-y-1.5">
                <div>
                  <span className="text-[#a0c0ff] hover:underline cursor-pointer font-bold">[ArbitrageTrader]</span>
                  <span className="text-zinc-500">: </span>
                  <span className="text-[#e2e5ec]">WTB Prime Junk 6 slots for <span className="text-[#d4af37] font-bold">12p</span>, any rarity! DM me!</span>
                </div>
                
                <div className="bg-[#d4af37]/5 border-l-2 border-[#d4af37] pl-2.5 py-0.5">
                  <span className="text-[#a4f0b2] hover:underline cursor-pointer font-bold">[BulkCollector]</span>
                  <span className="text-zinc-500">: </span>
                  <span className="text-[#d4af37] font-bold">WTS Prime Junk <span className="underline">1,1,2,4,8</span> ratio! Have plenty of supply, bulk transactions preferred.</span>
                </div>

                <div>
                  <span className="text-[#a0c0ff] hover:underline cursor-pointer font-bold">[TennoSells]</span>
                  <span className="text-zinc-500">: </span>
                  <span className="text-[#e2e5ec]">WTS prime garbage 6 slots = <span className="text-[#d4af37] font-bold">15p</span> fast trade</span>
                </div>
              </div>
            </div>

            <p className="text-[11px] text-[#8e9299] leading-relaxed">
              In-game advertisements like <strong className="text-[#a4f0b2]">"1,1,2,4,8"</strong> declare the platinum price a player assigns to parts based relative to their Ducat rarities. These are standard pricing coefficients used for high-volume transactions.
            </p>
          </div>

          {/* Column 2: Breakdown of the ratio */}
          <div className="lg:col-span-7 space-y-4">
            <h4 className="text-[11px] font-bold uppercase text-[#8e9299] tracking-wider font-mono">
              Evaluating the 1,1,2,4,8 Ratio Matrix
            </h4>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-[#2a2c33]/50 text-[#8e9299] uppercase text-[10px] tracking-wider">
                    <th className="py-2 font-semibold">Tier</th>
                    <th className="py-2 font-semibold text-center">Ducat Value</th>
                    <th className="py-2 font-semibold text-center">Trade Chat Platinum Value</th>
                    <th className="py-2 font-semibold text-right">Value per Ducat</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#2a2c33]/30 text-[#e0e1e6]">
                  <tr>
                    <td className="py-2 font-medium flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#cd7f32]"></span>
                      Bronze (Common)
                    </td>
                    <td className="py-2 text-center"><DucatValue val="15" size="w-3.5 h-3.5" className="text-[#e2e5ec]" /></td>
                    <td className="py-2 text-center text-[#d4af37] font-mono font-bold"><PlatValue val="1" size="w-3.5 h-3.5" className="text-[#d4af37]" /></td>
                    <td className="py-2 text-right text-zinc-500 font-mono"><PlatValue val="0.066" size="w-2.5 h-2.5" className="text-zinc-500" /> / <DucatValue val="D" size="w-2.5 h-2.5" className="text-zinc-500" /></td>
                  </tr>
                  <tr>
                    <td className="py-2 font-medium flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#cd7f32] opacity-80"></span>
                      Bronze (Common)
                    </td>
                    <td className="py-2 text-center"><DucatValue val="25" size="w-3.5 h-3.5" className="text-[#e2e5ec]" /></td>
                    <td className="py-2 text-center text-[#d4af37] font-mono font-bold"><PlatValue val="1" size="w-3.5 h-3.5" className="text-[#d4af37]" /></td>
                    <td className="py-2 text-right text-zinc-500 font-mono"><PlatValue val="0.040" size="w-2.5 h-2.5" className="text-zinc-500" /> / <DucatValue val="D" size="w-2.5 h-2.5" className="text-zinc-500" /></td>
                  </tr>
                  <tr>
                    <td className="py-2 font-medium flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#c0c0c0]"></span>
                      Silver (Uncommon)
                    </td>
                    <td className="py-2 text-center"><DucatValue val="45" size="w-3.5 h-3.5" className="text-[#e2e5ec]" /></td>
                    <td className="py-2 text-center text-[#d4af37] font-mono font-bold"><PlatValue val="2" size="w-3.5 h-3.5" className="text-[#d4af37]" /></td>
                    <td className="py-2 text-right text-zinc-500 font-mono"><PlatValue val="0.044" size="w-2.5 h-2.5" className="text-zinc-500" /> / <DucatValue val="D" size="w-2.5 h-2.5" className="text-zinc-500" /></td>
                  </tr>
                  <tr>
                    <td className="py-2 font-medium flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#c0c0c0] opacity-85"></span>
                      Silver (Uncommon)
                    </td>
                    <td className="py-2 text-center"><DucatValue val="65" size="w-3.5 h-3.5" className="text-[#e2e5ec]" /></td>
                    <td className="py-2 text-center text-[#d4af37] font-mono font-bold"><PlatValue val="4" size="w-3.5 h-3.5" className="text-[#d4af37]" /></td>
                    <td className="py-2 text-right text-zinc-500 font-mono"><PlatValue val="0.061" size="w-2.5 h-2.5" className="text-zinc-500" /> / <DucatValue val="D" size="w-2.5 h-2.5" className="text-zinc-500" /></td>
                  </tr>
                  <tr className="bg-[#d4af37]/5 font-bold">
                    <td className="py-2 font-bold flex items-center gap-1.5 text-[#d4af37]">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#ffd700] animate-pulse"></span>
                      Gold (Rare)
                    </td>
                    <td className="py-2 text-center"><DucatValue val="100" size="w-3.5 h-3.5" className="text-[#ffd700]" /></td>
                    <td className="py-2 text-center text-[#d4af37] font-mono">
                      <PlatValue val="8" size="w-3.5 h-3.5" className="text-[#d4af37]" /> 
                      <span className="text-[10px] text-zinc-400 font-normal ml-1">(can vary up to 10p)</span>
                    </td>
                    <td className="py-2 text-right text-[#d4af37] font-mono"><PlatValue val="0.080" size="w-3 h-3" className="text-[#d4af37]" /> / <DucatValue val="D" size="w-2.5 h-2.5" className="text-zinc-500" /></td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="space-y-1.5 bg-[#14161c]/40 border border-[#2a2c33]/50 rounded-lg p-3 text-[11px] text-[#c4c5cc] leading-relaxed">
              <span className="block font-bold text-white uppercase text-[10px] tracking-wider mb-1 text-[#d4af37]">
                ⚖️ Dynamic Weight-Based Focus (Inventory-Driven Analysis):
              </span>
              Because higher-tier items carry the <strong>largest mathematical weight</strong> in your expected inventory yields, analyzing price variances prioritizes the assets you actually own of high-density.
              <ul className="list-disc pl-4 mt-1 space-y-1 text-[#8e9299]">
                <li><strong>No Gold? No Problem:</strong> If your stock is low on Gold (<DucatValue val="100" size="w-3.5 h-3.5" className="text-[#ffd700]" />) items, the algorithm automatically shifts focus to your highest-density owned tiers (e.g., Silver <DucatValue val="65" size="w-2.5 h-2.5" />, Silver <DucatValue val="45" size="w-2.5 h-2.5" />, or Bronze <DucatValue val="25" size="w-2.5 h-2.5" />).</li>
                <li>A 1p change in a single Gold or heavy Silver part yields the exact same calculation outcome as changing dozens of low-tier items. We dynamically evaluate variance against the parts that represent the maximum volumes or potential revenue in your actual stash.</li>
                <li>If the statistical group difference is <span className="text-emerald-400 font-bold font-mono text-[10px] bg-emerald-950/20 px-1 border border-emerald-900/40 rounded">Significant</span>, it means your current inventory is highly sensitive to price fluctuations of this specific highlighted asset class!</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Grid of details */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Core pricing logic */}
        <div className="bg-[#0c0d10] border border-[#2a2c33]/40 p-5 rounded-lg space-y-3">
          <h3 className="text-sm font-semibold text-[#d4af37] uppercase tracking-wider flex items-center gap-1.5" style={{ fontFamily: "'Georgia', serif" }}>
            <TrendingUp className="w-4 h-4" />
            Pricing Economics
          </h3>
          <p className="text-xs text-[#8e9299] leading-relaxed">
            In Warframe, prime parts are traded in custom amounts between players using custom Platinum amounts. For bulk junk trading, parts are generally bought/sold based on their ducat values. A standard stable market price vector follows:
          </p>
          <ul className="text-xs text-[#c4c5cc] space-y-2 pl-2 border-l border-[#d4af37]/30 font-mono">
            <li>• Bronze 15: <span className="text-[#e0e1e6] font-bold flex items-center gap-1 inline-flex"><PlatValue val="1" size="w-3.5 h-3.5" className="text-[#e0e1e6]" /></span></li>
            <li>• Bronze 25: <span className="text-[#e0e1e6] font-bold flex items-center gap-1 inline-flex"><PlatValue val="1 to 2" size="w-3.5 h-3.5" className="text-[#e0e1e6]" /></span></li>
            <li>• Silver 45: <span className="text-[#e0e1e6] font-bold flex items-center gap-1 inline-flex"><PlatValue val="2 to 4" size="w-3.5 h-3.5" className="text-[#e0e1e6]" /></span></li>
            <li>• Silver 65: <span className="text-[#e0e1e6] font-bold flex items-center gap-1 inline-flex"><PlatValue val="4 to 7" size="w-3.5 h-3.5" className="text-[#e0e1e6]" /></span></li>
            <li>• Gold 100: <span className="text-[#d4af37] font-bold flex items-center gap-1 inline-flex"><PlatValue val="5 to 10" size="w-3.5 h-3.5" className="text-[#d4af37]" /></span></li>
          </ul>
          <p className="text-[11px] text-[#8e9299]/80 leading-relaxed">
            Our calculator evaluates every permutation of these ranges (96 in narrow model, 216 in broad model) to plot an exact profit distribution of minimums, standard deviations, and maximum potential yield.
          </p>
        </div>

        {/* What is ANOVA? */}
        <div className="bg-[#0c0d10] border border-[#2a2c33]/40 p-5 rounded-lg space-y-3">
          <h3 className="text-sm font-semibold text-[#d4af37] uppercase tracking-wider flex items-center gap-1.5" style={{ fontFamily: "'Georgia', serif" }}>
            <Cpu className="w-4 h-4" />
            What is One-Way ANOVA?
          </h3>
          <p className="text-xs text-[#8e9299] leading-relaxed">
            Analysis of Variance (ANOVA) is a structural statistical test carried out to analyze whether different pricing groupings have statistically equal mean yields, or if one group significantly outperforms the others.
          </p>
          <div className="bg-[#14161c] p-2.5 rounded border border-[#2a2c33] space-y-1">
            <div className="text-[10px] text-[#8e9299] font-mono">F-Statistic calculation:</div>
            <div className="text-xs text-[#d4af37] font-mono text-center my-1 font-bold">F = MS_between / MS_within</div>
            <p className="text-[10px] text-[#8e9299]">
              Where <strong className="text-[#e0e1e6]">MS_between</strong> evaluates variance between group averages, and <strong className="text-[#e0e1e6]">MS_within</strong> tracks variances of price combinations inside each individual group.
            </p>
          </div>
          <p className="text-[11px] text-[#8e9299]/80 leading-relaxed">
            A small <strong className="text-[#c4c5cc]">p-value (&le; 0.05)</strong> provides absolute evidence that at least one of the pricing subsets is significantly more profitable than others.
          </p>
        </div>

        {/* Group definitions */}
        <div className="bg-[#0c0d10] border border-[#2a2c33]/40 p-5 rounded-lg space-y-3">
          <h3 className="text-sm font-semibold text-[#d4af37] uppercase tracking-wider flex items-center gap-1.5" style={{ fontFamily: "'Georgia', serif" }}>
            <Star className="w-4 h-4" />
            Grouping Definitions in ANOVA
          </h3>
          <p className="text-xs text-[#8e9299] leading-relaxed font-normal">
            By sorting price portfolios into different inclusion lists, we isolate the exact effect of particular price constraints on your expected yields:
          </p>
          <ul className="text-xs text-[#c4c5cc] space-y-2">
            <li>
              • <strong className="text-[#e0e1e6]">All Costs:</strong> The complete range of price models.
            </li>
            <li>
              • <strong className="text-[#e0e1e6]">Costs Without 9s / 10s:</strong> Models where premium items are artificially limited (equivalent to conservative trading models).
            </li>
            <li>
              • <strong className="text-[#e0e1e6]">Costs With 10s Only:</strong> Highly aggressive portfolios where rare parts are priced at their ceiling.
            </li>
          </ul>
        </div>

        {/* Tukey's HSD test definition */}
        <div className="bg-[#0c0d10] border border-[#2a2c33]/40 p-5 rounded-lg space-y-3">
          <h3 className="text-sm font-semibold text-[#d4af37] uppercase tracking-wider flex items-center gap-1.5" style={{ fontFamily: "'Georgia', serif" }}>
            <Sparkles className="w-4 h-4" />
            Tukey's Honest Significant Difference (HSD)
          </h3>
          <p className="text-xs text-[#8e9299] leading-relaxed">
            Tukey's post-hoc test runs a systematic pairwise comparison of every pricing group. By checking whether the difference between any two groups is genuinely notable or just coincidental variance, it alerts you if group difference is statically significant.
          </p>
          <p className="text-[11px] text-[#8e9299]/80 leading-relaxed">
            If Tukey notes a <span className="text-emerald-400 font-bold">&#10003; Significant Difference</span>, you can be statistically confident that choosing one pricing strategy over another is guaranteed to yield unique trade results in actual players transactions.
          </p>
        </div>
      </div>

      <div className="p-4 bg-[#d4af37]/5 border border-[#d4af37]/20 rounded-lg flex items-center gap-3">
        <div className="p-2 bg-[#d4af37]/10 rounded-full text-[#d4af37]">
          <HelpCircle className="w-5 h-5" />
        </div>
        <div>
          <h4 className="text-xs font-bold text-[#e0e1e6] uppercase tracking-wider" style={{ fontFamily: "'Georgia', serif" }}>Quick Legend Guide:</h4>
          <p className="text-[11px] text-[#8e9299] mt-0.5 leading-relaxed">
            <span className="font-bold text-red-400">(V) Vaulted Parts:</span> Relics currently vaulted (no longer dropping in active void missions). Prices typically peak over time. <br />
            <span className="font-bold text-teal-400">(B) Baro Exclusive:</span> Parts exclusively sold by Baro Ki'Teer during fortnightly relays.
          </p>
        </div>
      </div>
    </div>
  );
}
