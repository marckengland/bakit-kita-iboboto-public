/**
 * Political Glossary Component
 *
 * Searchable glossary of political and legal terms in Filipino and English.
 * Requirements: 32.4, 32.6, 32.7
 */

"use client";

import { useState, useMemo } from "react";

interface GlossaryTerm {
  term: string;
  termFil: string;
  definition: string;
  definitionFil: string;
  category: string;
}

const glossaryTerms: GlossaryTerm[] = [
  // Government Structure
  {
    term: "Bicameral",
    termFil: "Bicameral",
    definition:
      "A legislative body consisting of two chambers or houses. In the Philippines, Congress is bicameral, composed of the Senate and the House of Representatives.",
    definitionFil:
      "Isang lehislaturang binubuo ng dalawang kapulungan. Sa Pilipinas, ang Kongreso ay bicameral, binubuo ng Senado at Kapulungan ng mga Kinatawan.",
    category: "Government Structure",
  },
  {
    term: "Executive Branch",
    termFil: "Sangay Ehekutibo",
    definition:
      "The branch of government responsible for implementing and enforcing laws. Headed by the President in the Philippines.",
    definitionFil:
      "Ang sangay ng gobyerno na responsable sa pagpapatupad ng mga batas. Pinamumunuan ng Pangulo sa Pilipinas.",
    category: "Government Structure",
  },
  {
    term: "Legislative Branch",
    termFil: "Sangay Lehislatibo",
    definition:
      "The branch of government responsible for making laws. In the Philippines, this is Congress, composed of the Senate and House of Representatives.",
    definitionFil:
      "Ang sangay ng gobyerno na responsable sa paggawa ng mga batas. Sa Pilipinas, ito ang Kongreso, binubuo ng Senado at Kapulungan ng mga Kinatawan.",
    category: "Government Structure",
  },
  {
    term: "Judicial Branch",
    termFil: "Sangay Hudisyal",
    definition:
      "The branch of government responsible for interpreting laws and administering justice. Headed by the Supreme Court in the Philippines.",
    definitionFil:
      "Ang sangay ng gobyerno na responsable sa pagpapakahulugan ng mga batas at pamamahala ng hustisya. Pinamumunuan ng Korte Suprema sa Pilipinas.",
    category: "Government Structure",
  },
  {
    term: "Local Government Unit (LGU)",
    termFil: "Lokal na Pamahalaan",
    definition:
      "Political subdivisions of the Philippines including provinces, cities, municipalities, and barangays, each with their own elected officials.",
    definitionFil:
      "Mga subdibisyong pampulitika ng Pilipinas kabilang ang mga lalawigan, lungsod, bayan, at barangay, bawat isa ay may sariling inihalal na opisyal.",
    category: "Government Structure",
  },
  {
    term: "Barangay",
    termFil: "Barangay",
    definition:
      "The smallest administrative division in the Philippines, serving as the basic unit of governance. Each barangay is headed by a Barangay Captain.",
    definitionFil:
      "Ang pinakamaliit na dibisyong administratibo sa Pilipinas, nagsisilbing pangunahing yunit ng pamamahala. Bawat barangay ay pinamumunuan ng Kapitan ng Barangay.",
    category: "Government Structure",
  },

  // Legislative Terms
  {
    term: "Bill",
    termFil: "Panukalang Batas",
    definition:
      "A proposed law submitted to Congress for consideration. If passed by both chambers and signed by the President, it becomes a law.",
    definitionFil:
      "Isang iminumungkahing batas na isinumite sa Kongreso para sa pagsasaalang-alang. Kung ipinasa ng parehong kapulungan at nilagdaan ng Pangulo, ito ay magiging batas.",
    category: "Legislative",
  },
  {
    term: "Republic Act",
    termFil: "Batas Republika",
    definition:
      "A law enacted by Congress and signed by the President. Each Republic Act is assigned a number (e.g., RA 11032).",
    definitionFil:
      "Isang batas na ipinasa ng Kongreso at nilagdaan ng Pangulo. Bawat Batas Republika ay binibigyan ng numero (hal., RA 11032).",
    category: "Legislative",
  },
  {
    term: "Resolution",
    termFil: "Resolusyon",
    definition:
      "A formal expression of opinion or intention by a legislative body. Unlike bills, resolutions generally do not have the force of law.",
    definitionFil:
      "Isang pormal na pagpapahayag ng opinyon o intensyon ng isang lehislaturang katawan. Hindi tulad ng mga panukalang batas, ang mga resolusyon ay karaniwang walang puwersa ng batas.",
    category: "Legislative",
  },
  {
    term: "Quorum",
    termFil: "Korum",
    definition:
      "The minimum number of members required to be present for a legislative body to conduct official business. Usually a majority of members.",
    definitionFil:
      "Ang minimum na bilang ng mga miyembro na kinakailangang dumalo para makapagsagawa ng opisyal na negosyo ang isang lehislaturang katawan. Karaniwang mayorya ng mga miyembro.",
    category: "Legislative",
  },
  {
    term: "Veto",
    termFil: "Beto",
    definition:
      "The power of the President to reject a bill passed by Congress. Congress can override a veto with a two-thirds vote of all members.",
    definitionFil:
      "Ang kapangyarihan ng Pangulo na tanggihan ang isang panukalang batas na ipinasa ng Kongreso. Maaaring i-override ng Kongreso ang beto sa pamamagitan ng dalawang-katlong boto ng lahat ng miyembro.",
    category: "Legislative",
  },
  {
    term: "Plenary Session",
    termFil: "Sesyong Plenaryo",
    definition:
      "A session attended by all members of a legislative body, as opposed to committee meetings.",
    definitionFil:
      "Isang sesyon na dinaluhan ng lahat ng miyembro ng isang lehislaturang katawan, hindi tulad ng mga pulong ng komite.",
    category: "Legislative",
  },
  {
    term: "Interpellation",
    termFil: "Interpelasyon",
    definition:
      "The period during legislative debate when members may ask questions about a bill to its sponsor.",
    definitionFil:
      "Ang panahon sa debate ng lehislatura kung kailan maaaring magtanong ang mga miyembro tungkol sa isang panukalang batas sa sponsor nito.",
    category: "Legislative",
  },

  // Election Terms
  {
    term: "COMELEC",
    termFil: "COMELEC (Komisyon sa mga Eleksyon)",
    definition:
      "Commission on Elections - the constitutional body responsible for administering elections in the Philippines.",
    definitionFil:
      "Komisyon sa mga Eleksyon - ang konstitusyonal na katawan na responsable sa pamamahala ng mga eleksyon sa Pilipinas.",
    category: "Elections",
  },
  {
    term: "Certificate of Candidacy (COC)",
    termFil: "Sertipiko ng Kandidatura",
    definition:
      "A document filed by a person declaring their intention to run for public office in an election.",
    definitionFil:
      "Isang dokumento na inihain ng isang tao na nagdedeklara ng kanilang intensyon na tumakbo para sa pampublikong posisyon sa isang eleksyon.",
    category: "Elections",
  },
  {
    term: "Precinct",
    termFil: "Presinto",
    definition:
      "A designated area or polling place where registered voters cast their ballots on election day.",
    definitionFil:
      "Isang itinalagang lugar o polling place kung saan ang mga rehistradong botante ay bumoboto sa araw ng eleksyon.",
    category: "Elections",
  },
  {
    term: "Ballot",
    termFil: "Balota",
    definition:
      "The paper or electronic form used by voters to indicate their choices in an election.",
    definitionFil:
      "Ang papel o elektronikong form na ginagamit ng mga botante upang ipahiwatig ang kanilang mga pagpipilian sa isang eleksyon.",
    category: "Elections",
  },
  {
    term: "Canvassing",
    termFil: "Pag-canvass",
    definition: "The official process of counting and tabulating votes after an election.",
    definitionFil:
      "Ang opisyal na proseso ng pagbibilang at pag-tabulate ng mga boto pagkatapos ng isang eleksyon.",
    category: "Elections",
  },
  {
    term: "Proclamation",
    termFil: "Proklamasyon",
    definition:
      "The official announcement declaring the winners of an election after canvassing is complete.",
    definitionFil:
      "Ang opisyal na anunsyo na nagdedeklara ng mga nanalo sa isang eleksyon pagkatapos makumpleto ang pag-canvass.",
    category: "Elections",
  },
  {
    term: "Party-List System",
    termFil: "Sistema ng Party-List",
    definition:
      "A mechanism allowing marginalized and underrepresented sectors to elect representatives to the House of Representatives.",
    definitionFil:
      "Isang mekanismo na nagpapahintulot sa mga marginalized at underrepresented na sektor na maghalal ng mga kinatawan sa Kapulungan ng mga Kinatawan.",
    category: "Elections",
  },

  // Political Terms
  {
    term: "Political Dynasty",
    termFil: "Dinastiyang Pampulitika",
    definition:
      "A situation where multiple members of the same family hold or have held political positions, often in the same area.",
    definitionFil:
      "Isang sitwasyon kung saan maraming miyembro ng parehong pamilya ang humahawak o humawak ng mga posisyong pampulitika, madalas sa parehong lugar.",
    category: "Political",
  },
  {
    term: "Term Limit",
    termFil: "Limitasyon sa Termino",
    definition:
      "Constitutional restriction on the number of consecutive terms a politician can serve in a specific position.",
    definitionFil:
      "Konstitusyonal na paghihigpit sa bilang ng magkakasunod na termino na maaaring pagsilbihan ng isang pulitiko sa isang partikular na posisyon.",
    category: "Political",
  },
  {
    term: "Turncoatism",
    termFil: "Turncoatism (Pagbabago ng Partido)",
    definition:
      "The practice of politicians switching political parties, often for personal or political gain.",
    definitionFil:
      "Ang praktis ng mga pulitiko na lumilipat ng partidong pampulitika, madalas para sa personal o pampulitikang pakinabang.",
    category: "Political",
  },
  {
    term: "Pork Barrel",
    termFil: "Pork Barrel",
    definition:
      "Government funds allocated to legislators for local projects in their districts. The term often carries negative connotations of wasteful spending.",
    definitionFil:
      "Mga pondo ng gobyerno na inilalaan sa mga mambabatas para sa mga lokal na proyekto sa kanilang mga distrito. Ang termino ay madalas na may negatibong konotasyon ng mapag-aksayang paggastos.",
    category: "Political",
  },

  // Financial/Transparency Terms
  {
    term: "SALN",
    termFil: "SALN (Pahayag ng mga Ari-arian, Pananagutan, at Net Worth)",
    definition:
      "Statement of Assets, Liabilities, and Net Worth - a document required of all government officials disclosing their financial status.",
    definitionFil:
      "Pahayag ng mga Ari-arian, Pananagutan, at Net Worth - isang dokumento na kinakailangan sa lahat ng opisyal ng gobyerno na nagbubunyag ng kanilang kalagayang pinansyal.",
    category: "Financial",
  },
  {
    term: "SOCE",
    termFil: "SOCE (Pahayag ng mga Kontribusyon at Gastusin)",
    definition:
      "Statement of Contributions and Expenditures - a COMELEC-required financial disclosure for campaign funding.",
    definitionFil:
      "Pahayag ng mga Kontribusyon at Gastusin - isang kinakailangang financial disclosure ng COMELEC para sa pagpopondo ng kampanya.",
    category: "Financial",
  },
  {
    term: "COA",
    termFil: "COA (Komisyon sa Awdit)",
    definition:
      "Commission on Audit - the constitutional body responsible for auditing government agencies and examining public funds.",
    definitionFil:
      "Komisyon sa Awdit - ang konstitusyonal na katawan na responsable sa pag-awdit ng mga ahensya ng gobyerno at pagsusuri ng mga pampublikong pondo.",
    category: "Financial",
  },
  {
    term: "DBM",
    termFil: "DBM (Kagawaran ng Badyet at Pamamahala)",
    definition:
      "Department of Budget and Management - the government agency responsible for budget preparation and execution.",
    definitionFil:
      "Kagawaran ng Badyet at Pamamahala - ang ahensya ng gobyerno na responsable sa paghahanda at pagpapatupad ng badyet.",
    category: "Financial",
  },

  // Legal Terms
  {
    term: "Ombudsman",
    termFil: "Ombudsman (Tanodbayan)",
    definition:
      "An independent constitutional body that investigates and prosecutes government officials for graft and corruption.",
    definitionFil:
      "Isang independyenteng konstitusyonal na katawan na nag-iimbestiga at nag-uusig ng mga opisyal ng gobyerno para sa graft at korupsyon.",
    category: "Legal",
  },
  {
    term: "Sandiganbayan",
    termFil: "Sandiganbayan",
    definition:
      "A special court that has jurisdiction over criminal and civil cases involving graft and corruption by public officials.",
    definitionFil:
      "Isang espesyal na hukuman na may hurisdiksyon sa mga kasong kriminal at sibil na kinasasangkutan ng graft at korupsyon ng mga pampublikong opisyal.",
    category: "Legal",
  },
  {
    term: "Impeachment",
    termFil: "Impeachment (Pag-aakusa)",
    definition:
      "A constitutional process to remove high-ranking officials from office for culpable violation of the Constitution, treason, bribery, graft and corruption, or betrayal of public trust.",
    definitionFil:
      "Isang konstitusyonal na proseso upang alisin ang mga mataas na ranggo na opisyal mula sa posisyon para sa paglabag sa Konstitusyon, pagtataksil, panunuhol, graft at korupsyon, o pagtataksil sa tiwala ng publiko.",
    category: "Legal",
  },
  {
    term: "Writ of Habeas Corpus",
    termFil: "Writ of Habeas Corpus",
    definition:
      "A court order requiring a person under arrest to be brought before a judge to determine if the detention is lawful.",
    definitionFil:
      "Isang utos ng hukuman na nag-aatas na ang isang taong inaresto ay dalhin sa harap ng hukom upang matukoy kung ang pagkakakulong ay legal.",
    category: "Legal",
  },
  {
    term: "Martial Law",
    termFil: "Batas Militar",
    definition:
      "The imposition of direct military control over civilian functions, which the President may declare in cases of invasion or rebellion.",
    definitionFil:
      "Ang pagpapataw ng direktang kontrol ng militar sa mga sibilyang tungkulin, na maaaring ideklara ng Pangulo sa mga kaso ng pagsalakay o rebelyon.",
    category: "Legal",
  },
];

const categories = [
  "All",
  "Government Structure",
  "Legislative",
  "Elections",
  "Political",
  "Financial",
  "Legal",
];

interface PoliticalGlossaryProps {
  searchTerm?: string;
}

export function PoliticalGlossary({ searchTerm }: PoliticalGlossaryProps) {
  const [search, setSearch] = useState(searchTerm || "");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [expandedTerm, setExpandedTerm] = useState<string | null>(null);

  const filteredTerms = useMemo(() => {
    return glossaryTerms.filter((term) => {
      const matchesSearch =
        search === "" ||
        term.term.toLowerCase().includes(search.toLowerCase()) ||
        term.termFil.toLowerCase().includes(search.toLowerCase()) ||
        term.definition.toLowerCase().includes(search.toLowerCase()) ||
        term.definitionFil.toLowerCase().includes(search.toLowerCase());

      const matchesCategory = selectedCategory === "All" || term.category === selectedCategory;

      return matchesSearch && matchesCategory;
    });
  }, [search, selectedCategory]);

  // Group terms by first letter for alphabetical navigation
  const groupedTerms = useMemo(() => {
    const groups: Map<string, GlossaryTerm[]> = new Map();
    filteredTerms.forEach((term) => {
      const firstChar = term.term[0];
      if (!firstChar) {
        return;
      }
      const letter = firstChar.toUpperCase();
      const existing = groups.get(letter);
      if (existing) {
        existing.push(term);
      } else {
        groups.set(letter, [term]);
      }
    });
    return groups;
  }, [filteredTerms]);

  const letters = Array.from(groupedTerms.keys()).sort();

  return (
    <div className="space-y-6">
      {/* Search and Filter */}
      <div className="card">
        <h2 className="text-xl font-bold text-neutral-900 dark:text-white">Political Glossary</h2>
        <p className="mt-1 text-sm text-neutral-500">Talasalitaan ng mga Terminong Pampulitika</p>

        {/* Search Input */}
        <div className="relative mt-4">
          <SearchIcon className="absolute top-1/2 left-3 h-5 w-5 -translate-y-1/2 text-neutral-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search terms in English or Filipino..."
            className="focus:border-primary-500 focus:ring-primary-500/20 w-full rounded-lg border border-neutral-200 bg-white py-2 pr-4 pl-10 text-neutral-900 placeholder-neutral-400 focus:ring-2 focus:outline-none dark:border-neutral-700 dark:bg-neutral-800 dark:text-white dark:placeholder-neutral-500"
          />
        </div>

        {/* Category Filter */}
        <div className="mt-4 flex flex-wrap gap-2">
          {categories.map((category) => (
            <button
              key={category}
              onClick={() => setSelectedCategory(category)}
              className={`rounded-full px-3 py-1 text-sm transition-colors ${
                selectedCategory === category
                  ? "bg-primary-500 text-white"
                  : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-400 dark:hover:bg-neutral-700"
              }`}
            >
              {category}
            </button>
          ))}
        </div>

        {/* Results Count */}
        <p className="mt-4 text-sm text-neutral-500">
          {filteredTerms.length} term{filteredTerms.length !== 1 ? "s" : ""} found
        </p>
      </div>

      {/* Alphabetical Navigation */}
      {letters.length > 0 && (
        <div className="card">
          <div className="flex flex-wrap gap-1">
            {letters.map((letter) => (
              <a
                key={letter}
                href={`#letter-${letter}`}
                className="hover:bg-primary-500 dark:hover:bg-primary-500 flex h-8 w-8 items-center justify-center rounded-lg bg-neutral-100 text-sm font-medium text-neutral-600 hover:text-white dark:bg-neutral-800 dark:text-neutral-400 dark:hover:text-white"
              >
                {letter}
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Terms List */}
      {letters.length === 0 ? (
        <div className="card py-12 text-center">
          <SearchIcon className="mx-auto h-12 w-12 text-neutral-300 dark:text-neutral-600" />
          <p className="mt-4 text-neutral-500">No terms found matching your search.</p>
          <p className="text-sm text-neutral-400">
            Walang nahanap na termino na tumutugma sa iyong paghahanap.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {letters.map((letter) => (
            <div key={letter} id={`letter-${letter}`} className="scroll-mt-4">
              <div className="mb-3 flex items-center gap-2">
                <span className="bg-primary-500 flex h-8 w-8 items-center justify-center rounded-lg text-sm font-bold text-white">
                  {letter}
                </span>
                <div className="h-px flex-1 bg-neutral-200 dark:bg-neutral-700" />
              </div>

              <div className="space-y-2">
                {(groupedTerms.get(letter) ?? []).map((term) => (
                  <GlossaryTermCard
                    key={term.term}
                    term={term}
                    isExpanded={expandedTerm === term.term}
                    onToggle={() => setExpandedTerm(expandedTerm === term.term ? null : term.term)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Glossary Term Card Component
function GlossaryTermCard({
  term,
  isExpanded,
  onToggle,
}: {
  term: GlossaryTerm;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="card">
      <button onClick={onToggle} className="flex w-full items-start justify-between text-left">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-neutral-900 dark:text-white">{term.term}</h3>
            <span className="badge-primary text-xs">{term.category}</span>
          </div>
          <p className="text-sm text-neutral-500">{term.termFil}</p>
        </div>
        <ChevronIcon
          className={`h-5 w-5 flex-shrink-0 text-neutral-400 transition-transform ${
            isExpanded ? "rotate-180" : ""
          }`}
        />
      </button>

      {isExpanded && (
        <div className="animate-fade-in mt-4 space-y-4">
          <div className="rounded-lg bg-neutral-50 p-4 dark:bg-neutral-800">
            <p className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
              English Definition:
            </p>
            <p className="mt-1 text-neutral-600 dark:text-neutral-400">{term.definition}</p>
          </div>

          <div className="bg-primary-50 dark:bg-primary-900/20 rounded-lg p-4">
            <p className="text-primary-700 dark:text-primary-300 text-sm font-medium">
              Kahulugan sa Filipino:
            </p>
            <p className="mt-1 text-neutral-600 dark:text-neutral-400">{term.definitionFil}</p>
          </div>
        </div>
      )}
    </div>
  );
}

// Icon Components
function SearchIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.5}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
      />
    </svg>
  );
}

function ChevronIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
    </svg>
  );
}
