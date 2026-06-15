import fs from 'fs';

let content = fs.readFileSync('src/components/MarketTab.tsx', 'utf-8');

// Rate-based stored stock chips
content = content.replace(
  '<span className="text-xs font-mono px-2.5 py-1.5 bg-[#0c0d10] border border-[#2a2c33] text-zinc-300 rounded-md flex items-center gap-1.5 font-bold">\n                                    Bronze 15<img src={ducatIcon} className="w-3.5 h-3.5 object-contain inline -mt-0.5" alt="D" referrerPolicy="no-referrer" /> Hold: <span className="text-white font-extrabold text-sm">{listing.counts.bronze15}</span>\n                                  </span>',
  '<span className="text-xs font-mono px-2.5 py-1.5 bg-[#0c0d10] border border-[#cd7f32]/40 text-[#cd7f32] rounded-md flex items-center gap-1.5 font-bold">\n                                    15 <img src={ducatIcon} className="w-3.5 h-3.5 object-contain inline -mt-0.5" alt="D" referrerPolicy="no-referrer" /> Hold: <span className="text-white font-extrabold text-sm">{listing.counts.bronze15}</span>\n                                  </span>'
);

content = content.replace(
  '<span className="text-xs font-mono px-2.5 py-1.5 bg-[#0c0d10] border border-[#2a2c33] text-zinc-300 rounded-md flex items-center gap-1.5 font-bold">\n                                    Bronze 25<img src={ducatIcon} className="w-3.5 h-3.5 object-contain inline -mt-0.5" alt="D" referrerPolicy="no-referrer" /> Hold: <span className="text-white font-extrabold text-sm">{listing.counts.bronze25}</span>\n                                  </span>',
  '<span className="text-xs font-mono px-2.5 py-1.5 bg-[#0c0d10] border border-[#cd7f32]/50 text-[#cd7f32] rounded-md flex items-center gap-1.5 font-bold">\n                                    25 <img src={ducatIcon} className="w-3.5 h-3.5 object-contain inline -mt-0.5" alt="D" referrerPolicy="no-referrer" /> Hold: <span className="text-white font-extrabold text-sm">{listing.counts.bronze25}</span>\n                                  </span>'
);

content = content.replace(
  '<span className="text-xs font-mono px-2.5 py-1.5 bg-[#0c0d10] border border-[#2a2c33] text-zinc-300 rounded-md flex items-center gap-1.5 font-bold">\n                                    Silver 45<img src={ducatIcon} className="w-3.5 h-3.5 object-contain inline -mt-0.5" alt="D" referrerPolicy="no-referrer" /> Hold: <span className="text-white font-extrabold text-sm">{listing.counts.silver45}</span>\n                                  </span>',
  '<span className="text-xs font-mono px-2.5 py-1.5 bg-[#0c0d10] border border-slate-600/70 text-slate-300 rounded-md flex items-center gap-1.5 font-bold">\n                                    45 <img src={ducatIcon} className="w-3.5 h-3.5 object-contain inline -mt-0.5" alt="D" referrerPolicy="no-referrer" /> Hold: <span className="text-white font-extrabold text-sm">{listing.counts.silver45}</span>\n                                  </span>'
);

content = content.replace(
  '<span className="text-xs font-mono px-2.5 py-1.5 bg-[#0c0d10] border border-[#2a2c33] text-zinc-300 rounded-md flex items-center gap-1.5 font-bold">\n                                    Silver 65<img src={ducatIcon} className="w-3.5 h-3.5 object-contain inline -mt-0.5" alt="D" referrerPolicy="no-referrer" /> Hold: <span className="text-white font-extrabold text-sm">{listing.counts.silver65}</span>\n                                  </span>',
  '<span className="text-xs font-mono px-2.5 py-1.5 bg-[#0c0d10] border border-slate-550/80 text-slate-300 rounded-md flex items-center gap-1.5 font-bold">\n                                    65 <img src={ducatIcon} className="w-3.5 h-3.5 object-contain inline -mt-0.5" alt="D" referrerPolicy="no-referrer" /> Hold: <span className="text-white font-extrabold text-sm">{listing.counts.silver65}</span>\n                                  </span>'
);

content = content.replace(
  '<span className="text-xs font-mono px-2.5 py-1.5 bg-[#0c0d10] border border-[#2a2c33] text-zinc-300 rounded-md flex items-center gap-1.5 font-bold">\n                                    Gold 100<img src={ducatIcon} className="w-3.5 h-3.5 object-contain inline -mt-0.5" alt="D" referrerPolicy="no-referrer" /> Hold: <span className="text-white font-extrabold text-sm">{listing.counts.gold}</span>\n                                  </span>',
  '<span className="text-xs font-mono px-2.5 py-1.5 bg-[#0c0d10] border border-[#d4af37]/45 text-[#d4af37] rounded-md flex items-center gap-1.5 font-bold">\n                                    100 <img src={ducatIcon} className="w-3.5 h-3.5 object-contain inline -mt-0.5" alt="D" referrerPolicy="no-referrer" /> Hold: <span className="text-white font-extrabold text-sm">{listing.counts.gold}</span>\n                                  </span>'
);


fs.writeFileSync('src/components/MarketTab.tsx', content);
