// Zoekwoordenbibliotheek van de Tenderkaart (BroadbandEU Global Connectivity Tender Monitor, okt 2026).
// Per categorie: vaste woordcombinaties in meerdere talen. Losse afkortingen (LEO, GEO, 5G, DIA) zijn bewust weggelaten:
// die geven te veel ruis. Een term matcht alleen als heel woord (of woordgroep); spatie en streepje zijn uitwisselbaar.

export const BRANDS = ['starlink', 'OneWeb', 'Project Kuiper', 'Amazon Leo']; // los "Kuiper" is ook een Nederlandse achternaam

export const CATEGORIES = [
  { key: 'leo', label: 'LEO / Starlink', prio: 1, terms: [
    ...BRANDS, 'LEO satellite', 'LEO satellites', 'LEO satellite internet', 'LEO connectivity', 'LEO-satelliet', 'LEO-satellieten',
    'LEO-Satellit', 'LEO-Satelliten', 'satellite LEO', 'satellites LEO', 'satélite LEO', 'satélites LEO', 'satellite a bassa orbita',
    'satelliti LEO', 'satelity LEO', 'satélite de órbita baixa', 'satélites de órbita baixa', 'satélite de baixa órbita',
    'satélites de baixa órbita', 'órbita terrestre baixa', 'satelital de órbita baja', 'satelitales de órbita baja', 'satélites de órbita baja',
    'órbita terrestre baja', 'satelity niskoorbitowe', 'satelitarny LEO', 'niskiej orbicie okołoziemskiej', 'sateliți LEO', 'orbită joasă',
    'LEO-Satellitenkommunikation', 'lavbane-satellitt', 'LEO-satellitt', 'low earth orbit', 'low-earth orbit satellite', 'low latency satellite'
  ] },
  { key: 'sat', label: 'Satelliet', prio: 1, terms: [
    'satellite internet', 'satellite broadband', 'satellite connectivity', 'satellite communications service', 'satcom', 'VSAT',
    'high throughput satellite', 'HTS satellite', 'MEO satellite', 'GEO satellite', 'geostationary satellite', 'Eutelsat', 'SES O3b', 'O3b mPOWER',
    'business satellite', 'satellietinternet', 'satellietverbinding', 'satellietverbindingen', 'internet via satelliet', 'satellietcommunicatie',
    'Satelliteninternet', 'Satellitenverbindung', 'Satelliten-Internet', 'Satellitenkommunikation', 'internet par satellite', 'internet satellitaire',
    'connexion satellitaire', 'connexion par satellite', 'internet via satélite', 'internet por satélite', 'internet satelital', 'internet satélite',
    'servicio de internet satelital', 'internet satellitare', 'connettività satellitare', 'internet satelitarny', 'internet przez satelitę',
    'łączność satelitarna', 'internet prin satelit', 'satellittinternett', 'satellittbredbånd', 'супутниковий інтернет', 'супутникового інтернету',
    'спутниковый интернет', 'спутникового интернета'
  ] },
  { key: 'mobile', label: 'Mobiel (4G/5G)', prio: 1, terms: [
    'private 5G', 'private LTE', 'private mobile network', '5G connectivity', '4G connectivity', 'LTE connectivity', 'mobile broadband',
    'fixed wireless access', 'fixed wireless', '4G router', '4G routers', '5G router', '5G routers', '4G/5G router', '5G campus network',
    'mobiel breedband', 'vaste draadloze verbinding', 'privaat 5G', 'privé 5G', '5G-Campusnetz', 'privates 5G', 'mobiles Breitband',
    'réseau 5G privé', 'réseau privé 5G', 'red 5G privada', 'banda ancha móvil', 'prywatna sieć 5G', 'rede 5G privada', 'banda larga móvel'
  ] },
  { key: 'microwave', label: 'Straalverbindingen', prio: 1, terms: [
    'straalverbinding', 'straalverbindingen', 'microgolfverbinding', 'gelicenseerde frequentie', 'microwave link', 'microwave links',
    'microwave backhaul', 'microwave radio', 'point-to-point microwave', 'point-to-point radio', 'point-to-point wireless', 'point-to-multipoint',
    'licensed microwave', 'wireless bridge', 'Richtfunk', 'Richtfunkstrecke', 'Richtfunkstrecken', 'Richtfunkverbindung', 'Richtfunkverbindungen',
    'Richtfunkanlage', 'Richtfunksystem', 'faisceau hertzien', 'faisceaux hertziens', 'liaison hertzienne', 'liaisons hertziennes', 'radioenlace',
    'radioenlaces', 'enlace de microondas', 'enlaces de microondas', 'enlace microondas', 'feixe hertziano', 'feixes hertzianos',
    'ligação de micro-ondas', 'ponte radio', 'ponti radio', 'collegamento in ponte radio', 'radiolinia', 'radiolinie', 'linia radiowa', 'radioreleu',
    'radiolinje', 'radiolinjer', 'radiolänk', 'радіорелейний', 'радіорелейного', 'радіорелейної', 'радиорелейной', 'радиорелейная', 'радиорелейного'
  ] },
  { key: 'fiber', label: 'Glasvezel', prio: 0.75, terms: [
    'fiber connectivity', 'fibre connectivity', 'dark fiber', 'dark fibre', 'leased line', 'leased lines', 'dedicated internet access',
    'Ethernet access', 'internet leased line', 'glasvezelaansluiting', 'glasvezelaansluitingen', 'glasvezelverbinding', 'glasvezelverbindingen',
    'huurlijn', 'huurlijnen', 'Glasfaseranschluss', 'Glasfaseranbindung', 'Standleitung', 'Standleitungen', 'Dark-Fiber', 'fibre noire',
    'liaison louée', 'lien fibre dédié', 'fibra oscura', 'línea dedicada', 'fibra apagada', 'światłowód ciemny', 'łącze dzierżawione'
  ] },
  { key: 'wifi', label: 'Wi-Fi', prio: 0.75, terms: [
    'managed Wi-Fi', 'managed WiFi', 'outdoor Wi-Fi', 'outdoor WiFi', 'wireless LAN', 'WLAN', 'Wi-Fi 6', 'Wi-Fi 6E', 'Wi-Fi 7', 'WiFi 6', 'WiFi 7',
    'wireless mesh', 'mesh network', 'wifi-netwerk', 'wifi netwerk', 'draadloos netwerk', 'WLAN-Infrastruktur', 'WLAN-Netz', 'réseau wifi',
    'réseau sans fil', 'red wifi', 'red inalámbrica', 'sieć WiFi', 'sieć bezprzewodowa', 'rede wifi', 'rede sem fios', 'rete wifi'
  ] },
  { key: 'managed', label: 'Managed', prio: 1, terms: [
    'managed connectivity', 'connectivity as a service', 'managed WAN', 'managed network services', 'managed network service', 'managed SD-WAN',
    'SD-WAN', 'SDWAN', 'network monitoring', 'netwerkbeheer', 'beheerde connectiviteit', 'beheerde netwerkdiensten', 'Managed Services Netzwerk',
    'réseau managé', 'services réseau managés', 'red gestionada', 'servicios gestionados de red'
  ] },
  { key: 'hybrid', label: 'Hybride / backup', prio: 1, terms: [
    'hybrid WAN', 'failover', 'link bonding', 'bonding router', 'backup connectivity', 'backup connection', 'resilient network', 'resilient networks',
    'redundant connectivity', 'redundante verbinding', 'redundante verbindingen', 'redundante Anbindung', 'connexion de secours', 'conexión de respaldo',
    '4G backup', '5G backup', 'LTE backup', '4G/5G backup', '4G back-up', '5G back-up', '4G failover', '5G failover', 'LTE failover', 'backup 4G',
    'backup 5G', 'mobile backup', 'mobiele backup', 'mobiele back-up', 'secours 4G', 'secours 5G', 'Mobilfunk-Backup', 'LTE-Backup'
  ] },
  { key: 'temp', label: 'Tijdelijk / nood', prio: 1, terms: [
    'emergency connectivity', 'emergency communications network', 'temporary internet', 'temporary network', 'temporary networks',
    'temporary connectivity', 'event connectivity', 'mobile command center', 'mobile command centre', 'mobile command post', 'noodcommunicatie',
    'tijdelijk netwerk', 'tijdelijke netwerken', 'tijdelijke internetverbinding', 'tijdelijke verbinding', 'mobiele commandopost',
    'temporäres Netzwerk', 'temporäre Netzwerke', 'temporäre Internetanbindung', 'Notfallkommunikation', 'réseau temporaire', 'réseaux temporaires',
    'communications d\'urgence', 'red temporal', 'comunicaciones de emergencia', 'rete temporanea', 'łączność awaryjna'
  ] },
  { key: 'maritime', label: 'Maritiem / offshore', prio: 0.75, terms: [
    'maritime broadband', 'maritime connectivity', 'vessel connectivity', 'ship connectivity', 'offshore communications', 'offshore connectivity',
    'maritieme connectiviteit', 'scheepsinternet', 'maritime Kommunikation', 'connectivité maritime', 'conectividad marítima'
  ] },
  { key: 'industrial', label: 'Industrieel / IoT', prio: 0.75, terms: [
    'industrial IoT', 'IIoT', 'remote site connectivity', 'remote sites connectivity', 'telemetry network', 'telemetry system', 'telemetry',
    'SCADA communications', 'SCADA communication', 'telemetrie', 'telemetriesysteem', 'Fernwirktechnik', 'télémétrie', 'telemetría', 'telemetria'
  ] },
  { key: 'haps', label: 'HAPS', prio: 0.5, terms: [
    'HAPS', 'high-altitude platform', 'high-altitude platforms', 'high altitude platform station', 'stratospheric communications', 'stratospheric platform'
  ] },
  { key: 'infra', label: 'Netwerkinfrastructuur', prio: 0.75, terms: [
    'backhaul', 'last-mile connectivity', 'last mile connectivity', 'rural broadband', 'rural connectivity', 'breedbandvoorziening', 'internettoegang',
    'Breitbandversorgung', 'Breitbandanbindung', 'haut débit rural', 'banda ancha rural', 'conectividad rural', 'szerokopasmowy dostęp'
  ] }
];

// Zoeken op de behoefte: twee dingen die samen in de tekst staan (Engels en Nederlands)
export const COMBOS = [
  { key: 'need', a: ['remote site', 'remote sites', 'remote location', 'remote locations', 'afgelegen locatie', 'afgelegen locaties'],
    b: ['connectivity', 'internet', 'connectiviteit', 'verbinding', 'verbindingen'] },
  { key: 'need', a: ['internet access', 'internet connection', 'internet connections', 'internettoegang', 'internetverbinding', 'internetverbindingen'],
    b: ['multiple locations', 'multiple sites', 'locations', 'sites', 'locaties', 'vestigingen'] },
  { key: 'sat', a: ['satellite', 'satelliet'], b: ['managed service', 'managed services', 'beheerde dienst', 'beheerde diensten'] },
  { key: 'microwave', a: ['microwave', 'straalverbinding'], b: ['backhaul'] },
  { key: 'hybrid', a: ['5G', '4G', 'LTE'], b: ['backup', 'back-up', 'failover'] },
  { key: 'infra', a: ['rural broadband', 'plattelandsbreedband'], b: ['installation', 'installatie'] }
];

// Brede termen: die tellen alleen als ze in de titel (het begin van de tekst) staan, niet ergens diep in een beschrijving.
// Anders komen er tenders mee als "levering van brandstof" waarin ergens "telemetrie" of "failover" staat.
export const WEAK_TERMS = ['telemetry', 'telemetry network', 'telemetry system', 'telemetrie', 'télémétrie', 'telemetría', 'telemetria', 'failover',
  'backhaul', 'WLAN', 'wireless LAN', 'network monitoring', 'netwerkbeheer', 'internettoegang', 'mesh network', 'HAPS', 'IIoT', 'industrial IoT',
  'Breitbandversorgung', 'Breitbandanbindung', 'mobile broadband', 'fixed wireless', 'rural connectivity', 'wireless bridge', 'Fernwirktechnik',
  'satcom', 'resilient network', 'resilient networks', 'Standleitung', 'Standleitungen', 'leased line', 'leased lines'];

// Termen voor bronnen met een zoekfunctie (TED en dergelijke): per categorie de sterkste
export const SEARCH_TERMS = [
  'starlink', 'oneweb', 'LEO satellite', 'satellite internet', 'satellite broadband', 'VSAT', 'satcom', 'private 5G', 'fixed wireless access',
  'microwave link', 'point-to-point radio', 'dark fibre', 'managed Wi-Fi', 'SD-WAN', 'managed connectivity', 'hybrid WAN', 'backup connectivity',
  '4G backup', 'emergency connectivity', 'temporary network', 'maritime broadband', 'remote site connectivity', 'high-altitude platform', 'rural broadband'
];
// Voor TED: Engelse kern plus de belangrijkste Nederlandse, Duitse, Franse en Spaanse vormen
export const TED_TERMS_LIST = [
  ...SEARCH_TERMS, 'Project Kuiper', 'Amazon Leo', 'low earth orbit', 'satellietinternet', 'satellietverbinding', 'straalverbinding', 'glasvezelaansluiting',
  'huurlijn', 'Satelliteninternet', 'Richtfunk', 'internet par satellite', 'faisceau hertzien', 'internet satelital', 'radioenlace',
  'internet via satélite', 'ponte radio', 'radiolinia', 'tijdelijk netwerk', 'noodcommunicatie'
];

// Landen waar Starlink (nog) niet beschikbaar of niet toegestaan is (stand van zaken medio 2026; graag corrigeren waar nodig)
export const STARLINK_BLOCKED = ['CN', 'RU', 'IR', 'KP', 'BY', 'CU', 'SY', 'AF', 'ZA', 'TR', 'EG', 'PK', 'MM'];
