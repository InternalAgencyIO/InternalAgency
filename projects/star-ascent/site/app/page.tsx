"use client";

import { useEffect, useState } from "react";
import { ActivationTerminal } from "./ActivationTerminal";
import { LaunchClock } from "./LaunchClock";
import { SignalField } from "./SignalField";
import { LaunchSequence } from "./LaunchSequence";

const copy = {
  en: {
    nav: ["Mission", "Token", "Roadmap", "Dossier"], register: "Operator Registration", signal: "STARLIGHT // SIGNAL ACQUIRED", presents: "INTERNAL AGENCY PRESENTS", lede: "The first public chapter of Internal Agency: a community token on Solana and the opening of the operator network.", enter: "Enter the Register", disclosure: "Read the token disclosure ↓", genesis: "GENESIS EVENT", broadcast: "LIVE BROADCAST", terminal: "STARLIGHT :: LAUNCH TERMINAL", terminalNote: "PUBLIC BUILD / NO WALLET CONNECTION REQUIRED", brief: "MISSION BRIEF", briefTitle: "THE PUBLIC BUILD", briefLines: ["[01] Internal Agency is opening its first public chapter.", "[02] $IAT is the community layer; it is not a promise of return.", "[03] Official information appears only through verified project channels."], premise: "THE PREMISE", thesis: <>Agency is not handed down.<br />It is built together.</>, body: "Internal Agency is a staged creative and technical project for people who want more agency in the AI era. STAR ASCENT is a transparent beginning—not a promise of finished technology or financial returns.", token: "$IAT / SOLANA", clear: <>Community layer.<br />Clear terms.</>, supply: "SUPPLY DESIGN TARGET", supplyTarget: "1,000,000,000 IAT", network: "NETWORK", presale: "PRESALE", yield: "LAUNCH YIELD", none: "None", status: "LAUNCH STATUS", live: "Launch information published", verified: "Mint address not published yet", safety: "No wallet connection required", staged: "STAGED RELEASE", phases: [["GENESIS", "Launch disclosure, livestream, and operator registration."], ["DISTRIBUTION", "Publish campaign methodology and the community allocation process."], ["IA PREVIEW", "Release announced IA experiences when ready for public use."]], protocol: "OPERATOR PROTOCOL", verify: "Verify. Sign. Enter.", free: "Registration is free. No seed phrase, private key, password, or payment is ever required.", prepare: "Prepare for Registration", notice: "Registration opens at launch. You will only ever be asked to sign a wallet message—never to share a seed phrase or private key.", faq: "OPERATOR FAQ", questions: [["Where is the official token address?", "The official mint address will appear only here, in the pinned official announcement, and on the launch livestream."], ["Do I need to connect a wallet now?", "No. Registration is not open yet. Never share a seed phrase or private key."], ["Is $IAT an investment promise?", "No. $IAT is a speculative community token. No price or financial return is promised."]], risk: "© 2026 Internal Agency. $IAT is highly speculative. No financial return is promised.", lang: "Türkçe", skip: "Skip to mission", languageLabel: "Site language: English. Switch to Turkish"
  },
  tr: {
    nav: ["Misyon", "Token", "Yol Haritası", "Dosya"], register: "Operatör Kaydı", signal: "STARLIGHT // SİNYAL ALINDI", presents: "İLERİ AKIL SUNAR", lede: "İleri Akıl'ın ilk kamuya açık bölümü: Solana üzerinde bir topluluk tokeni ve operatör ağının açılışı.", enter: "Kayıt Alanına Gir", disclosure: "Token açıklamasını oku ↓", genesis: "BAŞLANGIÇ ETKİNLİĞİ", broadcast: "CANLI YAYIN", terminal: "STARLIGHT :: LANSMAN TERMİNALİ", terminalNote: "HERKESE AÇIK YAPI / CÜZDAN BAĞLANTISI GEREKMEZ", brief: "GÖREV ÖZETİ", briefTitle: "KAMUYA AÇIK YAPI", briefLines: ["[01] İleri Akıl ilk kamuya açık bölümünü açıyor.", "[02] $IAT topluluk katmanıdır; getiri vaadi değildir.", "[03] Resmî bilgiler yalnızca doğrulanmış proje kanallarında yayımlanır."], premise: "ÖNCÜL", thesis: <>Ajans verilmez.<br />Birlikte inşa edilir.</>, body: "İleri Akıl, yapay zekâ çağında daha fazla söz sahibi olmak isteyen insanlar için aşamalı bir yaratıcı ve teknik projedir. STAR ASCENT şeffaf bir başlangıçtır; tamamlanmış teknoloji veya finansal getiri vaadi değildir.", token: "$IAT / SOLANA", clear: <>Topluluk katmanı.<br />Açık şartlar.</>, supply: "ARZ TASARIM HEDEFİ", supplyTarget: "1.000.000.000 IAT", network: "AĞ", presale: "ÖN SATIŞ", yield: "BAŞLANGIÇ GETİRİSİ", none: "Yok", status: "LANSMAN DURUMU", live: "Lansman bilgileri yayımlandı", verified: "Mint adresi henüz yayımlanmadı", safety: "Cüzdan bağlantısı gerekmiyor", staged: "AŞAMALI YAYIN", phases: [["BAŞLANGIÇ", "Lansman açıklaması, canlı yayın ve operatör kaydı."], ["DAĞITIM", "Kampanya yöntemini ve topluluk dağıtım sürecini yayımlama."], ["IA ÖNİZLEME", "IA deneyimlerini kamuya hazır olduğunda yayımlama."]], protocol: "OPERATÖR PROTOKOLÜ", verify: "Doğrula. İmzala. Katıl.", free: "Kayıt ücretsizdir. Seed phrase, özel anahtar, şifre veya ödeme asla istenmez.", prepare: "Kayıt İçin Hazırlan", notice: "Kayıt lansmanda açılır. Sizden yalnızca bir cüzdan mesajı imzalamanız istenir; seed phrase veya özel anahtar asla istenmez.", faq: "OPERATÖR SSS", questions: [["Resmî token adresi nerede?", "Resmî mint adresi yalnızca burada, sabitlenmiş resmî duyuruda ve lansman canlı yayınında paylaşılır."], ["Şimdi cüzdan bağlamam gerekiyor mu?", "Hayır. Kayıt henüz açık değil. Seed phrase veya özel anahtarınızı asla paylaşmayın."], ["$IAT yatırım vaadi midir?", "Hayır. $IAT spekülatif bir topluluk tokenidir. Fiyat veya finansal getiri vaat edilmez."]], risk: "© 2026 İleri Akıl. $IAT yüksek riskli ve spekülatiftir. Finansal getiri vaadi yoktur.", lang: "English", skip: "Misyona geç", languageLabel: "Site dili: Türkçe. İngilizceye geç"
  }
};

function repairLegacyEncoding<T>(value: T): T {
  if (typeof value === "string") {
    if (!/[ÃÄÅÂâ]/.test(value)) return value;
    try {
      return new TextDecoder("utf-8", { fatal: true })
        .decode(Uint8Array.from(value, (char) => char.charCodeAt(0))) as T;
    } catch { return value; }
  }
  if (Array.isArray(value)) return value.map(repairLegacyEncoding) as T;
  if (value && typeof value === "object" && !("$$typeof" in value)) {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, repairLegacyEncoding(item)]),
    ) as T;
  }
  return value;
}

const trPublicVoice = {
  lede: "İleri Akıl’ın ilk açık yayını: Solana üzerinde bir topluluk katmanı ve yeni bir operatör ağının başlangıcı.",
  enter: "Sinyale Gir",
  disclosure: "Token tasarımını oku ↓",
  brief: "İLETİM // 001",
  briefTitle: "SİNYAL AÇIK.",
  briefLines: ["[01] İleri Akıl ilk açık bölümünü başlatıyor.", "[02] $IAT bir topluluk katmanıdır; getiri sözü değildir.", "[03] Resmî bilgi yalnızca doğrulanmış kanallardan gelir."],
  premise: "İLETİM",
  body: "İleri Akıl, yapay zekâ çağında sadece izlemek istemeyenler için yaratıcı ve teknik bir deneydir. STAR ASCENT bitmiş bir vaat değil; herkesin gözü önünde başlayan açık bir inşadır.",
  clear: <>Bir sinyal.<br />Bir buluşma.</>,
  verify: "Doğrula. İmzala. Katıl.",
  skip: "İletime geç",
  languageLabel: "Site dili: Türkçe. İngilizceye geç"
};

const manifesto = {
  en: {
    lede: "A signal for people who refuse to sleepwalk through the age of artificial intelligence. STAR ASCENT is the first opening in the wall.",
    brief: "TRANSMISSION // 001",
    briefTitle: "THE SIGNAL IS OPEN.",
    lines: ["[01] We are not here to optimize the old world.", "[02] We are here to imagine a more sovereign one.", "[03] This is a public build. Bring your curiosity. Bring your fire."],
    premise: "THE TRANSMISSION",
    thesis: <>The future is not handed down.<br />It is taken back.</>,
    body: "Internal Agency is a living experiment in collective imagination, technology, culture, and self-determination. STAR ASCENT is our first broadcast: an invitation to build the strange, the beautiful, and the useful in public.",
    clear: <>A signal.<br />A gathering.</>,
  },
  tr: {
    lede: "Yapay zekâ çağında uyurgezer dolaşmayı reddedenler için bir sinyal. STAR ASCENT duvardaki ilk açıklık.",
    brief: "İLETİM // 001",
    briefTitle: "SİNYAL AÇIK.",
    lines: ["[01] Eski dünyayı optimize etmek için burada değiliz.", "[02] Daha egemen bir dünyayı hayal etmek için buradayız.", "[03] Bu kamusal bir inşa. Merakını getir. Ateşini getir."],
    premise: "İLETİM",
    thesis: <>Gelecek bahşedilmez.<br />Geri alınır.</>,
    body: "İleri Akıl; kolektif hayal gücü, teknoloji, kültür ve öz-belirlenim üzerine yaşayan bir deneydir. STAR ASCENT ilk yayınımız: tuhafı, güzeli ve faydalıyı herkesin gözü önünde inşa etme daveti.",
    clear: <>Bir sinyal.<br />Bir buluşma.</>,
  },
};

const launchPlan = {
  en: {
    eyebrow: "OPEN-SOURCE EXECUTION WINDOW",
    title: "Public code. Physical approval. Verifiable evidence.",
    note: "The ceremony window opens at exactly 15:00:00 UTC on 29 July 2026. The source is public now. No transaction is automatic, and mainnet remains blocked unless every evidence gate passes.",
    items: [
      ["15:00:00 UTC", "Ceremony window opens", "The open-source transaction builder becomes eligible for human-approved execution. There is no timer-triggered wallet action."],
      ["DEVNET FIRST", "Model T rehearsal", "The exact four-transaction path must complete on devnet with independent evidence before mainnet can unlock."],
      ["AFTER ALL GATES", "Mainnet decision", "The signer and verifier may proceed only if metadata, destinations, locks, digests, and handoff records all match."],
      ["After site update", "Registration opens", "Use the on-page status—not a direct message—to confirm availability."],
    ],
  },
  tr: {
    eyebrow: "AÇIK KAYNAK YÜRÜTME PENCERESİ",
    title: "Kamuya açık kod. Fiziksel onay. Doğrulanabilir kanıt.",
    note: "Tören penceresi 29 Temmuz 2026 saat 18:00:00 İstanbul'da açılır. Kaynak kod şimdi açıktır. Hiçbir işlem otomatik değildir ve tüm kanıt eşikleri geçmeden mainnet kilidi açılmaz.",
    items: [
      ["18:00:00 İSTANBUL", "Tören penceresi açılır", "Açık kaynak işlem kurucu insan onaylı yürütmeye uygun hâle gelir. Zamanlayıcı cüzdan işlemi başlatmaz."],
      ["ÖNCE DEVNET", "Model T provası", "Mainnet kilidi açılmadan önce dört işlemli yol devnet üzerinde bağımsız kanıtla tamamlanmalıdır."],
      ["TÜM EŞİKLERDEN SONRA", "Mainnet kararı", "İmzacı ve doğrulayıcı yalnızca metadata, hedefler, kilitler, özetler ve devir kayıtları eşleşirse ilerleyebilir."],
      ["Site güncellemesinden sonra", "Kayıt açılışı", "Kullanılabilirliği doğrudan mesajla değil, sayfadaki durum bilgisiyle doğrulayın."],
    ],
  },
};

const scamProtocol = {
  en: {
    eyebrow: "ANTI-SCAM PROTOCOL",
    title: "Pause before you sign.",
    intro: "Treat every direct message, countdown, and copied address as unverified until it matches this page and the livestream screen.",
    steps: [
      ["STOP", "Do not act on urgency, giveaways, presales, support DMs, or “verification” payments."],
      ["VERIFY", "Match the full address character-for-character in two official surfaces. A logo or display name proves nothing."],
      ["PROTECT", "Never enter a seed phrase or private key. Reject unexpected signatures and inspect the wallet prompt."],
      ["REPORT", "Capture the account and URL, report them on the platform, then return here independently—do not follow their link."],
    ],
    warning: "There is no private sale, paid registration, support wallet, or secret early-access link.",
  },
  tr: {
    eyebrow: "DOLANDIRICILIKTAN KORUNMA",
    title: "İmzalamadan önce durun.",
    intro: "Her doğrudan mesajı, geri sayımı ve kopyalanmış adresi bu sayfa ve canlı yayın ekranıyla eşleşene kadar doğrulanmamış kabul edin.",
    steps: [
      ["DUR", "Aciliyet, çekiliş, ön satış, destek mesajı veya “doğrulama” ödemesi yönlendirmesine uymayın."],
      ["DOĞRULA", "Tam adresi iki resmî yüzeyde karakter karakter karşılaştırın. Logo veya görünen ad kanıt değildir."],
      ["KORU", "Seed phrase veya özel anahtar girmeyin. Beklenmedik imzaları reddedin ve cüzdan istemini inceleyin."],
      ["BİLDİR", "Hesap ve URL görüntüsünü alın, platformda bildirin, sonra bağlantıya tıklamadan buraya kendiniz dönün."],
    ],
    warning: "Özel satış, ücretli kayıt, destek cüzdanı veya gizli erken erişim bağlantısı yoktur.",
  },
};

const faqAdditions = {
  en: [
    ["What should a registration signature ask me to do?", "Registration should request only a human-readable wallet message. If the wallet asks you to approve a transaction, token access, spending permission, or a transfer, cancel and return to this page independently."],
    ["Where will allocation and authority details be published?", "The allocation method, distribution rules, recipient categories, and mint/freeze authority status will be documented publicly before distribution begins. Until then, treat those details as pending—not implied."],
    ["Can support recover or verify my wallet?", "No. Official support will never ask to recover, import, verify, or inspect your wallet, and cannot reverse a transfer. Anyone requesting wallet secrets or payment is impersonating the project."],
  ],
  tr: [
    ["Kayıt imzası benden ne yapmamı istemeli?", "Kayıt yalnızca okunabilir bir cüzdan mesajı istemelidir. Cüzdan sizden işlem, token erişimi, harcama izni veya transfer onayı isterse iptal edin ve bu sayfaya bağlantı kullanmadan dönün."],
    ["Dağıtım ve yetki ayrıntıları nerede yayımlanacak?", "Dağıtım başlamadan önce tahsis yöntemi, dağıtım kuralları, alıcı kategorileri ile mint/dondurma yetkilerinin durumu kamuya açık biçimde belgelenecektir. O zamana kadar bu ayrıntıları kesinleşmemiş kabul edin."],
    ["Destek ekibi cüzdanımı kurtarabilir veya doğrulayabilir mi?", "Hayır. Resmî destek cüzdanınızı kurtarmanızı, içe aktarmanızı, doğrulamanızı veya inceletmenizi asla istemez ve bir transferi geri alamaz. Cüzdan sırları veya ödeme isteyen herkes projeyi taklit ediyordur."],
  ],
};

const tokenDisclosure = {
  en: {
    eyebrow: "TOKEN DISCLOSURE",
    title: "Design targets are not live facts.",
    intro: "No $IAT token has been presented as live on this page. These fields separate the intended configuration from evidence that must be published before distribution.",
    note: "The official mint address will be published only through this website, the pinned official announcement, and the livestream screen. Mint and freeze authority revocation is planned, but has not yet been verified.",
    pending: "PENDING",
    items: [
      ["Mint address", "Not published. Treat every address as unofficial until it matches the website and livestream."],
      ["Initial supply", "Design target: 1,000,000,000 IAT. The final on-chain supply must be independently verifiable."],
      ["Mint / freeze authority", "Revocation is planned after the documented initial mint; current status is not yet verified. On-chain evidence must be linked here."],
      ["Allocation and release", "Recipient categories, allocation wallets, vesting or lock terms, and the release schedule remain pending public documentation."],
    ],
    gate: "Distribution must not begin while any launch-critical disclosure remains pending.",
  },
  tr: {
    eyebrow: "TOKEN AÇIKLAMASI",
    title: "Tasarım hedefleri canlı veriler değildir.",
    intro: "Bu sayfada $IAT tokeni canlı olarak sunulmamaktadır. Aşağıdaki alanlar hedeflenen yapılandırmayı, dağıtımdan önce yayımlanması gereken kanıtlardan ayırır.",
    note: "Resmî mint adresi yalnızca bu web sitesi, sabitlenmiş resmî duyuru ve canlı yayın ekranında yayımlanacaktır. Mint ve dondurma yetkilerinin kaldırılması planlanmaktadır ancak henüz doğrulanmamıştır.",
    pending: "BEKLİYOR",
    items: [
      ["Mint adresi", "Yayımlanmadı. Web sitesi ve canlı yayınla eşleşene kadar her adresi gayriresmî kabul edin."],
      ["İlk arz", "Tasarım hedefi: 1.000.000.000 IAT. Nihai zincir üstü arz bağımsız olarak doğrulanabilmelidir."],
      ["Mint / dondurma yetkisi", "Belgelenen ilk mint işleminden sonra yetkilerin kaldırılması planlanır; mevcut durum henüz doğrulanmadı. Zincir üstü kanıt burada bağlantılanmalıdır."],
      ["Tahsis ve serbest bırakma", "Alıcı kategorileri, tahsis cüzdanları, hak ediş veya kilit şartları ve serbest bırakma takvimi kamuya açık belge bekliyor."],
    ],
    gate: "Lansman açısından kritik herhangi bir açıklama beklemedeyken dağıtım başlamamalıdır.",
  },
};

const evidencePack = {
  en: {
    eyebrow: "PUBLICATION GATE",
    title: "Evidence required before distribution.",
    intro: "A launch announcement is not proof. Distribution stays paused until one public packet makes every critical claim independently checkable.",
    status: "NOT YET PUBLISHED",
    items: [
      ["Final token configuration", "Mint address, token program, decimals, total supply, and a UTC verification timestamp."],
      ["Authority evidence", "Direct explorer links showing the current mint and freeze authority state; plans or screenshots are not sufficient."],
      ["Allocation map", "Recipient categories, percentages, token amounts, labeled public wallets, and a mathematical total of 100%."],
      ["Release controls", "Vesting, lock, custody, and release terms plus the public method for reporting every distribution."],
    ],
    note: "Each field remains pending until the linked evidence is live and consistent across the website, pinned announcement, and livestream.",
    download: "Download English checklist",
  },
  tr: {
    eyebrow: "YAYIN EŞİĞİ",
    title: "Dağıtımdan önce gereken kanıtlar.",
    intro: "Lansman duyurusu tek başına kanıt değildir. Kritik iddiaların tamamı bağımsız olarak doğrulanabilen tek bir kamu paketi yayımlanana kadar dağıtım durur.",
    status: "HENÜZ YAYIMLANMADI",
    items: [
      ["Nihai token yapılandırması", "Mint adresi, token programı, ondalık basamak, toplam arz ve UTC doğrulama zamanı."],
      ["Yetki kanıtı", "Mint ve dondurma yetkilerinin mevcut durumunu gösteren doğrudan explorer bağlantıları; planlar veya ekran görüntüleri yeterli değildir."],
      ["Tahsis haritası", "Alıcı kategorileri, yüzdeler, token miktarları, etiketli herkese açık cüzdanlar ve matematiksel olarak %100 toplam."],
      ["Serbest bırakma kontrolleri", "Hak ediş, kilit, saklama ve serbest bırakma şartları ile her dağıtımı kamuya raporlama yöntemi."],
    ],
    note: "Bağlantılı kanıt canlı olmadığı ve web sitesi, sabitlenmiş duyuru ve canlı yayın arasında tutarlı olmadığı sürece her alan beklemededir.",
    download: "Türkçe kontrol listesini indir",
  },
};

const documentPack = {
  en: {
    eyebrow: "PUBLIC DOCUMENTS",
    title: "Read the design before any wallet action.",
    intro: "These pre-launch documents describe intended safeguards and unresolved fields. They are not proof that a token exists, that an allocation is final, or that any authority has been changed.",
    status: "PRE-LAUNCH DRAFT",
    litepaper: "Download English litepaper",
    checklist: "Download English evidence checklist",
    technical: "Download English technical specification",
    validator: "Download allocation validator scaffold",
    authorityValidator: "Download authority-plan validator scaffold",
    socialKit: "Download English launch communications kit",
    rehearsal: "Download English launch rehearsal playbook",
    readiness: "Download English readiness scorecard",
    incident: "Download English incident-response runbook",
    audit: "Download publication audit scaffold",
    releaseValidator: "Download cross-channel packet validator",
    evidenceValidator: "Download evidence-freshness validator",
    snapshotValidator: "Download composite readiness snapshot",
    rehearsalTraceValidator: "Download rehearsal-trace validator",
    changeFreezeValidator: "Download change-freeze validator",
    launchHandoffValidator: "Download launch handoff validator",
    note: "The litepaper remains a design draft until every launch-critical field is backed by linked public evidence.",
  },
  tr: {
    eyebrow: "KAMUYA AÇIK BELGELER",
    title: "Herhangi bir cüzdan işleminden önce tasarımı okuyun.",
    intro: "Bu lansman öncesi belgeler hedeflenen güvenlik önlemlerini ve çözülmemiş alanları açıklar. Bir tokenin var olduğunun, tahsisin kesinleştiğinin veya herhangi bir yetkinin değiştirildiğinin kanıtı değildir.",
    status: "LANSMAN ÖNCESİ TASLAK",
    litepaper: "Türkçe litepaper'ı indir",
    checklist: "Türkçe kanıt kontrol listesini indir",
    technical: "Türkçe teknik şartnameyi indir",
    validator: "Tahsis doğrulayıcı iskeletini indir",
    authorityValidator: "Yetki planı doğrulayıcı iskeletini indir",
    socialKit: "Türkçe lansman iletişim kitini indir",
    rehearsal: "Türkçe lansman prova rehberini indir",
    readiness: "Türkçe hazırlık puan kartını indir",
    incident: "Türkçe olay müdahale rehberini indir",
    audit: "Yayın denetimi iskeletini indir",
    releaseValidator: "Kanallar arası paket doğrulayıcısını indir",
    evidenceValidator: "Kanıt güncelliği doğrulayıcısını indir",
    snapshotValidator: "Bileşik hazırlık anlık görünümünü indir",
    rehearsalTraceValidator: "Prova izi doğrulayıcısını indir",
    changeFreezeValidator: "Değişiklik dondurma doğrulayıcısını indir",
    launchHandoffValidator: "Lansman devri doğrulayıcısını indir",
    note: "Litepaper, lansman açısından kritik her alan bağlantılı kamu kanıtıyla desteklenene kadar tasarım taslağı olarak kalır.",
  },
};

const validatorPlan = {
  en: {
    eyebrow: "TECHNICAL TEST GATE · LOCAL ONLY",
    title: "What the allocation validator proves — and what it cannot.",
    intro: "The downloadable scaffold checks a proposed public allocation manifest without connecting to Solana, a wallet, or a signing service.",
    checks: [
      ["Exact arithmetic", "Supply, category totals, and recipient totals must match exactly in integer base units."],
      ["Unique identifiers", "Category IDs and public recipient-wallet identifiers cannot be duplicated."],
      ["Canonical inputs", "Amounts must be positive whole-number strings, avoiding floating-point rounding."],
      ["Deterministic result", "The same manifest produces the same summary and errors in local tests."],
    ],
    limit: "A passing result only shows that the draft manifest is internally consistent. It does not prove token authenticity, authority state, audit approval, deployment, or safety.",
    authorityTitle: "Authority plans stay proposed until the evidence is public.",
    authorityIntro: "A second offline scaffold checks that mint and freeze authority intentions are unique, explicit, evidence-gated, and still marked as proposed.",
    authorityLimit: "It does not inspect Solana or prove that an authority is retained, transferred, or revoked. Distribution remains blocked until linked public evidence is independently reviewed.",
  },
  tr: {
    eyebrow: "TEKNİK TEST EŞİĞİ · YALNIZCA YEREL",
    title: "Tahsis doğrulayıcının kanıtladığı ve kanıtlayamayacağı şeyler.",
    intro: "İndirilebilir iskelet, Solana'ya, cüzdana veya imzalama hizmetine bağlanmadan önerilen kamuya açık tahsis bildirimini kontrol eder.",
    checks: [
      ["Kesin aritmetik", "Arz, kategori toplamları ve alıcı toplamları tam sayı taban birimlerinde birebir eşleşmelidir."],
      ["Benzersiz tanımlayıcılar", "Kategori kimlikleri ve kamuya açık alıcı cüzdan tanımlayıcıları yinelenemez."],
      ["Standart girdiler", "Tutarlar pozitif tam sayı dizeleri olmalı; kayan nokta yuvarlaması kullanılmamalıdır."],
      ["Belirlenimci sonuç", "Aynı bildirim yerel testlerde aynı özeti ve hataları üretir."],
    ],
    limit: "Başarılı sonuç yalnızca taslak bildirimin kendi içinde tutarlı olduğunu gösterir. Token gerçekliğini, yetki durumunu, denetim onayını, dağıtımı veya güvenliği kanıtlamaz.",
    authorityTitle: "Kanıtlar kamuya açılana kadar yetki planları öneri olarak kalır.",
    authorityIntro: "İkinci çevrimdışı iskelet, mint ve dondurma yetkisi niyetlerinin benzersiz, açık, kanıta bağlı ve hâlâ öneri olarak işaretli olduğunu kontrol eder.",
    authorityLimit: "Solana'yı incelemez veya bir yetkinin korunduğunu, devredildiğini ya da kaldırıldığını kanıtlamaz. Bağlantılı kamu kanıtı bağımsız olarak incelenene kadar dağıtım engelli kalır.",
  },
};

const readinessScorecard = {
  en: {
    eyebrow: "LAUNCH READINESS · NOT APPROVED",
    title: "Current readiness: HOLD.",
    intro: "Rehearsal materials exist, but launch approval requires current public evidence. A completed draft, passing local test, or previous review cannot replace that evidence.",
    status: "HOLD",
    items: [
      ["Token identity", "Mint address, token program, decimals, supply, and verification time are not yet published as one checkable record."],
      ["Authority state", "Direct explorer evidence for current mint and freeze authorities is not yet linked and independently reviewed."],
      ["Allocation controls", "The final 100% allocation map, labeled public wallets, and release terms are not yet published."],
      ["Channel consistency", "The website, pinned announcement, and livestream must be compared after final content is live."],
    ],
    freshnessTitle: "Freshness is a launch gate.",
    freshness: "Every evidence record needs a UTC checked-at time, a named review role, and a direct public link. Recheck at T−60 minutes and immediately before any address publication or registration opening. A missing timestamp, unavailable link, changed value, or cross-channel mismatch returns the launch to HOLD.",
    note: "No numerical readiness score is shown while launch-critical evidence is missing; a percentage could imply approval that has not been earned.",
  },
  tr: {
    eyebrow: "LANSMAN HAZIRLIĞI · ONAYLANMADI",
    title: "Mevcut hazırlık durumu: BEKLET.",
    intro: "Prova materyalleri mevcut; ancak lansman onayı güncel kamu kanıtı gerektirir. Tamamlanmış taslak, başarılı yerel test veya önceki inceleme bu kanıtın yerini alamaz.",
    status: "BEKLET",
    items: [
      ["Token kimliği", "Mint adresi, token programı, ondalık basamak, arz ve doğrulama zamanı tek bir kontrol edilebilir kayıtta henüz yayımlanmadı."],
      ["Yetki durumu", "Mevcut mint ve dondurma yetkilerine ilişkin doğrudan explorer kanıtı henüz bağlantılanıp bağımsız olarak incelenmedi."],
      ["Tahsis kontrolleri", "Nihai %100 tahsis haritası, etiketli kamu cüzdanları ve serbest bırakma şartları henüz yayımlanmadı."],
      ["Kanal tutarlılığı", "Nihai içerik canlı olduktan sonra web sitesi, sabitlenmiş duyuru ve canlı yayın karşılaştırılmalıdır."],
    ],
    freshnessTitle: "Güncellik bir lansman eşiğidir.",
    freshness: "Her kanıt kaydı UTC kontrol zamanı, adı belirtilmiş inceleme rolü ve doğrudan kamu bağlantısı içermelidir. T−60 dakikada ve herhangi bir adres yayını veya kayıt açılışından hemen önce yeniden kontrol edin. Eksik zaman damgası, erişilemeyen bağlantı, değişmiş değer veya kanallar arası uyumsuzluk lansmanı BEKLET durumuna döndürür.",
    note: "Lansman açısından kritik kanıtlar eksikken sayısal hazırlık puanı gösterilmez; yüzde, kazanılmamış bir onay izlenimi verebilir.",
  },
};

const publicationAudit = {
  en: {
    eyebrow: "PUBLICATION QA · LOCAL ONLY",
    title: "Files, links, and critical warnings must travel together.",
    intro: "The downloadable audit checks that all 22 launch assets are present and that seven English/Turkish document pairs retain required pre-launch, hold, and safety markers.",
    status: "22 FILES · 7 LANGUAGE PAIRS",
    limit: "A passing local audit does not prove that a public URL is reachable, that evidence is current or authentic, or that the launch is approved. Readiness remains HOLD.",
  },
  tr: {
    eyebrow: "YAYIN KALİTE KONTROLÜ · YALNIZCA YEREL",
    title: "Dosyalar, bağlantılar ve kritik uyarılar birlikte ilerlemelidir.",
    intro: "İndirilebilir denetim, 22 lansman dosyasının bulunduğunu ve yedi İngilizce/Türkçe belge çiftinde gerekli lansman öncesi, bekletme ve güvenlik işaretlerinin korunduğunu kontrol eder.",
    status: "22 DOSYA · 7 DİL ÇİFTİ",
    limit: "Başarılı yerel denetim, kamu bağlantısının erişilebilir olduğunu, kanıtın güncel veya gerçek olduğunu ya da lansmanın onaylandığını kanıtlamaz. Hazırlık durumu BEKLET olarak kalır.",
  },
};

const incidentResponse = {
  en: {
    eyebrow: "INCIDENT RESPONSE · PUBLIC PROTOCOL",
    title: "If a launch signal conflicts, stop the action.",
    intro: "A mismatched address, unexpected wallet request, impersonation report, unavailable evidence link, or changed authority value immediately returns launch activity to HOLD.",
    status: "HOLD ON ANY TRIGGER",
    steps: [
      ["PAUSE", "Stop address publication, registration opening, distribution, and scheduled social posts. Do not improvise a replacement address or link."],
      ["CONTAIN", "Remove unsafe links from project-controlled surfaces, preserve public evidence, and warn the community without repeating a suspicious wallet or payment request."],
      ["CORRECT", "Publish one timestamped correction on this website first, then mirror the exact bilingual wording to the pinned announcement and livestream."],
      ["REVIEW", "Two separated review roles must recheck the full value, direct public evidence, UTC time, and cross-channel match before any activity resumes."],
    ],
    note: "Support will not resolve an incident through a private message and will never ask for a seed phrase, private key, password, personal data, payment, or token transfer.",
  },
  tr: {
    eyebrow: "OLAY MÜDAHALESİ · KAMU PROTOKOLÜ",
    title: "Lansman sinyalleri çelişirse işlemi durdurun.",
    intro: "Eşleşmeyen adres, beklenmedik cüzdan isteği, taklit hesap bildirimi, erişilemeyen kanıt bağlantısı veya değişmiş yetki değeri lansman faaliyetini derhâl BEKLET durumuna döndürür.",
    status: "HER TETİKLEYİCİDE BEKLET",
    steps: [
      ["DURAKLAT", "Adres yayınını, kayıt açılışını, dağıtımı ve planlı sosyal paylaşımları durdurun. Yerine yeni bir adres veya bağlantı uydurmayın."],
      ["SINIRLA", "Güvenli olmayan bağlantıları proje kontrolündeki yüzeylerden kaldırın, kamu kanıtını koruyun ve şüpheli cüzdan ya da ödeme isteğini yinelemeden topluluğu uyarın."],
      ["DÜZELT", "Zaman damgalı tek düzeltmeyi önce bu web sitesinde yayımlayın; ardından aynı iki dilli metni sabitlenmiş duyuruya ve canlı yayına taşıyın."],
      ["İNCELE", "Herhangi bir faaliyet yeniden başlamadan önce iki ayrı inceleme rolü tam değeri, doğrudan kamu kanıtını, UTC zamanını ve kanallar arası eşleşmeyi yeniden kontrol etmelidir."],
    ],
    note: "Destek bir olayı özel mesajla çözmez ve asla seed phrase, özel anahtar, şifre, kişisel veri, ödeme veya token transferi istemez.",
  },
};

const releasePacket = {
  en: {
    eyebrow: "CROSS-CHANNEL RELEASE PACKET · LOCAL ONLY",
    title: "One source. Three public surfaces. No silent substitutions.",
    intro: "Before any address publication, the website, pinned announcement, and livestream must carry the same launch-critical values character for character.",
    status: "HOLD UNTIL EXACT MATCH",
    surfaces: [
      ["Website", "Set the canonical public wording here first; unresolved token fields stay PENDING."],
      ["Pinned announcement", "Copy the same full values and safety notice without shortening addresses or changing status language."],
      ["Livestream", "Display and read back the same values; a verbal claim or cropped screen is not a substitute for public evidence."],
    ],
    limit: "The downloadable validator compares supplied text only. It does not fetch URLs, inspect Solana, verify evidence, handle wallet data, or approve launch readiness. A match still returns HOLD.",
  },
  tr: {
    eyebrow: "KANALLAR ARASI YAYIN PAKETİ · YALNIZCA YEREL",
    title: "Tek kaynak. Üç kamu yüzeyi. Sessiz değişiklik yok.",
    intro: "Herhangi bir adres yayınından önce web sitesi, sabitlenmiş duyuru ve canlı yayın, lansman açısından kritik değerleri karakter karakter aynı göstermelidir.",
    status: "TAM EŞLEŞMEYE KADAR BEKLET",
    surfaces: [
      ["Web sitesi", "Standart kamu metnini önce burada belirleyin; çözülmemiş token alanları BEKLİYOR durumunda kalsın."],
      ["Sabitlenmiş duyuru", "Adresleri kısaltmadan veya durum dilini değiştirmeden aynı tam değerleri ve güvenlik uyarısını kopyalayın."],
      ["Canlı yayın", "Aynı değerleri gösterip sesli olarak tekrar edin; sözlü iddia veya kırpılmış ekran kamu kanıtının yerini tutmaz."],
    ],
    limit: "İndirilebilir doğrulayıcı yalnızca sağlanan metni karşılaştırır. URL getirmez, Solana'yı incelemez, kanıt doğrulamaz, cüzdan verisi işlemez veya lansman hazırlığını onaylamaz. Eşleşme sonucu yine BEKLET'tir.",
  },
};

const evidenceLedger = {
  en: {
    eyebrow: "EVIDENCE FRESHNESS LEDGER · LOCAL ONLY",
    title: "Current evidence needs an expiry, two reviewers, and a direct link.",
    intro: "The downloadable validator checks six required evidence records at one declared UTC time. Missing, stale, future-dated, duplicated, or single-reviewer evidence fails closed.",
    status: "HOLD ON ANY GAP",
    checks: [
      ["Six required records", "Token identity, mint authority, freeze authority, allocation, release controls, and channel consistency must each be present."],
      ["Explicit freshness window", "Every verified record needs checked-at and expires-at UTC times; stale evidence is rejected deterministically."],
      ["Separated review", "A primary and independent review role must be named, and they cannot be the same role."],
    ],
    limit: "The validator reads supplied metadata only. It does not fetch a URL, inspect Solana, authenticate evidence, handle wallet data, or approve launch readiness. Every result remains HOLD.",
  },
  tr: {
    eyebrow: "KANIT GÜNCELLİK KAYDI · YALNIZCA YEREL",
    title: "Güncel kanıt; sona erme zamanı, iki inceleyen ve doğrudan bağlantı gerektirir.",
    intro: "İndirilebilir doğrulayıcı, belirtilen tek UTC zamanında altı zorunlu kanıt kaydını kontrol eder. Eksik, eski, ileri tarihli, yinelenen veya tek incelemeli kanıt kapalı durumda başarısız olur.",
    status: "HER EKSİKTE BEKLET",
    checks: [
      ["Altı zorunlu kayıt", "Token kimliği, mint yetkisi, dondurma yetkisi, tahsis, serbest bırakma kontrolleri ve kanal tutarlılığı ayrı ayrı bulunmalıdır."],
      ["Açık güncellik aralığı", "Doğrulanan her kayıt UTC kontrol ve sona erme zamanlarını içermelidir; eski kanıt belirlenimci biçimde reddedilir."],
      ["Ayrı inceleme", "Birincil ve bağımsız inceleme rolleri adlandırılmalı ve aynı rol olmamalıdır."],
    ],
    limit: "Doğrulayıcı yalnızca sağlanan üst veriyi okur. URL getirmez, Solana'yı incelemez, kanıtın gerçekliğini doğrulamaz, cüzdan verisi işlemez veya lansman hazırlığını onaylamaz. Her sonuç BEKLET olarak kalır.",
  },
};

const readinessSnapshot = {
  en: {
    eyebrow: "COMPOSITE READINESS SNAPSHOT · LOCAL ONLY",
    title: "Three gates. One fail-closed snapshot.",
    intro: "The downloadable composer joins the publication audit, cross-channel packet result, and evidence-freshness ledger result into one deterministic handoff.",
    status: "HOLD · NOT LAUNCH APPROVAL",
    gates: [
      ["Publication integrity", "All public files and critical pre-launch warnings must pass the local publication audit."],
      ["Cross-channel consistency", "Website, pinned announcement, and livestream values must match, with unresolved critical fields counted."],
      ["Evidence freshness", "The six required evidence records must reconcile as current or unresolved under separated review."],
    ],
    limit: "The snapshot composes supplied local results only. It does not fetch public links, authenticate evidence, inspect Solana, handle wallet data, or turn a HOLD into READY.",
  },
  tr: {
    eyebrow: "BİLEŞİK HAZIRLIK ANLIK GÖRÜNÜMÜ · YALNIZCA YEREL",
    title: "Üç eşik. Kapalı durumda başarısız olan tek görünüm.",
    intro: "İndirilebilir birleştirici; yayın denetimini, kanallar arası paket sonucunu ve kanıt güncelliği kayıt sonucunu belirlenimci tek bir devre tesliminde toplar.",
    status: "BEKLET · LANSMAN ONAYI DEĞİLDİR",
    gates: [
      ["Yayın bütünlüğü", "Tüm kamu dosyaları ve kritik lansman öncesi uyarılar yerel yayın denetiminden geçmelidir."],
      ["Kanallar arası tutarlılık", "Web sitesi, sabitlenmiş duyuru ve canlı yayın değerleri eşleşmeli; çözülmemiş kritik alanlar sayılmalıdır."],
      ["Kanıt güncelliği", "Altı zorunlu kanıt kaydı, ayrılmış inceleme altında güncel veya çözülmemiş olarak uzlaşmalıdır."],
    ],
    limit: "Anlık görünüm yalnızca sağlanan yerel sonuçları birleştirir. Kamu bağlantılarını getirmez, kanıtı doğrulamaz, Solana'yı incelemez, cüzdan verisi işlemez veya BEKLET kararını HAZIR durumuna dönüştürmez.",
  },
};

const rehearsalTrace = {
  en: {
    eyebrow: "REHEARSAL TRACE · LOCAL ONLY",
    title: "Timed checks need an auditable handoff.",
    intro: "The downloadable validator requires three ordered rehearsal records with UTC times, separated operator and reviewer roles, and explicit notes.",
    status: "HOLD AFTER EVERY REHEARSAL",
    phases: [
      ["T−60", "Record evidence freshness, public-link availability, and cross-channel copy before final staging."],
      ["T−15", "Repeat safety, account-control, and support-route checks without introducing new launch claims."],
      ["PRE-ACTION", "Recheck immediately before address publication, registration opening, or any scheduled broadcast action."],
    ],
    limit: "A complete rehearsal trace is operational evidence, not launch approval. HOLD or FAIL remains unresolved, and even three PASS records return HOLD for human review.",
  },
  tr: {
    eyebrow: "PROVA İZİ · YALNIZCA YEREL",
    title: "Zamanlı kontroller denetlenebilir bir devre teslimi gerektirir.",
    intro: "İndirilebilir doğrulayıcı; UTC zamanlı, operatör ve inceleyen rolleri ayrılmış, açık notlar içeren üç sıralı prova kaydı gerektirir.",
    status: "HER PROVADAN SONRA BEKLET",
    phases: [
      ["T−60", "Son hazırlıktan önce kanıt güncelliğini, kamu bağlantılarının erişimini ve kanallar arası metni kaydedin."],
      ["T−15", "Yeni lansman iddiası eklemeden güvenlik, hesap kontrolü ve destek yollarını yeniden kontrol edin."],
      ["İŞLEM ÖNCESİ", "Adres yayını, kayıt açılışı veya planlı yayın işleminden hemen önce yeniden kontrol edin."],
    ],
    limit: "Tam bir prova izi operasyon kanıtıdır; lansman onayı değildir. BEKLET veya BAŞARISIZ çözülmemiş kalır ve üç BAŞARILI kaydı bile insan incelemesi için BEKLET döndürür.",
  },
};

const changeFreeze = {
  en: {
    eyebrow: "CHANGE-FREEZE MANIFEST · LOCAL ONLY",
    title: "Freeze the reviewed bundle. Detect every silent change.",
    intro: "The downloadable validator creates SHA-256 digests for an approved public asset inventory, then rejects any missing, altered, duplicated, or unexpected file.",
    status: "ANY CHANGE RETURNS HOLD",
    checks: [
      ["Approved inventory", "A reviewer supplies the exact public files intended for the freeze; the tool does not decide which content is approved."],
      ["Content digests", "Every frozen file receives a deterministic SHA-256 digest so text changes are visible before publication."],
      ["Strict comparison", "Missing, changed, duplicate, or extra files fail closed and require a new human review."],
    ],
    limit: "The validator reads only supplied local files. It does not fetch the website, authenticate evidence, inspect Solana, handle wallet data, or approve launch readiness. A matching bundle still returns HOLD.",
  },
  tr: {
    eyebrow: "DEĞİŞİKLİK DONDURMA MANİFESTOSU · YALNIZCA YEREL",
    title: "İncelenen paketi dondurun. Her sessiz değişikliği tespit edin.",
    intro: "İndirilebilir doğrulayıcı, onaylanan kamu dosyası envanteri için SHA-256 özetleri oluşturur; eksik, değiştirilmiş, yinelenmiş veya beklenmeyen her dosyayı reddeder.",
    status: "HER DEĞİŞİKLİKTE BEKLET",
    checks: [
      ["Onaylı envanter", "İnceleyen kişi dondurulacak kesin kamu dosyalarını sağlar; araç hangi içeriğin onaylı olduğuna karar vermez."],
      ["İçerik özetleri", "Her dondurulmuş dosya belirlenimci SHA-256 özeti alır; böylece metin değişiklikleri yayından önce görünür olur."],
      ["Sıkı karşılaştırma", "Eksik, değişmiş, yinelenmiş veya fazla dosyalar kapalı durumda başarısız olur ve yeni insan incelemesi gerektirir."],
    ],
    limit: "Doğrulayıcı yalnızca sağlanan yerel dosyaları okur. Web sitesini getirmez, kanıtı doğrulamaz, Solana'yı incelemez, cüzdan verisi işlemez veya lansman hazırlığını onaylamaz. Eşleşen paket bile BEKLET döndürür.",
  },
};

const launchHandoff = {
  en: {
    eyebrow: "HUMAN LAUNCH HANDOFF · LOCAL ONLY",
    title: "Package the evidence. Keep the final decision human.",
    intro: "The downloadable validator composes the readiness snapshot, rehearsal trace, and change-freeze result into one role-separated handoff packet.",
    status: "HUMAN DECISION PENDING",
    checks: [
      ["Three supplied results", "Readiness, rehearsal, and frozen-asset results must each remain HOLD and declare that no network was checked."],
      ["Separated role codes", "Use only release-operator, safety-reviewer, and decision-owner; names and email addresses are rejected."],
      ["Explicit unresolved count", "Pending evidence, release fields, and rehearsal checks are totaled without converting them into a readiness score."],
    ],
    limit: "The packet records a review boundary; it does not fetch evidence, inspect Solana, handle wallet data, or sign for a person. Software cannot set READY or grant launch approval.",
  },
  tr: {
    eyebrow: "İNSAN ODAKLI LANSMAN DEVRİ · YALNIZCA YEREL",
    title: "Kanıtları paketleyin. Nihai kararı insanda tutun.",
    intro: "İndirilebilir doğrulayıcı; hazırlık görünümünü, prova izini ve değişiklik dondurma sonucunu rol ayrımı yapılmış tek bir devir paketinde birleştirir.",
    status: "İNSAN KARARI BEKLENİYOR",
    checks: [
      ["Sağlanan üç sonuç", "Hazırlık, prova ve dondurulmuş dosya sonuçlarının her biri BEKLET durumunda kalmalı ve ağ kontrolü yapılmadığını belirtmelidir."],
      ["Ayrılmış rol kodları", "Yalnızca release-operator, safety-reviewer ve decision-owner kullanılır; adlar ve e-posta adresleri reddedilir."],
      ["Açık çözülmemiş toplam", "Bekleyen kanıtlar, yayın alanları ve prova kontrolleri hazırlık puanına dönüştürülmeden toplanır."],
    ],
    limit: "Paket bir inceleme sınırı kaydeder; kanıt getirmez, Solana'yı incelemez, cüzdan verisi işlemez veya bir kişi adına imza atmaz. Yazılım HAZIR durumunu belirleyemez ya da lansman onayı veremez.",
  },
};

export default function Home() {
  const [language, setLanguage] = useState<"en" | "tr">("en");
  const [notice, setNotice] = useState("");
  const [activationOpen, setActivationOpen] = useState(false);
  useEffect(() => {
    if (window.location.hostname.includes("ileriakil")) {
      queueMicrotask(() => setLanguage("tr"));
    }
  }, []);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("activate") !== "1") return;
    queueMicrotask(() => setActivationOpen(true));
    params.delete("activate");
    const suffix = params.toString();
    window.history.replaceState({}, "", `${window.location.pathname}${suffix ? `?${suffix}` : ""}${window.location.hash}`);
  }, []);
  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);
  const t = language === "tr" ? { ...repairLegacyEncoding(copy.tr), ...trPublicVoice } : repairLegacyEncoding(copy.en);
  const m = repairLegacyEncoding(manifesto[language]);
  const schedule = repairLegacyEncoding(launchPlan[language]);
  const antiScam = repairLegacyEncoding(scamProtocol[language]);
  const disclosure = repairLegacyEncoding(tokenDisclosure[language]);
  const evidence = repairLegacyEncoding(evidencePack[language]);
  const documents = repairLegacyEncoding(documentPack[language]);
  const validator = validatorPlan[language];
  const readiness = readinessScorecard[language];
  const audit = publicationAudit[language];
  const incident = incidentResponse[language];
  const packet = releasePacket[language];
  const ledger = evidenceLedger[language];
  const snapshot = readinessSnapshot[language];
  const trace = rehearsalTrace[language];
  const freeze = changeFreeze[language];
  const handoff = launchHandoff[language];
  const register = () => { setNotice(t.notice); setActivationOpen(true); };
  const openActivation = () => setActivationOpen(true);
  const changeLanguage = () => { const next = language === "en" ? "tr" : "en"; setLanguage(next); setNotice(""); };
  return <>
    {activationOpen && <ActivationTerminal language={language} onClose={() => setActivationOpen(false)} />}
    <a className="skip-link" href="#main-content">{language === "en" ? "Skip to main content" : "Ana içeriğe geç"}</a>
    <span className="sr-only" id="registration-safety">{t.free}</span>
    <nav aria-label={language === "en" ? "Primary navigation" : "Ana navigasyon"}><div className="mark" aria-label="Internal Agency">IA<span aria-hidden="true">{"///"}</span></div><div className="nav-links"><a href="#mission">{t.nav[0]}</a><a href="#token">{t.nav[1]}</a><a href="#roadmap">{t.nav[2]}</a><a href="#document-pack-title">{t.nav[3]}</a><a href="/launch">{language === "en" ? "Launch" : "Lansman"}</a><a href="/proof">{language === "en" ? "Proof" : "Kanıt"}</a><a href="/signal">{language === "en" ? "Signal" : "Sinyal"}</a><a href="/future">{language === "en" ? "Future" : "Gelecek"}</a></div><div className="nav-actions"><button className="language" onClick={changeLanguage} aria-label={t.languageLabel}>{t.lang}</button><button className="outline" onClick={register} aria-describedby="registration-safety">{t.register}</button></div></nav>
    <main id="main-content" tabIndex={-1}><LaunchSequence language={language} />
    <section className="hero" aria-labelledby="hero-title"><div className="grid" aria-hidden="true" /><div className="orbital-nodes" aria-hidden="true"><i /><i /><i /><i /></div><div className="signal">{t.signal}</div><div className="terminal-head"><span>{t.terminal}</span><span>{t.terminalNote}</span></div><p className="eyebrow">{t.presents}</p><h1 id="hero-title">STAR<br />ASCENT<span>.</span></h1><p className="lede">{m.lede}</p><div className="actions"><button onClick={register} aria-describedby="registration-safety">{t.enter}</button><a className="text-link" href="#token">{t.disclosure}</a></div><LaunchClock language={language} /><div className="launch-time"><span>{t.genesis}</span><strong>{language === "en" ? "29 JUL · 15:00:00 UTC" : "29 TEM · 18:00:00 İSTANBUL"}</strong><span className="broadcast">{t.broadcast} · {language === "en" ? "CODE PUBLIC // EVIDENCE HOLD" : "KOD AÇIK // KANIT BEKLET"}</span></div></section>
    <div className="signal-ticker" aria-label={language === "en" ? "Project signal" : "Proje sinyali"}><div>{language === "en" ? "THE SIGNAL IS OPEN  //  BUILD THE STRANGE  //  BUILD THE BEAUTIFUL  //  BUILD IN PUBLIC  //  STAR ASCENT" : "SİNYAL AÇIK  //  TUHAFI İNŞA ET  //  GÜZELİ İNŞA ET  //  HERKESİN GÖZÜ ÖNÜNDE İNŞA ET  //  STAR ASCENT"}</div></div>
    <SignalField language={language} onOpenTerminal={openActivation} />
    <section className="brief"><p className="eyebrow">{m.brief}</p><h2>{m.briefTitle}</h2><div className="brief-console">{m.lines.map((line: string) => <p key={line}>{line}</p>)}</div></section>
    <section className="outer-comms"><img src="/images/outer-comms-v1.png" alt="" /><div><p className="eyebrow">{language === "en" ? "OUTER COMMS // SECURE" : "DIŞ İLETİŞİM // GÜVENLİ"}</p><h2>{language === "en" ? <>THE SIGNAL<br />IS ALIVE.</> : <>SİNYAL<br />CANLI.</>}</h2><p>{language === "en" ? "A constellation answers from the black. One room. One rising ship. Every line is moving." : "Takımyıldız karanlıktan cevap veriyor. Tek oda. Yükselen tek gemi. Her hat hareket ediyor."}</p></div></section>
    <section className="genesis-console" aria-labelledby="genesis-console-title"><div className="genesis-console-heading"><p>{language === "en" ? "GENESIS // COMMAND CENTER" : "BAŞLANGIÇ // KOMUTA MERKEZİ"}</p><h2 id="genesis-console-title">{language === "en" ? <>CHOOSE YOUR<br />ENTRY VECTOR.</> : <>GİRİŞ VEKTÖRÜNÜ<br />SEÇ.</>}</h2><span>{language === "en" ? "Three public surfaces. One verification order." : "Üç kamuya açık alan. Tek doğrulama sırası."}</span></div><div className="genesis-console-grid"><a href="/dossier"><small>01 // {language === "en" ? "CANONICAL RECORD" : "KANONİK KAYIT"}</small><strong>{language === "en" ? "OPEN THE DOSSIER" : "DOSYAYI AÇ"}</strong><em>{language === "en" ? "Read the public record, token design target, and evidence gates." : "Kamu kaydını, token tasarım hedefini ve kanıt eşiklerini oku."}</em><b>↗</b></a><button onClick={openActivation}><small>02 // {language === "en" ? "PREPARE" : "HAZIRLAN"}</small><strong>{language === "en" ? "ACTIVATION TERMINAL" : "AKTİVASYON TERMİNALİ"}</strong><em>{language === "en" ? "Review the safe Genesis sequence. No wallet connection required." : "Güvenli Başlangıç sırasını incele. Cüzdan bağlantısı gerekmez."}</em><b>→</b></button><a href="#schedule"><small>03 // {language === "en" ? "WITNESS" : "TANIK OL"}</small><strong>{language === "en" ? "BROADCAST WINDOW" : "YAYIN PENCERESİ"}</strong><em>{language === "en" ? "29 July at 15:00:00 UTC. The window opens exactly; transaction execution remains human-approved." : "29 Temmuz saat 18:00:00 İstanbul. Pencere tam zamanında açılır; işlem yürütme insan onaylı kalır."}</em><b>↓</b></a></div></section>
    <figure className="keyart">
      <div className="keyart-frame">
        {/* eslint-disable-next-line @next/next/no-img-element -- native dimensions and lazy loading keep this static Sites asset stable */}
        <img src="/images/star-ascent-keyart-v2.png" width={1728} height={909} loading="lazy" decoding="async" fetchPriority="low" alt={language === "en" ? "Amber STAR ASCENT signal-acquired deep-space telemetry artwork" : "Kehribar STAR ASCENT sinyal alındı derin uzay telemetri görseli"} />
      </div>
      <figcaption>{language === "en" ? "PRE-LAUNCH ART · Decorative brand artwork — not live telemetry or network status." : "LANSMAN ÖNCESİ GÖRSEL · Dekoratif marka görseli — canlı telemetri veya ağ durumu değildir."}</figcaption>
    </figure>
    <figure className="scorpion-story">
      <div className="scorpion-story-copy"><p>{language === "en" ? "SCORPION GENERATION // LAUNCH CONTROL" : "AKREP NESLİ // FIRLATMA KONTROLÜ"}</p><h2>{language === "en" ? <>WE DO NOT<br />WAIT FOR THE<br />FUTURE.</> : <>GELECEĞİ<br />BEKLEMEYİZ.</>}</h2><span>{language === "en" ? "The stage is a ship. The signal is a gathering. The ascent is ours." : "Sahne bir gemidir. Sinyal bir buluşmadır. Yükseliş bizimdir."}</span></div>
      {/* eslint-disable-next-line @next/next/no-img-element -- static, responsive lore artwork */}
      <img src="/images/scorpion-launch-control-v1.png" width={1728} height={909} loading="lazy" decoding="async" alt={language === "en" ? "Adult Scorpion Generation stage director and light operators at a starship launch-rave control deck" : "Yıldız gemisi fırlatma-rave kontrol güvertesinde yetişkin Akrep Nesli sahne direktörü ve ışık operatörleri"} />
    </figure>
    <figure className="crew-arrival"><div className="crew-arrival-copy"><p>{language === "en" ? "THE CREW // ARRIVAL WINDOW" : "EKİP // VARIŞ PENCERESİ"}</p><h2>{language === "en" ? <>THE LIGHTS<br />ARE ALREADY<br />ON.</> : <>IŞIKLAR<br />ÇOKTAN<br />AÇIK.</>}</h2><span>{language === "en" ? "Not a promise. A scene set for the people arriving with their eyes open." : "Bir vaat değil. Gözleri açık gelenler için kurulmuş bir sahne."}</span></div>{/* eslint-disable-next-line @next/next/no-img-element -- static, responsive lore artwork */}<img src="/images/scorpion-crew-arrival-v1.png" width={1728} height={909} loading="lazy" decoding="async" alt={language === "en" ? "Adult stage commander and light operators in a red spacecraft launch hangar" : "Kırmızı uzay aracı fırlatma hangarında yetişkin sahne komutanı ve ışık operatörleri"} /></figure>
    <section className="ascent-ritual" aria-label={language === "en" ? "The ascent ritual" : "Yükseliş ritüeli"}><img src="/images/ascent-ritual-v1.png" alt={language === "en" ? "A crew witnessing the STAR ASCENT launch beneath a luminous constellation" : "Işıklı bir takımyıldızın altında STAR ASCENT fırlatmasını izleyen ekip"} /><div><p className="eyebrow">{language === "en" ? "THE SCORPION GENERATION" : "AKREP NESLİ"}</p><h2>{language === "en" ? <>WE DON&apos;T WATCH<br />THE FUTURE.</> : <>GELECEĞİ<br />İZLEMEYİZ.</>}</h2><p>{language === "en" ? "We gather at the edge of the signal: artists, operators, believers and night people. The ship rises; the room becomes a constellation." : "Sinyalin kıyısında buluşuruz: sanatçılar, operatörler, inananlar ve gece insanları. Gemi yükselir; oda bir takımyıldızına dönüşür."}</p></div></section>
    <section className="statement" id="mission"><p className="eyebrow">{m.premise}</p><h2>{m.thesis}</h2><p>{m.body}</p></section>
    <section className="token" id="token"><div><p className="eyebrow">{t.token}</p><h2>{m.clear}</h2></div><div className="token-grid"><div><span>{t.supply}</span><b>{t.supplyTarget}</b></div><div><span>{t.network}</span><b>Solana</b></div><div><span>{t.presale}</span><b>{t.none}</b></div><div><span>{t.yield}</span><b>{t.none}</b></div></div><p className="note">{disclosure.note}</p></section>
    <section className="token-disclosure" aria-labelledby="token-disclosure-title"><p className="eyebrow">{disclosure.eyebrow}</p><h2 id="token-disclosure-title">{disclosure.title}</h2><p className="disclosure-intro">{disclosure.intro}</p><dl>{disclosure.items.map(([term, detail]: string[]) => <div key={term}><dt>{term}<span>{disclosure.pending}</span></dt><dd>{detail}</dd></div>)}</dl><p className="disclosure-gate"><strong>{disclosure.gate}</strong> <a href="#evidence">{language === "en" ? "Review the publication gate ↓" : "Yayın eşiğini incele ↓"}</a></p></section>
    <section className="evidence-pack" id="evidence" aria-labelledby="evidence-title"><p className="eyebrow">{evidence.eyebrow}</p><h2 id="evidence-title">{evidence.title}</h2><p className="evidence-intro">{evidence.intro}</p><ol>{evidence.items.map(([title, detail]: string[], index: number) => <li key={title}><span aria-hidden="true">0{index + 1}</span><div><h3>{title}</h3><p>{detail}</p></div><strong>{evidence.status}</strong></li>)}</ol><p className="evidence-note">{evidence.note}</p><a className="document-link" href={language === "en" ? "/disclosures/iat-allocation-authority-checklist-en.txt" : "/disclosures/iat-allocation-authority-checklist-tr.txt"} download>{evidence.download}</a></section>
    <section className="validator-plan" aria-labelledby="validator-plan-title"><p className="eyebrow">{validator.eyebrow}</p><h2 id="validator-plan-title">{validator.title}</h2><p className="validator-plan-intro">{validator.intro}</p><ol>{validator.checks.map(([title, detail], index) => <li key={title}><span aria-hidden="true">0{index + 1}</span><div><h3>{title}</h3><p>{detail}</p></div></li>)}</ol><p className="validator-plan-limit"><strong>{language === "en" ? "LIMIT" : "SINIR"}</strong> {validator.limit}</p><a className="document-link" href="/disclosures/iat-allocation-validator.mjs" download>{documents.validator}</a><h3 className="validator-plan-subtitle">{validator.authorityTitle}</h3><p className="validator-plan-intro">{validator.authorityIntro}</p><p className="validator-plan-limit"><strong>{language === "en" ? "EVIDENCE GATE" : "KANIT EŞİĞİ"}</strong> {validator.authorityLimit}</p><a className="document-link" href="/disclosures/iat-authority-plan-validator.mjs" download>{documents.authorityValidator}</a></section>
    <section className="document-pack" aria-labelledby="document-pack-title"><p className="eyebrow">{documents.eyebrow}</p><h2 id="document-pack-title">{documents.title}</h2><p className="document-pack-intro">{documents.intro}</p><div className="document-cards"><a href={language === "en" ? "/disclosures/iat-litepaper-en.txt" : "/disclosures/iat-litepaper-tr.txt"} download><span>{documents.status}</span><strong>{documents.litepaper}</strong></a><a href={language === "en" ? "/disclosures/iat-allocation-authority-checklist-en.txt" : "/disclosures/iat-allocation-authority-checklist-tr.txt"} download><span>{documents.status}</span><strong>{documents.checklist}</strong></a><a href={language === "en" ? "/disclosures/iat-solana-technical-spec-en.txt" : "/disclosures/iat-solana-technical-spec-tr.txt"} download><span>{documents.status}</span><strong>{documents.technical}</strong></a><a href="/disclosures/iat-allocation-validator.mjs" download><span>{documents.status}</span><strong>{documents.validator}</strong></a><a href="/disclosures/iat-authority-plan-validator.mjs" download><span>{documents.status}</span><strong>{documents.authorityValidator}</strong></a><a href={language === "en" ? "/disclosures/star-ascent-communications-kit-en.txt" : "/disclosures/star-ascent-communications-kit-tr.txt"} download><span>{documents.status}</span><strong>{documents.socialKit}</strong></a><a href={language === "en" ? "/disclosures/star-ascent-launch-rehearsal-en.txt" : "/disclosures/star-ascent-launch-rehearsal-tr.txt"} download><span>{documents.status}</span><strong>{documents.rehearsal}</strong></a><a href={language === "en" ? "/disclosures/star-ascent-readiness-scorecard-en.txt" : "/disclosures/star-ascent-readiness-scorecard-tr.txt"} download><span>{readiness.status}</span><strong>{documents.readiness}</strong></a><a href={language === "en" ? "/disclosures/star-ascent-incident-response-en.txt" : "/disclosures/star-ascent-incident-response-tr.txt"} download><span>{documents.status}</span><strong>{documents.incident}</strong></a><a href="/disclosures/star-ascent-publication-audit.mjs" download><span>{documents.status}</span><strong>{documents.audit}</strong></a><a href="/disclosures/star-ascent-release-packet-validator.mjs" download><span>{packet.status}</span><strong>{documents.releaseValidator}</strong></a><a href="/disclosures/star-ascent-evidence-ledger-validator.mjs" download><span>{ledger.status}</span><strong>{documents.evidenceValidator}</strong></a><a href="/disclosures/star-ascent-readiness-snapshot-validator.mjs" download><span>{snapshot.status}</span><strong>{documents.snapshotValidator}</strong></a><a href="/disclosures/star-ascent-rehearsal-trace-validator.mjs" download><span>{trace.status}</span><strong>{documents.rehearsalTraceValidator}</strong></a><a href="/disclosures/star-ascent-change-freeze-validator.mjs" download><span>{freeze.status}</span><strong>{documents.changeFreezeValidator}</strong></a><a href="/disclosures/star-ascent-launch-handoff-validator.mjs" download><span>{handoff.status}</span><strong>{documents.launchHandoffValidator}</strong></a></div><p className="document-pack-note">{documents.note}</p></section>
    <details className="deep-archive"><summary><span>{language === "en" ? "OPEN THE DEEP ARCHIVE" : "DERİN ARŞİVİ AÇ"}</span><small>{language === "en" ? "Operational controls, rehearsal and readiness material" : "Operasyon kontrolleri, prova ve hazırlık materyalleri"}</small></summary><div className="deep-archive-body"><section className="publication-audit" aria-labelledby="publication-audit-title"><p className="eyebrow">{audit.eyebrow}</p><div className="publication-audit-heading"><h2 id="publication-audit-title">{audit.title}</h2><strong>{audit.status}</strong></div><p className="publication-audit-intro">{audit.intro}</p><p className="publication-audit-limit"><strong>{language === "en" ? "LIMIT" : "SINIR"}</strong> {audit.limit}</p><a className="document-link" href="/disclosures/star-ascent-publication-audit.mjs" download>{documents.audit}</a></section>
    <section className="release-packet" aria-labelledby="release-packet-title"><p className="eyebrow">{packet.eyebrow}</p><div className="release-packet-heading"><h2 id="release-packet-title">{packet.title}</h2><strong>{packet.status}</strong></div><p className="release-packet-intro">{packet.intro}</p><ol>{packet.surfaces.map(([title, detail], index) => <li key={title}><span aria-hidden="true">0{index + 1}</span><div><h3>{title}</h3><p>{detail}</p></div></li>)}</ol><p className="release-packet-limit"><strong>{language === "en" ? "LIMIT" : "SINIR"}</strong> {packet.limit}</p><a className="document-link" href="/disclosures/star-ascent-release-packet-validator.mjs" download>{documents.releaseValidator}</a></section>
    <section className="evidence-ledger" aria-labelledby="evidence-ledger-title"><p className="eyebrow">{ledger.eyebrow}</p><div className="evidence-ledger-heading"><h2 id="evidence-ledger-title">{ledger.title}</h2><strong>{ledger.status}</strong></div><p className="evidence-ledger-intro">{ledger.intro}</p><ol>{ledger.checks.map(([title, detail], index) => <li key={title}><span aria-hidden="true">0{index + 1}</span><div><h3>{title}</h3><p>{detail}</p></div></li>)}</ol><p className="evidence-ledger-limit"><strong>{language === "en" ? "LIMIT" : "SINIR"}</strong> {ledger.limit}</p><a className="document-link" href="/disclosures/star-ascent-evidence-ledger-validator.mjs" download>{documents.evidenceValidator}</a></section>
    <section className="readiness-snapshot" aria-labelledby="readiness-snapshot-title"><p className="eyebrow">{snapshot.eyebrow}</p><div className="readiness-snapshot-heading"><h2 id="readiness-snapshot-title">{snapshot.title}</h2><strong>{snapshot.status}</strong></div><p className="readiness-snapshot-intro">{snapshot.intro}</p><ol>{snapshot.gates.map(([title, detail], index) => <li key={title}><span aria-hidden="true">0{index + 1}</span><div><h3>{title}</h3><p>{detail}</p></div></li>)}</ol><p className="readiness-snapshot-limit"><strong>{language === "en" ? "LIMIT" : "SINIR"}</strong> {snapshot.limit}</p><a className="document-link" href="/disclosures/star-ascent-readiness-snapshot-validator.mjs" download>{documents.snapshotValidator}</a></section>
    <section className="rehearsal-trace" aria-labelledby="rehearsal-trace-title"><p className="eyebrow">{trace.eyebrow}</p><div className="rehearsal-trace-heading"><h2 id="rehearsal-trace-title">{trace.title}</h2><strong>{trace.status}</strong></div><p className="rehearsal-trace-intro">{trace.intro}</p><ol>{trace.phases.map(([title, detail], index) => <li key={title}><span aria-hidden="true">0{index + 1}</span><div><h3>{title}</h3><p>{detail}</p></div></li>)}</ol><p className="rehearsal-trace-limit"><strong>{language === "en" ? "LIMIT" : "SINIR"}</strong> {trace.limit}</p><a className="document-link" href="/disclosures/star-ascent-rehearsal-trace-validator.mjs" download>{documents.rehearsalTraceValidator}</a></section>
    <section className="change-freeze" aria-labelledby="change-freeze-title"><p className="eyebrow">{freeze.eyebrow}</p><div className="change-freeze-heading"><h2 id="change-freeze-title">{freeze.title}</h2><strong>{freeze.status}</strong></div><p className="change-freeze-intro">{freeze.intro}</p><ol>{freeze.checks.map(([title, detail], index) => <li key={title}><span aria-hidden="true">0{index + 1}</span><div><h3>{title}</h3><p>{detail}</p></div></li>)}</ol><p className="change-freeze-limit"><strong>{language === "en" ? "LIMIT" : "SINIR"}</strong> {freeze.limit}</p><a className="document-link" href="/disclosures/star-ascent-change-freeze-validator.mjs" download>{documents.changeFreezeValidator}</a></section>
    <section className="launch-handoff" aria-labelledby="launch-handoff-title"><p className="eyebrow">{handoff.eyebrow}</p><div className="launch-handoff-heading"><h2 id="launch-handoff-title">{handoff.title}</h2><strong>{handoff.status}</strong></div><p className="launch-handoff-intro">{handoff.intro}</p><ol>{handoff.checks.map(([title, detail], index) => <li key={title}><span aria-hidden="true">0{index + 1}</span><div><h3>{title}</h3><p>{detail}</p></div></li>)}</ol><p className="launch-handoff-limit"><strong>{language === "en" ? "LIMIT" : "SINIR"}</strong> {handoff.limit}</p><a className="document-link" href="/disclosures/star-ascent-launch-handoff-validator.mjs" download>{documents.launchHandoffValidator}</a></section>
    <section className="readiness-scorecard" aria-labelledby="readiness-title"><p className="eyebrow">{readiness.eyebrow}</p><div className="readiness-heading"><h2 id="readiness-title">{readiness.title}</h2><strong>{readiness.status}</strong></div><p className="readiness-intro">{readiness.intro}</p><ol>{readiness.items.map(([title, detail], index) => <li key={title}><span aria-hidden="true">0{index + 1}</span><div><h3>{title}</h3><p>{detail}</p></div><strong>{readiness.status}</strong></li>)}</ol><div className="freshness-gate"><h3>{readiness.freshnessTitle}</h3><p>{readiness.freshness}</p></div><p className="readiness-note">{readiness.note}</p></section>
    <section className="incident-response" aria-labelledby="incident-response-title"><p className="eyebrow">{incident.eyebrow}</p><div className="incident-response-heading"><h2 id="incident-response-title">{incident.title}</h2><strong>{incident.status}</strong></div><p className="incident-response-intro">{incident.intro}</p><ol>{incident.steps.map(([title, detail], index) => <li key={title}><span aria-hidden="true">0{index + 1}</span><div><h3>{title}</h3><p>{detail}</p></div></li>)}</ol><p className="incident-response-note">{incident.note}</p><a className="document-link" href={language === "en" ? "/disclosures/star-ascent-incident-response-en.txt" : "/disclosures/star-ascent-incident-response-tr.txt"} download>{documents.incident}</a></section>
    </div></details>
    <section className="status"><p className="eyebrow">{t.status}</p><div><span className="pulse" aria-hidden="true" />{t.live}</div><div>{t.verified}</div><div><span className="check" aria-hidden="true">✓</span>{t.safety}</div></section>
    <section className="schedule" aria-labelledby="schedule-title"><p className="eyebrow">{schedule.eyebrow}</p><h2 id="schedule-title">{schedule.title}</h2><p className="schedule-note">{schedule.note}</p><ol>{schedule.items.map(([time, title, description]: string[]) => <li key={time}><time>{time}</time><div><h3>{title}</h3><p>{description}</p></div></li>)}</ol><a className="document-link" href="https://github.com/InternalAgencyIO/InternalAgency/tree/agent/iat-launch-window/projects/star-ascent/site" target="_blank" rel="noreferrer">{language === "en" ? "REVIEW THE OPEN-SOURCE CEREMONY CODE ↗" : "AÇIK KAYNAK TÖREN KODUNU İNCELE ↗"}</a></section>
    <section className="roadmap" id="roadmap"><p className="eyebrow">{t.staged}</p><div className="steps">{t.phases.map(([title, description]: string[], i: number) => <article key={title}><span>0{i + 1}</span><h3>{title}</h3><p>{description}</p></article>)}</div></section>
    <section className="postgenesis-tease" aria-labelledby="postgenesis-title"><div><p>{language === "en" ? "POST-GENESIS // INACTIVE PREVIEWS" : "BAŞLANGIÇ SONRASI // PASİF ÖNİZLEMELER"}</p><h2 id="postgenesis-title">{language === "en" ? <>THE NEXT ROOMS<br />ARE TAKING SHAPE.</> : <>SONRAKİ ODALAR<br />ŞEKİLLENİYOR.</>}</h2><span>{language === "en" ? "Predictive Engine target: 30 days after $IAT Genesis. Casino DLC target: 15 days after $IAT Genesis. Separate audits, separate activation, no wager route today." : "Tahmin Motoru hedefi: $IAT Başlangıcından 30 gün sonra. Casino DLC hedefi: $IAT Başlangıcından 15 gün sonra. Ayrı denetim, ayrı aktivasyon; bugün bahis yolu yok."}</span><a href="/future">{language === "en" ? "ENTER THE FUTURE-SYSTEMS PREVIEW →" : "GELECEK SİSTEMLER ÖNİZLEMESİNE GİR →"}</a></div></section>
    <section className="faq" id="faq" aria-labelledby="faq-title"><p className="eyebrow" id="faq-title">{t.faq}</p>{[...t.questions, ...faqAdditions[language]].map(([question, answer]) => <details key={question}><summary>{question}</summary><p>{answer}</p></details>)}</section>
    <section className="anti-scam" aria-labelledby="anti-scam-title"><p className="eyebrow">{antiScam.eyebrow}</p><h2 id="anti-scam-title">{antiScam.title}</h2><p className="anti-scam-intro">{antiScam.intro}</p><div className="safety-steps">{antiScam.steps.map(([label, guidance]: string[], index: number) => <article key={label}><span aria-hidden="true">0{index + 1}</span><h3>{label}</h3><p>{guidance}</p></article>)}</div><p className="safety-warning"><strong>{antiScam.warning}</strong></p></section>
    <section className="register"><p className="eyebrow">{t.protocol}</p><h2>{t.verify}</h2><p>{t.free}</p><button onClick={register} aria-describedby="registration-safety">{t.prepare}</button><p className="notice" role="status" aria-live="polite">{notice}</p></section>
    </main>
    <footer><div className="mark">IA<span>{"///"}</span></div><p>{t.risk}</p><a href="#token">{t.disclosure}</a></footer>
  </>;
}
