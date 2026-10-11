export interface SeoGuideSection {
  heading: string;
  content: string[];
  tips?: string[];
}

export interface SeoGuideFaq {
  q: string;
  a: string;
}

export interface SeoGuide {
  slug: string;
  title: string;
  metaTitle: string;
  metaDescription: string;
  badge: string;
  readTime: string;
  perex: string;
  sections: SeoGuideSection[];
  faq: SeoGuideFaq[];
}

export const SEO_GUIDES: Record<string, SeoGuide> = {
  'jak-zacit-podnikat': {
    slug: 'jak-zacit-podnikat',
    title: 'Jak začít podnikat v roce 2026: Krok za krokem od nápadu k první faktuře',
    metaTitle: 'Jak začít podnikat v roce 2026: Průvodce krok za krokem | PODNIKAI',
    metaDescription: 'Komplexní návod, jak začít podnikat v ČR v roce 2026. Od volby živnosti a ohlášení přes odvody a daně až po získání prvních zakázek.',
    badge: 'Základní průvodce',
    readTime: '8 min čtení',
    perex: 'Začít podnikat v České republice není tak složité, jak se na první pohled zdá. Pokud máte správný plán, realisticky nastavené mantinely a vyhnete se typickým začátečnickým pastem, můžete vystavit svou první fakturu již během několika dnů.',
    sections: [
      {
        heading: '1. Vyjasněte si své mantinely: Čas, rozpočet a dovednosti',
        content: [
          'Většina lidí začíná otázkou „Co by mohlo vydělávat nejvíc?“. Mnohem spolehlivější je ale začít inventurou vašich reálných možností. Kolik hodin týdně můžete podnikání věnovat vedle zaměstnání nebo rodiny? Jaký máte finanční polštář a kolik jste ochotni investovat bez ohrožení běžného chodu domácnosti?',
          'Pokud máte k dispozici 10 hodin týdně a rozpočet do 10 000 Kč, nedává smysl otevírat kamennou kavárnu. Dává smysl nabídnout expertní konzultace, freelancing nebo specializovanou lokální službu, kde je vstupní investice minimální a marže vysoká.'
        ],
        tips: [
          'Oddělte rodinné finance od podnikatelských ještě před startem.',
          'Začněte při zaměstnání (vedlejší činnost), snížíte tím finanční stres na minimum.'
        ]
      },
      {
        heading: '2. Výběr právní formy: OSVČ vs. s.r.o.',
        content: [
          'Pro 90 % začínajících podnikatelů je ideální volbou živnostenské oprávnění (OSVČ). Založení stojí 1 000 Kč na živnostenském úřadě (nebo přes portál JRF), administrativa je jednoduchá a máte možnost využít paušální daň nebo paušální výdaje.',
          'Společnost s ručením omezeným (s.r.o.) má smysl zakládat v situaci, kdy podnikáte ve více lidech, nesete vysoké majetkové riziko, nebo vaši firemní partneři vyžadují korporátní formu.'
        ],
        tips: [
          'Při živnosti ohlášené jako vedlejší činnost neplatíte v prvním roce minimální zálohy na sociální pojištění, pokud nepřekročíte rozhodnou částku.',
          'Využijte Jednotný registrační formulář (JRF), který vás nahlásí na ŽÚ, finanční úřad, ČSSZ i zdravotní pojišťovnu najednou.'
        ]
      },
      {
        heading: '3. Ověření poptávky před velkými investicemi',
        content: [
          'Neinvestujte do loga, drahého webu ani kanceláře, dokud nemáte ověřeno, že o vaši službu či produkt existuje reálný zájem. Zkuste najít první 3 potenciální zákazníky ve svém okolí nebo na profesních sítích.',
          'Ptejte se lidí na jejich reálné problémy a ochotu zaplatit za konkrétní řešení. Pokud lidé říkají, že je to „super nápad“, ale nikdo nevytáhne peněženku, nápad ještě není validovaný.'
        ]
      },
      {
        heading: '4. První nabídka a vystavení první faktury',
        content: [
          'Sestavte jednoduchou, srozumitelnou nabídku: jaký problém řešíte, co je výstupem, do kdy ho dodáte a kolik to stojí. Vyhněte se složitým ceníkům s desítkami položek.',
          'Pro fakturaci využijte jednoduchý fakturační nástroj (FakturaOnline, iDoklad, Fakturoid). Faktura musí obsahovat vaše jméno, IČO, sídlo a informaci o zápisu v živnostenském rejstříku.'
        ]
      }
    ],
    faq: [
      {
        q: 'Kolik stojí založení živnosti v ČR?',
        a: 'Správní poplatek za ohlášení volné živnosti činí 1 000 Kč při osobní návštěvě živnostenského úřadu, případně 800 Kč při elektronickém podání s kvalifikovaným podpisem.'
      },
      {
        q: 'Musím mít hned od začátku podnikatelský účet?',
        a: 'Zákon to pro OSVČ výslovně nenařizuje, ale je to velmi doporučeno kvůli přehlednosti a oddělení osobních a firemních výdajů.'
      },
      {
        q: 'Co když mám zaměstnání a chci podnikat po večerech?',
        a: 'Můžete podnikat na vedlejší činnost. Zaměstnavatel vám v tom nemůže bránit, ledaže byste podnikali ve stejném oboru jako je předmět jeho činnosti (v tom případě potřebujete jeho písemný souhlas).'
      }
    ]
  },

  'v-cem-podnikat': {
    slug: 'v-cem-podnikat',
    title: 'V čem podnikat v roce 2026: 15 ověřených oborů s nízkým rizikem a kapitálem',
    metaTitle: 'V čem podnikat v roce 2026: Nápady na podnikání s nízkým kapitálem | PODNIKAI',
    metaDescription: 'Hledáte nápad na podnikání? Přehled 15 perspektivních oborů a služeb pro rok 2026 s nízkou vstupní investicí a vysokou poptávkou v ČR.',
    badge: 'Výběr oboru',
    readTime: '7 min čtení',
    perex: 'Najít správný nápad na podnikání neznamená vymyslet nový Facebook nebo revoluční technologii. Nejúspěšnější malé podniky řeší každodenní, reálné problémy lidí a firem, kteří rádi zaplatí za spolehlivost a ušetřený čas.',
    sections: [
      {
        heading: '1. Služby pro firmy (B2B): Vysoká ochota platit a rychlé rozhodování',
        content: [
          'Firemní zákazníci neřeší emoce, ale efektivitu. Pokud jim dokážete ušetřit čas nebo přinést tržby, investice se jim vrátí. Mezi nejžádanější B2B služby v roce 2026 patří správa sociálních sítí pro lokální firmy, virtuální asistence, copyediting s využitím moderních AI nástrojů a technická podpora e-shopů.',
          'Výhodou B2B služeb je obvykle měsíční paušální odměna (retainer), která vám zajistí stabilní cashflow.'
        ],
        tips: [
          'Cílejte na menší firmy v okruhu 50 km – osobní kontakt a důvěra jsou obrovskou konkurenční výhodou proti velkým agenturám.',
          'Definujte balíčky s jasným měsíčním rozsahem a výstupy.'
        ]
      },
      {
        heading: '2. Lokální specializované služby (B2C)',
        content: [
          'V moderních městech i regionech dramaticky roste poptávka po spolehlivých řemeslných a asistenčních službách. Úklidové služby pro vytížené domácnosti, péče o zahrady, hodinový manžel se zaměřením na montáže nábytku či servis elektrokol.',
          'V těchto oborech často nerozhoduje nejnižší cena, ale to, zda zvednete telefon, dorazíte včas a odvedete čistou práci.'
        ]
      },
      {
        heading: '3. Znalostní podnikání a digitální konzultace',
        content: [
          'Pokud máte zkušenosti z korporátu, IT, financí nebo marketingu, můžete své know-how zpeněžit formou auditu, konzultací nebo školení. Využití AI pro zefektivnění běžné kancelářské práce je téma, o které má zájem prakticky každá střední firma v Česku.',
          'Vstupní náklady jsou prakticky nulové – potřebujete pouze počítač, internet a schopnost srozumitelně předat své zkušenosti.'
        ]
      },
      {
        heading: '4. Jak filtrovat nápady: Matice riziko vs. kapitál',
        content: [
          'Před konečným rozhodnutím si nápad prověřte 3 filtry: 1) Mám na to potřebné znalosti alespoň na úrovni poučeného specialisty? 2) Má cílová skupina dost peněz na to, aby za to zaplatila? 3) Dokážu získat prvního klienta do 14 dnů bez velkého marketingu?'
        ]
      }
    ],
    faq: [
      {
        q: 'Jaký je nejlepší obor pro začátek bez peněz?',
        a: 'Nejlepší jsou znalostní a osobní služby (B2B freelancing, správa sítí, virtuální asistence, lokální řemesla), kde prodáváte svůj čas a dovednosti místo nákupu skladových zásob.'
      },
      {
        q: 'Je v roce 2026 ještě šance uspět s novým e-shopem?',
        a: 'Ano, ale pouze s úzce zaměřeným sortimentem (niche), vlastním produktem nebo výjimečným zákaznickým servisem. Obecné e-shopy přeprodávající běžné zboží mají kvůli velkým tržištím velmi nízké marže.'
      }
    ]
  },

  'podnikani-pro-zacatecniky': {
    slug: 'podnikani-pro-zacatecniky',
    title: 'Podnikání pro začátečníky v ČR: Daně, odvody, živnost a čemu se vyhnout',
    metaTitle: 'Podnikání pro začátečníky 2026: Daně, odvody a pravidla | PODNIKAI',
    metaDescription: 'Vše, co potřebuje začínající podnikatel v ČR vědět o daních, zálohách na sociální a zdravotní pojištění, paušální dani a povinnostech vůči státu.',
    badge: 'Finance a legislativa',
    readTime: '9 min čtení',
    perex: 'Legislativa a daně v ČR mohou působit odstrašujícím dojmem. Ve skutečnosti však stačí porozumět několika základním pravidlům, abyste se vyhnuli pokutám a měli své finance pod kontrolou od prvního dne.',
    sections: [
      {
        heading: '1. Hlavní vs. vedlejší činnost: Zásadní rozdíl v odvodech',
        content: [
          'Při hlavní činnosti musíte od prvního měsíce platit minimální zálohy na zdravotní i sociální pojištění bez ohledu na to, zda jste vydělali korunu. V roce 2026 činí minimální měsíční zálohy na sociální a zdravotní pojištění významnou položku v rozpočtu.',
          'Při vedlejší činnosti (např. při zaměstnání, studiu nebo rodičovské dovolené) platíte zdravotní pojištění podle skutečného zisku a zálohy na sociální pojištění v prvním roce neplatíte vůbec. Pokud zisk nepřekročí zákonný limit, sociální pojištění za daný rok neplatíte vůbec.'
        ],
        tips: [
          'Pokud můžete, začněte podnikat jako OSVČ na vedlejší činnost. Je to bezpečný způsob, jak si ověřit byznys model bez fixního tlaku minimálních záloh.'
        ]
      },
      {
        heading: '2. Tři způsoby, jak danit příjmy OSVČ',
        content: [
          'Máte na výběr ze tří hlavních režimů: 1) Paušální daň (jedna měsíční platba pokrývající daň i obě pojištění bez nutnosti podávat daňové přiznání), 2) Výdajový paušál (např. 60 % pro volné živnosti – ideální pro služby s nízkými reálnými náklady), 3) Skutečné daňové výdaje (vedení daňové evidence – výhodné při vysokých nákupních nákladech na materiál či zboží).',
          'Pro většinu začátečníků ve službách vychází nejvýhodněji výdajový paušál 60 % nebo vstup do paušálního režimu.'
        ]
      },
      {
        heading: '3. Registrace k DPH: Kdy je povinná a kdy dobrovolná?',
        content: [
          'Plátcem DPH se ze zákona stáváte, pokud váš obrat za 12 po sobě jdoucích měsíců překročí limit 2 000 000 Kč. Do té doby jste neplátce DPH.',
          'Dobrovolná registrace k DPH má smysl jen tehdy, pokud nakupujete drahé stroje či zboží s DPH a vaši zákazníci jsou výhradně firmy, které si DPH mohou odečíst.'
        ]
      },
      {
        heading: '4. Datová schránka a komunikace s úřady',
        content: [
          'Každý podnikatel zapsaný v živnostenském rejstříku má ze zákona zřízenou datovou schránku podnikající fyzické osoby. Všechna daňová přiznání a přehledy pro pojišťovny se podávají elektronicky.',
          'Nezapomeňte si nastavit notifikace na e-mail při doručení nové zprávy do datové schránky, aby vám neunikla důležitá úřední psaní.'
        ]
      }
    ],
    faq: [
      {
        q: 'Kdy musím podat daňové přiznání za uplynulý rok?',
        a: 'Standardní termín pro elektronické podání daňového přiznání a přehledů pro ČSSZ a ZP je do 2. května následujícího roku (nebo do 1. června při zastoupení daňovým poradcem).'
      },
      {
        q: 'Co se stane, když v prvním měsíci nic nevydělám?',
        a: 'Při vedlejší činnosti nic neplatíte. Při hlavní činnosti musíte uhradit zákonem stanovené minimální měsíční zálohy na sociální a zdravotní pojištění.'
      }
    ]
  },

  'podnikatelsky-plan': {
    slug: 'podnikatelsky-plan',
    title: 'Jak napsat podnikatelský plán: Praktická šablona a struktura pro úspěch',
    metaTitle: 'Jak napsat podnikatelský plán v roce 2026: Šablona a postup | PODNIKAI',
    metaDescription: 'Stručný a efektivní podnikatelský plán na 1-2 strany. Praktická struktura: zákazník, hodnota, cenotvorba, kapacita a finanční scénáře.',
    badge: 'Strategie a plánování',
    readTime: '8 min čtení',
    perex: 'Zapomeňte na stostránkové akademické dokumenty, které po sepsání skončí v šuplíku. Moderní byznys plán je živý dokument na 1 až 2 strany, který vám jasně řekne, komu prodáváte, jaké máte marže a kdy dosáhnete bodu zvratu.',
    sections: [
      {
        heading: '1. Exekutivní shrnutí a definice problému',
        content: [
          'V jedné větě popište, co děláte a pro koho. Například: „Pomáháme majitelům rodinných domů ve středních Čechách ušetřit 30 % nákladů na vytápění instalací tepelných čerpadel do 14 dnů od objednávky.“',
          'Jasně specifikujte, jakou konkrétní bolest zákazníka řešíte a proč si má vybrat právě vás a ne zavedenou konkurenci.'
        ],
        tips: [
          'Vyhněte se vágním frázím jako „nabízíme nejvyšší kvalitu za nejlepší cenu“. Zákazníci věří konkrétním faktům a transparentním termínům.'
        ]
      },
      {
        heading: '2. Cílová skupina a zákaznická persona',
        content: [
          'Kdo je váš ideální platící zákazník? Definujte jeho rozpočet, rozhodovací proces a kde se pohybuje (Facebook skupiny, LinkedIn, lokální fóra, doporučení známých).',
          'Čím užší cílovou skupinu na začátku zvolíte, tím levnější a efektivnější bude vaše marketingové oslovení.'
        ]
      },
      {
        heading: '3. Finanční plán a bod zvratu (Break-even)',
        content: [
          'Rozdělte své náklady na fixní (účetní, software, telefon, pojištění) a variabilní (materiál, subdodávky, provize).',
          'Spočítejte si bod zvratu: Kolik zakázek či hodin musíte každý měsíc prodat, abyste pokryli veškeré fixní náklady a dostali se na nulu? Vše nad tento bod je váš čistý zisk.'
        ],
        tips: [
          'Vždy pracujte se třemi scénáři: Pesimistický (40 % plánovaných tržeb), Realistický (100 %) a Optimistický (150 %). Pokud i v pesimistickém scénáři přežijete bez dluhů, je plán zdravý.'
        ]
      },
      {
        heading: '4. Akční plán na prvních 30 dní',
        content: [
          'Rozepište si konkrétní úkoly týden po týdnu: Týden 1 – Příprava nabídky a založení živnosti. Týden 2 – Přímé oslovení 20 kontaktů z okolí. Týden 3 – Realizace první testovací zakázky a získání reference. Týden 4 – Vyhodnocení a optimalizace cen.'
        ]
      }
    ],
    faq: [
      {
        q: 'Potřebuji podnikatelský plán, i když nežádám o úvěr v bance?',
        a: 'Jednoznačně ano. Plán nepíšete pro banku, ale pro sebe – slouží jako kompas, který vám zabrání pálit peníze a čas v neefektivních slepých uličkách.'
      },
      {
        q: 'Jak často bych měl podnikatelský plán aktualizovat?',
        a: 'V prvním roce doporučujeme revidovat finanční čísla a předpoklady každý měsíc na základě skutečně dosažených výsledků.'
      }
    ]
  },

  'jak-ziskat-prvni-zakazniky': {
    slug: 'jak-ziskat-prvni-zakazniky',
    title: 'Jak získat první platící zákazníky: 7 strategií bez velkého rozpočtu',
    metaTitle: 'Jak získat první zákazníky bez peněz na reklamu: 7 strategií | PODNIKAI',
    metaDescription: 'Ověřené postupy pro získání prvních 3–10 platících klientů bez drahých kampaní. Osobní síť, přímé oslovení, partnerství a reference.',
    badge: 'Prodej a akvizice',
    readTime: '7 min čtení',
    perex: 'Získat prvních několik zákazníků je nejtěžší část podnikání. Nemáte reference, nikdo vás nezná a nemáte rozpočet na masivní reklamní kampaně. Zde je 7 praktických strategií, jak získat první klienty vlastní aktivitou.',
    sections: [
      {
        heading: '1. Aktivujte svou horkou síť kontaktů',
        content: [
          'Váš první zákazník téměř jistě přijde z vašeho okolí – od bývalých kolegů, přátel, rodiny nebo známých. Nestyďte se jim říct, co nově děláte.',
          'Napište osobní zprávu 30 lidem ve svém telefonu nebo na LinkedInu. Nevnucujte jim koupi, ale napište: „Začal jsem se věnovat X. Pokud znáš někoho, kdo řeší Y, moc mi pomůže, když mu o mně řekneš.“'
        ],
        tips: [
          'Lidé rádi pomáhají začínajícím podnikatelům ve svém okolí, pokud o jejich službě vědí.'
        ]
      },
      {
        heading: '2. Strategie „Pilotní projekt za referenci“',
        content: [
          'Nabídněte prvním 2 až 3 klientům spolupráci za zvýhodněnou cenu výměnou za detailní písemnou a video referenci. Reference a případová studie mají v začátku větší hodnotu než okamžitý zisk.',
          'Jasně vymezte mantinely pilotu, aby zákazník věděl, co přesně dostane a co očekáváte na oplátku.'
        ]
      },
      {
        heading: '3. Přímé zacílené oslovení (Cold outreach s přidanou hodnotou)',
        content: [
          'Najděte 20 konkrétních firem nebo lidí, kterým můžete prokazatelně pomoci. Podívejte se na jejich web nebo sociální sítě a pošlete jim konkrétní postřeh či tip na zlepšení zcela zdarma.',
          'Když příjemce vidí, že jste věnovali 10 minut analýze jeho reálné situace, šance na odpověď a následnou schůzku stoupá o stovky procent.'
        ]
      },
      {
        heading: '4. Partnerský prodej a komplementární služby',
        content: [
          'Spojte se s někým, kdo obsluhuje stejnou cílovou skupinu, ale nenabízí stejnou službu. Pokud jste grafik, spojte se s copywriterem nebo programátorem. Pokud čistíte koberce, spojte se s lokální úklidovou firmou.',
          'Doporučování klientů mezi nekonkurujícími si profesionály je nejlevnější a nejtrvalejší zdroj zakázek.'
        ]
      }
    ],
    faq: [
      {
        q: 'Mám hned od začátku platit reklamu na Facebooku nebo Google Ads?',
        a: 'Pro 95 % začínajících podnikatelů ve službách to není vhodné. Placená reklama funguje skvěle pro škálování, ale pro první zakázky je drahá a neefektivní, dokud nemáte ověřenou konverzní nabídku.'
      },
      {
        q: 'Jak překonat strach z odmítnutí při oslovování?',
        a: 'Neberte odmítnutí osobně. Pokud z 20 oslovených zareagují 3 a 1 koupí, je to v B2B prodeji vynikající úspěšnost 5 %.'
      }
    ]
  }
};
