import fs from 'fs';

function formatMarketTab() {
  const filePath = 'src/components/MarketTab.tsx';
  if (!fs.existsSync(filePath)) {
    console.error(`File not found: ${filePath}`);
    return;
  }
  
  let content = fs.readFileSync(filePath, 'utf-8');

  // ============== resize.ts (DOM sizing and text) ==============
  content = content.replace(
      /<h4 className="text-xs font-bold text-\[\#e0e1e6\] truncate pr-8" title=\{trade\.name\}>/g,
      '<h4 className="text-sm font-bold text-[#e0e1e6] truncate pr-8" title={trade.name}>'
  );
  content = content.replace(
      /<p className="text-\[10px\] text-zinc-500 mt-0\.5">\{trade\.timestamp\}<\/p>/g,
      '<p className="text-xs text-zinc-500 mt-1">{trade.timestamp}</p>'
  );
  content = content.replace(
      'className="w-full py-1.5 mt-1 bg-emerald-900/20 hover:bg-emerald-900/40 text-emerald-400 border border-emerald-900/50 rounded text-[10px] font-bold uppercase transition-colors cursor-pointer"',
      'className="w-full py-2 mt-2 bg-emerald-900/20 hover:bg-emerald-900/40 text-emerald-400 border border-emerald-900/50 rounded text-xs font-bold uppercase transition-colors cursor-pointer"'
  );
  content = content.replace(
      /<span className="text-\[10px\] bg-zinc-800\/50 (.*?)">/g,
      '<span className="text-xs bg-zinc-800/50 $1">'
  );
  content = content.replace(
      /<span className="text-\[10px\] bg-emerald-950\/40 (.*?)">/g,
      '<span className="text-xs bg-emerald-950/40 $1">'
  );
  content = content.replace(
      'className="text-xs text-zinc-500 text-center py-4"',
      'className="text-sm text-zinc-500 text-center py-4"'
  );

  let lines = content.split('\n');
  for (let i = 1130; i < 1840; i++) {
      let line = lines[i];
      if (!line) continue;
      line = line.replace(/text-\[10px\]/g, 'text-xs');
      line = line.replace(/w-7 h-7 /g, 'w-8 h-8 text-base ');
      line = line.replace(/className="w-12 text-center bg-\[\#14161c\] border border-zinc-700 text-xs text-white font-mono h-7 /g, 'className="w-16 text-center bg-[#14161c] border border-zinc-700 text-sm text-white font-mono h-8 ');
      line = line.replace(/className="w-16 text-center bg-\[\#14161c\] border border-zinc-700 text-xs text-white font-mono h-7 /g, 'className="w-20 text-center bg-[#14161c] border border-zinc-700 text-sm text-white font-mono h-8 ');
      lines[i] = line;
  }
  content = lines.join('\n');

  // ============== replaceScript2.ts (Ducat/Plat icons for counts/rates) ==============
  content = content.replace(/\((15|25|45|65|100) Ducats\)/g, '($1 <img src={ducatIcon} className="w-3.5 h-3.5 object-contain inline -mt-0.5" alt="D" referrerPolicy="no-referrer" />)');
  content = content.replace(/(15|25|45|65|100)d parts count/g, '$1 <img src={ducatIcon} className="w-3 h-3 object-contain inline -mt-0.5" alt="D" referrerPolicy="no-referrer" /> parts count');
  content = content.replace(/(15|25|45|65|100)d part exchange rate \(Plat value\)/g, '$1 <img src={ducatIcon} className="w-3 h-3 object-contain inline -mt-0.5" alt="D" referrerPolicy="no-referrer" /> part exchange rate (<img src={platinumIcon} className="w-3 h-3 object-contain inline -mt-0.5" alt="Pt" /> value)');
  content = content.replace('Clear to 0p', 'Clear to 0 <img src={platinumIcon} className="w-3.5 h-3.5 object-contain inline -mt-0.5" alt="Pt" />');
  content = content.replace('Fine-Tune Part Prices (Plat):', 'Fine-Tune Part Prices (<img src={platinumIcon} className="w-3.5 h-3.5 object-contain inline -mt-0.5" alt="Pt" />):');
  content = content.replace('Exchange Rates (Plat value):', 'Exchange Rates (<img src={platinumIcon} className="w-3.5 h-3.5 object-contain inline -mt-0.5" alt="Pt" /> value):');

  // ============== replaceScript3.ts (Formula string icons) ==============
  content = content.replace(/\{bulkRarityPrices\.([a-zA-Z0-9]+)\}p/g, '{bulkRarityPrices.$1}<img src={platinumIcon} className="w-3 h-3 object-contain inline -mt-0.5" alt="Pt" />');
  content = content.replace(/= \{sumPricePlat\}p/g, '= {sumPricePlat}<img src={platinumIcon} className="w-3.5 h-3.5 object-contain inline -mt-0.5" alt="Pt" />');
  content = content.replace('Rate (<img src={platinumIcon} className="w-3.5 h-3.5 object-contain inline -mt-0.5" alt="Pt" /> value)', 'Rate (<img src={platinumIcon} className="w-3.5 h-3.5 object-contain inline -mt-0.5" alt="Pt" />)');
  content = content.replace('part exchange rate (<img src={platinumIcon} className="w-3 h-3 object-contain inline -mt-0.5" alt="Pt" /> value)', 'part exchange rate (<img src={platinumIcon} className="w-3 h-3 object-contain inline -mt-0.5" alt="Pt" />)');
  content = content.replace('Exchange Rates (<img src={platinumIcon} className="w-3.5 h-3.5 object-contain inline -mt-0.5" alt="Pt" /> value):', 'Exchange Rates (<img src={platinumIcon} className="w-3.5 h-3.5 object-contain inline -mt-0.5" alt="Pt" />):');

  // ============== replaceScript4.ts (listPrices plat appends) ==============
  content = content.replace(/\{listPrices\.([a-zA-Z0-9]+)\}p/g, '{listPrices.$1}<img src={platinumIcon} className="w-3.5 h-3.5 object-contain inline -mt-0.5" alt="Pt" />');

  // ============== replaceScript5.ts (Additional item hold and single 'p' matches) ==============
  content = content.replace(/(Bronze|Silver|Gold) \(?(15|25|45|65|100)d\)? Hold:/g, '$1 $2<img src={ducatIcon} className="w-3.5 h-3.5 object-contain inline -mt-0.5" alt="D" referrerPolicy="no-referrer" /> Hold:');
  content = content.replace(/(Bronze|Silver|Gold) \((15|25|45|65|100)d\)/g, '$1 ($2<img src={ducatIcon} className="w-3.5 h-3.5 object-contain inline -mt-0.5" alt="D" referrerPolicy="no-referrer" />)');
  content = content.replace(/\{listing\.price\}p /g, '{listing.price}<img src={platinumIcon} className="w-3.5 h-3.5 object-contain inline -mt-0.5" alt="Pt" /> ');
  content = content.replace(/\{listing\.price\}p\[/g, '{listing.price}<img src={platinumIcon} className="w-3.5 h-3.5 object-contain inline -mt-0.5" alt="Pt" /> [');
  content = content.replace(/<span className="text-\[10px\] text-\[\#d4af37\] font-semibold uppercase">p<\/span>/g, '<img src={platinumIcon} className="w-3.5 h-3.5 object-contain inline -mt-0.5" alt="Pt" />');

  // ============== declutter.ts (Decluttering Rate-Based & Prime Junk listings) ==============
  content = content.replace(/<span className="text-emerald-400 flex items-center gap-1\.5 bg-\[\#0f1d16\] px-3 py-1\.5 rounded-md border border-emerald-900\/50 font-bold text-xs">[\s\S]*?<\/span>[\s\S]*?<\/span>/g, '');
  content = content.replace(/className="text-xs font-mono px-2\.5 py-1\.5 bg-\[\#0c0d10\] border border-\[\#cd7f32\]\/40 text-\[\#cd7f32\] rounded-md flex items-center gap-1\.5 font-bold"/g, 'className="text-xs font-mono px-2.5 py-1.5 bg-[#0c0d10] border border-[#2a2c33] text-zinc-300 rounded-md flex items-center gap-1.5 font-bold"');
  content = content.replace(/className="text-xs font-mono px-2\.5 py-1\.5 bg-\[\#0c0d10\] border border-\[\#cd7f32\]\/50 text-\[\#cd7f32\] rounded-md flex items-center gap-1\.5 font-bold"/g, 'className="text-xs font-mono px-2.5 py-1.5 bg-[#0c0d10] border border-[#2a2c33] text-zinc-300 rounded-md flex items-center gap-1.5 font-bold"');
  content = content.replace(/className="text-xs font-mono px-2\.5 py-1\.5 bg-\[\#0c0d10\] border border-slate-600\/70 text-slate-300 rounded-md flex items-center gap-1\.5 font-bold"/g, 'className="text-xs font-mono px-2.5 py-1.5 bg-[#0c0d10] border border-[#2a2c33] text-zinc-300 rounded-md flex items-center gap-1.5 font-bold"');
  content = content.replace(/className="text-xs font-mono px-2\.5 py-1\.5 bg-\[\#0c0d10\] border border-slate-550\/80 text-slate-300 rounded-md flex items-center gap-1\.5 font-bold"/g, 'className="text-xs font-mono px-2.5 py-1.5 bg-[#0c0d10] border border-[#2a2c33] text-zinc-300 rounded-md flex items-center gap-1.5 font-bold"');
  content = content.replace(/className="text-xs font-mono px-2\.5 py-1\.5 bg-\[\#0c0d10\] border border-\[\#d4af37\]\/45 text-\[\#d4af37\] rounded-md flex items-center gap-1\.5 font-bold"/g, 'className="text-xs font-mono px-2.5 py-1.5 bg-[#0c0d10] border border-[#2a2c33] text-zinc-300 rounded-md flex items-center gap-1.5 font-bold"');
  content = content.replace(/<span className="text-\[\#cd7f32\] font-black uppercase text-\[10px\] tracking-wider">Bronze \(15d\)<\/span>/g, '<span className="text-zinc-500 font-bold text-[10px] tracking-wider uppercase">Bronze 15</span>');
  content = content.replace(/<span className="text-\[\#cd7f32\] font-black uppercase text-\[10px\] tracking-wider">Bronze \(25d\)<\/span>/g, '<span className="text-zinc-500 font-bold text-[10px] tracking-wider uppercase">Bronze 25</span>');
  content = content.replace(/<span className="text-zinc-200 font-black uppercase text-\[10px\] tracking-wider">Silver \(45d\)<\/span>/g, '<span className="text-zinc-500 font-bold text-[10px] tracking-wider uppercase">Silver 45</span>');
  content = content.replace(/<span className="text-zinc-200 font-black uppercase text-\[10px\] tracking-wider">Silver \(65d\)<\/span>/g, '<span className="text-zinc-500 font-bold text-[10px] tracking-wider uppercase">Silver 65</span>');
  content = content.replace(/<span className="text-\[\#d4af37\] font-black uppercase text-\[10px\] tracking-wider">Gold \(100d\)<\/span>/g, '<span className="text-zinc-500 font-bold text-[10px] tracking-wider uppercase">Gold 100</span>');

  fs.writeFileSync(filePath, content);
  console.log('Successfully formatted MarketTab.tsx!');
}

formatMarketTab();
