"use client";

import { useEffect, useState } from "react";
import { isLocaleCode, sourceLanguageForClientPath } from "../i18n/config";
import "./tokenomics.css";

const copy = {
  en: {
    lang: "TR",
    kicker: "IAT // PUBLIC ECONOMIC POLICY V2",
    title: <>THE TERMS<br />ARE VISIBLE.</>,
    intro: "This is the proposed reward and vesting design for IAT. It is public before execution so the code, funding and consequences can be reviewed.",
    state: "HOST-TESTED · NOT DEPLOYED · MAINNET HOLD",
    noticeTitle: "No reward program is live.",
    notice: "The open-source on-chain implementation passes its host policy and adapter tests. It has not completed a verifiable SBF build, independent security and economic review, or the matching hardware-wallet devnet rehearsal. No one can currently earn these rates. Mainnet remains on HOLD.",
    allocation: "FIXED SUPPLY",
    supply: "1,000,000,000 IAT · 9 DECIMALS · NO ADDITIONAL ISSUANCE INTENDED",
    allocations: [
      ["COMMUNITY", "500M", "50%"],
      ["TREASURY", "200M", "20%"],
      ["ECOSYSTEM", "150M", "15%"],
      ["CORE TEAM", "100M", "10%"],
      ["LIQUIDITY", "50M", "5%"],
    ],
    reserve: "400M REWARD RESERVE",
    reserveIntro: "Treasury, ecosystem and liquidity are ordered reward lanes. They are intentionally exhaustible.",
    lanes: [
      ["01", "TREASURY", "200M total · 50M available at Genesis target · 150M vested"],
      ["02", "ECOSYSTEM", "150M total · 37.5M available at Genesis target · 112.5M vested"],
      ["03", "LIQUIDITY", "50M total · 12.5M available at Genesis target · 37.5M vested"],
    ],
    reserveRule: "Payments draw from treasury first, then ecosystem, then liquidity. The system is designed to allow all three lanes to reach zero. There is no separately protected market-liquidity reserve in this proposal.",
    vesting: "VESTING",
    schedules: [
      ["TREASURY REMAINDER", "12-month cliff, then linear release over the following 36 months."],
      ["ECOSYSTEM REMAINDER", "6-month cliff, then linear release over the following 24 months."],
      ["LIQUIDITY REMAINDER", "6-month cliff, then linear release through month 24."],
      ["CORE-TEAM PRINCIPAL", "100M IAT: 6-month cliff, then linear release through month 24. No discretionary early unlock."],
    ],
    rates: "ANNUAL REWARD RATES",
    ratesIntro: "The percentages below are simple annual reward rates paid weekly without automatic compounding. The program UI may call them APY, but compounding is not automatic.",
    rateRows: [
      ["CORE TEAM", "17%", "Fixed across the full 100M core-team principal while it vests. CCC status never changes this rate."],
      ["STANDARD USER", "10%", "For an eligible, accepted and fully collateralized staking position."],
      ["CCC AGENT", "28%", "Applies only while the wallet holds the active CCC Agent role for the turn."],
      ["CCC ASSOCIATE", "20%", "Applies to eligible downstream associates captured by the published turn snapshot."],
    ],
    collateral: "NO UNFUNDED PROMISES",
    collateralBody: "Before accepting a new position, the program must reserve its complete maximum reward obligation from currently unlocked lane capacity. If that capacity is unavailable, the position is rejected. Existing reserved obligations remain funded; the program creates no reward debt.",
    wildcard: "CCC WILDCARD // WEEKLY",
    wildcardIntro: "The first publicly verifiable CCC draw opens 24 hours after Genesis. A new draw opens every seven days after that. The core-team role temporarily occupies one eligible Agency position for the turn.",
    wildcardRules: [
      "The selected Agency and its snapshotted downstream associates or stakers lose new turn-specific access, points and IAT rewards for that week.",
      "Previously accrued rewards, wallet assets and vested principal are not removed.",
      "Paused rewards do not accrue and remain in the current source lane.",
      "The operator cannot reroll. The eligible set, snapshot, randomness input, result and settlement record must be public.",
      "The core team’s fixed 17% rate is unchanged by the draw.",
    ],
    tiebreak: "UNIVERSAL TIEBREAK // ONE ROLL",
    tiebreakIntro: "Whenever a published protocol rule leaves two or more candidates exactly equal, the system resolves the tie with one committed, publicly verifiable random result. No operator gets the deciding vote.",
    tiebreakRules: [
      "The complete tied set and its canonical order are snapshotted before randomness is requested.",
      "One official Switchboard On-Demand commit must immediately precede the decision snapshot in the same transaction; its fresh prior-slot seed is bound on-chain.",
      "A decision-specific SHA-256 domain expands that one reveal. Exact-uniform rejection sampling maps it to one winning index without modulo bias.",
      "The same math handles 2-way, 100-way and larger ties.",
      "The decision ID, candidate-set commitment, randomness account, commit slot, reveal, derivation counter, winning index and settlement transaction must be public.",
      "The first valid result is final. There is no operator reroll and no unresolved tie.",
    ],
    gates: "ACTIVATION GATES",
    gateRows: [
      ["CODE", "Open-source staking, vesting, reserve-routing and CCC contracts match this policy."],
      ["FUNDING", "All program vaults and beneficiary addresses are published and independently compared."],
      ["RANDOMNESS", "The weekly draw and every exact tie use the published one-roll, exact-uniform method with no operator reroll."],
      ["REHEARSAL", "A new devnet rehearsal covers vesting, reserve exhaustion, role reassignment and failure paths."],
      ["REVIEW", "Independent security and economic review findings are public, including unresolved risks."],
    ],
    boundary: "IAT is highly speculative. These rates are program rules, not a promise of token price, market value, profit or uninterrupted availability. Eligibility, accepted positions and payments depend on the published contract and remaining unlocked reserve.",
    dossier: "OPEN THE DOSSIER",
    rewards: "OPEN REWARD STATUS",
    proof: "OPEN PROOF BOARD",
  },
  tr: {
    lang: "EN",
    kicker: "IAT // KAMUSAL EKONOMİ POLİTİKASI V2",
    title: <>ŞARTLAR<br />GÖRÜNÜR.</>,
    intro: "Bu, IAT için önerilen ödül ve hak ediş tasarımıdır. Kod, fonlama ve sonuçları yürütme öncesinde incelenebilsin diye açıkça yayımlanır.",
    state: "SUNUCU TESTLERİ GEÇTİ · DAĞITILMADI · MAINNET BEKLET",
    noticeTitle: "Canlı bir ödül programı yok.",
    notice: "Açık kaynak zincir üstü uygulama, sunucu politika ve adaptör testlerini geçti. Doğrulanabilir SBF derlemesi, bağımsız güvenlik ve ekonomi incelemesi ve eşleşen donanım cüzdanlı devnet provası henüz tamamlanmadı. Şu anda kimse bu oranları kazanamaz. Mainnet BEKLET durumundadır.",
    allocation: "SABİT ARZ",
    supply: "1.000.000.000 IAT · 9 ONDALIK · EK İHRAÇ PLANLANMIYOR",
    allocations: [
      ["TOPLULUK", "500M", "%50"],
      ["HAZİNE", "200M", "%20"],
      ["EKOSİSTEM", "150M", "%15"],
      ["ÇEKİRDEK EKİP", "100M", "%10"],
      ["LİKİDİTE", "50M", "%5"],
    ],
    reserve: "400M ÖDÜL REZERVİ",
    reserveIntro: "Hazine, ekosistem ve likidite sıralı ödül hatlarıdır. Tasarım gereği tükenebilirler.",
    lanes: [
      ["01", "HAZİNE", "Toplam 200M · Başlangıç hedefinde 50M kullanılabilir · 150M hak edişli"],
      ["02", "EKOSİSTEM", "Toplam 150M · Başlangıç hedefinde 37,5M kullanılabilir · 112,5M hak edişli"],
      ["03", "LİKİDİTE", "Toplam 50M · Başlangıç hedefinde 12,5M kullanılabilir · 37,5M hak edişli"],
    ],
    reserveRule: "Ödemeler önce hazineden, sonra ekosistemden, ardından likiditeden çekilir. Sistem, üç hattın da sıfıra ulaşmasına izin verecek şekilde tasarlanmıştır. Bu öneride ayrıca korunan bir piyasa likiditesi rezervi yoktur.",
    vesting: "HAK EDİŞ",
    schedules: [
      ["HAZİNE KALANI", "12 ay cliff, ardından sonraki 36 ay boyunca doğrusal serbest bırakma."],
      ["EKOSİSTEM KALANI", "6 ay cliff, ardından sonraki 24 ay boyunca doğrusal serbest bırakma."],
      ["LİKİDİTE KALANI", "6 ay cliff, ardından 24. aya kadar doğrusal serbest bırakma."],
      ["ÇEKİRDEK EKİP ANAPARASI", "100M IAT: 6 ay cliff, ardından 24. aya kadar doğrusal serbest bırakma. İsteğe bağlı erken kilit açma yoktur."],
    ],
    rates: "YILLIK ÖDÜL ORANLARI",
    ratesIntro: "Aşağıdaki yüzdeler haftalık ödenen, otomatik bileşik getirisi olmayan basit yıllık ödül oranlarıdır. Program arayüzü bunlara APY diyebilir; bileşik getiri otomatik değildir.",
    rateRows: [
      ["ÇEKİRDEK EKİP", "%17", "Hak ediş sürerken 100M çekirdek ekip anaparasının tamamına sabit uygulanır. CCC durumu bu oranı değiştirmez."],
      ["STANDART KULLANICI", "%10", "Uygun, kabul edilmiş ve tam teminatlandırılmış staking pozisyonu için."],
      ["CCC AGENT", "%28", "Yalnızca cüzdan ilgili turda aktif CCC Agent rolünü taşırken uygulanır."],
      ["CCC ASSOCIATE", "%20", "Yayımlanmış tur anlık görüntüsündeki uygun alt ilişkili hesaplara uygulanır."],
    ],
    collateral: "FONLANMAMIŞ VAAT YOK",
    collateralBody: "Program yeni bir pozisyonu kabul etmeden önce azami ödül yükümlülüğünün tamamını o anda kilidi açık hat kapasitesinden ayırmalıdır. Kapasite yoksa pozisyon reddedilir. Mevcut ayrılmış yükümlülükler fonlu kalır; sistem ödül borcu yaratmaz.",
    wildcard: "CCC WILDCARD // HAFTALIK",
    wildcardIntro: "Kamuya açık biçimde doğrulanabilir ilk CCC çekilişi Başlangıçtan 24 saat sonra açılır. Sonrasında her yedi günde yeni bir çekiliş açılır. Çekirdek ekip rolü bir tur boyunca uygun bir Agency konumunu geçici olarak işgal eder.",
    wildcardRules: [
      "Seçilen Agency ile anlık görüntüdeki alt associate veya staker hesapları o haftanın yeni erişim, puan ve IAT ödüllerini kaybeder.",
      "Daha önce tahakkuk etmiş ödüller, cüzdan varlıkları ve hak edilmiş anapara kaldırılmaz.",
      "Duraklatılan ödüller tahakkuk etmez ve mevcut kaynak hattında kalır.",
      "Operatör yeniden çekiliş yapamaz. Uygun küme, anlık görüntü, rastgelelik girdisi, sonuç ve ödeme kaydı kamusal olmalıdır.",
      "Çekirdek ekibin sabit %17 oranı çekilişten etkilenmez.",
    ],
    tiebreak: "EVRENSEL EŞİTLİK BOZMA // TEK ÇEKİLİŞ",
    tiebreakIntro: "Yayımlanmış bir protokol kuralı iki veya daha fazla adayı tamamen eşit bıraktığında, sistem eşitliği tek bir taahhütlü ve kamuya açık doğrulanabilir rastgele sonuçla çözer. Son oyu operatör vermez.",
    tiebreakRules: [
      "Eşit adayların tamamı ve kanonik sırası rastgelelik istenmeden önce anlık görüntülenir.",
      "Resmî Switchboard On-Demand commit işlemi aynı işlem içinde karar anlık görüntüsünün hemen önünde olmalıdır; taze önceki-slot seed değeri zincir üstünde bağlanır.",
      "Karara özgü SHA-256 alanı tek reveal sonucunu genişletir. Tam eşit dağılımlı rejection sampling, modulo yanlılığı olmadan kazanan indeks üretir.",
      "Aynı matematik 2’li, 100’lü ve daha büyük eşitliklerde kullanılır.",
      "Karar kimliği, aday kümesi taahhüdü, rastgelelik hesabı, commit slotu, reveal, türetme sayacı, kazanan indeks ve settlement işlemi kamusal olmalıdır.",
      "İlk geçerli sonuç kesindir. Operatör yeniden çekiliş yapamaz ve çözülmemiş eşitlik kalmaz.",
    ],
    gates: "AKTİVASYON EŞİKLERİ",
    gateRows: [
      ["KOD", "Açık kaynak staking, hak ediş, rezerv yönlendirme ve CCC sözleşmeleri bu politikayla eşleşir."],
      ["FONLAMA", "Tüm program kasaları ve lehtar adresleri yayımlanır ve bağımsız olarak karşılaştırılır."],
      ["RASTGELELİK", "Haftalık çekiliş ve her tam eşitlik, operatörün yeniden çekilişine kapalı tek çekilişli ve tam eşit dağılımlı yöntemi kullanır."],
      ["PROVA", "Yeni devnet provası hak edişi, rezerv tükenmesini, rol atamasını ve hata yollarını kapsar."],
      ["İNCELEME", "Bağımsız güvenlik ve ekonomik inceleme bulguları, çözülmemiş risklerle birlikte yayımlanır."],
    ],
    boundary: "IAT yüksek riskli ve spekülatiftir. Bu oranlar program kurallarıdır; token fiyatı, piyasa değeri, kâr veya kesintisiz kullanılabilirlik vaadi değildir. Uygunluk, kabul edilen pozisyonlar ve ödemeler yayımlanmış sözleşmeye ve kalan kilidi açık rezerve bağlıdır.",
    dossier: "DOSYAYI AÇ",
    rewards: "ÖDÜL DURUMUNU AÇ",
    proof: "KANIT PANOSUNU AÇ",
  },
};

export default function TokenomicsPage() {
  const [language, setLanguage] = useState<"en" | "tr">("en");
  useEffect(() => {
    setLanguage(sourceLanguageForClientPath(window.location.pathname, window.location.hostname));
  }, []);
  useEffect(() => {
    const routeLocale = window.location.pathname.split("/").filter(Boolean)[0];
    if (isLocaleCode(routeLocale)) return;
    document.documentElement.lang = language;
  }, [language]);
  const t = copy[language];

  return <main className="policy-page">
    <div className="policy-stars" aria-hidden="true" />
    <nav className="policy-nav">
      <a href="/">IA<span>///</span></a>
      <div><a href="/dossier">{language === "en" ? "DOSSIER" : "DOSYA"}</a><button onClick={() => setLanguage(language === "en" ? "tr" : "en")}>{t.lang}</button></div>
    </nav>

    <header className="policy-hero">
      <p>{t.kicker}</p><h1>{t.title}</h1><span>{t.intro}</span><strong>{t.state}</strong>
    </header>

    <section className="policy-hold" aria-labelledby="policy-hold-title">
      <p>00 // HOLD</p><h2 id="policy-hold-title">{t.noticeTitle}</h2><span>{t.notice}</span>
    </section>

    <section className="policy-section policy-supply">
      <p>01 // {t.allocation}</p><h2>{t.supply}</h2>
      <div>{t.allocations.map(([name, amount, share]) => <article key={name}><span>{name}</span><b>{amount}</b><em>{share}</em></article>)}</div>
    </section>

    <section className="policy-section policy-dark">
      <p>02 // {t.reserve}</p><h2>{t.reserveIntro}</h2>
      <div className="policy-lanes">{t.lanes.map(([number, name, detail]) => <article key={name}><span>{number}</span><h3>{name}</h3><p>{detail}</p></article>)}</div>
      <strong className="policy-warning">{t.reserveRule}</strong>
    </section>

    <section className="policy-section policy-light">
      <p>03 // {t.vesting}</p>
      <div className="policy-rows">{t.schedules.map(([name, detail]) => <article key={name}><h3>{name}</h3><p>{detail}</p></article>)}</div>
    </section>

    <section className="policy-section policy-rates">
      <p>04 // {t.rates}</p><h2>{t.ratesIntro}</h2>
      <div>{t.rateRows.map(([name, rate, detail]) => <article key={name}><span>{name}</span><b>{rate}</b><p>{detail}</p></article>)}</div>
      <aside><strong>{t.collateral}</strong><p>{t.collateralBody}</p></aside>
    </section>

    <section className="policy-section policy-wildcard">
      <p>05 // {t.wildcard}</p><h2>{t.wildcardIntro}</h2>
      <ol>{t.wildcardRules.map((rule, index) => <li key={rule}><span>0{index + 1}</span><p>{rule}</p></li>)}</ol>
    </section>

    <section className="policy-section policy-wildcard">
      <p>06 // {t.tiebreak}</p><h2>{t.tiebreakIntro}</h2>
      <ol>{t.tiebreakRules.map((rule, index) => <li key={rule}><span>0{index + 1}</span><p>{rule}</p></li>)}</ol>
    </section>

    <section className="policy-section policy-gates">
      <p>07 // {t.gates}</p>
      <div>{t.gateRows.map(([name, detail], index) => <article key={name}><span>0{index + 1}</span><h3>{name}</h3><p>{detail}</p><b>HOLD</b></article>)}</div>
      <p className="policy-boundary">{t.boundary}</p>
    </section>

    <footer className="policy-footer"><a href="/dossier">{t.dossier} ↗</a><a href="/rewards">{t.rewards} ↗</a><a href="/proof">{t.proof} ↗</a></footer>
  </main>;
}
