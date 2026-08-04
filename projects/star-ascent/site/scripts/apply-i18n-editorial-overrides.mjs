import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const catalogPath = path.join(root, "app", "i18n", "messages.json");
const criticalOverridesPath = path.join(root, "app", "i18n", "critical-ui-overrides.json");

const overrides = {
  ka: {
    "GENESIS DOES NOT DEPEND ON EITHER FEATURE.":
      "GENESIS არც ერთ ფუნქციაზე არ არის დამოკიდებული.",
    "Where is the official token address?":
      "სად არის ოფიციალური token-ის მისამართი?",
  },
  fi: {
    "OPEN THE SOURCE DOCUMENTS": "AVAA LÄHDEDOKUMENTIT",
  },
  qu: {
    "Alıcı kategorileri, yüzdeler, token miktarları, etiketli herkese açık cüzdanlar ve matematiksel olarak %100 toplam.":
      "Chaskiq qutukuna, rakiykuna, token yupaykuna, sutichasqa llapaq walletkuna, matematikapi %100 hunt'asqa.",
    "Lansman açısından kritik kanıtlar eksikken sayısal hazırlık puanı gösterilmez; yüzde, kazanılmamış bir onay izlenimi verebilir.":
      "Lansamientopaq ancha chaninniyuq pruebakuna falta kaptin, manam yupaywan preparación puntuta rikuchinchu; porcentajeqa mana chaskisqa aprobación hina rikuchikunman.",
    "The percentages below are simple annual reward rates paid weekly without automatic compounding. The program UI may call them APY, but compounding is not automatic.":
      "Uraypi kaq porcentajekuna sapa wataq premio tasankunam, sapa semana pagasqa mana kikillanmantapacha yapakuspa. Programa UI nisqaqa APY sutichanman, ichaqa manam kikillanmantapacha yapakunchu.",
  },
  pcm: {
    "LANGUAGE CHECK": "CHECK LANGUAGE",
    "Want English instead?": "You wan use English instead?",
    "We opened the site in your local language. English is always one tap away.":
      "We open di site for your local language. English still dey one tap away.",
    "Stay here": "Make e remain like this",
    "Switch to English": "Change am to English",
    "Close language prompt": "Close language message",
    "This closes on its own in 15 seconds.": "This one go close by itself after 15 seconds.",
  },
  pl: {
    "THE ROOM": "POKÓJ",
    VERIFY: "SPRAWDŹ",
    YAYIN: "TRANSMISJA",
  },
  de: {
    "A passing local audit does not prove that a public URL is reachable, that evidence is current or authentic, or that the launch is approved. Readiness remains HOLD.":
      "Eine bestandene lokale Prüfung beweist weder, dass eine öffentliche URL erreichbar ist, noch dass Nachweise aktuell oder authentisch sind oder der Start freigegeben wurde. Die Bereitschaft bleibt HOLD.",
    "ANY CHANGE RETURNS HOLD": "JEDE ÄNDERUNG FÜHRT ZURÜCK ZU HOLD",
    "CLAIM SYSTEM // HOLD UNTIL VERIFIED GENESIS":
      "CLAIM-SYSTEM // HOLD BIS ZUR VERIFIZIERTEN GENESIS",
    "CODE PUBLIC // EVIDENCE HOLD": "CODE ÖFFENTLICH // NACHWEIS HOLD",
    "Current readiness: HOLD.": "Aktueller Bereitschaftsstatus: HOLD.",
    HOLD: "HOLD",
    "HOLD · NOT LAUNCH APPROVAL": "HOLD · KEINE STARTFREIGABE",
    "HOLD // AWAITING EVIDENCE": "HOLD // NACHWEISE AUSSTEHEND",
    "HOLD AFTER EVERY REHEARSAL": "HOLD NACH JEDER PROBE",
    "HOLD ON ANY GAP": "HOLD BEI JEDER LÜCKE",
    "HOLD ON ANY TRIGGER": "HOLD BEI JEDEM AUSLÖSER",
    "HOLD UNTIL ALL GATES PASS": "HOLD BIS ALLE GATES BESTANDEN SIND",
    "HOLD UNTIL EXACT MATCH": "HOLD BIS ZUR EXAKTEN ÜBEREINSTIMMUNG",
    "HOLD UNTIL SIGNER REHEARSAL": "HOLD BIS ZUR SIGNER-PROBE",
    "No mainnet change": "Keine mainnet-Änderung",
    "THE RECORD REMAINS ON HOLD UNTIL PUBLIC EVIDENCE IS AVAILABLE.":
      "DER DATENSATZ BLEIBT AUF HOLD, BIS ÖFFENTLICHE NACHWEISE VERFÜGBAR SIND.",
    "The validator reads supplied metadata only. It does not fetch a URL, inspect Solana, authenticate evidence, handle wallet data, or approve launch readiness. Every result remains HOLD.":
      "Der Validator liest nur die bereitgestellten Metadaten. Er ruft keine URL ab, prüft Solana nicht, authentifiziert keine Nachweise, verarbeitet keine Wallet-Daten und gibt den Start nicht frei. Jedes Ergebnis bleibt HOLD.",
    "%50/%20/%15/%10/%5 tahsis, 400M sıralı ödül rezervi, hak ediş takvimleri, yıllık ödül oranları, haftalık CCC Wildcard ve evrensel tek çekilişli eşitlik bozma yöntemi öneri olarak yayımlandı. Zincir üstü uygulama ve kanıt bekliyor.":
      "Die %50/%20/%15/%10/%5-Zuteilung, die geordnete Belohnungsreserve von 400M, die Vesting-Zeitpläne, die jährlichen Belohnungssätze, der wöchentliche CCC Wildcard und der universelle Tiebreak mit einer einzigen Ziehung wurden als Vorschlag veröffentlicht. On-chain-Umsetzung und Nachweise stehen noch aus.",
    "1,000,000,000 IAT · 9 DECIMALS · NO ADDITIONAL ISSUANCE INTENDED":
      "1,000,000,000 IAT · 9 DEZIMALSTELLEN · KEINE ZUSÄTZLICHE AUSGABE VORGESEHEN",
    "1,000,000,000 IAT: Community 50%; Treasury 20%; Ecosystem 15%; Core Team 10%; Liquidity 5%. The on-chain mint and authority evidence are not yet public.":
      "1,000,000,000 IAT: Community 50%; Treasury 20%; Ökosystem 15%; Kernteam 10%; Liquidität 5%. Die On-chain-Nachweise für Mint und Authorities sind noch nicht öffentlich.",
    "150M total · 37.5M available at Genesis target · 112.5M vested":
      "150M insgesamt · 37.5M am Genesis-Ziel verfügbar · 112.5M im Vesting",
    "200M total · 50M available at Genesis target · 150M vested":
      "200M insgesamt · 50M am Genesis-Ziel verfügbar · 150M im Vesting",
    "400M REWARD RESERVE": "400M BELOHNUNGSRESERVE",
    "50M total · 12.5M available at Genesis target · 37.5M vested":
      "50M insgesamt · 12.5M am Genesis-Ziel verfügbar · 37.5M im Vesting",
    "Fixed across the full 100M core-team principal while it vests. CCC status never changes this rate.":
      "Fest auf den gesamten 100M Core-Team-Principal während des Vestings. Der CCC-Status ändert diesen Satz nie.",
    "Maximum combined reward reserve: 400M IAT, routed treasury → ecosystem → liquidity. New positions must be fully collateralized; all three lanes may reach zero by design.":
      "Maximale gemeinsame Belohnungsreserve: 400M IAT, in der Reihenfolge Treasury → Ökosystem → Liquidität. Neue Positionen müssen vollständig besichert sein; alle drei Bereiche können planmäßig auf null fallen.",
    "Proposed: 100M principal: 6-month cliff, then linear through month 24; fixed 17% annual reward rate across the full principal while vesting":
      "Vorschlag: 100M Principal; 6-monatiger Cliff, danach linear bis Monat 24; fester jährlicher Belohnungssatz von 17% auf den gesamten Principal während des Vestings",
    "Proposed: 25% available at Genesis target; remaining 75% has a 12-month cliff, then 36-month linear release":
      "Vorschlag: 25% am Genesis-Ziel verfügbar; die übrigen 75% haben einen Cliff von 12 Monaten, danach erfolgt die lineare Freigabe über 36 Monate",
    "Proposed: 25% available at Genesis target; remaining 75% has a 6-month cliff, then 24-month linear release":
      "Vorschlag: 25% am Genesis-Ziel verfügbar; die übrigen 75% haben einen Cliff von 6 Monaten, danach erfolgt die lineare Freigabe über 24 Monate",
    "Proposed: 25% available at Genesis target; remaining 75% has a 6-month cliff, then linear release through month 24":
      "Vorschlag: 25% am Genesis-Ziel verfügbar; die übrigen 75% haben einen Cliff von 6 Monaten, danach erfolgt die lineare Freigabe bis Monat 24",
    "Simple annual rates, paid weekly without automatic compounding: core team 17%, standard user 10%, CCC Agent 28%, eligible downstream CCC associate 20%. A weekly public random draw pauses one CCC Agency and its snapshotted downstream group for that turn. Every exact protocol tie uses one final, exact-uniform, publicly verifiable roll over a precommitted candidate set. Full terms: /tokenomics.":
      "Einfache jährliche Sätze, wöchentlich ohne automatische Verzinsung ausgezahlt: Kernteam 17%, Standardnutzer 10%, CCC Agent 28%, berechtigter nachgelagerter CCC Associate 20%. Eine öffentliche wöchentliche Zufallsauslosung pausiert für diese Runde eine CCC Agency samt ihrer per Snapshot erfassten nachgelagerten Gruppe. Jeder exakte Protokollgleichstand wird durch einen einzigen finalen, exakt gleichverteilten und öffentlich prüfbaren Wurf über eine vorab festgelegte Kandidatenmenge entschieden. Alle Bedingungen: /tokenomics.",
    "The 50/20/15/10/5 allocation, 400M ordered reward reserve, vesting schedules, annual reward rates, weekly CCC Wildcard, and universal one-roll tiebreak are published as a proposal. Their on-chain implementation and evidence remain pending.":
      "Die 50/20/15/10/5-Zuteilung, die geordnete Belohnungsreserve von 400M, Vesting-Zeitpläne, jährliche Belohnungssätze, der wöchentliche CCC Wildcard und der universelle Tiebreak mit einem Wurf sind als Vorschlag veröffentlicht. On-chain-Umsetzung und Nachweise stehen noch aus.",
    "The core team’s fixed 17% rate is unchanged by the draw.":
      "Der feste Satz des Kernteams von 17% bleibt von der Auslosung unberührt.",
    "The proposed staking system uses simple annual reward rates paid weekly without automatic compounding: standard user 10%, CCC Agent 28%, eligible downstream CCC associate 20%, and core team 17%. A public random draw reassigns one CCC Agency every week and pauses that Agency and its snapshotted downstream group for the turn. Every exact protocol tie uses the same final one-roll, exact-uniform, publicly verifiable method. The program is not active.":
      "Das vorgeschlagene Staking-System nutzt einfache jährliche Belohnungssätze, die wöchentlich ohne automatische Verzinsung ausgezahlt werden: Standardnutzer 10%, CCC Agent 28%, berechtigter nachgelagerter CCC Associate 20% und Kernteam 17%. Eine öffentliche Zufallsauslosung weist jede Woche eine CCC Agency neu zu und pausiert diese Agency samt ihrer per Snapshot erfassten nachgelagerten Gruppe für die Runde. Jeder exakte Protokollgleichstand nutzt dieselbe finale Methode mit einem Wurf: exakt gleichverteilt und öffentlich prüfbar. Das Programm ist nicht aktiv.",
    "Treasury, ecosystem and liquidity form an ordered, intentionally exhaustible 400M IAT reserve. The Genesis target unlocks 25% of each lane, or 100M total. New positions must be fully collateralized before acceptance.":
      "Treasury, Ökosystem und Liquidität bilden eine geordnete, bewusst aufbrauchbare Reserve von 400M IAT. Das Genesis-Ziel gibt 25% jedes Bereichs frei, insgesamt 100M. Neue Positionen müssen vor der Annahme vollständig besichert sein.",
  },
  zh: {
    "A complete rehearsal trace is operational evidence, not launch approval. HOLD or FAIL remains unresolved, and even three PASS records return HOLD for human review.":
      "完整的演练轨迹只是操作证据，并不代表获准上线。HOLD 或 FAIL 仍表示问题未解决；即使三项记录均为 PASS，也必须回到 HOLD 等待人工复核。",
    "A passing local audit does not prove that a public URL is reachable, that evidence is current or authentic, or that the launch is approved. Readiness remains HOLD.":
      "本地审计通过，并不能证明公共 URL 可访问、证据仍然有效且真实，也不代表上线已获批准。准备状态仍为 HOLD。",
    "ANY CHANGE RETURNS HOLD": "任一变更都会使状态回到 HOLD",
    "CLAIM SYSTEM // HOLD UNTIL VERIFIED GENESIS":
      "申领系统 // 经验证的 GENESIS 之前保持 HOLD",
    "CODE PUBLIC // EVIDENCE HOLD": "代码公开 // 证据状态 HOLD",
    "Current readiness: HOLD.": "当前准备状态：HOLD。",
    "HOLD": "HOLD",
    "HOLD · NOT LAUNCH APPROVAL": "HOLD · 并非上线批准",
    "HOLD // AWAITING EVIDENCE": "HOLD // 等待证据",
    "HOLD AFTER EVERY REHEARSAL": "每次演练后均回到 HOLD",
    "HOLD ON ANY GAP": "发现任何缺口即 HOLD",
    "HOLD ON ANY TRIGGER": "触发任一条件即 HOLD",
    "HOLD UNTIL ALL GATES PASS": "所有门槛通过前保持 HOLD",
    "HOLD UNTIL EXACT MATCH": "完全匹配前保持 HOLD",
    "HOLD UNTIL SIGNER REHEARSAL": "签名人演练完成前保持 HOLD",
    "No mainnet change": "mainnet 不作任何更改",
    "Readiness, rehearsal, and frozen-asset results must each remain HOLD and declare that no network was checked.":
      "准备度、演练和冻结资产结果均须保持 HOLD，并声明未检查任何网络。",
    "The downloadable validator compares supplied text only. It does not fetch URLs, inspect Solana, verify evidence, handle wallet data, or approve launch readiness. A match still returns HOLD.":
      "可下载验证器仅比较所提供的文本。它不会获取 URL、检查 Solana、验证证据、处理钱包数据或批准上线准备状态。即使匹配，结果仍为 HOLD。",
    "THE RECORD REMAINS ON HOLD UNTIL PUBLIC EVIDENCE IS AVAILABLE.":
      "在公开证据可用之前，记录保持 HOLD。",
    "The validator reads supplied metadata only. It does not fetch a URL, inspect Solana, authenticate evidence, handle wallet data, or approve launch readiness. Every result remains HOLD.":
      "验证器仅读取所提供的元数据。它不会获取 URL、检查 Solana、认证证据、处理钱包数据或批准上线准备状态。所有结果均保持 HOLD。",
    "Treasury, ecosystem and liquidity form an ordered, intentionally exhaustible 400M IAT reserve. The Genesis target unlocks 25% of each lane, or 100M total. New positions must be fully collateralized before acceptance.":
      "金库、生态系统和流动性构成一个按顺序调用、可按设计耗尽的 400M IAT 奖励储备。Genesis 目标会解锁每条通道的 25%，合计 100M。新仓位必须在接受前获得全额抵押。",
    "50M total · 12.5M available at Genesis target · 37.5M vested":
      "总计 50M · Genesis 目标可用 12.5M · 已归属 37.5M",
    "150M total · 37.5M available at Genesis target · 112.5M vested":
      "总计 150M · Genesis 目标可用 37.5M · 已归属 112.5M",
  },
  es: {
    "A complete rehearsal trace is operational evidence, not launch approval. HOLD or FAIL remains unresolved, and even three PASS records return HOLD for human review.":
      "Una traza completa del ensayo es evidencia operativa, no aprobación de lanzamiento. HOLD o FAIL siguen indicando asuntos sin resolver; incluso tres registros PASS devuelven el estado a HOLD para revisión humana.",
    "A passing local audit does not prove that a public URL is reachable, that evidence is current or authentic, or that the launch is approved. Readiness remains HOLD.":
      "Que una auditoría local pase no demuestra que una URL pública sea accesible, que la evidencia sea vigente o auténtica, ni que el lanzamiento esté aprobado. La preparación sigue en HOLD.",
    "ANY CHANGE RETURNS HOLD": "CUALQUIER CAMBIO DEVUELVE EL ESTADO A HOLD",
    "CLAIM SYSTEM // HOLD UNTIL VERIFIED GENESIS":
      "SISTEMA DE RECLAMACIÓN // HOLD HASTA VERIFICAR GENESIS",
    "CODE PUBLIC // EVIDENCE HOLD": "CÓDIGO PÚBLICO // EVIDENCIA EN HOLD",
    "Current readiness: HOLD.": "Preparación actual: HOLD.",
    "Every evidence record needs a UTC checked-at time, a named review role, and a direct public link. Recheck at T−60 minutes and immediately before any address publication or registration opening. A missing timestamp, unavailable link, changed value, or cross-channel mismatch returns the launch to HOLD.":
      "Cada registro de evidencia necesita una hora de comprobación UTC, un rol de revisión identificado y un enlace público directo. Vuelva a comprobarlo en T−60 minutos y justo antes de publicar cualquier dirección o abrir el registro. Si falta una marca de tiempo, un enlace no está disponible, cambia un valor o hay discrepancias entre canales, el lanzamiento vuelve a HOLD.",
    "Every material Genesis claim belongs beside a public address, transaction, program reference, or a clear HOLD status.":
      "Cada afirmación material sobre Genesis debe aparecer junto a una dirección pública, una transacción, una referencia de programa o un estado HOLD claro.",
    HOLD: "HOLD",
    "HOLD · NOT LAUNCH APPROVAL": "HOLD · NO ES APROBACIÓN DE LANZAMIENTO",
    "HOLD // AWAITING EVIDENCE": "HOLD // A LA ESPERA DE EVIDENCIA",
    "HOLD AFTER EVERY REHEARSAL": "HOLD DESPUÉS DE CADA ENSAYO",
    "HOLD ON ANY GAP": "HOLD ANTE CUALQUIER VACÍO",
    "HOLD ON ANY TRIGGER": "HOLD ANTE CUALQUIER ACTIVADOR",
    "HOLD UNTIL ALL GATES PASS": "HOLD HASTA QUE PASEN TODAS LAS PUERTAS",
    "HOLD UNTIL EXACT MATCH": "HOLD HASTA LA COINCIDENCIA EXACTA",
    "HOLD UNTIL SIGNER REHEARSAL": "HOLD HASTA EL ENSAYO DEL FIRMANTE",
    "No mainnet change": "Sin cambios en mainnet",
    "Readiness, rehearsal, and frozen-asset results must each remain HOLD and declare that no network was checked.":
      "Los resultados de preparación, ensayo y activos congelados deben permanecer en HOLD y declarar que no se comprobó ninguna red.",
    "The downloadable validator compares supplied text only. It does not fetch URLs, inspect Solana, verify evidence, handle wallet data, or approve launch readiness. A match still returns HOLD.":
      "El validador descargable solo compara el texto proporcionado. No obtiene URL, inspecciona Solana, verifica evidencia, procesa datos de billeteras ni aprueba la preparación para el lanzamiento. Incluso una coincidencia devuelve HOLD.",
    "THE RECORD REMAINS ON HOLD UNTIL PUBLIC EVIDENCE IS AVAILABLE.":
      "EL REGISTRO PERMANECE EN HOLD HASTA QUE HAYA EVIDENCIA PÚBLICA.",
    "The snapshot composes supplied local results only. It does not fetch public links, authenticate evidence, inspect Solana, handle wallet data, or turn a HOLD into READY.":
      "La instantánea solo reúne los resultados locales proporcionados. No obtiene enlaces públicos, autentica evidencia, inspecciona Solana, procesa datos de billeteras ni convierte un HOLD en READY.",
    "The validator reads supplied metadata only. It does not fetch a URL, inspect Solana, authenticate evidence, handle wallet data, or approve launch readiness. Every result remains HOLD.":
      "El validador solo lee los metadatos proporcionados. No obtiene una URL, inspecciona Solana, autentica evidencia, procesa datos de billeteras ni aprueba la preparación para el lanzamiento. Todos los resultados permanecen en HOLD.",
    "%50/%20/%15/%10/%5 tahsis, 400M sıralı ödül rezervi, hak ediş takvimleri, yıllık ödül oranları, haftalık CCC Wildcard ve evrensel tek çekilişli eşitlik bozma yöntemi öneri olarak yayımlandı. Zincir üstü uygulama ve kanıt bekliyor.":
      "La asignación %50/%20/%15/%10/%5, la reserva ordenada de recompensas de 400M, los calendarios de adquisición, las tasas anuales de recompensa, el CCC Wildcard semanal y el desempate universal de una sola tirada se publicaron como propuesta. La implementación y la evidencia en cadena siguen pendientes.",
    "1,000,000,000 IAT · 9 DECIMALS · NO ADDITIONAL ISSUANCE INTENDED":
      "1,000,000,000 IAT · 9 DECIMALES · NO SE PREVÉ EMISIÓN ADICIONAL",
    "1,000,000,000 IAT: Community 50%; Treasury 20%; Ecosystem 15%; Core Team 10%; Liquidity 5%. The on-chain mint and authority evidence are not yet public.":
      "1,000,000,000 IAT: Comunidad 50%; Tesorería 20%; Ecosistema 15%; Equipo central 10%; Liquidez 5%. La evidencia en cadena de la acuñación y las autoridades aún no es pública.",
    "150M total · 37.5M available at Genesis target · 112.5M vested":
      "150M en total · 37.5M disponibles en el objetivo Genesis · 112.5M con adquisición gradual",
    "200M total · 50M available at Genesis target · 150M vested":
      "200M en total · 50M disponibles en el objetivo Genesis · 150M con adquisición gradual",
    "50M total · 12.5M available at Genesis target · 37.5M vested":
      "50M en total · 12.5M disponibles en el objetivo Genesis · 37.5M con adquisición gradual",
    "Fixed across the full 100M core-team principal while it vests. CCC status never changes this rate.":
      "Fijo sobre los 100M completos de principal del equipo central mientras se adquieren. El estado CCC nunca cambia esta tasa.",
    "Proposed: 100M principal: 6-month cliff, then linear through month 24; fixed 17% annual reward rate across the full principal while vesting":
      "Propuesta: principal de 100M, cliff de 6 meses y liberación lineal hasta el mes 24; tasa anual fija del 17% sobre todo el principal durante la adquisición.",
    "Proposed: 25% available at Genesis target; remaining 75% has a 12-month cliff, then 36-month linear release":
      "Propuesta: 25% disponible en el objetivo Genesis; el 75% restante tiene un cliff de 12 meses y después una liberación lineal de 36 meses.",
    "Proposed: 25% available at Genesis target; remaining 75% has a 6-month cliff, then 24-month linear release":
      "Propuesta: 25% disponible en el objetivo Genesis; el 75% restante tiene un cliff de 6 meses y después una liberación lineal de 24 meses.",
    "Proposed: 25% available at Genesis target; remaining 75% has a 6-month cliff, then linear release through month 24":
      "Propuesta: 25% disponible en el objetivo Genesis; el 75% restante tiene un cliff de 6 meses y después una liberación lineal hasta el mes 24.",
    "Simple annual rates, paid weekly without automatic compounding: core team 17%, standard user 10%, CCC Agent 28%, eligible downstream CCC associate 20%. A weekly public random draw pauses one CCC Agency and its snapshotted downstream group for that turn. Every exact protocol tie uses one final, exact-uniform, publicly verifiable roll over a precommitted candidate set. Full terms: /tokenomics.":
      "Tasas anuales simples, pagadas semanalmente sin capitalización automática: equipo central 17%, usuario estándar 10%, CCC Agent 28%, asociado CCC descendente elegible 20%. Un sorteo aleatorio público semanal pausa una Agencia CCC y su grupo descendente capturado en la instantánea durante ese turno. Cada empate exacto del protocolo usa una tirada final, exactamente uniforme y verificable públicamente sobre un conjunto de candidatos comprometido previamente. Términos completos: /tokenomics.",
    "The 50/20/15/10/5 allocation, 400M ordered reward reserve, vesting schedules, annual reward rates, weekly CCC Wildcard, and universal one-roll tiebreak are published as a proposal. Their on-chain implementation and evidence remain pending.":
      "La asignación 50/20/15/10/5, la reserva ordenada de recompensas de 400M, los calendarios de adquisición, las tasas anuales de recompensa, el CCC Wildcard semanal y el desempate universal de una sola tirada se publican como propuesta. Su implementación y evidencia en cadena siguen pendientes.",
  },
  ru: {
    "Mint adresi, token programı, ondalık basamak, arz ve doğrulama zamanı tek bir kontrol edilebilir kayıtta henüz yayımlanmadı.":
      "Адрес минта, токен-программа, число десятичных знаков, предложение и время проверки пока не опубликованы в единой проверяемой записи.",
    "1,000,000,000 IAT · 9 DECIMALS · NO ADDITIONAL ISSUANCE INTENDED":
      "1,000,000,000 IAT · 9 ДЕСЯТИЧНЫХ ЗНАКОВ · ДОПОЛНИТЕЛЬНАЯ ЭМИССИЯ НЕ ПРЕДПОЛАГАЕТСЯ",
    "1,000,000,000 IAT: Community 50%; Treasury 20%; Ecosystem 15%; Core Team 10%; Liquidity 5%. The on-chain mint and authority evidence are not yet public.":
      "1,000,000,000 IAT: сообщество 50%; казначейство 20%; экосистема 15%; основная команда 10%; ликвидность 5%. Ончейн-доказательства минта и полномочий пока не опубликованы.",
    "150M total · 37.5M available at Genesis target · 112.5M vested":
      "Всего 150M · 37.5M доступны при достижении цели Genesis · 112.5M находятся в вестинге",
    "200M total · 50M available at Genesis target · 150M vested":
      "Всего 200M · 50M доступны при достижении цели Genesis · 150M находятся в вестинге",
    "400M REWARD RESERVE": "РЕЗЕРВ ВОЗНАГРАЖДЕНИЙ 400M",
    "50M total · 12.5M available at Genesis target · 37.5M vested":
      "Всего 50M · 12.5M доступны при достижении цели Genesis · 37.5M находятся в вестинге",
    "A complete rehearsal trace is operational evidence, not launch approval. HOLD or FAIL remains unresolved, and even three PASS records return HOLD for human review.":
      "Полная трасса репетиции — это операционное доказательство, а не разрешение на запуск. HOLD или FAIL означают нерешённый вопрос; даже три записи PASS возвращают статус в HOLD для проверки человеком.",
    "A passing local audit does not prove that a public URL is reachable, that evidence is current or authentic, or that the launch is approved. Readiness remains HOLD.":
      "Успешный локальный аудит не доказывает, что публичный URL доступен, доказательство актуально или подлинно либо запуск одобрен. Готовность остаётся в HOLD.",
    "ANY CHANGE RETURNS HOLD": "ЛЮБОЕ ИЗМЕНЕНИЕ ВОЗВРАЩАЕТ СТАТУС В HOLD",
    "CLAIM SYSTEM // HOLD UNTIL VERIFIED GENESIS":
      "СИСТЕМА ПОЛУЧЕНИЯ // HOLD ДО ПРОВЕРКИ GENESIS",
    "CODE PUBLIC // EVIDENCE HOLD": "КОД ПУБЛИЧЕН // ДОКАЗАТЕЛЬСТВА В HOLD",
    "Current readiness: HOLD.": "Текущая готовность: HOLD.",
    "Fixed across the full 100M core-team principal while it vests. CCC status never changes this rate.":
      "Фиксированная ставка на весь основной капитал команды в размере 100M в течение вестинга. Статус CCC никогда не меняет эту ставку.",
    HOLD: "HOLD",
    "HOLD · NOT LAUNCH APPROVAL": "HOLD · НЕ РАЗРЕШЕНИЕ НА ЗАПУСК",
    "HOLD // AWAITING EVIDENCE": "HOLD // ОЖИДАНИЕ ДОКАЗАТЕЛЬСТВ",
    "HOLD AFTER EVERY REHEARSAL": "HOLD ПОСЛЕ КАЖДОЙ РЕПЕТИЦИИ",
    "HOLD ON ANY GAP": "HOLD ПРИ ЛЮБОМ ПРОБЕЛЕ",
    "HOLD ON ANY TRIGGER": "HOLD ПРИ ЛЮБОМ ТРИГГЕРЕ",
    "HOLD UNTIL ALL GATES PASS": "HOLD ДО ПРОХОЖДЕНИЯ ВСЕХ ГЕЙТОВ",
    "HOLD UNTIL EXACT MATCH": "HOLD ДО ТОЧНОГО СОВПАДЕНИЯ",
    "HOLD UNTIL SIGNER REHEARSAL": "HOLD ДО РЕПЕТИЦИИ ПОДПИСАНТА",
    "Maximum combined reward reserve: 400M IAT, routed treasury → ecosystem → liquidity. New positions must be fully collateralized; all three lanes may reach zero by design.":
      "Максимальный совокупный резерв вознаграждений: 400M IAT, маршрут казначейство → экосистема → ликвидность. Новые позиции должны быть полностью обеспечены; все три направления по замыслу могут достичь нуля.",
    "No mainnet change": "Никаких изменений в mainnet",
    "Proposed: 100M principal: 6-month cliff, then linear through month 24; fixed 17% annual reward rate across the full principal while vesting":
      "Предложение: основной капитал 100M, клифф 6 месяцев, затем линейный вестинг до месяца 24; фиксированная годовая ставка вознаграждения 17% на весь капитал в течение вестинга.",
    "Simple annual rates, paid weekly without automatic compounding: core team 17%, standard user 10%, CCC Agent 28%, eligible downstream CCC associate 20%. A weekly public random draw pauses one CCC Agency and its snapshotted downstream group for that turn. Every exact protocol tie uses one final, exact-uniform, publicly verifiable roll over a precommitted candidate set. Full terms: /tokenomics.":
      "Простые годовые ставки с еженедельной выплатой без автоматического сложного процента: основная команда 17%, стандартный пользователь 10%, CCC Agent 28%, подходящий нижестоящий участник CCC 20%. Еженедельный публичный случайный розыгрыш приостанавливает одно агентство CCC и зафиксированную нижестоящую группу на этот ход. Любая точная ничья протокола разрешается одним финальным, строго равномерным и публично проверяемым броском по заранее зафиксированному набору кандидатов. Полные условия: /tokenomics.",
    "The 50/20/15/10/5 allocation, 400M ordered reward reserve, vesting schedules, annual reward rates, weekly CCC Wildcard, and universal one-roll tiebreak are published as a proposal. Their on-chain implementation and evidence remain pending.":
      "Распределение 50/20/15/10/5, упорядоченный резерв вознаграждений 400M, графики вестинга, годовые ставки, еженедельный CCC Wildcard и универсальное разрешение ничьи одним броском опубликованы как предложение. Их ончейн-реализация и доказательства остаются в ожидании.",
    "The downloadable validator compares supplied text only. It does not fetch URLs, inspect Solana, verify evidence, handle wallet data, or approve launch readiness. A match still returns HOLD.":
      "Скачиваемый валидатор только сравнивает предоставленный текст. Он не загружает URL, не проверяет Solana, не верифицирует доказательства, не обрабатывает данные кошелька и не утверждает готовность к запуску. Совпадение всё равно возвращает HOLD.",
    "THE RECORD REMAINS ON HOLD UNTIL PUBLIC EVIDENCE IS AVAILABLE.":
      "ЗАПИСЬ ОСТАЁТСЯ В HOLD ДО ПОЯВЛЕНИЯ ПУБЛИЧНЫХ ДОКАЗАТЕЛЬСТВ.",
    "The validator reads supplied metadata only. It does not fetch a URL, inspect Solana, authenticate evidence, handle wallet data, or approve launch readiness. Every result remains HOLD.":
      "Валидатор читает только предоставленные метаданные. Он не загружает URL, не проверяет Solana, не подтверждает подлинность доказательств, не обрабатывает данные кошелька и не утверждает готовность к запуску. Каждый результат остаётся в HOLD.",
    "Three stake roles, standard and CCC-linked week-8 settlement outcomes, core APY, liquidity unlock, Switchboard randomness, and two settled CCC draws are recorded.":
      "Зафиксированы три роли стейкинга, результаты расчётов за 8-ю неделю для стандартной и связанной с CCC схем, базовый APY, разблокировка ликвидности, случайность Switchboard и два завершённых розыгрыша CCC.",
    "Treasury, ecosystem and liquidity form an ordered, intentionally exhaustible 400M IAT reserve. The Genesis target unlocks 25% of each lane, or 100M total. New positions must be fully collateralized before acceptance.":
      "Казначейство, экосистема и ликвидность образуют упорядоченный и намеренно исчерпаемый резерв 400M IAT. Цель Genesis разблокирует 25% каждого направления, всего 100M. Новые позиции должны быть полностью обеспечены до принятия.",
  },
  ur: {
    "400M REWARD RESERVE": "400M انعامی ریزرو",
    "A passing local audit does not prove that a public URL is reachable, that evidence is current or authentic, or that the launch is approved. Readiness remains HOLD.":
      "مقامی آڈٹ کا کامیاب ہونا یہ ثابت نہیں کرتا کہ عوامی URL قابلِ رسائی ہے، ثبوت موجودہ یا مستند ہے، یا لانچ منظور ہو چکا ہے۔ تیاری کی حالت HOLD ہی رہتی ہے۔",
    "ANY CHANGE RETURNS HOLD": "کوئی بھی تبدیلی حالت کو HOLD پر واپس لاتی ہے",
    "CLAIM SYSTEM // HOLD UNTIL VERIFIED GENESIS":
      "کلیم سسٹم // GENESIS کی تصدیق تک HOLD",
    "CODE PUBLIC // EVIDENCE HOLD": "کوڈ عوامی // ثبوت HOLD پر",
    "Current readiness: HOLD.": "موجودہ تیاری: HOLD۔",
    HOLD: "HOLD",
    "HOLD // AWAITING EVIDENCE": "HOLD // ثبوت کا انتظار",
    "HOLD AFTER EVERY REHEARSAL": "ہر مشق کے بعد HOLD",
    "HOLD ON ANY GAP": "کسی بھی خلا پر HOLD",
    "HOLD ON ANY TRIGGER": "کسی بھی محرک پر HOLD",
    "HOLD UNTIL ALL GATES PASS": "تمام گیٹس پاس ہونے تک HOLD",
    "HOLD UNTIL EXACT MATCH": "عین مطابقت تک HOLD",
    "HOLD UNTIL SIGNER REHEARSAL": "دستخط کنندہ کی مشق تک HOLD",
    "No mainnet change": "mainnet میں کوئی تبدیلی نہیں",
    "The downloadable validator compares supplied text only. It does not fetch URLs, inspect Solana, verify evidence, handle wallet data, or approve launch readiness. A match still returns HOLD.":
      "ڈاؤن لوڈ کے قابل ویلیڈیٹر صرف فراہم کردہ متن کا موازنہ کرتا ہے۔ یہ URLs حاصل نہیں کرتا، Solana کا معائنہ نہیں کرتا، ثبوت کی تصدیق نہیں کرتا، والٹ ڈیٹا نہیں سنبھالتا اور لانچ کی تیاری منظور نہیں کرتا۔ مطابقت کے باوجود نتیجہ HOLD رہتا ہے۔",
    "THE RECORD REMAINS ON HOLD UNTIL PUBLIC EVIDENCE IS AVAILABLE.":
      "عوامی ثبوت دستیاب ہونے تک ریکارڈ HOLD پر رہے گا۔",
    "The validator reads supplied metadata only. It does not fetch a URL, inspect Solana, authenticate evidence, handle wallet data, or approve launch readiness. Every result remains HOLD.":
      "ویلیڈیٹر صرف فراہم کردہ میٹا ڈیٹا پڑھتا ہے۔ یہ URL حاصل نہیں کرتا، Solana کا معائنہ نہیں کرتا، ثبوت کی اصالت نہیں جانچتا، والٹ ڈیٹا نہیں سنبھالتا اور لانچ کی تیاری منظور نہیں کرتا۔ ہر نتیجہ HOLD رہتا ہے۔",
  },
  id: {
    "Eşleşmeyen adres, beklenmedik cüzdan isteği, taklit hesap bildirimi, erişilemeyen kanıt bağlantısı veya değişmiş yetki değeri lansman faaliyetini derhâl BEKLET durumuna döndürür.":
      "Alamat yang tidak cocok, permintaan dompet yang tak terduga, laporan akun palsu, tautan bukti yang tak dapat diakses, atau perubahan nilai otoritas segera mengembalikan aktivitas peluncuran ke HOLD.",
    "%50/%20/%15/%10/%5 tahsis, 400M sıralı ödül rezervi, hak ediş takvimleri, yıllık ödül oranları, haftalık CCC Wildcard ve evrensel tek çekilişli eşitlik bozma yöntemi öneri olarak yayımlandı. Zincir üstü uygulama ve kanıt bekliyor.":
      "Alokasi %50/%20/%15/%10/%5, cadangan imbalan berurutan sebesar 400M, jadwal vesting, tingkat imbalan tahunan, CCC Wildcard mingguan, dan aturan pemecah seri satu undian diterbitkan sebagai proposal. Implementasi on-chain dan buktinya masih tertunda.",
    "1,000,000,000 IAT · 9 DECIMALS · NO ADDITIONAL ISSUANCE INTENDED":
      "1,000,000,000 IAT · 9 DESIMAL · TIDAK ADA PENERBITAN TAMBAHAN YANG DIRENCANAKAN",
    "1,000,000,000 IAT: Community 50%; Treasury 20%; Ecosystem 15%; Core Team 10%; Liquidity 5%. The on-chain mint and authority evidence are not yet public.":
      "1,000,000,000 IAT: komunitas 50%; perbendaharaan 20%; ekosistem 15%; tim inti 10%; likuiditas 5%. Bukti mint dan otoritas on-chain belum dipublikasikan.",
    "100M IAT: 6-month cliff, then linear release through month 24. No discretionary early unlock.":
      "100M IAT: cliff 6 bulan, lalu pelepasan linear sampai bulan 24. Tidak ada pembukaan awal berdasarkan kebijakan sepihak.",
    "150M total · 37.5M available at Genesis target · 112.5M vested":
      "Total 150M · 37.5M tersedia pada target Genesis · 112.5M dalam vesting",
    "200M total · 50M available at Genesis target · 150M vested":
      "Total 200M · 50M tersedia pada target Genesis · 150M dalam vesting",
    "400M REWARD RESERVE": "CADANGAN IMBALAN 400M",
    "50M total · 12.5M available at Genesis target · 37.5M vested":
      "Total 50M · 12.5M tersedia pada target Genesis · 37.5M dalam vesting",
    "A passing local audit does not prove that a public URL is reachable, that evidence is current or authentic, or that the launch is approved. Readiness remains HOLD.":
      "Lolos audit lokal tidak membuktikan bahwa URL publik dapat diakses, bukti masih berlaku atau autentik, maupun peluncuran telah disetujui. Kesiapan tetap HOLD.",
    "ANY CHANGE RETURNS HOLD": "SETIAP PERUBAHAN MENGEMBALIKAN STATUS KE HOLD",
    "CLAIM SYSTEM // HOLD UNTIL VERIFIED GENESIS":
      "SISTEM KLAIM // HOLD SAMPAI GENESIS TERVERIFIKASI",
    "CODE PUBLIC // EVIDENCE HOLD": "KODE PUBLIK // BUKTI HOLD",
    "Current readiness: HOLD.": "Kesiapan saat ini: HOLD.",
    "Fixed across the full 100M core-team principal while it vests. CCC status never changes this rate.":
      "Tetap pada seluruh pokok tim inti sebesar 100M selama vesting. Status CCC tidak pernah mengubah tingkat ini.",
    HOLD: "HOLD",
    "HOLD · NOT LAUNCH APPROVAL": "HOLD · BUKAN PERSETUJUAN PELUNCURAN",
    "HOLD // AWAITING EVIDENCE": "HOLD // MENUNGGU BUKTI",
    "HOLD AFTER EVERY REHEARSAL": "HOLD SETELAH SETIAP LATIHAN",
    "HOLD ON ANY GAP": "HOLD JIKA ADA CELAH",
    "HOLD ON ANY TRIGGER": "HOLD PADA SETIAP PEMICU",
    "HOLD UNTIL ALL GATES PASS": "HOLD SAMPAI SEMUA GATE LOLOS",
    "HOLD UNTIL EXACT MATCH": "HOLD SAMPAI COCOK PERSIS",
    "HOLD UNTIL SIGNER REHEARSAL": "HOLD SAMPAI LATIHAN PENANDATANGAN",
    "Maximum combined reward reserve: 400M IAT, routed treasury → ecosystem → liquidity. New positions must be fully collateralized; all three lanes may reach zero by design.":
      "Cadangan imbalan gabungan maksimum: 400M IAT, dialirkan perbendaharaan → ekosistem → likuiditas. Posisi baru harus dijamin penuh; ketiga jalur dapat mencapai nol sesuai desain.",
    "No mainnet change": "Tidak ada perubahan pada mainnet",
    "Proposed: 100M principal: 6-month cliff, then linear through month 24; fixed 17% annual reward rate across the full principal while vesting":
      "Proposal: pokok 100M, cliff 6 bulan, lalu vesting linear sampai bulan 24; tingkat imbalan tahunan tetap 17% atas seluruh pokok selama vesting.",
    "The 50/20/15/10/5 allocation, 400M ordered reward reserve, vesting schedules, annual reward rates, weekly CCC Wildcard, and universal one-roll tiebreak are published as a proposal. Their on-chain implementation and evidence remain pending.":
      "Alokasi 50/20/15/10/5, cadangan imbalan berurutan sebesar 400M, jadwal vesting, tingkat imbalan tahunan, CCC Wildcard mingguan, dan aturan pemecah seri satu undian diterbitkan sebagai proposal. Implementasi on-chain dan buktinya masih tertunda.",
    "The downloadable validator compares supplied text only. It does not fetch URLs, inspect Solana, verify evidence, handle wallet data, or approve launch readiness. A match still returns HOLD.":
      "Validator yang dapat diunduh hanya membandingkan teks yang diberikan. Validator ini tidak mengambil URL, memeriksa Solana, memverifikasi bukti, menangani data dompet, atau menyetujui kesiapan peluncuran. Hasil yang cocok tetap mengembalikan HOLD.",
    "THE RECORD REMAINS ON HOLD UNTIL PUBLIC EVIDENCE IS AVAILABLE.":
      "CATATAN TETAP HOLD SAMPAI BUKTI PUBLIK TERSEDIA.",
    "The validator reads only supplied local files. It does not fetch the website, authenticate evidence, inspect Solana, handle wallet data, or approve launch readiness. A matching bundle still returns HOLD.":
      "Validator hanya membaca berkas lokal yang diberikan. Validator ini tidak mengambil situs web, mengautentikasi bukti, memeriksa Solana, menangani data dompet, atau menyetujui kesiapan peluncuran. Bundel yang cocok tetap mengembalikan HOLD.",
    "The validator reads supplied metadata only. It does not fetch a URL, inspect Solana, authenticate evidence, handle wallet data, or approve launch readiness. Every result remains HOLD.":
      "Validator hanya membaca metadata yang diberikan. Validator ini tidak mengambil URL, memeriksa Solana, mengautentikasi bukti, menangani data dompet, atau menyetujui kesiapan peluncuran. Setiap hasil tetap HOLD.",
    "Treasury, ecosystem and liquidity form an ordered, intentionally exhaustible 400M IAT reserve. The Genesis target unlocks 25% of each lane, or 100M total. New positions must be fully collateralized before acceptance.":
      "Perbendaharaan, ekosistem, dan likuiditas membentuk cadangan 400M IAT yang berurutan dan memang dapat habis. Target Genesis membuka 25% dari setiap jalur, atau total 100M. Posisi baru harus dijamin penuh sebelum diterima.",
  },
  pt: {
    "%50/%20/%15/%10/%5 tahsis, 400M sıralı ödül rezervi, hak ediş takvimleri, yıllık ödül oranları, haftalık CCC Wildcard ve evrensel tek çekilişli eşitlik bozma yöntemi öneri olarak yayımlandı. Zincir üstü uygulama ve kanıt bekliyor.":
      "A alocação %50/%20/%15/%10/%5, a reserva ordenada de recompensas de 400M, os cronogramas de vesting, as taxas anuais, o CCC Wildcard semanal e o desempate universal em um único sorteio foram publicados como proposta. A implementação on-chain e as provas continuam pendentes.",
    "1,000,000,000 IAT · 9 DECIMALS · NO ADDITIONAL ISSUANCE INTENDED":
      "1,000,000,000 IAT · 9 DECIMAIS · NENHUMA EMISSÃO ADICIONAL PREVISTA",
    "1,000,000,000 IAT: Community 50%; Treasury 20%; Ecosystem 15%; Core Team 10%; Liquidity 5%. The on-chain mint and authority evidence are not yet public.":
      "1,000,000,000 IAT: comunidade 50%; tesouraria 20%; ecossistema 15%; equipe principal 10%; liquidez 5%. As provas on-chain do mint e das autoridades ainda não são públicas.",
    "150M total · 37.5M available at Genesis target · 112.5M vested":
      "150M no total · 37.5M disponíveis na meta Genesis · 112.5M em vesting",
    "200M total · 50M available at Genesis target · 150M vested":
      "200M no total · 50M disponíveis na meta Genesis · 150M em vesting",
    "50M total · 12.5M available at Genesis target · 37.5M vested":
      "50M no total · 12.5M disponíveis na meta Genesis · 37.5M em vesting",
    "A complete rehearsal trace is operational evidence, not launch approval. HOLD or FAIL remains unresolved, and even three PASS records return HOLD for human review.":
      "Um registro completo do ensaio é prova operacional, não aprovação de lançamento. HOLD ou FAIL ainda indicam pendência; até três registros PASS devolvem o estado a HOLD para revisão humana.",
    "A passing local audit does not prove that a public URL is reachable, that evidence is current or authentic, or that the launch is approved. Readiness remains HOLD.":
      "A aprovação em uma auditoria local não prova que uma URL pública esteja acessível, que a prova seja atual ou autêntica, nem que o lançamento esteja aprovado. A prontidão continua em HOLD.",
    "ANY CHANGE RETURNS HOLD": "QUALQUER ALTERAÇÃO DEVOLVE O ESTADO A HOLD",
    "CLAIM SYSTEM // HOLD UNTIL VERIFIED GENESIS":
      "SISTEMA DE RESGATE // HOLD ATÉ GENESIS SER VERIFICADO",
    "CODE PUBLIC // EVIDENCE HOLD": "CÓDIGO PÚBLICO // PROVAS EM HOLD",
    "Current readiness: HOLD.": "Prontidão atual: HOLD.",
    "Every material Genesis claim belongs beside a public address, transaction, program reference, or a clear HOLD status.":
      "Toda afirmação material sobre Genesis deve vir acompanhada de endereço público, transação, referência de programa ou status HOLD claro.",
    "Fixed across the full 100M core-team principal while it vests. CCC status never changes this rate.":
      "Fixa sobre os 100M completos de principal da equipe central durante o vesting. O status CCC nunca altera essa taxa.",
    HOLD: "HOLD",
    "HOLD · NOT LAUNCH APPROVAL": "HOLD · NÃO É APROVAÇÃO DE LANÇAMENTO",
    "HOLD // AWAITING EVIDENCE": "HOLD // AGUARDANDO PROVAS",
    "HOLD AFTER EVERY REHEARSAL": "HOLD APÓS CADA ENSAIO",
    "HOLD ON ANY GAP": "HOLD DIANTE DE QUALQUER LACUNA",
    "HOLD ON ANY TRIGGER": "HOLD DIANTE DE QUALQUER GATILHO",
    "HOLD UNTIL ALL GATES PASS": "HOLD ATÉ TODOS OS GATES PASSAREM",
    "HOLD UNTIL EXACT MATCH": "HOLD ATÉ A CORRESPONDÊNCIA EXATA",
    "HOLD UNTIL SIGNER REHEARSAL": "HOLD ATÉ O ENSAIO DO SIGNATÁRIO",
    "Maximum combined reward reserve: 400M IAT, routed treasury → ecosystem → liquidity. New positions must be fully collateralized; all three lanes may reach zero by design.":
      "Reserva máxima combinada de recompensas: 400M IAT, encaminhada tesouraria → ecossistema → liquidez. Novas posições devem ter garantia integral; os três compartimentos podem chegar a zero por projeto.",
    "No mainnet change": "Nenhuma alteração na mainnet",
    "Proposed: 100M principal: 6-month cliff, then linear through month 24; fixed 17% annual reward rate across the full principal while vesting":
      "Proposta: principal de 100M, cliff de 6 meses e depois vesting linear até o mês 24; taxa anual fixa de 17% sobre todo o principal durante o vesting.",
    "Readiness, rehearsal, and frozen-asset results must each remain HOLD and declare that no network was checked.":
      "Os resultados de prontidão, ensaio e ativos congelados devem permanecer em HOLD e declarar que nenhuma rede foi verificada.",
    "The 50/20/15/10/5 allocation, 400M ordered reward reserve, vesting schedules, annual reward rates, weekly CCC Wildcard, and universal one-roll tiebreak are published as a proposal. Their on-chain implementation and evidence remain pending.":
      "A alocação 50/20/15/10/5, a reserva ordenada de recompensas de 400M, os cronogramas de vesting, as taxas anuais, o CCC Wildcard semanal e o desempate universal em um único sorteio foram publicados como proposta. A implementação on-chain e as provas continuam pendentes.",
    "The downloadable validator compares supplied text only. It does not fetch URLs, inspect Solana, verify evidence, handle wallet data, or approve launch readiness. A match still returns HOLD.":
      "O validador para download compara apenas o texto fornecido. Ele não acessa URLs, não inspeciona Solana, não verifica provas, não lida com dados de carteira e não aprova a prontidão de lançamento. Mesmo uma correspondência retorna HOLD.",
    "THE RECORD REMAINS ON HOLD UNTIL PUBLIC EVIDENCE IS AVAILABLE.":
      "O REGISTRO CONTINUA EM HOLD ATÉ QUE AS PROVAS PÚBLICAS ESTEJAM DISPONÍVEIS.",
    "The validator reads supplied metadata only. It does not fetch a URL, inspect Solana, authenticate evidence, handle wallet data, or approve launch readiness. Every result remains HOLD.":
      "O validador lê apenas os metadados fornecidos. Ele não acessa uma URL, não inspeciona Solana, não autentica provas, não lida com dados de carteira e não aprova a prontidão de lançamento. Todos os resultados permanecem em HOLD.",
    "Treasury, ecosystem and liquidity form an ordered, intentionally exhaustible 400M IAT reserve. The Genesis target unlocks 25% of each lane, or 100M total. New positions must be fully collateralized before acceptance.":
      "Tesouraria, ecossistema e liquidez formam uma reserva ordenada e intencionalmente esgotável de 400M IAT. A meta Genesis libera 25% de cada compartimento, ou 100M no total. Novas posições devem ter garantia integral antes da aceitação.",
  },
  bn: {
    "A mismatched address, unexpected wallet request, impersonation report, unavailable evidence link, or changed authority value immediately returns launch activity to HOLD.":
      "ঠিকানা না মেলা, অপ্রত্যাশিত ওয়ালেট অনুরোধ, ছদ্মবেশের অভিযোগ, অপ্রাপ্য প্রমাণ-লিংক বা পরিবর্তিত কর্তৃত্বের মান—যেকোনোটি লঞ্চ কার্যক্রমকে সঙ্গে সঙ্গে HOLD-এ ফেরত পাঠায়।",
    "A passing local audit does not prove that a public URL is reachable, that evidence is current or authentic, or that the launch is approved. Readiness remains HOLD.":
      "লোকাল অডিট পাস করলেই প্রমাণ হয় না যে পাবলিক URL-এ পৌঁছানো যাচ্ছে, প্রমাণটি হালনাগাদ বা সত্যিকারের, কিংবা লঞ্চ অনুমোদিত। প্রস্তুতির অবস্থা HOLD-এই থাকে।",
    "ANY CHANGE RETURNS HOLD": "যেকোনো পরিবর্তন অবস্থা HOLD-এ ফেরায়",
    "CLAIM SYSTEM // HOLD UNTIL VERIFIED GENESIS":
      "ক্লেইম সিস্টেম // GENESIS যাচাই না হওয়া পর্যন্ত HOLD",
    "CODE PUBLIC // EVIDENCE HOLD": "কোড পাবলিক // প্রমাণ HOLD-এ",
    "Current readiness: HOLD.": "বর্তমান প্রস্তুতি: HOLD।",
    HOLD: "HOLD",
    "HOLD · NOT LAUNCH APPROVAL": "HOLD · লঞ্চের অনুমোদন নয়",
    "HOLD AFTER EVERY REHEARSAL": "প্রতিটি মহড়ার পর HOLD",
    "HOLD ON ANY GAP": "যেকোনো ঘাটতিতে HOLD",
    "HOLD ON ANY TRIGGER": "যেকোনো ট্রিগারে HOLD",
    "HOLD UNTIL ALL GATES PASS": "সব গেট পাস না হওয়া পর্যন্ত HOLD",
    "HOLD UNTIL EXACT MATCH": "হুবহু মিল না হওয়া পর্যন্ত HOLD",
    "HOLD UNTIL SIGNER REHEARSAL": "সাইনার মহড়া না হওয়া পর্যন্ত HOLD",
    "No mainnet change": "mainnet-এ কোনো পরিবর্তন নেই",
    "REPLACEMENT UTC WINDOW // NOT PUBLISHED":
      "বিকল্প UTC উইন্ডো // প্রকাশিত নয়",
    "THE RECORD REMAINS ON HOLD UNTIL PUBLIC EVIDENCE IS AVAILABLE.":
      "পাবলিক প্রমাণ পাওয়া না যাওয়া পর্যন্ত রেকর্ডটি HOLD-এ থাকবে।",
    "The validator reads supplied metadata only. It does not fetch a URL, inspect Solana, authenticate evidence, handle wallet data, or approve launch readiness. Every result remains HOLD.":
      "ভ্যালিডেটর শুধু দেওয়া মেটাডেটা পড়ে। এটি কোনো URL আনে না, Solana পরীক্ষা করে না, প্রমাণের সত্যতা যাচাই করে না, ওয়ালেট ডেটা পরিচালনা করে না এবং লঞ্চ প্রস্তুতি অনুমোদন করে না। প্রতিটি ফলাফল HOLD-এ থাকে।",
    "YENİ UTC PENCERESİ // YAYIMLANMADI": "নতুন UTC উইন্ডো // প্রকাশিত নয়",
    "Yeni UTC penceresi bekleniyor": "নতুন UTC উইন্ডোর অপেক্ষা চলছে",
  },
  ar: {
    "SCORPION GENERATION // LAUNCH CONTROL":
      "جيل العقرب // التحكم في الإطلاق",
    "%50/%20/%15/%10/%5 tahsis, 400M sıralı ödül rezervi, hak ediş takvimleri, yıllık ödül oranları, haftalık CCC Wildcard ve evrensel tek çekilişli eşitlik bozma yöntemi öneri olarak yayımlandı. Zincir üstü uygulama ve kanıt bekliyor.":
      "نُشر تخصيص %50/%20/%15/%10/%5، واحتياطي المكافآت المرتب بقيمة 400M، وجداول الاستحقاق، ومعدلات المكافآت السنوية، وCCC Wildcard الأسبوعية، وقاعدة فضّ التعادل بسحب واحد كمقترح. ما زال التنفيذ على السلسلة والدليل قيد الانتظار.",
    "100M IAT: 6-month cliff, then linear release through month 24. No discretionary early unlock.":
      "100M IAT: فترة حجز أولية مدتها 6 أشهر، ثم تحرير خطي حتى الشهر 24. لا يوجد فتح مبكر تقديري.",
    "150M total · 37.5M available at Genesis target · 112.5M vested":
      "إجمالي 150M · المتاح عند هدف Genesis هو 37.5M · الخاضع للاستحقاق 112.5M",
    "200M total · 50M available at Genesis target · 150M vested":
      "إجمالي 200M · المتاح عند هدف Genesis هو 50M · الخاضع للاستحقاق 150M",
    "400M REWARD RESERVE": "احتياطي مكافآت بقيمة 400M",
    "50M total · 12.5M available at Genesis target · 37.5M vested":
      "إجمالي 50M · المتاح عند هدف Genesis هو 12.5M · الخاضع للاستحقاق 37.5M",
    "A complete rehearsal trace is operational evidence, not launch approval. HOLD or FAIL remains unresolved, and even three PASS records return HOLD for human review.":
      "سجل التدريب الكامل دليل تشغيلي، وليس موافقة على الإطلاق. تظل نتيجة HOLD أو FAIL غير محسومة، وحتى ثلاثة سجلات PASS تعيد الحالة إلى HOLD للمراجعة البشرية.",
    "A mismatched address, unexpected wallet request, impersonation report, unavailable evidence link, or changed authority value immediately returns launch activity to HOLD.":
      "أي عنوان غير مطابق، أو طلب محفظة غير متوقع، أو بلاغ انتحال، أو رابط دليل غير متاح، أو تغيير في قيمة الصلاحية يعيد نشاط الإطلاق فورًا إلى HOLD.",
    "A passing local audit does not prove that a public URL is reachable, that evidence is current or authentic, or that the launch is approved. Readiness remains HOLD.":
      "نجاح التدقيق المحلي لا يثبت أن عنوان URL العام متاح، ولا أن الدليل حديث أو أصيل، ولا أن الإطلاق معتمد. تظل الجاهزية في حالة HOLD.",
    "ANY CHANGE RETURNS HOLD": "أي تغيير يعيد الحالة إلى HOLD",
    "CLAIM SYSTEM // HOLD UNTIL VERIFIED GENESIS":
      "نظام المطالبة // HOLD حتى التحقق من GENESIS",
    "CODE PUBLIC // EVIDENCE HOLD": "الكود عام // الدليل في حالة HOLD",
    "Current readiness: HOLD.": "الجاهزية الحالية: HOLD.",
    "Every material Genesis claim belongs beside a public address, transaction, program reference, or a clear HOLD status.":
      "يجب أن تقترن كل مطالبة جوهرية تخص Genesis بعنوان عام أو معاملة أو مرجع برنامج أو حالة HOLD واضحة.",
    "Fixed across the full 100M core-team principal while it vests. CCC status never changes this rate.":
      "ثابت على كامل أصل فريق النواة البالغ 100M أثناء الاستحقاق. حالة CCC لا تغيّر هذا المعدل مطلقًا.",
    HOLD: "HOLD",
    "HOLD · NOT LAUNCH APPROVAL": "HOLD · ليست موافقة على الإطلاق",
    "HOLD // AWAITING EVIDENCE": "HOLD // بانتظار الدليل",
    "HOLD AFTER EVERY REHEARSAL": "HOLD بعد كل تدريب",
    "HOLD ON ANY GAP": "HOLD عند وجود أي فجوة",
    "HOLD ON ANY TRIGGER": "HOLD عند أي محفّز",
    "HOLD UNTIL ALL GATES PASS": "HOLD حتى اجتياز جميع البوابات",
    "HOLD UNTIL EXACT MATCH": "HOLD حتى التطابق التام",
    "HOLD UNTIL SIGNER REHEARSAL": "HOLD حتى تدريب الموقّع",
    "Maximum combined reward reserve: 400M IAT, routed treasury → ecosystem → liquidity. New positions must be fully collateralized; all three lanes may reach zero by design.":
      "الحد الأقصى لاحتياطي المكافآت المجمّع: 400M IAT، ويُوجَّه من الخزانة → النظام البيئي → السيولة. يجب ضمان المراكز الجديدة بالكامل؛ ويمكن أن تصل المسارات الثلاثة إلى الصفر بحكم التصميم.",
    "No mainnet change": "لا تغيير على mainnet",
    "Proposed: 100M principal: 6-month cliff, then linear through month 24; fixed 17% annual reward rate across the full principal while vesting":
      "المقترح: أصل بقيمة 100M، وفترة حجز أولية مدتها 6 أشهر، ثم استحقاق خطي حتى الشهر 24؛ ومعدل مكافأة سنوي ثابت قدره 17% على كامل الأصل أثناء الاستحقاق.",
    "Proposed: 25% available at Genesis target; remaining 75% has a 12-month cliff, then 36-month linear release":
      "المقترح: 25% متاح عند هدف Genesis؛ أما 75% المتبقية فلها فترة حجز أولية مدتها 12 شهرًا، ثم تحرير خطي على مدى 36 شهرًا.",
    "Readiness, rehearsal, and frozen-asset results must each remain HOLD and declare that no network was checked.":
      "يجب أن تظل نتائج الجاهزية والتدريب والأصول المجمّدة في حالة HOLD، وأن تصرّح بأنه لم يتم فحص أي شبكة.",
    "The 50/20/15/10/5 allocation, 400M ordered reward reserve, vesting schedules, annual reward rates, weekly CCC Wildcard, and universal one-roll tiebreak are published as a proposal. Their on-chain implementation and evidence remain pending.":
      "نُشر تخصيص 50/20/15/10/5، واحتياطي المكافآت المرتب بقيمة 400M، وجداول الاستحقاق، ومعدلات المكافآت السنوية، وCCC Wildcard الأسبوعية، وقاعدة فضّ التعادل بسحب واحد كمقترح. ما زال التنفيذ على السلسلة والدليل قيد الانتظار.",
    "THE RECORD REMAINS ON HOLD UNTIL PUBLIC EVIDENCE IS AVAILABLE.":
      "يبقى السجل في حالة HOLD حتى يتوفر الدليل العام.",
    "The same math handles 2-way, 100-way and larger ties.":
      "تعالج المعادلة نفسها التعادلات ثنائية الاتجاه 2، والتعادلات ذات 100 اتجاه، وما هو أكبر.",
    "The snapshot composes supplied local results only. It does not fetch public links, authenticate evidence, inspect Solana, handle wallet data, or turn a HOLD into READY.":
      "تجمع اللقطة النتائج المحلية المقدمة فقط. لا تجلب الروابط العامة، ولا تصادق على الأدلة، ولا تفحص Solana، ولا تتعامل مع بيانات المحافظ، ولا تحوّل HOLD إلى READY.",
    "Three stake roles, standard and CCC-linked week-8 settlement outcomes, core APY, liquidity unlock, Switchboard randomness, and two settled CCC draws are recorded.":
      "تم تسجيل أدوار التخزين الثلاثة، ونتائج تسوية الأسبوع 8 القياسية والمرتبطة بـ CCC، و APY الأساسي، وفتح السيولة، وعشوائية Switchboard، وسحبين من CCC تمت تسويتهما.",
    "Treasury, ecosystem and liquidity form an ordered, intentionally exhaustible 400M IAT reserve. The Genesis target unlocks 25% of each lane, or 100M total. New positions must be fully collateralized before acceptance.":
      "تشكل الخزانة والنظام البيئي والسيولة احتياطيًا مرتبًا وقابلًا للاستنفاد عمدًا بقيمة 400M IAT. يفتح هدف Genesis نسبة 25% من كل مسار، أي ما مجموعه 100M. يجب ضمان أي مركز جديد بالكامل قبل قبوله.",
  },
  fr: {
    "%50/%20/%15/%10/%5 tahsis, 400M sıralı ödül rezervi, hak ediş takvimleri, yıllık ödül oranları, haftalık CCC Wildcard ve evrensel tek çekilişli eşitlik bozma yöntemi öneri olarak yayımlandı. Zincir üstü uygulama ve kanıt bekliyor.":
      "L’allocation %50/%20/%15/%10/%5, la réserve ordonnée de récompenses de 400M, les calendriers d’acquisition, les taux annuels, le CCC Wildcard hebdomadaire et la règle universelle de départage en un tirage sont publiés comme proposition. Leur mise en œuvre on-chain et les preuves restent en attente.",
    "1,000,000,000 IAT · 9 DECIMALS · NO ADDITIONAL ISSUANCE INTENDED":
      "1,000,000,000 IAT · 9 DÉCIMALES · AUCUNE ÉMISSION SUPPLÉMENTAIRE PRÉVUE",
    "1,000,000,000 IAT: Community 50%; Treasury 20%; Ecosystem 15%; Core Team 10%; Liquidity 5%. The on-chain mint and authority evidence are not yet public.":
      "1,000,000,000 IAT : communauté 50%; trésorerie 20%; écosystème 15%; équipe principale 10%; liquidité 5%. Les preuves on-chain du mint et des autorités ne sont pas encore publiques.",
    "100M IAT: 6-month cliff, then linear release through month 24. No discretionary early unlock.":
      "100M IAT : cliff de 6 mois, puis libération linéaire jusqu’au mois 24. Aucun déblocage anticipé discrétionnaire.",
    "150M total · 37.5M available at Genesis target · 112.5M vested":
      "150M au total · 37.5M disponibles à l’objectif Genesis · 112.5M soumis à acquisition",
    "200M total · 50M available at Genesis target · 150M vested":
      "200M au total · 50M disponibles à l’objectif Genesis · 150M soumis à acquisition",
    "400M REWARD RESERVE": "RÉSERVE DE RÉCOMPENSES DE 400M",
    "50M total · 12.5M available at Genesis target · 37.5M vested":
      "50M au total · 12.5M disponibles à l’objectif Genesis · 37.5M soumis à acquisition",
    "A complete rehearsal trace is operational evidence, not launch approval. HOLD or FAIL remains unresolved, and even three PASS records return HOLD for human review.":
      "Une trace complète de répétition constitue une preuve opérationnelle, pas une autorisation de lancement. HOLD ou FAIL signalent toujours un point non résolu, et même trois résultats PASS ramènent le statut à HOLD pour examen humain.",
    "A passing local audit does not prove that a public URL is reachable, that evidence is current or authentic, or that the launch is approved. Readiness remains HOLD.":
      "La réussite d’un audit local ne prouve ni qu’une URL publique est accessible, ni que les preuves sont actuelles ou authentiques, ni que le lancement est autorisé. La préparation reste en HOLD.",
    "ANY CHANGE RETURNS HOLD": "TOUT CHANGEMENT RAMÈNE LE STATUT À HOLD",
    "CLAIM SYSTEM // HOLD UNTIL VERIFIED GENESIS":
      "SYSTÈME DE RÉCLAMATION // HOLD JUSQU’À GENESIS VÉRIFIÉ",
    "CODE PUBLIC // EVIDENCE HOLD": "CODE PUBLIC // PREUVES EN HOLD",
    "Current readiness: HOLD.": "Préparation actuelle : HOLD.",
    "Every material Genesis claim belongs beside a public address, transaction, program reference, or a clear HOLD status.":
      "Chaque déclaration matérielle sur Genesis doit être accompagnée d’une adresse publique, d’une transaction, d’une référence de programme ou d’un statut HOLD explicite.",
    "Fixed across the full 100M core-team principal while it vests. CCC status never changes this rate.":
      "Fixe sur la totalité des 100M de principal de l’équipe principale pendant l’acquisition. Le statut CCC ne modifie jamais ce taux.",
    HOLD: "HOLD",
    "HOLD · NOT LAUNCH APPROVAL": "HOLD · PAS UNE AUTORISATION DE LANCEMENT",
    "HOLD // AWAITING EVIDENCE": "HOLD // EN ATTENTE DE PREUVES",
    "HOLD AFTER EVERY REHEARSAL": "HOLD APRÈS CHAQUE RÉPÉTITION",
    "HOLD ON ANY GAP": "HOLD AU MOINDRE MANQUE",
    "HOLD ON ANY TRIGGER": "HOLD AU MOINDRE DÉCLENCHEUR",
    "HOLD UNTIL ALL GATES PASS": "HOLD JUSQU’À VALIDATION DE TOUS LES GATES",
    "HOLD UNTIL EXACT MATCH": "HOLD JUSQU’À CORRESPONDANCE EXACTE",
    "HOLD UNTIL SIGNER REHEARSAL": "HOLD JUSQU’À LA RÉPÉTITION DU SIGNATAIRE",
    "Maximum combined reward reserve: 400M IAT, routed treasury → ecosystem → liquidity. New positions must be fully collateralized; all three lanes may reach zero by design.":
      "Réserve maximale combinée de récompenses : 400M IAT, acheminée trésorerie → écosystème → liquidité. Toute nouvelle position doit être entièrement garantie; les trois compartiments peuvent atteindre zéro par conception.",
    "No mainnet change": "Aucun changement sur mainnet",
    "Proposed: 100M principal: 6-month cliff, then linear through month 24; fixed 17% annual reward rate across the full principal while vesting":
      "Proposition : principal de 100M, cliff de 6 mois, puis acquisition linéaire jusqu’au mois 24; taux annuel fixe de 17% sur la totalité du principal pendant l’acquisition.",
    "Proposed: 25% available at Genesis target; remaining 75% has a 12-month cliff, then 36-month linear release":
      "Proposition : 25% disponibles à l’objectif Genesis; les 75% restants ont un cliff de 12 mois, puis une libération linéaire sur 36 mois.",
    "Proposed: 25% available at Genesis target; remaining 75% has a 6-month cliff, then 24-month linear release":
      "Proposition : 25% disponibles à l’objectif Genesis; les 75% restants ont un cliff de 6 mois, puis une libération linéaire sur 24 mois.",
    "Proposed: 25% available at Genesis target; remaining 75% has a 6-month cliff, then linear release through month 24":
      "Proposition : 25% disponibles à l’objectif Genesis; les 75% restants ont un cliff de 6 mois, puis une libération linéaire jusqu’au mois 24.",
    "Readiness, rehearsal, and frozen-asset results must each remain HOLD and declare that no network was checked.":
      "Les résultats de préparation, de répétition et d’actifs gelés doivent tous rester en HOLD et préciser qu’aucun réseau n’a été vérifié.",
    "Simple annual rates, paid weekly without automatic compounding: core team 17%, standard user 10%, CCC Agent 28%, eligible downstream CCC associate 20%. A weekly public random draw pauses one CCC Agency and its snapshotted downstream group for that turn. Every exact protocol tie uses one final, exact-uniform, publicly verifiable roll over a precommitted candidate set. Full terms: /tokenomics.":
      "Taux annuels simples, versés chaque semaine sans capitalisation automatique : équipe principale 17%, utilisateur standard 10%, CCC Agent 28%, associé CCC descendant éligible 20%. Un tirage public hebdomadaire suspend une agence CCC et son groupe descendant figé pour ce tour. Toute égalité exacte du protocole utilise un unique tirage final, parfaitement uniforme et publiquement vérifiable sur un ensemble de candidats pré-engagé. Conditions complètes : /tokenomics.",
    "The 50/20/15/10/5 allocation, 400M ordered reward reserve, vesting schedules, annual reward rates, weekly CCC Wildcard, and universal one-roll tiebreak are published as a proposal. Their on-chain implementation and evidence remain pending.":
      "L’allocation 50/20/15/10/5, la réserve ordonnée de récompenses de 400M, les calendriers d’acquisition, les taux annuels, le CCC Wildcard hebdomadaire et la règle universelle de départage en un tirage sont publiés comme proposition. Leur mise en œuvre on-chain et les preuves restent en attente.",
    "The core team’s fixed 17% rate is unchanged by the draw.":
      "Le taux fixe de 17% de l’équipe principale ne change pas avec le tirage.",
    "The downloadable validator compares supplied text only. It does not fetch URLs, inspect Solana, verify evidence, handle wallet data, or approve launch readiness. A match still returns HOLD.":
      "Le validateur téléchargeable compare uniquement le texte fourni. Il ne récupère aucune URL, n’inspecte pas Solana, ne vérifie pas les preuves, ne traite pas les données de portefeuille et n’autorise pas la préparation au lancement. Même une correspondance renvoie HOLD.",
    "The proposed staking system uses simple annual reward rates paid weekly without automatic compounding: standard user 10%, CCC Agent 28%, eligible downstream CCC associate 20%, and core team 17%. A public random draw reassigns one CCC Agency every week and pauses that Agency and its snapshotted downstream group for the turn. Every exact protocol tie uses the same final one-roll, exact-uniform, publicly verifiable method. The program is not active.":
      "Le système de staking proposé utilise des taux annuels simples versés chaque semaine sans capitalisation automatique : utilisateur standard 10%, CCC Agent 28%, associé CCC descendant éligible 20% et équipe principale 17%. Un tirage public réaffecte une agence CCC chaque semaine et suspend cette agence ainsi que son groupe descendant figé pour le tour. Toute égalité exacte du protocole utilise la même méthode finale en un tirage, parfaitement uniforme et publiquement vérifiable. Le programme n’est pas actif.",
    "THE RECORD REMAINS ON HOLD UNTIL PUBLIC EVIDENCE IS AVAILABLE.":
      "LE REGISTRE RESTE EN HOLD JUSQU’À LA PUBLICATION DES PREUVES.",
    "The validator reads only supplied local files. It does not fetch the website, authenticate evidence, inspect Solana, handle wallet data, or approve launch readiness. A matching bundle still returns HOLD.":
      "Le validateur lit uniquement les fichiers locaux fournis. Il ne récupère pas le site, n’authentifie pas les preuves, n’inspecte pas Solana, ne traite pas les données de portefeuille et n’autorise pas la préparation au lancement. Même un bundle correspondant renvoie HOLD.",
    "The validator reads supplied metadata only. It does not fetch a URL, inspect Solana, authenticate evidence, handle wallet data, or approve launch readiness. Every result remains HOLD.":
      "Le validateur lit uniquement les métadonnées fournies. Il ne récupère aucune URL, n’inspecte pas Solana, n’authentifie pas les preuves, ne traite pas les données de portefeuille et n’autorise pas la préparation au lancement. Chaque résultat reste en HOLD.",
    "Treasury, ecosystem and liquidity form an ordered, intentionally exhaustible 400M IAT reserve. The Genesis target unlocks 25% of each lane, or 100M total. New positions must be fully collateralized before acceptance.":
      "La trésorerie, l’écosystème et la liquidité forment une réserve ordonnée et volontairement épuisable de 400M IAT. L’objectif Genesis débloque 25% de chaque compartiment, soit 100M au total. Toute nouvelle position doit être entièrement garantie avant acceptation.",
  },
  hi: {
    "%50/%20/%15/%10/%5 tahsis, 400M sıralı ödül rezervi, hak ediş takvimleri, yıllık ödül oranları, haftalık CCC Wildcard ve evrensel tek çekilişli eşitlik bozma yöntemi öneri olarak yayımlandı. Zincir üstü uygulama ve kanıt bekliyor.":
      "%50/%20/%15/%10/%5 आवंटन, 400M क्रमबद्ध रिवॉर्ड रिज़र्व, वेस्टिंग शेड्यूल, सालाना रिवॉर्ड दरें, साप्ताहिक CCC Wildcard और हर टाई के लिए एक ही ड्रॉ वाला नियम प्रस्ताव के रूप में प्रकाशित है। ऑन-चेन लागूकरण और प्रमाण अभी लंबित हैं।",
    "100M IAT: 6-month cliff, then linear release through month 24. No discretionary early unlock.":
      "100M IAT: 6 महीने का cliff, फिर महीने 24 तक रैखिक रिलीज़। मनमाने ढंग से जल्दी unlock नहीं।",
    "150M total · 37.5M available at Genesis target · 112.5M vested":
      "कुल 150M · Genesis लक्ष्य पर 37.5M उपलब्ध · 112.5M वेस्टेड",
    "200M total · 50M available at Genesis target · 150M vested":
      "कुल 200M · Genesis लक्ष्य पर 50M उपलब्ध · 150M वेस्टेड",
    "50M total · 12.5M available at Genesis target · 37.5M vested":
      "कुल 50M · Genesis लक्ष्य पर 12.5M उपलब्ध · 37.5M वेस्टेड",
    "A passing local audit does not prove that a public URL is reachable, that evidence is current or authentic, or that the launch is approved. Readiness remains HOLD.":
      "स्थानीय ऑडिट का पास होना यह साबित नहीं करता कि सार्वजनिक URL उपलब्ध है, प्रमाण मौजूदा या प्रामाणिक है, या लॉन्च मंज़ूर है। तैयारी की स्थिति HOLD ही रहती है।",
    "ANY CHANGE RETURNS HOLD": "कोई भी बदलाव स्थिति को HOLD पर लौटाता है",
    "CLAIM SYSTEM // HOLD UNTIL VERIFIED GENESIS":
      "दावा प्रणाली // सत्यापित GENESIS तक HOLD",
    "CODE PUBLIC // EVIDENCE HOLD": "कोड सार्वजनिक // प्रमाण HOLD पर",
    "Current readiness: HOLD.": "मौजूदा तैयारी: HOLD।",
    "GENESIS // UNSCHEDULED · MAINNET HOLD. REPLACEMENT UTC WINDOW · NOT PUBLISHED. NO CEREMONY TIME IS ACTIVE · NO AUTOMATIC TRANSACTIONS.":
      "GENESIS // अनिर्धारित · MAINNET HOLD। वैकल्पिक UTC विंडो · प्रकाशित नहीं। कोई समारोह समय सक्रिय नहीं · कोई स्वचालित लेनदेन नहीं।",
    HOLD: "HOLD",
    "HOLD · NOT LAUNCH APPROVAL": "HOLD · लॉन्च की मंज़ूरी नहीं",
    "HOLD // AWAITING EVIDENCE": "HOLD // प्रमाण की प्रतीक्षा",
    "HOLD AFTER EVERY REHEARSAL": "हर रिहर्सल के बाद HOLD",
    "HOLD ON ANY GAP": "किसी भी कमी पर HOLD",
    "HOLD ON ANY TRIGGER": "किसी भी ट्रिगर पर HOLD",
    "HOLD UNTIL ALL GATES PASS": "सभी गेट पास होने तक HOLD",
    "HOLD UNTIL EXACT MATCH": "सटीक मिलान तक HOLD",
    "HOLD UNTIL SIGNER REHEARSAL": "साइनर रिहर्सल तक HOLD",
    "No mainnet change": "mainnet में कोई बदलाव नहीं",
    "No replacement UTC ceremony window is published.":
      "कोई वैकल्पिक UTC समारोह विंडो प्रकाशित नहीं की गई है।",
    "Önceki tören penceresi geçti ve yeni UTC zamanı yayımlanmadı. Kaynak kod şimdi açıktır. Hiçbir işlem otomatik değildir; fonlama ve tüm kanıt eşikleri geçmeden mainnet BEKLET durumunda kalır.":
      "पिछली समारोह विंडो बीत चुकी है और नया UTC समय प्रकाशित नहीं किया गया है। स्रोत कोड अब सार्वजनिक है। कोई प्रक्रिया स्वचालित नहीं है; फंडिंग और सभी प्रमाण-गेट पूरे होने तक mainnet HOLD पर रहेगा।",
    "Proposed: 100M principal: 6-month cliff, then linear through month 24; fixed 17% annual reward rate across the full principal while vesting":
      "प्रस्ताव: 100M मूलधन: 6 महीने का cliff, फिर महीने 24 तक रैखिक वेस्टिंग; वेस्टिंग के दौरान पूरे मूलधन पर 17% की तय वार्षिक रिवॉर्ड दर।",
    "REPLACEMENT UTC WINDOW · NOT PUBLISHED":
      "वैकल्पिक UTC विंडो · प्रकाशित नहीं",
    "REPLACEMENT UTC WINDOW // NOT PUBLISHED":
      "वैकल्पिक UTC विंडो // प्रकाशित नहीं",
    "Replacement UTC window pending": "वैकल्पिक UTC विंडो लंबित है",
    "The 50/20/15/10/5 allocation, 400M ordered reward reserve, vesting schedules, annual reward rates, weekly CCC Wildcard, and universal one-roll tiebreak are published as a proposal. Their on-chain implementation and evidence remain pending.":
      "50/20/15/10/5 आवंटन, 400M क्रमबद्ध रिवॉर्ड रिज़र्व, वेस्टिंग शेड्यूल, सालाना रिवॉर्ड दरें, साप्ताहिक CCC Wildcard और सार्वभौमिक एक-रोल टाईब्रेकर प्रस्ताव के रूप में प्रकाशित हैं। उनका ऑन-चेन लागूकरण और प्रमाण अभी लंबित हैं।",
    "The downloadable validator compares supplied text only. It does not fetch URLs, inspect Solana, verify evidence, handle wallet data, or approve launch readiness. A match still returns HOLD.":
      "डाउनलोड योग्य वैलिडेटर केवल दिए गए टेक्स्ट की तुलना करता है। यह URL नहीं खोलता, Solana का निरीक्षण नहीं करता, प्रमाण सत्यापित नहीं करता, वॉलेट डेटा नहीं संभालता और लॉन्च तैयारी मंज़ूर नहीं करता। मिलान होने पर भी नतीजा HOLD रहता है।",
    "The prior ceremony window has expired and no replacement UTC time is published. The source is public now. No transaction is automatic, and mainnet remains on HOLD until funding and every evidence gate pass.":
      "पिछली समारोह विंडो समाप्त हो चुकी है और कोई वैकल्पिक UTC समय प्रकाशित नहीं है। स्रोत अब सार्वजनिक है। कोई लेनदेन स्वचालित नहीं है; फंडिंग और हर प्रमाण-गेट पास होने तक mainnet HOLD पर रहेगा।",
    "THE RECORD REMAINS ON HOLD UNTIL PUBLIC EVIDENCE IS AVAILABLE.":
      "सार्वजनिक प्रमाण उपलब्ध होने तक रिकॉर्ड HOLD पर रहेगा।",
    "The snapshot composes supplied local results only. It does not fetch public links, authenticate evidence, inspect Solana, handle wallet data, or turn a HOLD into READY.":
      "स्नैपशॉट केवल दिए गए स्थानीय नतीजों को जोड़ता है। यह सार्वजनिक लिंक नहीं खोलता, प्रमाण की प्रामाणिकता नहीं जांचता, Solana का निरीक्षण नहीं करता, वॉलेट डेटा नहीं संभालता और HOLD को READY में नहीं बदलता।",
    "The validator reads supplied metadata only. It does not fetch a URL, inspect Solana, authenticate evidence, handle wallet data, or approve launch readiness. Every result remains HOLD.":
      "वैलिडेटर केवल दिया गया मेटाडेटा पढ़ता है। यह URL नहीं खोलता, Solana का निरीक्षण नहीं करता, प्रमाण की प्रामाणिकता नहीं जांचता, वॉलेट डेटा नहीं संभालता और लॉन्च तैयारी मंज़ूर नहीं करता। हर नतीजा HOLD रहता है।",
    "YENİ UTC PENCERESİ · YAYIMLANMADI": "नई UTC विंडो · प्रकाशित नहीं",
    "YENİ UTC PENCERESİ // YAYIMLANMADI": "नई UTC विंडो // प्रकाशित नहीं",
    "Yeni UTC penceresi bekleniyor": "नई UTC विंडो की प्रतीक्षा है",
  },
  tr: {
    "CHANGE-FREEZE MANIFEST · LOCAL ONLY":
      "DEĞİŞİKLİK DONDURMA MANİFESTOSU · YALNIZCA YEREL",
    "PER VERIFIED NODE": "DOĞRULANMIŞ DÜĞÜM BAŞINA",
    "PRE-LAUNCH DRAFT": "LANSMAN ÖNCESİ TASLAK",
    "Every non-secret Devnet export and the separate local time-gate proof are public under CC0. The 18-transaction rehearsal and operator-relayed FDF Guard review are recorded; mainnet remains on hold for funding, final preflight, and scheduling.":
      "Gizli olmayan tüm Devnet dışa aktarımları ve ayrı yerel zaman kapısı kanıtı CC0 ile kamusaldır. 18 işlemlik prova ve operatör tarafından aktarılan FDF Guard incelemesi kayıtlıdır; fonlama, son ön kontrol ve planlama bitene kadar mainnet beklemededir.",
    "Latest 18-transaction record: three stake roles, standard and CCC-agent week-8 payouts, the selected-agency CCC-associate pause, core APY, liquidity unlock, Switchboard randomness, and CCC rounds 7 and 8. Later time gates remain outside this signed snapshot.":
      "En güncel 18 işlemlik kayıt: üç staking rolü, standart ve CCC-agent 8. hafta ödemeleri, seçilen ajansın CCC-associate duraklatması, temel APY, likidite kilidinin açılması, Switchboard rastgeleliği ve 7. ile 8. CCC turları. Daha sonraki zaman kapıları bu imzalı anlık görüntünün kapsamı dışındadır.",
    "Proposed: 100M principal: 6-month cliff, then linear through month 24; fixed 17% annual reward rate across the full principal while vesting":
      "Öneri: 100M ana para için 6 aylık cliff; ardından 24. aya kadar doğrusal hak ediş. Hak ediş boyunca ana paranın tamamında yıllık ödül oranı 17% olarak sabittir.",
  },
};

const catalog = JSON.parse(fs.readFileSync(catalogPath, "utf8"));
const criticalOverrides = JSON.parse(fs.readFileSync(criticalOverridesPath, "utf8"));
const sanitizeOverride = (value) => value.normalize("NFC").replace(/[\u202A-\u202E\u2066-\u2069]/gu, "");

for (const [locale, messages] of Object.entries(overrides)) {
  if (!catalog.messages?.[locale]) {
    throw new Error(`Missing locale in catalog: ${locale}`);
  }

  for (const [source, replacement] of Object.entries(messages)) {
    if (!Object.hasOwn(catalog.messages[locale], source)) {
      throw new Error(`Missing source key for ${locale}: ${source}`);
    }
    catalog.messages[locale][source] = sanitizeOverride(replacement);
  }
}

for (const [locale, messages] of Object.entries(criticalOverrides.translations)) {
  if (!catalog.messages?.[locale]) {
    throw new Error(`Missing critical-override locale in catalog: ${locale}`);
  }
  for (const [source, replacement] of Object.entries(messages)) {
    if (!Object.hasOwn(catalog.messages[locale], source)) {
      throw new Error(`Missing critical source key for ${locale}: ${source}`);
    }
    catalog.messages[locale][source] = sanitizeOverride(replacement);
  }
}

fs.writeFileSync(catalogPath, `${JSON.stringify(catalog, null, 2)}\n`, "utf8");
console.log(
  `Applied ${Object.values(overrides).reduce(
    (count, messages) => count + Object.keys(messages).length,
    0,
  )} editorial overrides and ${Object.values(criticalOverrides.translations).reduce(
    (count, messages) => count + Object.keys(messages).length,
    0,
  )} critical UI overrides.`,
);
