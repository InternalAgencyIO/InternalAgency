"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { sourceLanguageForClientPath } from "../../../i18n/config";

type Copy = { label: string; title: string; deck: string; state: string; blocks: [string, string][]; next: string };

const NEXT_RECORD_ROUTES: Record<string, string> = {
  "white-dossier": "/dossier/read/tokenomics",
  tokenomics: "/dossier/read/genesis-proof",
  "mint-manifest": "/dossier/read/genesis-run",
  "genesis-proof": "/dossier/read/mint-manifest",
  "broadcast-pack": "/dossier/read/social-kit",
  "social-kit": "/dossier/read/white-dossier",
  "genesis-run": "/dossier/read/genesis-proof",
  "authority-map": "/dossier/read/genesis-proof",
  "technical-spec": "/dossier/read/mint-manifest",
  readiness: "/dossier/read/genesis-run",
  "incident-response": "/dossier",
};

function repairLegacyEncoding<T>(value: T): T {
  if (typeof value === "string") {
    // Legacy records passed through Windows-1252. Its punctuation bytes (such
    // as the sequences that render as â€™ or â†’) are not direct byte values.
    const windows1252 = new Map<number, number>([
      [0x20AC, 0x80], [0x201A, 0x82], [0x0192, 0x83], [0x201E, 0x84], [0x2026, 0x85], [0x2020, 0x86], [0x2021, 0x87], [0x02C6, 0x88], [0x2030, 0x89], [0x0160, 0x8A], [0x2039, 0x8B], [0x0152, 0x8C], [0x017D, 0x8E], [0x2018, 0x91], [0x2019, 0x92], [0x201C, 0x93], [0x201D, 0x94], [0x2022, 0x95], [0x2013, 0x96], [0x2014, 0x97], [0x02DC, 0x98], [0x2122, 0x99], [0x0161, 0x9A], [0x203A, 0x9B], [0x0153, 0x9C], [0x017E, 0x9E], [0x0178, 0x9F],
    ]);
    // Turkish dotted-I and s-cedilla artifacts can start with Ä or Å rather
    // than the Ã sequence covered by the older generic detection below.
    if (/[\u00c4\u00c5]/.test(value)) {
      const bytes: number[] = [];
      for (const character of value) {
        const codePoint = character.codePointAt(0)!;
        const byte = codePoint <= 0xFF ? codePoint : windows1252.get(codePoint);
        if (byte === undefined) return value;
        bytes.push(byte);
      }
      try { return new TextDecoder("utf-8", { fatal: true }).decode(Uint8Array.from(bytes)) as T; } catch { return value; }
    }
    if (!/[ÃÅâ]/.test(value)) return value;
    const bytes: number[] = [];
    for (const character of value) {
      const codePoint = character.codePointAt(0)!;
      const byte = codePoint <= 0xFF ? codePoint : windows1252.get(codePoint);
      if (byte === undefined) return value;
      bytes.push(byte);
    }
    try { return new TextDecoder("utf-8", { fatal: true }).decode(Uint8Array.from(bytes)) as T; } catch { return value; }
  }
  if (Array.isArray(value)) return value.map(repairLegacyEncoding) as T;
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, repairLegacyEncoding(item)])) as T;
  return value;
}

const EN: Record<string, Copy> = {
  "white-dossier": { label: "CANONICAL RECORD / 01", title: "WHITE DOSSIER", deck: "The public transmission of STAR ASCENT: a mythic system made legible before Genesis.", state: "LIVE DRAFT / READING EDITION", blocks: [["THE SIGNAL", "STAR ASCENT is a public build across culture, technology, and collective imagination. The work stays visible so the record can be inspected in real time."], ["THE BOUNDARY", "No presale or paid registration. No token-price, profit, or guaranteed market-value promise. The proposed reward program is disclosed separately and remains inactive on mainnet HOLD."], ["THE STANDARD", "Every material Genesis claim belongs beside a public address, transaction, program reference, or a clear HOLD status."]], next: "OPEN TOKENOMICS →" },
  tokenomics: { label: "CANONICAL RECORD / 02", title: "TOKENOMICS", deck: "A fixed-supply design target with its reward mechanics and adverse outcomes visible before execution.", state: "POLICY V2 / NOT ACTIVE / MAINNET HOLD", blocks: [["FIXED SUPPLY", "1,000,000,000 IAT: Community 50%; Treasury 20%; Ecosystem 15%; Core Team 10%; Liquidity 5%. The on-chain mint and authority evidence are not yet public."], ["REWARD RESERVE", "Treasury, ecosystem and liquidity form an ordered, intentionally exhaustible 400M IAT reserve. The Genesis target unlocks 25% of each lane, or 100M total. New positions must be fully collateralized before acceptance."], ["RATES + CCC", "Simple annual rates, paid weekly without automatic compounding: core team 17%, standard user 10%, CCC Agent 28%, eligible downstream CCC associate 20%. A weekly public random draw pauses one CCC Agency and its snapshotted downstream group for that turn. Every exact protocol tie uses one final, exact-uniform, publicly verifiable roll over a precommitted candidate set. Full terms: /tokenomics."]], next: "OPEN GENESIS PROOF →" },
  "mint-manifest": { label: "OPERATOR RECORD / 03", title: "MINT MANIFEST", deck: "The sequence that must be rehearsed, signed physically, and evidenced without shortcuts.", state: "HOLD UNTIL SIGNER REHEARSAL", blocks: [["SIGNER GATE", "The fee payer is signed on the Trezor device. Any required one-time mint-account signer is treated as a rehearsal gate, never an invisible detail."], ["STANDARD PROGRAM", "The intended path uses the original SPL Token Program. No hidden mint path, transfer tax, or surprise authority belongs in the launch."], ["PUBLICATION", "Mint address, program, supply, authority evidence, allocation addresses, locks, and circulating-supply calculation are published together."]], next: "OPEN GENESIS RUN →" },
  "genesis-proof": { label: "EVIDENCE RECORD / 04", title: "GENESIS PROOF", deck: "A designed evidence ledger for the moment a proposal becomes a public network fact.", state: "AWAITING ON-CHAIN EVIDENCE", blocks: [["MINT", "Record the verified mint address, decimals, supply, and token program."], ["AUTHORITY", "Record the transaction evidence that confirms mint and freeze authority removal."], ["ALLOCATIONS", "Record allocation wallets, lock evidence, circulating calculation, and any known limitation in plain language."]], next: "OPEN MINT MANIFEST →" },
  "broadcast-pack": { label: "TRANSMISSION / 05", title: "BROADCAST PACK", deck: "The run of show for a launch broadcast that values proof over theatre—without losing the theatre.", state: "LIVE BUILD / EDITION 01", blocks: [["OPEN", "State the time window, the scope, and the fact that no transaction is final until physically signed and publicly confirmed."], ["SIGNAL", "Show the public evidence screens as they exist. Do not narrate unavailable facts as already complete."], ["CLOSE", "Publish the proof route and a clear HOLD notice if any gate is incomplete."]], next: "OPEN SOCIAL KIT →" },
  "social-kit": { label: "SIGNAL SYSTEM / 06", title: "SOCIAL KIT", deck: "A living set of language and visual cues for the Scorpion Generation signal.", state: "LIVE BUILD / EDITION 01", blocks: [["VOICE", "Precise, electric, suspicious of empty promises. Myth is welcome; false certainty is not."], ["VISUAL", "Hot red, deep space, operators, light, movement, and a system visibly being assembled."], ["POSTING", "Lead to designed Dossier routes, then attach immutable evidence as it is available."]], next: "OPEN WHITE DOSSIER →" },
  "genesis-run": { label: "OPERATIONS RECORD / 07", title: "GENESIS RUN", deck: "A live sequence for the hours around Genesis, with stop conditions explicit.", state: "HOLD UNTIL ALL GATES PASS", blocks: [["BEFORE", "Verify the signing device, devnet rehearsal, intended accounts, publication payload, and live page copy."], ["DURING", "Sign only what is shown on the device. Capture transaction references immediately and do not improvise recovery steps."], ["AFTER", "Publish the evidence ledger, confirm authority state, and reconcile actual circulating supply before any forward-looking story."]], next: "OPEN GENESIS PROOF →" },
};

const TR: Record<string, Copy> = {
  "white-dossier": { label: "KANONİK KAYIT / 01", title: "BEYAZ DOSYA", deck: "STAR ASCENT’in kamusal iletimi: Başlangıç öncesinde okunabilir kılınmış mitik sistem.", state: "CANLI TASLAK / OKUMA SÜRÜMÜ", blocks: [["SİNYAL", "STAR ASCENT; kültür, teknoloji ve kolektif hayal gücü arasında kurulan kamusal bir yapıdır. Kayıt gerçek zamanlı incelenebilsin diye çalışma görünür kalır."], ["SINIR", "Ön satış veya ücretli kayıt yoktur. Token fiyatı, kâr veya garantili piyasa değeri vaadi yoktur. Önerilen ödül programı ayrıca açıklanır ve mainnet BEKLET durumunda aktifsiz kalır."], ["STANDART", "Her maddi Başlangıç iddiası; bir kamusal adres, işlem, program kaydı veya açık bir BEKLET durumu ile birlikte yer alır."]], next: "TOKENOMICS AÇ →" },
  tokenomics: { label: "KANONİK KAYIT / 02", title: "TOKENOMICS", deck: "Ödül mekanikleri ve olumsuz sonuçları yürütme öncesinde görünür kılınmış sabit arz hedefi.", state: "POLİTİKA V2 / AKTİF DEĞİL / MAINNET BEKLET", blocks: [["SABİT ARZ", "1.000.000.000 IAT: Topluluk %50; Hazine %20; Ekosistem %15; Çekirdek Ekip %10; Likidite %5. Zincir üstü mint ve yetki kanıtı henüz kamusal değildir."], ["ÖDÜL REZERVİ", "Hazine, ekosistem ve likidite sıralı ve tasarım gereği tükenebilir 400M IAT rezervini oluşturur. Başlangıç hedefinde her hattın %25'i, toplam 100M açılır. Yeni pozisyonlar kabul öncesinde tam teminatlandırılmalıdır."], ["ORANLAR + CCC", "Otomatik bileşik olmadan haftalık ödenen basit yıllık oranlar: çekirdek ekip %17, standart kullanıcı %10, CCC Agent %28, uygun alt CCC associate %20. Haftalık kamusal rastgele çekiliş, bir CCC Agency ve anlık görüntüdeki alt grubunu o tur için duraklatır. Her tam protokol eşitliği, önceden taahhütlü aday kümesi üzerinde tek, kesin, tam eşit dağılımlı ve kamuya açık doğrulanabilir çekilişle çözülür. Tüm şartlar: /tokenomics."]], next: "BAŞLANGIÇ KANITINI AÇ →" },
  "mint-manifest": { label: "OPERATÖR KAYDI / 03", title: "MINT BİLDİRİMİ", deck: "Kestirme olmadan prova edilmesi, fiziksel olarak imzalanması ve kanıtlanması gereken sıra.", state: "İMZACI PROVASI TAMAMLANANA KADAR BEKLET", blocks: [["İMZACI EŞİĞİ", "Ücret ödeyen işlem Trezor cihazında imzalanır. Gerekli olabilecek tek seferlik mint hesabı imzacısı görünmeyen bir ayrıntı değil, prova eşiğidir."], ["STANDART PROGRAM", "Amaçlanan yol özgün SPL Token Programıdır. Gizli mint yolu, transfer vergisi veya sürpriz yetki yoktur."], ["YAYIN", "Mint adresi, program, arz, yetki kanıtı, tahsis adresleri, kilitler ve dolaşımdaki arz hesabı birlikte yayımlanır."]], next: "BAŞLANGIÇ AKIŞINI AÇ →" },
  "genesis-proof": { label: "KANIT KAYDI / 04", title: "BAŞLANGIÇ KANITI", deck: "Bir önerinin kamusal ağ gerçeğine dönüştüğü an için tasarlanmış kanıt defteri.", state: "ZİNCİR ÜSTÜ KANIT BEKLİYOR", blocks: [["MINT", "Doğrulanmış mint adresini, ondalıkları, arzı ve token programını kaydedin."], ["YETKİ", "Mint ve dondurma yetkisinin kaldırıldığını doğrulayan işlem kanıtını kaydedin."], ["TAHSİSLER", "Tahsis cüzdanlarını, kilit kanıtını, dolaşım hesabını ve bilinen sınırlamaları açık dille kaydedin."]], next: "MINT BİLDİRİMİNİ AÇ →" },
  "broadcast-pack": { label: "İLETİM / 05", title: "YAYIN PAKETİ", deck: "Tiyatroyu kaybetmeden kanıtı önceliklendiren lansman yayını akışı.", state: "CANLI YAPI / SÜRÜM 01", blocks: [["AÇILIŞ", "Zaman penceresini, kapsamı ve fiziksel olarak imzalanıp kamusal olarak doğrulanmadan hiçbir işlemin kesin olmadığını belirtin."], ["SİNYAL", "Kamusal kanıt ekranlarını var oldukları hâliyle gösterin. Mevcut olmayan gerçekleri tamamlanmış gibi anlatmayın."], ["KAPANIŞ", "Kanıt rotasını yayımlayın; bir eşik eksikse açık bir BEKLET notu bırakın."]], next: "SOSYAL KİTİ AÇ →" },
  "social-kit": { label: "SİNYAL SİSTEMİ / 06", title: "SOSYAL KİT", deck: "Akrep Nesli sinyali için yaşayan dil ve görsel ipuçları seti.", state: "CANLI YAPI / SÜRÜM 01", blocks: [["SES", "Kesin, elektrikli ve boş vaatlere şüpheci. Mit serbesttir; sahte kesinlik değildir."], ["GÖRSEL", "Sıcak kırmızı, derin uzay, operatörler, ışık, hareket ve görünür biçimde inşa edilen bir sistem."], ["YAYIN", "Tasarlanmış Dosya rotalarına yönlendirin; değişmez kanıtları hazır olduklarında ekleyin."]], next: "BEYAZ DOSYAYI AÇ →" },
  "genesis-run": { label: "OPERASYON KAYDI / 07", title: "BAŞLANGIÇ AKIŞI", deck: "Başlangıç çevresindeki saatler için durdurma koşulları açık bir canlı sıra.", state: "TÜM EŞİKLER GEÇİLENE KADAR BEKLET", blocks: [["ÖNCE", "İmza cihazını, devnet provasını, hedef hesapları, yayın paketini ve canlı sayfa kopyasını doğrulayın."], ["SIRASINDA", "Yalnızca cihazda gösterileni imzalayın. İşlem referanslarını hemen kaydedin; kurtarma adımlarını doğaçlamayın."], ["SONRA", "Kanıt defterini yayımlayın, yetki durumunu doğrulayın ve ileriye dönük anlatıdan önce gerçek dolaşımı mutabık kılın."]], next: "BAŞLANGIÇ KANITINI AÇ →" },
};

const tailoredEN: Record<string, Copy> = {
  "authority-map": { label: "CONTROL RECORD / 08", title: "AUTHORITY MAP", deck: "A public checklist for the moment the system gives up the powers it must not retain.", state: "HOLD UNTIL EVIDENCED", blocks: [["MINT AUTHORITY", "The mint authority is a launch gate, not a trust-me sentence. Its revocation belongs in a public transaction record."], ["FREEZE AUTHORITY", "Freeze authority follows the same rule: name the state, publish the evidence, or keep the record on HOLD."], ["ALLOCATION CONTROL", "Time-locks, custody boundaries, and public allocation addresses are evidence objects, not marketing copy."]], next: "OPEN GENESIS PROOF →" },
  "technical-spec": { label: "SYSTEM RECORD / 09", title: "TECHNICAL SPEC", deck: "A readable technical contract between the signal, the chain, and the people verifying both.", state: "REFERENCE EDITION", blocks: [["TOKEN STANDARD", "The intended design uses the original SPL Token Program with a fixed supply target and nine decimals."], ["VERIFICATION", "Every technical statement should resolve to a mint address, program reference, account state, or a clear pending label."], ["NO HIDDEN LAYER", "No transfer tax, surprise authority, or opaque execution path belongs in the public design."]], next: "OPEN MINT MANIFEST →" },
  readiness: { label: "LAUNCH RECORD / 10", title: "READINESS SCORE", deck: "A visible list of what must be true before the signal crosses from theatre into a public event.", state: "LIVE CHECKLIST", blocks: [["DEVICE", "The physical signer, device update state, and rehearsal path are confirmed before any mainnet action."], ["EVIDENCE", "The public pages, release packet, and evidence ledger are ready before the first final signature."], ["STOP CONDITION", "If a gate is incomplete, the correct move is HOLD. Speed does not outrank verifiability."]], next: "OPEN GENESIS RUN →" },
  "incident-response": { label: "SAFETY RECORD / 11", title: "INCIDENT RESPONSE", deck: "A calm route through bad information, compromised links, and the pressure to move too quickly.", state: "ALWAYS ACTIVE", blocks: [["PAUSE", "Stop broadcast claims and transactions when a material inconsistency appears. Preserve facts before narrative."], ["VERIFY", "Use known official addresses and independent evidence. Never accept a wallet or link from a reply, DM, or rushed message."], ["RECORD", "Publish the correction, the decision, and the new status in the archive. A visible pause is stronger than a hidden mistake."]], next: "RETURN TO DOSSIER →" },
};

const tailoredTR: Record<string, Copy> = {
  "authority-map": { label: "KONTROL KAYDI / 08", title: "YETKİ HARİTASI", deck: "Sistemin elinde kalmaması gereken yetkilerden vazgeçtiği an için kamusal kontrol kaydı.", state: "KANITLANANA KADAR BEKLET", blocks: [["MINT YETKİSİ", "Mint yetkisi güven sözü değil, lansman eşiğidir. Kaldırılması kamusal işlem kaydında görünmelidir."], ["DONDURMA YETKİSİ", "Dondurma yetkisi de aynı kurala tabidir: durumu adlandırın, kanıtı yayımlayın veya kaydı BEKLET'te tutun."], ["TAHSİS KONTROLÜ", "Zaman kilitleri, saklama sınırları ve kamusal tahsis adresleri pazarlama metni değil, kanıt nesneleridir."]], next: "BAŞLANGIÇ KANITINI AÇ →" },
  "technical-spec": { label: "SİSTEM KAYDI / 09", title: "TEKNİK ŞARTNAME", deck: "Sinyal, zincir ve ikisini doğrulayan insanlar arasında okunabilir teknik sözleşme.", state: "REFERANS SÜRÜMÜ", blocks: [["TOKEN STANDARDI", "Amaçlanan tasarım, sabit arz hedefi ve dokuz ondalıkla özgün SPL Token Programını kullanır."], ["DOĞRULAMA", "Her teknik ifade bir mint adresine, program kaydına, hesap durumuna veya açık bekleyen etikete bağlanmalıdır."], ["GİZLİ KATMAN YOK", "Transfer vergisi, sürpriz yetki veya kapalı yürütme yolu kamusal tasarımın parçası değildir."]], next: "MINT BİLDİRİMİNİ AÇ →" },
  readiness: { label: "LANSAMAN KAYDI / 10", title: "HAZIRLIK SKORU", deck: "Sinyal, tiyatrodan kamusal olaya geçmeden önce doğru olması gerekenlerin görünür listesi.", state: "CANLI KONTROL LİSTESİ", blocks: [["CİHAZ", "Fiziksel imzalayıcı, cihaz güncelliği ve prova yolu ana ağ işleminden önce doğrulanır."], ["KANIT", "İlk kesin imzadan önce kamusal sayfalar, yayın paketi ve kanıt defteri hazırdır."], ["DURDURMA KOŞULU", "Bir eşik eksikse doğru hareket BEKLET'tir. Hız doğrulanabilirliğin önüne geçmez."]], next: "BAŞLANGIÇ AKIŞINI AÇ →" },
  "incident-response": { label: "GÜVENLİK KAYDI / 11", title: "OLAY MÜDAHALESİ", deck: "Kötü bilgi, ele geçirilmiş bağlantılar ve acele baskısı içinde sakin bir rota.", state: "HER ZAMAN AKTİF", blocks: [["DURAKLAT", "Maddi bir tutarsızlık belirdiğinde yayın iddialarını ve işlemleri durdurun. Anlatıdan önce gerçekleri koruyun."], ["DOĞRULA", "Bilinen resmi adresleri ve bağımsız kanıtı kullanın. Yanıt, DM veya acele mesajdan gelen cüzdanı kabul etmeyin."], ["KAYDET", "Düzeltmeyi, kararı ve yeni durumu arşivde yayımlayın. Görünür duraklama gizli hatadan daha güçlüdür."]], next: "DOSYAYA DÖN →" },
};

function fallback(language: "en" | "tr", slug: string): Copy {
  if (language === "en" && tailoredEN[slug]) return tailoredEN[slug];
  if (language === "tr" && tailoredTR[slug]) return tailoredTR[slug];
  return language === "tr" ? { label: "KAYIT BULUNAMADI", title: "KANONİK OLMAYAN ADRES", deck: "Bu adres kanonik bir STAR ASCENT Dosya kaydına karşılık gelmiyor.", state: "KAYIT YAYINLANMADI", blocks: [["DOĞRULAMA", "Kanonik kayıtları Dosya ana sayfasından açın."], ["GÜVENLİK", "Bu sayfadaki herhangi bir iddiayı kamusal kanıt olarak kullanmayın."], ["SONRAKİ", "Doğru kayıt bağlantısı için Dosya dizinine dönün."]], next: "DOSYAYA DÖN →" } : { label: "RECORD NOT FOUND", title: "NON-CANONICAL ADDRESS", deck: "This address does not resolve to a canonical STAR ASCENT Dossier record.", state: "RECORD NOT PUBLISHED", blocks: [["VERIFY", "Open canonical records from the Dossier index."], ["SAFETY", "Do not treat any claim on this page as public evidence."], ["NEXT", "Return to the Dossier index for the correct record link."]], next: "RETURN TO DOSSIER →" };
}

function archiveFragments(language: "en" | "tr", slug: string) {
  const en = [
    ["ARCHIVE FRAGMENT", "Every page is a room on the ship. The bridge holds the visible choices; the archive keeps the reasons, revisions, and pressure around them."],
    ["SCORPION GENERATION", "The point is not to perform futurity. It is to become precise enough to build a future in public—beautifully, critically, and without faking what is not ready."],
    ["THE NEXT SIGNAL", slug === "genesis-run" ? "Genesis is a threshold, not an ending. The record stays open after the launch window." : "Follow this record into the next room. The world is assembled by routes, traces, and the people who keep showing up."]
  ];
  const tr = [
    ["ARŞİV PARÇASI", "Her sayfa gemide bir odadır. Köprü görünür seçimleri taşır; arşiv ise nedenleri, düzeltmeleri ve bunların çevresindeki baskıyı saklar."],
    ["AKREP NESLİ", "Amaç geleceği canlandırmak değildir. Amaç, geleceği herkesin gözü önünde inşa edecek kadar kesinleşmektir: güzel, eleştirel ve hazır olmayanı hazırmış gibi göstermeden."],
    ["SONRAKİ SİNYAL", slug === "genesis-run" ? "Başlangıç bir eşiktir, bitiş değil. Kayıt lansman penceresinden sonra da açık kalır." : "Bu kaydı sonraki odaya takip edin. Dünya; rotalar, izler ve görünmeye devam eden insanlar tarafından kurulur."]
  ];
  return language === "tr" ? tr : en;
}

export default function DossierReaderPage() {
  const params = useParams<{ slug: string }>();
  const [language, setLanguage] = useState<"en" | "tr">("en");
  useEffect(() => setLanguage(sourceLanguageForClientPath(window.location.pathname, window.location.hostname)), []);
  const record = useMemo(() => repairLegacyEncoding((language === "tr" ? TR : EN)[params.slug] ?? fallback(language, params.slug)), [language, params.slug]);
  const fragments = repairLegacyEncoding(archiveFragments(language, params.slug));
  const radianceArt = params.slug === "broadcast-pack" || params.slug === "social-kit"
    ? { src: "/images/radiance-studio-signal.png", width: 800, height: 1966 }
    : params.slug === "genesis-run" || params.slug === "readiness"
      ? { src: "/images/radiance-bike-operator.webp", width: 1024, height: 1536 }
      : params.slug === "white-dossier"
        ? { src: "/images/radiance-roller-rave.webp", width: 853, height: 1844 }
        : { src: "/images/radiance-snow-train.webp", width: 864, height: 1820 };
  const nextRecordHref = NEXT_RECORD_ROUTES[params.slug] ?? "/dossier";
  return <main className="reader-page">
    <div className="reader-noise" aria-hidden="true" />
    <nav className="reader-nav"><a href="/">IA<span>///</span></a><div><a href="/dossier">{language === "tr" ? "DOSYA" : "DOSSIER"}</a><button onClick={() => setLanguage(language === "en" ? "tr" : "en")}>{language === "en" ? "TR" : "EN"}</button></div></nav>
    <section className="reader-hero"><div><p>{record.label}</p><h1>{record.title}</h1><strong>{record.state}</strong><p className="reader-deck">{record.deck}</p>{params.slug === "genesis-proof" && <p className="reader-live-note">{language === "tr" ? "CANLI KAYIT: Başlangıç sonrası kanonik bağlantılar burada görünür." : "LIVE RECORD: canonical Genesis links appear here after publication."}</p>}</div><figure>
      {/* eslint-disable-next-line @next/next/no-img-element -- Vinext runtime does not safely support next/image; this local asset has exact intrinsic dimensions. */}
      <img {...radianceArt} loading="lazy" decoding="async" alt="Radiance, Internal Agency field operator" />
      <figcaption>RADIANCE // LIVE ARCHIVE OPERATOR</figcaption>
    </figure></section>
    <section className="reader-sheet"><div className="reader-spine"><span>STAR ASCENT</span><b>0{Math.max(1, Object.keys(EN).indexOf(params.slug) + 1)}</b><span>2026</span></div><div className="reader-content">{record.blocks.map(([heading, text], index) => <article key={heading}><span>0{index + 1}</span><h2>{heading}</h2><p>{text}</p></article>)}</div></section>
    <section className="reader-lore"><figure>
      {/* eslint-disable-next-line @next/next/no-img-element -- Vinext runtime does not safely support next/image; this local asset has exact intrinsic dimensions. */}
      <img src="/images/scorpion-crew-arrival-v1.webp" width={1672} height={941} loading="lazy" decoding="async" alt={language === "tr" ? "STAR ASCENT ekibi kırmızı ışık altında geliyor" : "STAR ASCENT crew arriving under red light"} />
    </figure><div>{fragments.map(([heading, text], index) => <article key={heading}><span>0{index + 4}</span><h2>{heading}</h2><p>{text}</p></article>)}</div></section>
    <section className="reader-next"><p>{language === "tr" ? "BİR SONRAKİ KAYIT" : "NEXT RECORD"}</p><a href={nextRecordHref}>{record.next}<span>↗</span></a><a className="reader-world-link" href="/world">{language === "tr" ? "DÜNYA ARŞİVİNE GİR" : "ENTER THE WORLD ARCHIVE"}<span>◌</span></a></section>
  </main>;
}
