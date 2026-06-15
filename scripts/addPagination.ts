import fs from 'fs';

let content = fs.readFileSync('src/components/MarketTab.tsx', 'utf-8');

// 1. Add currentPage state
if (!content.includes('const [currentPage')) {
  // Find where SearchQuery is to insert right after
  content = content.replace(
    "const [searchQuery, setSearchQuery] = useState('');",
    "const [searchQuery, setSearchQuery] = useState('');\n  const [currentPage, setCurrentPage] = useState(1);"
  );
}

// 2. Add useEffect to reset page when filters change
if (!content.includes('setCurrentPage(1)')) {
  content = content.replace(
    /const filteredListings = listings\.filter\(l => \{/g,
    "useEffect(() => {\n    setCurrentPage(1);\n  }, [searchQuery, typeFilter, verifiedFilter]);\n\n  const filteredListings = listings.filter(l => {"
  );
}

// 3. Slice filteredListings and add vars
if (!content.includes('const ITEMS_PER_PAGE =')) {
  content = content.replace(
    "return itemMatch && typeMatch && verifiedMatch;\n  });",
    "return itemMatch && typeMatch && verifiedMatch;\n  });\n\n  const ITEMS_PER_PAGE = 20;\n  const totalPages = Math.max(1, Math.ceil(filteredListings.length / ITEMS_PER_PAGE));\n  const paginatedListings = filteredListings.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);"
  );
}

// 4. Change map to use paginatedListings
content = content.replace(
  "{filteredListings.map((listing) => {",
  "{paginatedListings.map((listing) => {"
);

// 5. Add pagination controls
if (!content.includes('Pagination controls')) {
  content = content.replace(
    "</div>\n          )}\n        </div>\n      </div>",
    `</div>\n\n              {/* Pagination controls */}\n              {totalPages > 1 && (\n                <div className="flex items-center justify-center gap-4 mt-6 pt-4 border-t border-zinc-800/50">\n                  <button\n                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}\n                    disabled={currentPage === 1}\n                    className="px-3 py-1.5 bg-[#14161c] border border-[#2a2c33] disabled:opacity-50 disabled:cursor-not-allowed hover:bg-zinc-800 rounded font-mono text-xs text-zinc-300 transition-colors"\n                  >\n                    Previous\n                  </button>\n                  <span className="text-xs font-mono text-[#8e9299]">\n                    Page <span className="text-[#e0e1e6] font-bold">{currentPage}</span> of <span className="text-[#e0e1e6]">{totalPages}</span>\n                  </span>\n                  <button\n                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}\n                    disabled={currentPage === totalPages}\n                    className="px-3 py-1.5 bg-[#14161c] border border-[#2a2c33] disabled:opacity-50 disabled:cursor-not-allowed hover:bg-zinc-800 rounded font-mono text-xs text-zinc-300 transition-colors"\n                  >\n                    Next\n                  </button>\n                </div>\n              )}\n            </div>\n          )}\n        </div>\n      </div>`
  );
}

fs.writeFileSync('src/components/MarketTab.tsx', content);
