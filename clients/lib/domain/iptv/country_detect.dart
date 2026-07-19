import 'm3u.dart';

/// A detected country/region for an IPTV channel or group. Ports the `Country`
/// type of `iptv/country-detect.ts`.
class Country {
  const Country({required this.code, required this.name, required this.short});
  final String code;
  final String name;
  final String short;
}

/// A country with the number of channels detected for it.
class CountryCount {
  const CountryCount({required this.country, required this.count});
  final Country country;
  final int count;
}

const Map<String, String> _name = {
  'US': 'United States',
  'GB': 'United Kingdom',
  'CA': 'Canada',
  'AU': 'Australia',
  'IE': 'Ireland',
  'NZ': 'New Zealand',
  'FR': 'France',
  'DE': 'Germany',
  'ES': 'Spain',
  'IT': 'Italy',
  'PT': 'Portugal',
  'NL': 'Netherlands',
  'BE': 'Belgium',
  'CH': 'Switzerland',
  'AT': 'Austria',
  'SE': 'Sweden',
  'NO': 'Norway',
  'DK': 'Denmark',
  'FI': 'Finland',
  'PL': 'Poland',
  'CZ': 'Czechia',
  'SK': 'Slovakia',
  'HU': 'Hungary',
  'RO': 'Romania',
  'BG': 'Bulgaria',
  'GR': 'Greece',
  'TR': 'Turkey',
  'RU': 'Russia',
  'UA': 'Ukraine',
  'RS': 'Serbia',
  'HR': 'Croatia',
  'BR': 'Brazil',
  'MX': 'Mexico',
  'AR': 'Argentina',
  'CO': 'Colombia',
  'CL': 'Chile',
  'PE': 'Peru',
  'VE': 'Venezuela',
  'IN': 'India',
  'PK': 'Pakistan',
  'BD': 'Bangladesh',
  'PH': 'Philippines',
  'ID': 'Indonesia',
  'MY': 'Malaysia',
  'TH': 'Thailand',
  'VN': 'Vietnam',
  'CN': 'China',
  'JP': 'Japan',
  'KR': 'South Korea',
  'SA': 'Saudi Arabia',
  'AE': 'UAE',
  'EG': 'Egypt',
  'MA': 'Morocco',
  'IL': 'Israel',
  'ZA': 'South Africa',
  'NG': 'Nigeria',
  'DZ': 'Algeria',
  'LATINO': 'Latino',
  'EXYU': 'Ex-Yugoslavia',
  'ARABIC': 'Arabic',
  'NORDIC': 'Nordic',
  'AFRICA': 'Africa',
};

const Map<String, String> _short = {
  'GB': 'UK',
  'LATINO': 'LAT',
  'EXYU': 'YU',
  'ARABIC': 'ARB',
  'NORDIC': 'NOR',
  'AFRICA': 'AFR',
};

const Map<String, String> _alias = {
  'US': 'US',
  'USA': 'US',
  'UNITEDSTATES': 'US',
  'AMERICA': 'US',
  'AMERICAN': 'US',
  'UK': 'GB',
  'GB': 'GB',
  'UNITEDKINGDOM': 'GB',
  'ENGLAND': 'GB',
  'BRITAIN': 'GB',
  'BRITISH': 'GB',
  'CA': 'CA',
  'CAN': 'CA',
  'CANADA': 'CA',
  'CANADIAN': 'CA',
  'AU': 'AU',
  'AUS': 'AU',
  'AUSTRALIA': 'AU',
  'IE': 'IE',
  'IRELAND': 'IE',
  'IRISH': 'IE',
  'NZ': 'NZ',
  'NEWZEALAND': 'NZ',
  'FR': 'FR',
  'FRA': 'FR',
  'FRANCE': 'FR',
  'FRENCH': 'FR',
  'DE': 'DE',
  'GER': 'DE',
  'DEU': 'DE',
  'GERMANY': 'DE',
  'GERMAN': 'DE',
  'DEUTSCHLAND': 'DE',
  'ES': 'ES',
  'ESP': 'ES',
  'SPAIN': 'ES',
  'SPANISH': 'ES',
  'ESPANA': 'ES',
  'IT': 'IT',
  'ITA': 'IT',
  'ITALY': 'IT',
  'ITALIAN': 'IT',
  'ITALIA': 'IT',
  'PT': 'PT',
  'POR': 'PT',
  'PORTUGAL': 'PT',
  'PORTUGUESE': 'PT',
  'NL': 'NL',
  'NED': 'NL',
  'NETHERLANDS': 'NL',
  'DUTCH': 'NL',
  'HOLLAND': 'NL',
  'BE': 'BE',
  'BELGIUM': 'BE',
  'BELGIE': 'BE',
  'BELGIQUE': 'BE',
  'CH': 'CH',
  'SWISS': 'CH',
  'SWITZERLAND': 'CH',
  'AT': 'AT',
  'AUSTRIA': 'AT',
  'OSTERREICH': 'AT',
  'SE': 'SE',
  'SWE': 'SE',
  'SWEDEN': 'SE',
  'SWEDISH': 'SE',
  'NO': 'NO',
  'NOR': 'NO',
  'NORWAY': 'NO',
  'NORWEGIAN': 'NO',
  'DK': 'DK',
  'DEN': 'DK',
  'DENMARK': 'DK',
  'DANISH': 'DK',
  'FI': 'FI',
  'FIN': 'FI',
  'FINLAND': 'FI',
  'PL': 'PL',
  'POL': 'PL',
  'POLAND': 'PL',
  'POLISH': 'PL',
  'POLSKA': 'PL',
  'CZ': 'CZ',
  'CZECH': 'CZ',
  'CESKO': 'CZ',
  'SK': 'SK',
  'SLOVAKIA': 'SK',
  'HU': 'HU',
  'HUN': 'HU',
  'HUNGARY': 'HU',
  'RO': 'RO',
  'ROM': 'RO',
  'ROMANIA': 'RO',
  'ROMANIAN': 'RO',
  'BG': 'BG',
  'BULGARIA': 'BG',
  'GR': 'GR',
  'GRE': 'GR',
  'GREECE': 'GR',
  'GREEK': 'GR',
  'HELLAS': 'GR',
  'TR': 'TR',
  'TUR': 'TR',
  'TURKEY': 'TR',
  'TURKISH': 'TR',
  'TURKIYE': 'TR',
  'RU': 'RU',
  'RUS': 'RU',
  'RUSSIA': 'RU',
  'RUSSIAN': 'RU',
  'UA': 'UA',
  'UKR': 'UA',
  'UKRAINE': 'UA',
  'RS': 'RS',
  'SERBIA': 'RS',
  'SRBIJA': 'RS',
  'HR': 'HR',
  'CROATIA': 'HR',
  'HRVATSKA': 'HR',
  'BR': 'BR',
  'BRA': 'BR',
  'BRAZIL': 'BR',
  'BRASIL': 'BR',
  'BRAZILIAN': 'BR',
  'MX': 'MX',
  'MEX': 'MX',
  'MEXICO': 'MX',
  'MEXICAN': 'MX',
  'ARG': 'AR',
  'ARGENTINA': 'AR',
  'CO': 'CO',
  'COL': 'CO',
  'COLOMBIA': 'CO',
  'CL': 'CL',
  'CHILE': 'CL',
  'PE': 'PE',
  'PERU': 'PE',
  'VE': 'VE',
  'VENEZUELA': 'VE',
  'IN': 'IN',
  'IND': 'IN',
  'INDIA': 'IN',
  'INDIAN': 'IN',
  'HINDI': 'IN',
  'PK': 'PK',
  'PAK': 'PK',
  'PAKISTAN': 'PK',
  'BD': 'BD',
  'BANGLADESH': 'BD',
  'BANGLA': 'BD',
  'PH': 'PH',
  'PHIL': 'PH',
  'PHILIPPINES': 'PH',
  'FILIPINO': 'PH',
  'ID': 'ID',
  'INDONESIA': 'ID',
  'MY': 'MY',
  'MALAYSIA': 'MY',
  'TH': 'TH',
  'THAILAND': 'TH',
  'VN': 'VN',
  'VIETNAM': 'VN',
  'CN': 'CN',
  'CHINA': 'CN',
  'CHINESE': 'CN',
  'JP': 'JP',
  'JAPAN': 'JP',
  'JAPANESE': 'JP',
  'KR': 'KR',
  'KOREA': 'KR',
  'KOREAN': 'KR',
  'SOUTHKOREA': 'KR',
  'SA': 'SA',
  'KSA': 'SA',
  'SAUDI': 'SA',
  'SAUDIARABIA': 'SA',
  'AE': 'AE',
  'UAE': 'AE',
  'EMIRATES': 'AE',
  'DUBAI': 'AE',
  'EG': 'EG',
  'EGYPT': 'EG',
  'DZ': 'DZ',
  'ALGERIA': 'DZ',
  'ALGERIE': 'DZ',
  'ALGERIAN': 'DZ',
  'MA': 'MA',
  'MOROCCO': 'MA',
  'MAROC': 'MA',
  'IL': 'IL',
  'ISRAEL': 'IL',
  'ZA': 'ZA',
  'SOUTHAFRICA': 'ZA',
  'NG': 'NG',
  'NIGERIA': 'NG',
  'LATINO': 'LATINO',
  'LATIN': 'LATINO',
  'LATAM': 'LATINO',
  'EXYU': 'EXYU',
  'YU': 'EXYU',
  'YUGO': 'EXYU',
  'YUGOSLAVIA': 'EXYU',
  'BALKAN': 'EXYU',
  'BALKANS': 'EXYU',
  'AR': 'ARABIC',
  'ARABIC': 'ARABIC',
  'ARAB': 'ARABIC',
  'ARABIA': 'ARABIC',
  'NORDIC': 'NORDIC',
  'SCANDINAVIA': 'NORDIC',
  'SCANDINAVIAN': 'NORDIC',
  'AFRICA': 'AFRICA',
  'AFRICAN': 'AFRICA',
};

final RegExp _sep = RegExp(r'[|/:►▶▷»>[\]{}()]+');
final RegExp _nonAlnum = RegExp(r'[^A-Z0-9]');
final RegExp _spaces = RegExp(r'\s+');
final RegExp _leadingSep = RegExp(r'^[\s|/:►▶▷»>\-–—]+');
final RegExp _prefixWord = RegExp(r'^(\S+)\s+(.+)$');
final RegExp _tvgSep = RegExp(r'[;,\s]');
final RegExp _twoAlpha = RegExp(r'^[A-Z]{2}$');

String? _lookup(String raw) {
  final k = raw.toUpperCase().replaceAll(_nonAlnum, '');
  if (k.isEmpty) return null;
  return _alias[k];
}

String? _flagToCode(String s) {
  final letters = <String>[];
  for (final cp in s.runes.take(4)) {
    if (cp >= 0x1f1e6 && cp <= 0x1f1ff) {
      letters.add(String.fromCharCode(65 + (cp - 0x1f1e6)));
    }
  }
  if (letters.length >= 2) return _alias[letters.take(2).join()];
  return null;
}

Country _mk(String code) =>
    Country(code: code, name: _name[code] ?? code, short: _short[code] ?? code);

/// The flag CDN URL for a 2-letter ISO code, or null. Ports `flagUrl`.
String? flagUrl(String code) => _twoAlpha.hasMatch(code)
    ? 'https://flagcdn.com/w40/${code.toLowerCase()}.png'
    : null;

/// Detects the country from a group title (flag emoji, then leading segment /
/// word aliases). Ports `detectCountryFromGroup`.
Country? detectCountryFromGroup(String? group) {
  if (group == null || group.isEmpty) return null;
  final fc = _flagToCode(group);
  if (fc != null) return _mk(fc);
  final segs = group
      .split(_sep)
      .map((s) => s.trim())
      .where((s) => s.isNotEmpty)
      .toList();
  final cands = <String>[];
  if (segs.isNotEmpty) {
    cands.add(segs[0]);
    cands.add(segs[0].split(_spaces)[0]);
  }
  final firstWord = group.trim().split(_spaces)[0];
  if (firstWord.isNotEmpty) cands.add(firstWord);
  for (final c in cands) {
    final code = _lookup(c);
    if (code != null) return _mk(code);
  }
  return null;
}

/// Detects the country for a channel (group, then the `tvg-country` attr).
/// Ports `detectCountry`.
Country? detectCountry(IptvChannel ch) {
  final fromGroup = detectCountryFromGroup(ch.group);
  if (fromGroup != null) return fromGroup;
  final tvg = ch.attrs['tvg-country'];
  if (tvg != null && tvg.isNotEmpty) {
    final code = _lookup(tvg.split(_tvgSep)[0]);
    if (code != null) return _mk(code);
  }
  return null;
}

/// Strips a leading country prefix from a group title. Ports
/// `stripCountryPrefix`.
String stripCountryPrefix(String group) {
  final idx = _sep.firstMatch(group)?.start ?? -1;
  if (idx >= 0) {
    final head = group.substring(0, idx);
    if (_lookup(head) != null || _flagToCode(head) != null) {
      final rest = group
          .substring(idx + 1)
          .replaceFirst(_leadingSep, '')
          .trim();
      return rest.isEmpty ? group.trim() : rest;
    }
  }
  final m = _prefixWord.firstMatch(group.trim());
  if (m != null && _lookup(m.group(1)!) != null) return m.group(2)!.trim();
  return group.trim();
}

/// Buckets channels by detected country and returns the countries by count
/// desc. Ports `indexChannelsByCountry`.
({
  Map<String, List<IptvChannel>> channelsByCountry,
  List<CountryCount> countries,
})
indexChannelsByCountry(List<IptvChannel> channels) {
  final groupCache = <String, Country?>{};
  final channelsByCountry = <String, List<IptvChannel>>{};
  final meta = <String, Country>{};
  for (final ch in channels) {
    final gk = ch.group ?? '';
    Country? c;
    if (groupCache.containsKey(gk)) {
      c = groupCache[gk];
    } else {
      c = detectCountryFromGroup(ch.group);
      groupCache[gk] = c;
    }
    c ??= detectCountry(ch);
    if (c == null) continue;
    meta[c.code] = c;
    (channelsByCountry[c.code] ??= []).add(ch);
  }
  final countries = [
    for (final e in channelsByCountry.entries)
      CountryCount(country: meta[e.key]!, count: e.value.length),
  ]..sort((a, b) => b.count.compareTo(a.count));
  return (channelsByCountry: channelsByCountry, countries: countries);
}
