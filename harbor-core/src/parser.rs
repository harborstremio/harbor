#![allow(dead_code)]

use crate::types::*;
use once_cell::sync::Lazy;
use regex::Regex;
use std::collections::{BTreeMap, HashSet};

static TRUSTED_GROUPS: Lazy<HashSet<&'static str>> = Lazy::new(|| {
    let mut s = HashSet::new();
    for g in [
        "FRDS", "FRAMESTOR", "FORM", "EVO", "RARBG", "ETHEL", "FLUX", "QXR", "MEGUSTA",
        "ION10", "PSA", "AMIABLE", "GALAXYRG", "WEBDV", "RZEROX", "SIC", "TGX", "NTB",
        "NTG", "TEPES", "GECKOS", "SUCCESSFULCRAB", "SUBSPLEASE", "ERAI", "ERAIRAWS",
        "JUDAS", "ASW", "EMBER", "ANE", "CLEO", "BEATRICERAWS", "AKIHITO", "VODES",
        "NANDESUKA", "SMOL", "TENRAISENSEI", "GST", "ANIMEKAIZOKU", "REINFORCE", "RAWS",
        "OZR", "PURGATORY", "SHK", "KOTUWA", "KIRION", "COMMIE", "DAMEDESUYO", "MTBB",
        "GJM", "SOFCJ",
    ] {
        s.insert(g);
    }
    s
});

static LANG_TOKENS: Lazy<BTreeMap<&'static str, &'static str>> = Lazy::new(|| {
    let pairs: &[(&str, &str)] = &[
        ("ENG", "English"), ("ENGLISH", "English"),
        ("ITA", "Italian"), ("ITALIAN", "Italian"),
        ("RUS", "Russian"), ("RUSSIAN", "Russian"),
        ("HIN", "Hindi"), ("HINDI", "Hindi"),
        ("ESP", "Spanish"), ("SPA", "Spanish"), ("SPANISH", "Spanish"),
        ("LAT", "Spanish"), ("LATINO", "Spanish"), ("CASTELLANO", "Spanish"),
        ("KOR", "Korean"), ("KOREAN", "Korean"),
        ("JPN", "Japanese"), ("JAPANESE", "Japanese"), ("JAP", "Japanese"),
        ("CHN", "Chinese"), ("CHI", "Chinese"), ("CHINESE", "Chinese"),
        ("ZHO", "Chinese"), ("MAN", "Chinese"), ("MANDARIN", "Chinese"),
        ("CANTONESE", "Chinese"),
        ("POR", "Portuguese"), ("PORTUGUESE", "Portuguese"),
        ("PTBR", "Portuguese"), ("DUBLADO", "Portuguese"),
        ("GER", "German"), ("GERMAN", "German"), ("DEU", "German"),
        ("FRA", "French"), ("FRENCH", "French"), ("FRE", "French"),
        ("VFF", "French"), ("VFQ", "French"), ("VOSTFR", "French"),
        ("TUR", "Turkish"), ("TURKISH", "Turkish"),
        ("ARA", "Arabic"), ("ARABIC", "Arabic"),
        ("TAM", "Tamil"), ("TAMIL", "Tamil"),
        ("TEL", "Telugu"), ("TELUGU", "Telugu"),
        ("CES", "Czech"), ("CZECH", "Czech"), ("CZE", "Czech"),
        ("DAN", "Danish"), ("DANISH", "Danish"),
        ("FIN", "Finnish"), ("FINNISH", "Finnish"),
        ("HEB", "Hebrew"), ("HEBREW", "Hebrew"),
        ("HUN", "Hungarian"), ("HUNGARIAN", "Hungarian"),
        ("NLD", "Dutch"), ("DUTCH", "Dutch"), ("DUT", "Dutch"),
        ("NOR", "Norwegian"), ("NORWEGIAN", "Norwegian"),
        ("POL", "Polish"), ("POLISH", "Polish"),
        ("RON", "Romanian"), ("ROMANIAN", "Romanian"), ("ROM", "Romanian"),
        ("SWE", "Swedish"), ("SWEDISH", "Swedish"),
        ("THA", "Thai"), ("THAI", "Thai"),
        ("UKR", "Ukrainian"), ("UKRAINIAN", "Ukrainian"),
        ("VIE", "Vietnamese"), ("VIETNAMESE", "Vietnamese"),
    ];
    pairs.iter().copied().collect()
});

static FLAG_TO_LANGUAGE: Lazy<BTreeMap<&'static str, &'static str>> = Lazy::new(|| {
    let pairs: &[(&str, &str)] = &[
        ("US", "English"), ("GB", "English"), ("CA", "English"), ("AU", "English"),
        ("NZ", "English"), ("IE", "English"),
        ("ES", "Spanish"), ("MX", "Spanish"), ("AR", "Spanish"), ("CO", "Spanish"),
        ("PE", "Spanish"), ("CL", "Spanish"),
        ("IT", "Italian"),
        ("DE", "German"), ("AT", "German"), ("CH", "German"),
        ("FR", "French"), ("BE", "French"), ("LU", "French"),
        ("JP", "Japanese"),
        ("KR", "Korean"), ("KP", "Korean"),
        ("CN", "Chinese"), ("HK", "Chinese"), ("TW", "Chinese"), ("SG", "Chinese"),
        ("PT", "Portuguese"), ("BR", "Portuguese"),
        ("RU", "Russian"), ("BY", "Russian"),
        ("IN", "Hindi"), ("PK", "Hindi"),
        ("SA", "Arabic"), ("AE", "Arabic"), ("EG", "Arabic"), ("IQ", "Arabic"),
        ("JO", "Arabic"), ("KW", "Arabic"), ("LB", "Arabic"), ("MA", "Arabic"),
        ("QA", "Arabic"), ("SY", "Arabic"), ("TN", "Arabic"),
        ("IL", "Hebrew"),
        ("TR", "Turkish"),
        ("NL", "Dutch"),
        ("NO", "Norwegian"),
        ("PL", "Polish"),
        ("RO", "Romanian"), ("MD", "Romanian"),
        ("SE", "Swedish"),
        ("DK", "Danish"),
        ("FI", "Finnish"),
        ("CZ", "Czech"),
        ("HU", "Hungarian"),
        ("TH", "Thai"),
        ("UA", "Ukrainian"),
        ("VN", "Vietnamese"),
        ("GR", "Greek"),
        ("ID", "Indonesian"),
        ("MY", "Malay"),
        ("PH", "Tagalog"),
        ("IR", "Persian"),
    ];
    pairs.iter().copied().collect()
});

static ISO_PAIR_TO_LANGUAGE: Lazy<BTreeMap<&'static str, &'static str>> = Lazy::new(|| {
    let pairs: &[(&str, &str)] = &[
        ("EN", "English"), ("GB", "English"), ("US", "English"), ("CA", "English"),
        ("AU", "English"), ("NZ", "English"),
        ("ES", "Spanish"), ("MX", "Spanish"),
        ("IT", "Italian"),
        ("DE", "German"),
        ("FR", "French"),
        ("PT", "Portuguese"), ("BR", "Portuguese"),
        ("RU", "Russian"),
        ("JA", "Japanese"), ("JP", "Japanese"),
        ("KO", "Korean"), ("KR", "Korean"),
        ("ZH", "Chinese"), ("CN", "Chinese"), ("TW", "Chinese"), ("HK", "Chinese"),
        ("HI", "Hindi"),
        ("AR", "Arabic"), ("SA", "Arabic"), ("AE", "Arabic"), ("EG", "Arabic"),
        ("TR", "Turkish"),
        ("NL", "Dutch"),
        ("PL", "Polish"),
        ("RO", "Romanian"),
        ("SV", "Swedish"), ("SE", "Swedish"),
        ("DA", "Danish"),
        ("FI", "Finnish"),
        ("CS", "Czech"), ("CZ", "Czech"),
        ("HU", "Hungarian"),
        ("TH", "Thai"),
        ("UK", "Ukrainian"), ("UA", "Ukrainian"),
        ("VI", "Vietnamese"),
        ("IL", "Hebrew"), ("HE", "Hebrew"),
        ("GR", "Greek"),
        ("ID", "Indonesian"),
        ("MY", "Malay"),
        ("PH", "Tagalog"),
        ("IR", "Persian"), ("FA", "Persian"),
    ];
    pairs.iter().copied().collect()
});

static LANG_RX: Lazy<Regex> = Lazy::new(|| {
    Regex::new(
        r"(?i)\b(ENG(?:LISH)?|ITA(?:LIAN)?|RUS(?:SIAN)?|HIN(?:DI)?|ESP|SPA(?:NISH)?|LAT(?:INO)?|CASTELLANO|KOR(?:EAN)?|JPN|JAPANESE|JAP|CHN|CHI(?:NESE)?|ZHO|MAN(?:DARIN)?|CANTONESE|POR(?:TUGUESE)?|PTBR|DUBLADO|GER(?:MAN)?|DEU|FRA|FRENCH|FRE|VFF|VFQ|VOSTFR|TUR(?:KISH)?|ARA(?:BIC)?|TAM(?:IL)?|TEL(?:UGU)?|CES|CZECH|CZE|DAN(?:ISH)?|FIN(?:NISH)?|HEB(?:REW)?|HUN(?:GARIAN)?|NLD|DUTCH|DUT|NOR(?:WEGIAN)?|POL(?:ISH)?|RON|ROM|ROMANIAN|SWE(?:DISH)?|THA|THAI|UKR(?:AINIAN)?|VIE(?:TNAMESE)?|MULTI|DUAL)\b",
    ).unwrap()
});

static FLAG_RX: Lazy<Regex> = Lazy::new(|| {
    Regex::new(r"[\x{1F1E6}-\x{1F1FF}][\x{1F1E6}-\x{1F1FF}]").unwrap()
});

static ISO_PAIR_RX: Lazy<Regex> = Lazy::new(|| {
    Regex::new(
        r"(?i)(?:^|[\.\-_\s\[(])(EN|FR|ES|IT|DE|PT|RU|JA|JP|KO|KR|ZH|CN|HI|AR|TR|NL|PL|RO|SV|SE|DA|FI|CS|CZ|HU|TH|UK|UA|VI|GB|US|MX|BR|CA|AU|NZ|TW|HK|IL|HE|SA|AE|EG|GR|ID|MY|PH|IR|FA)(?:[\.\-_\s\])]|$)",
    ).unwrap()
});

static TORRENTIO_NOISE_PREFIX_RX: Lazy<Regex> = Lazy::new(|| {
    Regex::new(r"^[\s\x{1F464}\x{1F465}\x{1F4BE}\x{1F4E6}\x{26A1}\x{1F310}\x{1F4FA}\x{1F3AC}\x{1F50A}]+").unwrap()
});

static TORRENTIO_NOISE_SUFFIX_RX: Lazy<Regex> = Lazy::new(|| {
    Regex::new(r"[\s\x{1F464}\x{1F465}\x{1F4BE}\x{1F4E6}\x{26A1}\x{1F310}\x{1F4FA}\x{1F3AC}\x{1F50A}]+$").unwrap()
});

static CONTAINER_RX: Lazy<Regex> =
    Lazy::new(|| Regex::new(r"(?i)\.(mkv|mp4|m4v|avi|webm|mov|ts|wmv)\b").unwrap());

static SIZE_RX: Lazy<Regex> =
    Lazy::new(|| Regex::new(r"(?i)(\d+(?:\.\d+)?)\s*(GB|MB|TB|GiB|MiB|TiB)\b").unwrap());

static SEEDERS_RX: Lazy<Regex> = Lazy::new(|| {
    Regex::new(r"(?i)(?:\x{1F465}|\x{1F464}|S:|seeds?:?|\bS\s*=\s*)\s*(\d+)").unwrap()
});

static ANIME_HASH_RX: Lazy<Regex> =
    Lazy::new(|| Regex::new(r"(?i)\[([0-9A-F]{8})\]").unwrap());

static RD_CACHE_RX: Lazy<Regex> = Lazy::new(|| Regex::new(r"(?i)\[RD[+\x{26A1}]\]").unwrap());
static TB_CACHE_RX: Lazy<Regex> = Lazy::new(|| Regex::new(r"(?i)\[TB[+\x{26A1}]\]").unwrap());
static AD_CACHE_RX: Lazy<Regex> = Lazy::new(|| Regex::new(r"(?i)\[AD[+\x{26A1}]\]").unwrap());
static PM_CACHE_RX: Lazy<Regex> = Lazy::new(|| Regex::new(r"(?i)\[PM[+\x{26A1}]\]").unwrap());
static DL_CACHE_RX: Lazy<Regex> = Lazy::new(|| Regex::new(r"(?i)\[DL[+\x{26A1}]\]").unwrap());

static RD_UNCACHED_RX: Lazy<Regex> = Lazy::new(|| {
    Regex::new(r"(?i)\[RD(?:[\s\-]?download|\x{2B07}\x{FE0F}?|\x{23F3})\]").unwrap()
});
static TB_UNCACHED_RX: Lazy<Regex> = Lazy::new(|| {
    Regex::new(r"(?i)\[TB(?:[\s\-]?download|\x{2B07}\x{FE0F}?|\x{23F3})\]").unwrap()
});
static AD_UNCACHED_RX: Lazy<Regex> = Lazy::new(|| {
    Regex::new(r"(?i)\[AD(?:[\s\-]?download|\x{2B07}\x{FE0F}?|\x{23F3})\]").unwrap()
});
static PM_UNCACHED_RX: Lazy<Regex> = Lazy::new(|| {
    Regex::new(r"(?i)\[PM(?:[\s\-]?download|\x{2B07}\x{FE0F}?|\x{23F3})\]").unwrap()
});
static DL_UNCACHED_RX: Lazy<Regex> = Lazy::new(|| {
    Regex::new(r"(?i)\[DL(?:[\s\-]?download|\x{2B07}\x{FE0F}?|\x{23F3})\]").unwrap()
});

static JACKETTIO_BARE_UNCACHED_RX: Lazy<Regex> = Lazy::new(|| {
    Regex::new(r"(?i)\[(RD|TB|AD|PM|DL|OC|ED|Putio)\]\s+(?:Jackettio|jackettio)\b").unwrap()
});

static STREAMFUSION_CACHED_RX: Lazy<Regex> =
    Lazy::new(|| Regex::new(r"(?im)^\x{26A1}instant").unwrap());
static STREAMFUSION_SERVICE_RX: Lazy<Regex> =
    Lazy::new(|| Regex::new(r"(?im)^\x{26A1}instant\s*\n([^\n]+)").unwrap());
static STREAMFUSION_UNCACHED_SERVICE_RX: Lazy<Regex> = Lazy::new(|| {
    Regex::new(r"(?im)^\x{2B07}\x{FE0F}?download\s*\n([^\n]+)").unwrap()
});

static AIOSTREAMS_TORBOX_CACHED_RX: Lazy<Regex> =
    Lazy::new(|| Regex::new(r"(?i)\(Instant\b").unwrap());
static AIOSTREAMS_PRISM_CACHED_RX: Lazy<Regex> =
    Lazy::new(|| Regex::new(r"(?i)\x{26A1}\s*Ready\b").unwrap());
static AIOSTREAMS_PRISM_UNCACHED_RX: Lazy<Regex> =
    Lazy::new(|| Regex::new(r"(?i)\x{274C}\s*Not\s+Ready\b").unwrap());
static AIOSTREAMS_GDRIVE_CACHED_RX: Lazy<Regex> = Lazy::new(|| Regex::new(r"\x{1F3AB}").unwrap());
static AIOSTREAMS_GDRIVE_UNCACHED_RX: Lazy<Regex> =
    Lazy::new(|| Regex::new(r"\x{1F39F}\x{FE0F}?").unwrap());

const MEDIAFUSION_SERVICE: &str = r"RD|TB|TRB|AD|PM|DL|OC|ED|ST|DBD|DB|PKP|PP|SDR|SAB|NZB|DAV|EN|NNTP|QB-WD|Putio|Offcloud|EasyDebrid";

static MEDIAFUSION_CACHED_RX: Lazy<Regex> = Lazy::new(|| {
    Regex::new(&format!(
        r"(?i)\b(?:{})\s*[+\x{{26A1}}\x{{2705}}]",
        MEDIAFUSION_SERVICE
    ))
    .unwrap()
});
static MEDIAFUSION_UNCACHED_RX: Lazy<Regex> = Lazy::new(|| {
    Regex::new(&format!(
        r"(?i)\b(?:{})\s*[\x{{23F3}}\x{{2B07}}\x{{1F53B}}\x{{274C}}]",
        MEDIAFUSION_SERVICE
    ))
    .unwrap()
});

static SERVICE_CACHED_RX: Lazy<Regex> = Lazy::new(|| {
    Regex::new(
        r"(?i)(?:\x{26A1}\x{FE0F}?|\x{2705})\s*(?:cached(?:\s+on)?|instant(?:\s+on)?|ready(?:\s+on)?)?\s*(real[\s\-_]?debrid|realdebrid|rd|torbox|tb|all[\s\-_]?debrid|alldebrid|ad|premiumize|pm|debrid[\s\-_]?link|debridlink|dl)",
    ).unwrap()
});
static SERVICE_UNCACHED_RX: Lazy<Regex> = Lazy::new(|| {
    Regex::new(
        r"(?i)(?:\x{23F3}|\x{2B07}\x{FE0F}?|\x{1F53B}|\x{274C})\s*(?:need[\s_-]?cache|need[\s_-]?to[\s_-]?cache|download(?:\s+via)?|not\s+ready|uncached(?:\s+on)?)?\s*(real[\s\-_]?debrid|realdebrid|rd|torbox|tb|all[\s\-_]?debrid|alldebrid|ad|premiumize|pm|debrid[\s\-_]?link|debridlink|dl)",
    ).unwrap()
});

static HDR_FORMATS: Lazy<Vec<(Regex, HdrFormat)>> = Lazy::new(|| {
    vec![
        (
            Regex::new(
                r"(?i)\bDV[+\-\s.]?HDR10\+?\b|\bDoVi[+\-\s.]?HDR10\+?\b|\bDolby[\.\s]?Vision[+\-\s.]?HDR10\+?\b",
            )
            .unwrap(),
            HdrFormat::DvHdr10,
        ),
        (
            Regex::new(r"(?i)\bDV\b|\bDoVi\b|\bDolby[\.\s]?Vision\b").unwrap(),
            HdrFormat::Dv,
        ),
        (Regex::new(r"(?i)\bHDR10\+\b").unwrap(), HdrFormat::Hdr10Plus),
        (Regex::new(r"(?i)\bHLG\b").unwrap(), HdrFormat::Hlg),
        (
            Regex::new(r"(?i)\bHDR10?\b|\bHDR\b").unwrap(),
            HdrFormat::Hdr10,
        ),
    ]
});

static SOURCE_RX: Lazy<Vec<(Regex, Source)>> = Lazy::new(|| {
    vec![
        (
            Regex::new(r"(?i)\bHC[\s._\-]?(?:HDRip|HD[\s._\-]?Rip|CAM(?:Rip)?)\b").unwrap(),
            Source::CAM,
        ),
        (
            Regex::new(r"(?i)\b(?:HD|Clean|New|HQ|TS)[\s._\-]?CAM(?:Rip)?\b|\bCAM(?:Rip)?\b")
                .unwrap(),
            Source::CAM,
        ),
        (
            Regex::new(r"(?i)\bHD[\s._\-]?TS\b|\bHDTS\b").unwrap(),
            Source::HDTS,
        ),
        (
            Regex::new(r"(?i)\bTELESYNC\b|\bTS[\s._\-]?Rip\b|\bPDVDRip\b").unwrap(),
            Source::TS,
        ),
        (
            Regex::new(r"(?i)\bTELECINE\b|\bHD[\s._\-]?TC\b").unwrap(),
            Source::TC,
        ),
        (
            Regex::new(
                r"(?i)\bSCREENER\b|\bDVDSCR\b|\bDVDScreener\b|\bBDSCR\b|\bWEB[\s._\-]?SCR\b|\bSCR\b",
            )
            .unwrap(),
            Source::SCR,
        ),
        (Regex::new(r"(?i)\bRemux\b").unwrap(), Source::REMUX),
        (
            Regex::new(r"(?i)\bBluRay\b|\bBDRip\b|\bBRRip\b").unwrap(),
            Source::BluRay,
        ),
        (Regex::new(r"(?i)\bWEB[\.\-]?DL\b").unwrap(), Source::WebDl),
        (
            Regex::new(r"(?i)\bWEBRip\b|\bWEB-Rip\b").unwrap(),
            Source::WEBRip,
        ),
        (Regex::new(r"(?i)\bHDRip\b").unwrap(), Source::HDRip),
        (Regex::new(r"(?i)\bDVDRip\b").unwrap(), Source::DVDRip),
        (Regex::new(r"(?i)\bHDTV\b").unwrap(), Source::HDTV),
    ]
});

static AUDIO_CODEC_RX: Lazy<Vec<(Regex, AudioCodec)>> = Lazy::new(|| {
    vec![
        (Regex::new(r"(?i)\bAtmos\b").unwrap(), AudioCodec::Atmos),
        (Regex::new(r"(?i)\bTrueHD\b").unwrap(), AudioCodec::TrueHd),
        (
            Regex::new(r"(?i)\bDTS-HD\.?MA\b|\bDTS\.?HD\.?MA\b").unwrap(),
            AudioCodec::DtsHdMa,
        ),
        (Regex::new(r"(?i)\bDTS\b").unwrap(), AudioCodec::Dts),
        (
            Regex::new(r"(?i)\bDDP?5?\.?1\+?\b|\bE-?AC3\b|\bDD\+\b").unwrap(),
            AudioCodec::DdPlus,
        ),
        (Regex::new(r"(?i)\bAC3\b").unwrap(), AudioCodec::Ac3),
        (Regex::new(r"(?i)\bAAC\b").unwrap(), AudioCodec::Aac),
        (Regex::new(r"(?i)\bFLAC\b").unwrap(), AudioCodec::Flac),
        (Regex::new(r"(?i)\bOpus\b").unwrap(), AudioCodec::Opus),
    ]
});

static CHANNELS_RX: Lazy<Regex> =
    Lazy::new(|| Regex::new(r"\b(7\.1|5\.1|6\.1|2\.1|2\.0)\b").unwrap());
static BIT_DEPTH_RX: Lazy<Regex> =
    Lazy::new(|| Regex::new(r"(?i)\b(8|10|12)\s*bit\b").unwrap());
static REPACK_RX: Lazy<Regex> =
    Lazy::new(|| Regex::new(r"(?i)\bREPACK(\d+)?\b").unwrap());
static REMUX_RX: Lazy<Regex> = Lazy::new(|| Regex::new(r"(?i)\bRemux\b").unwrap());
static HARDCODED_RX: Lazy<Regex> =
    Lazy::new(|| Regex::new(r"(?i)\b(HC|HARDCODED|HARDSUB)\b").unwrap());
static YEAR_RANGE_RX: Lazy<Regex> =
    Lazy::new(|| Regex::new(r"\b(19\d\d|20\d\d)[\-\.](19\d\d|20\d\d)\b").unwrap());
static DISC_RX: Lazy<Regex> = Lazy::new(|| Regex::new(r"(?i)\bDISC\s*(\d+)\b").unwrap());
static EDITION_RX: Lazy<Regex> = Lazy::new(|| {
    Regex::new(
        r"(?i)\b(IMAX|EXTENDED|DIRECTORS?[.\s]?CUT|THEATRICAL|UNRATED|UNCUT|REMASTERED|RESTORATION|CRITERION|OPEN[.\s]?MATTE|HYBRID)\b",
    ).unwrap()
});

static QUALITY_STOP_RX: Lazy<Regex> = Lazy::new(|| {
    Regex::new(
        r"(?i)\.(?:480p|576p|720p|1080p|1440p|2160p|4k|uhd|hdr|hdr10|dv|dovi|bluray|bdrip|brrip|web[\.\-]?dl|webrip|hdrip|hdtv|remux|cam|ts|hdts|tc|scr|x264|x265|hevc|avc|h\.?264|h\.?265|av1|aac|ac3|ddp?|eac3|dts|truehd|atmos|flac|opus|10bit|8bit|repack|proper|extended|directors?|imax|hybrid|hdr10\+|repack\d?|multi|dual|dubbed|sub|subbed|complete|amzn|nf|hulu|max|atvp|dsnp)",
    ).unwrap()
});

static FN_TORRENTIO_PREFIX_RX: Lazy<Regex> = Lazy::new(|| {
    Regex::new(
        r"(?i)^(?:torrentio|comet|mediafusion|aiostreams|knightcrawler|jackettio|torbox)\b",
    )
    .unwrap()
});
static FN_QUALITY_ONLY_RX: Lazy<Regex> =
    Lazy::new(|| Regex::new(r"(?i)^(?:4k|1080p|720p|480p|sd|hd|hdr|dv|uhd)$").unwrap());
static FN_NOISE_LEAD_RX: Lazy<Regex> = Lazy::new(|| {
    Regex::new(r"^[\x{1F464}\x{1F465}\x{1F4BE}\x{1F4E6}\x{26A1}\x{1F310}\x{1F4FA}\x{1F3AC}\x{1F50A}]")
        .unwrap()
});
static FN_LABEL_PREFIX_RX: Lazy<Regex> = Lazy::new(|| {
    Regex::new(r"(?i)^(?:size|seeders?|peers?|languages?)\s*[:=]").unwrap()
});
static FN_LIBRARY_LABEL_RX: Lazy<Regex> = Lazy::new(|| {
    Regex::new(r"(?i)^\[(?:RD|TB|AD|PM|DL)\+\]\s+\S+\s+library").unwrap()
});
static FN_YEAR_RX: Lazy<Regex> = Lazy::new(|| Regex::new(r"\b(?:19|20)\d{2}\b").unwrap());
static FN_RES_NUM_RX: Lazy<Regex> = Lazy::new(|| Regex::new(r"(?i)\b\d{3,4}p\b").unwrap());
static FN_RES_4K_RX: Lazy<Regex> = Lazy::new(|| Regex::new(r"(?i)\b(?:4k|uhd|2160p)\b").unwrap());
static FN_EPISODE_RX: Lazy<Regex> =
    Lazy::new(|| Regex::new(r"(?i)\bS\d{1,2}E\d{1,3}\b").unwrap());
static FN_SOURCE_RX: Lazy<Regex> = Lazy::new(|| {
    Regex::new(r"(?i)\b(?:Blu[\.\-]?Ray|WEB[\.\-]?DL|WEBRip|HDRip|BDRip|HDTV|REMUX|Remux|HDCAM|TELESYNC|TELECINE|CAM|HDTS|DVDRip)\b").unwrap()
});
static FN_CODEC_RX: Lazy<Regex> = Lazy::new(|| {
    Regex::new(r"(?i)\b(?:x264|x265|HEVC|AVC|h264|h265|AV1|MPEG2|MPEG-2)\b").unwrap()
});
static FN_CONTAINER_RX: Lazy<Regex> =
    Lazy::new(|| Regex::new(r"(?i)\.(?:mkv|mp4|m4v|avi|ts)\b").unwrap());

static SEASON_PACK_RX: Lazy<Regex> = Lazy::new(|| {
    Regex::new(r"(?i)\b(complete|season[\s\.]?pack|s\d{1,2})\b").unwrap()
});
static SEASON_PACK_BARE_S_RX: Lazy<Regex> =
    Lazy::new(|| Regex::new(r"(?i)\bs\d{1,2}E").unwrap());

static EPTITLE_TRIM_LEAD_RX: Lazy<Regex> =
    Lazy::new(|| Regex::new(r"^[\.\-_\s]+").unwrap());
static EPTITLE_DOTS_RX: Lazy<Regex> = Lazy::new(|| Regex::new(r"[\.\-_]+").unwrap());
static EPTITLE_SPACES_RX: Lazy<Regex> = Lazy::new(|| Regex::new(r"\s+").unwrap());
static EPTITLE_BAD_RX: Lazy<Regex> =
    Lazy::new(|| Regex::new(r"(?i)^(?:e\d+|episode|hdtv|webrip)$").unwrap());

static GROUP_NORMALIZE_RX: Lazy<Regex> = Lazy::new(|| Regex::new(r"[^A-Z0-9]").unwrap());

static INVISIBLE_RX: Lazy<Regex> = Lazy::new(|| {
    Regex::new(r"[\x{200B}-\x{200D}\x{2060}\x{FEFF}]").unwrap()
});
static VARIATION_SELECTOR_RX: Lazy<Regex> =
    Lazy::new(|| Regex::new(r"\x{FE0F}").unwrap());

static COMET_BINGE_RX: Lazy<Regex> =
    Lazy::new(|| Regex::new(r"(?i)^comet\|([a-z\-]+)\|").unwrap());

static URL_HTTP_RX: Lazy<Regex> = Lazy::new(|| Regex::new(r"(?i)^https?://").unwrap());
static URL_DEBRID_RX: Lazy<Regex> = Lazy::new(|| {
    Regex::new(r"(?i)(?:realdebrid|real-debrid|torbox|alldebrid|premiumize|debridlink|debrid-link|elfhosted)").unwrap()
});
static DEBRID_AWARE_ADDON_RX: Lazy<Regex> = Lazy::new(|| {
    Regex::new(r"(?i)(?:mediafusion|comet|torrentio|aiostreams|knightcrawler|jackettio|streamfusion|easynews)").unwrap()
});

static MF_TRB_RX: Lazy<Regex> =
    Lazy::new(|| Regex::new(r"(?i)\bTRB\b|\bTorBox\b").unwrap());
static MF_TB_RX: Lazy<Regex> = Lazy::new(|| Regex::new(r"(?i)\bTB\b").unwrap());
static MF_RD_FULL_RX: Lazy<Regex> =
    Lazy::new(|| Regex::new(r"(?i)\bReal[\s\-]?Debrid\b").unwrap());
static MF_RD_RX: Lazy<Regex> = Lazy::new(|| Regex::new(r"(?i)\bRD\b").unwrap());
static MF_AD_FULL_RX: Lazy<Regex> = Lazy::new(|| Regex::new(r"(?i)\bAllDebrid\b").unwrap());
static MF_AD_RX: Lazy<Regex> = Lazy::new(|| Regex::new(r"(?i)\bAD\b").unwrap());
static MF_PM_FULL_RX: Lazy<Regex> = Lazy::new(|| Regex::new(r"(?i)\bPremiumize\b").unwrap());
static MF_PM_RX: Lazy<Regex> = Lazy::new(|| Regex::new(r"(?i)\bPM\b").unwrap());
static MF_DL_FULL_RX: Lazy<Regex> =
    Lazy::new(|| Regex::new(r"(?i)\bDebrid[\s\-]?Link\b").unwrap());
static MF_DL_RX: Lazy<Regex> = Lazy::new(|| Regex::new(r"(?i)\bDL\b").unwrap());

#[derive(Debug, Default, Clone)]
struct PttResult {
    title: String,
    year: Option<u16>,
    resolution: Option<String>,
    codec: Option<String>,
    season: Option<i32>,
    episode: Option<i32>,
    group: Option<String>,
    channels: Option<f64>,
    bitdepth: Option<u8>,
    repack: bool,
    proper: bool,
    hardcoded: bool,
    extended: bool,
    unrated: bool,
    theatrical: bool,
    uncut: bool,
    remastered: bool,
    criterion: bool,
    openmatte: bool,
}

fn ptt_parse(title: &str) -> PttResult {
    let mut r = PttResult::default();
    let mut end_of_title = title.len();

    macro_rules! note_idx {
        ($idx:expr) => {
            if let Some(i) = $idx {
                if i > 0 && i < end_of_title {
                    end_of_title = i;
                }
            }
        };
    }

    static PTT_YEAR_RX: Lazy<Regex> = Lazy::new(|| {
        Regex::new(r"[^a-zA-Z0-9][\(\[]?((?:19[0-9]|20[012])[0-9])[\)\]]?").unwrap()
    });
    if let Some(c) = PTT_YEAR_RX.captures(title) {
        if let Some(m) = c.get(1) {
            if let Ok(y) = m.as_str().parse::<u16>() {
                r.year = Some(y);
            }
            note_idx!(c.get(0).map(|m| m.start()));
        }
    }

    static PTT_RES_NUM_RX: Lazy<Regex> =
        Lazy::new(|| Regex::new(r"(?i)([0-9]{3,4}[pi])").unwrap());
    static PTT_RES_4K_RX: Lazy<Regex> = Lazy::new(|| Regex::new(r"(?i)\b(4k)").unwrap());
    static PTT_RES_1080_RX: Lazy<Regex> =
        Lazy::new(|| Regex::new(r"(?i)FHD|\b1080\b").unwrap());
    static PTT_RES_UHD_RX: Lazy<Regex> = Lazy::new(|| Regex::new(r"(?i)UHD").unwrap());
    if let Some(c) = PTT_RES_NUM_RX.captures(title) {
        r.resolution = Some(c.get(1).unwrap().as_str().to_lowercase());
        note_idx!(c.get(0).map(|m| m.start()));
    }
    if r.resolution.is_none() {
        if let Some(c) = PTT_RES_4K_RX.captures(title) {
            r.resolution = Some(c.get(1).unwrap().as_str().to_lowercase());
            note_idx!(c.get(0).map(|m| m.start()));
        }
    }
    if r.resolution.is_none() {
        if let Some(m) = PTT_RES_1080_RX.find(title) {
            r.resolution = Some("1080p".to_string());
            note_idx!(Some(m.start()));
        }
    }
    if r.resolution.is_none() {
        if let Some(m) = PTT_RES_UHD_RX.find(title) {
            r.resolution = Some("4k".to_string());
            note_idx!(Some(m.start()));
        }
    }

    static PTT_EXTENDED_RX: Lazy<Regex> =
        Lazy::new(|| Regex::new(r"(?i)EXTENDED(?:[\s.]CUT)?").unwrap());
    if let Some(m) = PTT_EXTENDED_RX.find(title) {
        r.extended = true;
        note_idx!(Some(m.start()));
    }

    static PTT_THEATRICAL_RX: Lazy<Regex> =
        Lazy::new(|| Regex::new(r"Theatrical(?:[. ]Cut)?").unwrap());
    if let Some(m) = PTT_THEATRICAL_RX.find(title) {
        r.theatrical = true;
        note_idx!(Some(m.start()));
    }

    static PTT_UNCUT_RX: Lazy<Regex> = Lazy::new(|| Regex::new(r"(?i).+\bUNCUT\b").unwrap());
    if let Some(m) = PTT_UNCUT_RX.find(title) {
        r.uncut = true;
        note_idx!(Some(m.start()));
    }

    static PTT_OPENMATTE_RX: Lazy<Regex> =
        Lazy::new(|| Regex::new(r"(?i)OPEN[. ]MATTE").unwrap());
    if let Some(m) = PTT_OPENMATTE_RX.find(title) {
        r.openmatte = true;
        note_idx!(Some(m.start()));
    }

    static PTT_HARDCODED_RX: Lazy<Regex> =
        Lazy::new(|| Regex::new(r"HC|HARDCODED").unwrap());
    if let Some(m) = PTT_HARDCODED_RX.find(title) {
        r.hardcoded = true;
        note_idx!(Some(m.start()));
    }

    static PTT_PROPER_RX: Lazy<Regex> =
        Lazy::new(|| Regex::new(r"(?i)\b(?:REAL.)?PROPER\b").unwrap());
    if let Some(m) = PTT_PROPER_RX.find(title) {
        r.proper = true;
        note_idx!(Some(m.start()));
    }

    static PTT_REPACK_RX: Lazy<Regex> =
        Lazy::new(|| Regex::new(r"(?i)REPACK|RERIP").unwrap());
    if let Some(m) = PTT_REPACK_RX.find(title) {
        r.repack = true;
        note_idx!(Some(m.start()));
    }

    static PTT_REMASTERED_RX: Lazy<Regex> =
        Lazy::new(|| Regex::new(r"(?i)\bRemaster(?:ed)?\b").unwrap());
    if let Some(m) = PTT_REMASTERED_RX.find(title) {
        r.remastered = true;
        note_idx!(Some(m.start()));
    }

    static PTT_UNRATED_RX: Lazy<Regex> =
        Lazy::new(|| Regex::new(r"(?i)\bunrated|uncensored\b").unwrap());
    if let Some(m) = PTT_UNRATED_RX.find(title) {
        r.unrated = true;
        note_idx!(Some(m.start()));
    }

    static PTT_CRITERION_RX: Lazy<Regex> =
        Lazy::new(|| Regex::new(r"\bCriterion\b").unwrap());
    if let Some(m) = PTT_CRITERION_RX.find(title) {
        r.criterion = true;
        note_idx!(Some(m.start()));
    }

    static PTT_CODEC_265_RX: Lazy<Regex> =
        Lazy::new(|| Regex::new(r"(?i)h[-. ]?265|hevc").unwrap());
    static PTT_CODEC_264_RX: Lazy<Regex> =
        Lazy::new(|| Regex::new(r"(?i)h[-. ]?264|avc").unwrap());
    static PTT_CODEC_OTHER_RX: Lazy<Regex> = Lazy::new(|| {
        Regex::new(r"(?i)dvix|mpeg2|divx|xvid|x[-. ]?26[45]").unwrap()
    });
    if let Some(m) = PTT_CODEC_265_RX.find(title) {
        r.codec = Some("h265".to_string());
        note_idx!(Some(m.start()));
    } else if let Some(m) = PTT_CODEC_264_RX.find(title) {
        r.codec = Some("h264".to_string());
        note_idx!(Some(m.start()));
    } else if let Some(m) = PTT_CODEC_OTHER_RX.find(title) {
        let raw = m.as_str().to_lowercase();
        let cleaned: String = raw.chars().filter(|c| !matches!(*c, ' ' | '.' | '-')).collect();
        r.codec = Some(cleaned);
        note_idx!(Some(m.start()));
    }

    static PTT_CHANNELS_DOT_RX: Lazy<Regex> =
        Lazy::new(|| Regex::new(r"\d+[.\s](?:1|0)\b").unwrap());
    static PTT_CHANNELS_2CH_RX: Lazy<Regex> = Lazy::new(|| Regex::new(r"2(?:ch)").unwrap());
    static PTT_CHANNELS_6CH_RX: Lazy<Regex> = Lazy::new(|| Regex::new(r"6(?:ch)").unwrap());
    static PTT_CHANNELS_8CH_RX: Lazy<Regex> = Lazy::new(|| Regex::new(r"8(?:ch)").unwrap());
    if let Some(m) = PTT_CHANNELS_DOT_RX.find(title) {
        let s = m.as_str().replace(' ', ".");
        if let Ok(v) = s.parse::<f64>() {
            r.channels = Some(v);
        }
        note_idx!(Some(m.start()));
    }
    if r.channels.is_none() {
        if let Some(m) = PTT_CHANNELS_2CH_RX.find(title) {
            r.channels = Some(2.0);
            note_idx!(Some(m.start()));
        } else if let Some(m) = PTT_CHANNELS_6CH_RX.find(title) {
            r.channels = Some(5.1);
            note_idx!(Some(m.start()));
        } else if let Some(m) = PTT_CHANNELS_8CH_RX.find(title) {
            r.channels = Some(7.1);
            note_idx!(Some(m.start()));
        }
    }

    static PTT_BITDEPTH_RX: Lazy<Regex> =
        Lazy::new(|| Regex::new(r"(?i)\b(8|10|12|16|24)[-\s.]?bits?\b").unwrap());
    if let Some(c) = PTT_BITDEPTH_RX.captures(title) {
        if let Some(m) = c.get(1) {
            if let Ok(v) = m.as_str().parse::<u8>() {
                r.bitdepth = Some(v);
            }
        }
        note_idx!(c.get(0).map(|m| m.start()));
    }

    static PTT_GROUP_RX: Lazy<Regex> = Lazy::new(|| {
        Regex::new(r"(?i)-[ \(\[]*(?:\w+[ \]\)]+)?(\w+(?:\.\w+)?)[\)\]]?(?:\.(?:mkv|mp4))?$")
            .unwrap()
    });
    if let Some(c) = PTT_GROUP_RX.captures(title) {
        if let Some(m) = c.get(1) {
            let candidate = m.as_str();
            let lc = candidate.to_lowercase();
            if lc != "mkv" && lc != "mp4" {
                r.group = Some(candidate.to_string());
                note_idx!(c.get(0).map(|m| m.start()));
            }
        }
    }

    static PTT_SEASON_XALL_RX: Lazy<Regex> =
        Lazy::new(|| Regex::new(r"(?i)([0-9]{1,2})xall").unwrap());
    static PTT_SEASON_SE_RX: Lazy<Regex> =
        Lazy::new(|| Regex::new(r"(?i)S([0-9]{1,2}) ?E[0-9]{1,2}").unwrap());
    static PTT_SEASON_X_RX: Lazy<Regex> =
        Lazy::new(|| Regex::new(r"([0-9]{1,2})x[0-9]{1,2}").unwrap());
    static PTT_SEASON_WORD_RX: Lazy<Regex> =
        Lazy::new(|| Regex::new(r"(?i)(?:Saison|Season)[. _-]?([0-9]{1,2})").unwrap());
    static PTT_SEASON_S_RX: Lazy<Regex> =
        Lazy::new(|| Regex::new(r"(?i)\bS([0-9]{1,2})([0-9])?").unwrap());
    if let Some(c) = PTT_SEASON_XALL_RX.captures(title) {
        if let Some(m) = c.get(1) {
            r.season = m.as_str().parse().ok();
            note_idx!(c.get(0).map(|m| m.start()));
        }
    }
    if r.season.is_none() {
        if let Some(c) = PTT_SEASON_SE_RX.captures(title) {
            if let Some(m) = c.get(1) {
                r.season = m.as_str().parse().ok();
                note_idx!(c.get(0).map(|m| m.start()));
            }
        }
    }
    if r.season.is_none() {
        if let Some(c) = PTT_SEASON_X_RX.captures(title) {
            if let Some(m) = c.get(1) {
                r.season = m.as_str().parse().ok();
                note_idx!(c.get(0).map(|m| m.start()));
            }
        }
    }
    if r.season.is_none() {
        if let Some(c) = PTT_SEASON_WORD_RX.captures(title) {
            if let Some(m) = c.get(1) {
                r.season = m.as_str().parse().ok();
                note_idx!(c.get(0).map(|m| m.start()));
            }
        }
    }
    if r.season.is_none() {
        if let Some(c) = PTT_SEASON_S_RX.captures(title) {
            if c.get(2).is_none() {
                if let Some(m) = c.get(1) {
                    r.season = m.as_str().parse().ok();
                    note_idx!(c.get(0).map(|m| m.start()));
                }
            }
        }
    }

    static PTT_EPISODE_SE_RX: Lazy<Regex> =
        Lazy::new(|| Regex::new(r"(?i)S[0-9]{1,2} ?E([0-9]{1,5})").unwrap());
    static PTT_EPISODE_X_RX: Lazy<Regex> =
        Lazy::new(|| Regex::new(r"[0-9]{1,2}x([0-9]{1,5})").unwrap());
    static PTT_EPISODE_EP_RX: Lazy<Regex> = Lazy::new(|| {
        Regex::new(r"(?i)[e\u{00E9}]p(?:isode)?[. _-]?([0-9]{1,5})").unwrap()
    });
    if let Some(c) = PTT_EPISODE_SE_RX.captures(title) {
        if let Some(m) = c.get(1) {
            r.episode = m.as_str().parse().ok();
            note_idx!(c.get(0).map(|m| m.start()));
        }
    }
    if r.episode.is_none() {
        if let Some(c) = PTT_EPISODE_X_RX.captures(title) {
            if let Some(m) = c.get(1) {
                r.episode = m.as_str().parse().ok();
                note_idx!(c.get(0).map(|m| m.start()));
            }
        }
    }
    if r.episode.is_none() {
        if let Some(c) = PTT_EPISODE_EP_RX.captures(title) {
            if let Some(m) = c.get(1) {
                r.episode = m.as_str().parse().ok();
                note_idx!(c.get(0).map(|m| m.start()));
            }
        }
    }

    let raw_title = if end_of_title <= title.len() {
        let mut cut = end_of_title;
        while cut > 0 && !title.is_char_boundary(cut) {
            cut -= 1;
        }
        &title[..cut]
    } else {
        title
    };
    r.title = clean_title(raw_title);
    r
}

fn clean_title(raw: &str) -> String {
    let mut s = raw.to_string();
    while s.starts_with('.') {
        s.remove(0);
    }
    while s.ends_with('.') {
        s.pop();
    }
    if !s.contains(' ') && s.contains('.') {
        s = s.replace('.', " ");
    }
    s = s.replace('_', " ");
    let s = s.trim_end_matches(['(', '_']);
    let s = s.strip_suffix("- ").unwrap_or(s);
    s.trim().to_string()
}

pub fn parse_stream(stream: Stream) -> ParsedStream {
    let filename_line = extract_filename_line(&stream);
    let mut text_parts: Vec<&str> = Vec::new();
    if !filename_line.is_empty() {
        text_parts.push(&filename_line);
    }
    if let Some(t) = stream.title.as_deref() {
        if !t.is_empty() {
            text_parts.push(t);
        }
    }
    if let Some(d) = stream.description.as_deref() {
        if !d.is_empty() {
            text_parts.push(d);
        }
    }
    if let Some(n) = stream.name.as_deref() {
        if !n.is_empty() {
            text_parts.push(n);
        }
    }
    let text = text_parts.join(" ");
    let ptt_input = if !filename_line.is_empty() {
        filename_line.as_str()
    } else {
        text.as_str()
    };
    let ptt = ptt_parse(ptt_input);

    let resolution = map_resolution(ptt.resolution.as_deref());
    let hdr_format = detect_hdr(&text);
    let codec = map_codec(ptt.codec.as_deref().unwrap_or(""));
    let source = detect_source(&text);
    let audio = parse_audio(&text, &ptt);
    let audio_languages = parse_languages(&text);
    let video_size_hint = stream
        .behavior_hints
        .as_ref()
        .and_then(|v| v.get("videoSize"))
        .and_then(|v| v.as_u64());
    let size = parse_size(&text, video_size_hint);
    let seeders = parse_seeders(&text);
    let binge_group = stream
        .behavior_hints
        .as_ref()
        .and_then(|v| v.get("bingeGroup"))
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());
    let cached = parse_cache_flags(
        &text,
        binge_group.as_deref(),
        Some(stream.addon_name.as_str()),
        stream.url.as_deref(),
    );
    let in_library: BTreeMap<String, bool> = BTreeMap::new();
    let filename_hint = stream
        .behavior_hints
        .as_ref()
        .and_then(|v| v.get("filename").or_else(|| v.get("fileName")))
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());
    let container = parse_container(filename_hint.as_deref(), &filename_line, &text);
    let release_group = ptt.group.clone();
    let release_group_normalized = release_group.as_ref().map(|g| {
        let upper = g.to_uppercase();
        GROUP_NORMALIZE_RX.replace_all(&upper, "").into_owned()
    });
    let remux = REMUX_RX.is_match(&text);
    let edition = parse_edition(&text, &ptt);
    let year = ptt.year;
    let year_range = parse_year_range(&text);
    let season = ptt.season;
    let episode = ptt.episode;
    let season_pack = parse_season_pack(&text, &ptt);
    let disc_index = parse_disc(&text);
    let repack_iteration = parse_repack_iteration(&text, &ptt);
    let proper = ptt.proper;
    let hardcoded = HARDCODED_RX.is_match(&text) || ptt.hardcoded;
    let anime_hash = parse_anime_hash(&text);
    let scam_score = compute_scam_score(source, resolution, size);

    let parsed_title = if !ptt.title.is_empty() {
        ptt.title.clone()
    } else if !filename_line.is_empty() {
        slice_chars(&filename_line, 100)
    } else {
        slice_chars(&text, 100)
    };
    let episode_title = parse_episode_title(&filename_line, ptt.season, ptt.episode);

    ParsedStream {
        stream,
        parsed_title,
        episode_title,
        resolution,
        hdr_format,
        codec,
        source,
        audio,
        audio_languages,
        size,
        seeders,
        cached,
        in_library,
        container,
        release_group,
        release_group_normalized,
        remux,
        edition,
        year,
        year_range,
        season,
        episode,
        season_pack,
        disc_index,
        repack_iteration,
        proper,
        hardcoded,
        anime_hash,
        scam_score,
    }
}

fn slice_chars(s: &str, n: usize) -> String {
    s.chars().take(n).collect()
}

pub fn is_trusted_group(normalized: Option<&str>) -> bool {
    matches!(normalized, Some(n) if TRUSTED_GROUPS.contains(n))
}

fn map_resolution(r: Option<&str>) -> Resolution {
    let Some(r) = r else { return Resolution::SD };
    let lower = r.to_lowercase();
    if lower.contains("2160") || lower == "4k" || lower == "uhd" {
        return Resolution::UHD;
    }
    if lower.contains("1080") {
        return Resolution::P1080;
    }
    if lower.contains("720") {
        return Resolution::P720;
    }
    if lower.contains("480") {
        return Resolution::P480;
    }
    Resolution::SD
}

fn detect_hdr(text: &str) -> Option<HdrFormat> {
    for (rx, label) in HDR_FORMATS.iter() {
        if rx.is_match(text) {
            return Some(*label);
        }
    }
    None
}

fn map_codec(c: &str) -> Codec {
    let lower = c.to_lowercase();
    if lower.contains("265") || lower == "hevc" {
        return Codec::Hevc;
    }
    if lower.contains("264") || lower == "avc" {
        return Codec::Avc;
    }
    if lower.contains("av1") {
        return Codec::Av1;
    }
    if lower.contains("vp9") {
        return Codec::Vp9;
    }
    if lower.contains("mpeg") {
        return Codec::Mpeg2;
    }
    Codec::Other
}

fn detect_source(text: &str) -> Source {
    for (rx, label) in SOURCE_RX.iter() {
        if rx.is_match(text) {
            return *label;
        }
    }
    Source::Other
}

fn parse_audio(text: &str, ptt: &PttResult) -> AudioInfo {
    let mut codec = AudioCodec::Other;
    for (rx, label) in AUDIO_CODEC_RX.iter() {
        if rx.is_match(text) {
            codec = *label;
            break;
        }
    }
    let channels = if let Some(c) = CHANNELS_RX.captures(text) {
        map_channels(c.get(1).unwrap().as_str())
    } else if let Some(ch) = ptt.channels {
        // PTT returns numeric channels like 5.1 - map same as label
        map_channels(&format_channels(ch))
    } else {
        2
    };
    let bit_depth = if let Some(c) = BIT_DEPTH_RX.captures(text) {
        c.get(1).unwrap().as_str().parse::<u8>().ok()
    } else {
        ptt.bitdepth
    };
    AudioInfo {
        codec,
        channels,
        bit_depth,
    }
}

fn format_channels(v: f64) -> String {
    if (v - 7.1).abs() < 0.05 {
        "7.1".to_string()
    } else if (v - 6.1).abs() < 0.05 {
        "6.1".to_string()
    } else if (v - 5.1).abs() < 0.05 {
        "5.1".to_string()
    } else if (v - 2.1).abs() < 0.05 {
        "2.1".to_string()
    } else if (v - 2.0).abs() < 0.05 {
        "2.0".to_string()
    } else {
        format!("{}", v)
    }
}

fn map_channels(label: &str) -> u16 {
    match label {
        "7.1" => 8,
        "6.1" => 7,
        "5.1" => 6,
        "2.1" => 3,
        _ => 2,
    }
}

fn parse_languages(text: &str) -> Vec<String> {
    let mut out: Vec<String> = Vec::new();
    let mut seen: HashSet<String> = HashSet::new();
    let add = |s: &str, out: &mut Vec<String>, seen: &mut HashSet<String>| {
        if seen.insert(s.to_string()) {
            out.push(s.to_string());
        }
    };

    for m in LANG_RX.find_iter(text) {
        let upper = m.as_str().to_uppercase();
        if let Some(mapped) = LANG_TOKENS.get(upper.as_str()) {
            add(mapped, &mut out, &mut seen);
        } else if upper == "MULTI" || upper == "DUAL" {
            add("Multi", &mut out, &mut seen);
        }
    }

    for m in FLAG_RX.find_iter(text) {
        let chars: Vec<char> = m.as_str().chars().collect();
        if chars.len() < 2 {
            continue;
        }
        let a = chars[0] as u32;
        let b = chars[1] as u32;
        let ca = (a as i64 - 0x1f1e6_i64) + 65;
        let cb = (b as i64 - 0x1f1e6_i64) + 65;
        if !(65..=90).contains(&ca) || !(65..=90).contains(&cb) {
            continue;
        }
        let code: String = vec![ca as u8 as char, cb as u8 as char].into_iter().collect();
        if let Some(lang) = FLAG_TO_LANGUAGE.get(code.as_str()) {
            add(lang, &mut out, &mut seen);
        }
    }

    for c in ISO_PAIR_RX.captures_iter(text) {
        if let Some(m) = c.get(1) {
            let upper = m.as_str().to_uppercase();
            if let Some(lang) = ISO_PAIR_TO_LANGUAGE.get(upper.as_str()) {
                add(lang, &mut out, &mut seen);
            }
        }
    }

    let concrete: Vec<String> = out.iter().filter(|l| l.as_str() != "Multi").cloned().collect();
    if concrete.len() > 1 {
        let mut v = vec!["Multi".to_string()];
        v.extend(concrete);
        return v;
    }
    if concrete.len() == 1 {
        return concrete;
    }
    if seen.contains("Multi") {
        return vec!["Multi".to_string()];
    }
    Vec::new()
}

fn parse_episode_title(filename: &str, season: Option<i32>, episode: Option<i32>) -> Option<String> {
    let (Some(s), Some(e)) = (season, episode) else {
        return None;
    };
    let code = format!("S{:02}E{:02}", s, e);
    let upper = filename.to_uppercase();
    let idx = upper.find(&code)?;
    let mut after_bytes_offset = idx + code.len();
    while after_bytes_offset < filename.len() && !filename.is_char_boundary(after_bytes_offset) {
        after_bytes_offset += 1;
    }
    let after = &filename[after_bytes_offset..];
    let after = EPTITLE_TRIM_LEAD_RX.replace(after, "").into_owned();
    let cut = if let Some(m) = QUALITY_STOP_RX.find(&after) {
        m.start()
    } else {
        after.len()
    };
    let after = if cut > 0 { &after[..cut] } else { &after };
    let cleaned = EPTITLE_DOTS_RX.replace_all(after, " ");
    let cleaned = EPTITLE_SPACES_RX.replace_all(&cleaned, " ").trim().to_string();
    if cleaned.chars().count() < 2 || cleaned.chars().count() > 80 {
        return None;
    }
    if EPTITLE_BAD_RX.is_match(&cleaned) {
        return None;
    }
    Some(cleaned)
}

fn parse_container(
    filename_hint: Option<&str>,
    filename_line: &str,
    text: &str,
) -> Option<Container> {
    for src in [filename_hint, Some(filename_line), Some(text)].into_iter().flatten() {
        if src.is_empty() {
            continue;
        }
        if let Some(c) = CONTAINER_RX.captures(src) {
            let lower = c.get(1).unwrap().as_str().to_lowercase();
            return match lower.as_str() {
                "mkv" => Some(Container::Mkv),
                "mp4" => Some(Container::Mp4),
                "m4v" => Some(Container::M4v),
                "avi" => Some(Container::Avi),
                "webm" => Some(Container::Webm),
                "mov" => Some(Container::Mov),
                "ts" => Some(Container::Ts),
                "wmv" => Some(Container::Wmv),
                _ => None,
            };
        }
    }
    None
}

fn extract_filename_line(stream: &Stream) -> String {
    let mut lines: Vec<String> = Vec::new();
    let filename = stream
        .behavior_hints
        .as_ref()
        .and_then(|v| {
            v.get("filename")
                .and_then(|x| x.as_str())
                .or_else(|| v.get("fileName").and_then(|x| x.as_str()))
        })
        .map(|s| s.to_string());
    let mut sources: Vec<&str> = Vec::new();
    if let Some(t) = stream.title.as_deref() {
        if !t.is_empty() {
            sources.push(t);
        }
    }
    if let Some(f) = filename.as_deref() {
        if !f.is_empty() {
            sources.push(f);
        }
    }
    if let Some(d) = stream.description.as_deref() {
        if !d.is_empty() {
            sources.push(d);
        }
    }
    if let Some(n) = stream.name.as_deref() {
        if !n.is_empty() {
            sources.push(n);
        }
    }

    for raw in sources {
        for line in raw.split(['\n', '\r']) {
            if line.is_empty() {
                continue;
            }
            let stripped = TORRENTIO_NOISE_PREFIX_RX.replace(line, "");
            let stripped = TORRENTIO_NOISE_SUFFIX_RX.replace(&stripped, "");
            let trimmed = stripped.trim();
            if !trimmed.is_empty() {
                lines.push(trimmed.to_string());
            }
        }
    }

    let mut best = String::new();
    let mut best_score = i64::MIN;
    for line in &lines {
        let s = filename_score(line);
        if s > best_score {
            best_score = s;
            best = line.clone();
        }
    }
    best
}

fn filename_score(line: &str) -> i64 {
    if line.chars().count() < 8 {
        return -100;
    }
    if FN_TORRENTIO_PREFIX_RX.is_match(line) {
        return -100;
    }
    if FN_QUALITY_ONLY_RX.is_match(line) {
        return -100;
    }
    if FN_NOISE_LEAD_RX.is_match(line) {
        return -100;
    }
    if FN_LABEL_PREFIX_RX.is_match(line) {
        return -50;
    }
    if FN_LIBRARY_LABEL_RX.is_match(line) {
        return -50;
    }
    let has_year = FN_YEAR_RX.is_match(line);
    let has_resolution = FN_RES_NUM_RX.is_match(line) || FN_RES_4K_RX.is_match(line);
    let has_episode = FN_EPISODE_RX.is_match(line);
    let has_source = FN_SOURCE_RX.is_match(line);
    let has_codec = FN_CODEC_RX.is_match(line);
    let has_container = FN_CONTAINER_RX.is_match(line);
    let has_dots = line.matches('.').count() >= 3;
    let technical_markers = [
        has_year,
        has_resolution,
        has_episode,
        has_source,
        has_codec,
        has_container,
        has_dots,
    ]
    .iter()
    .filter(|x| **x)
    .count();
    if technical_markers == 0 {
        return -20;
    }
    let mut s: i64 = 0;
    if line.chars().count() >= 20 {
        s += 2;
    }
    if has_dots {
        s += 3;
    }
    if has_year {
        s += 2;
    }
    if has_resolution {
        s += 2;
    }
    if has_episode {
        s += 3;
    }
    if has_source {
        s += 3;
    }
    if has_codec {
        s += 1;
    }
    if has_container {
        s += 2;
    }
    s
}

fn parse_size(text: &str, hint: Option<u64>) -> Option<u64> {
    if let Some(h) = hint {
        if h > 0 {
            return Some(h);
        }
    }
    let c = SIZE_RX.captures(text)?;
    let n: f64 = c.get(1)?.as_str().parse().ok()?;
    let unit = c.get(2)?.as_str().to_lowercase();
    let bytes = if unit.starts_with('t') {
        n * (1024f64.powi(4))
    } else if unit.starts_with('g') {
        n * (1024f64.powi(3))
    } else if unit.starts_with('m') {
        n * (1024f64.powi(2))
    } else {
        return None;
    };
    Some(bytes.round() as u64)
}

fn parse_seeders(text: &str) -> Option<u32> {
    let c = SEEDERS_RX.captures(text)?;
    c.get(1)?.as_str().parse().ok()
}

fn strip_invisibles(text: &str) -> String {
    let s = INVISIBLE_RX.replace_all(text, "");
    VARIATION_SELECTOR_RX.replace_all(&s, "").into_owned()
}

fn parse_cache_flags(
    raw_text: &str,
    binge_group: Option<&str>,
    addon_name: Option<&str>,
    url: Option<&str>,
) -> BTreeMap<String, bool> {
    let text = strip_invisibles(raw_text);
    let mut out: BTreeMap<String, bool> = BTreeMap::new();
    let mut denied: HashSet<String> = HashSet::new();
    let mark_uncached = |slug: &str, out: &mut BTreeMap<String, bool>, denied: &mut HashSet<String>| {
        denied.insert(slug.to_string());
        out.insert(slug.to_string(), false);
    };

    if RD_UNCACHED_RX.is_match(&text) {
        mark_uncached("rd", &mut out, &mut denied);
    }
    if TB_UNCACHED_RX.is_match(&text) {
        mark_uncached("tb", &mut out, &mut denied);
    }
    if AD_UNCACHED_RX.is_match(&text) {
        mark_uncached("ad", &mut out, &mut denied);
    }
    if PM_UNCACHED_RX.is_match(&text) {
        mark_uncached("pm", &mut out, &mut denied);
    }
    if DL_UNCACHED_RX.is_match(&text) {
        mark_uncached("dl", &mut out, &mut denied);
    }
    if let Some(c) = JACKETTIO_BARE_UNCACHED_RX.captures(&text) {
        if let Some(slug) = service_name_to_slug(c.get(1).unwrap().as_str()) {
            mark_uncached(slug, &mut out, &mut denied);
        }
    }
    if let Some(c) = STREAMFUSION_UNCACHED_SERVICE_RX.captures(&text) {
        if let Some(m) = c.get(1) {
            if let Some(slug) = service_name_to_slug(m.as_str().trim()) {
                mark_uncached(slug, &mut out, &mut denied);
            }
        }
    }
    if let Some(c) = SERVICE_UNCACHED_RX.captures(&text) {
        if let Some(slug) = service_name_to_slug(c.get(1).unwrap().as_str()) {
            mark_uncached(slug, &mut out, &mut denied);
        }
    }

    if AIOSTREAMS_PRISM_UNCACHED_RX.is_match(&text)
        || AIOSTREAMS_GDRIVE_UNCACHED_RX.is_match(&text)
        || MEDIAFUSION_UNCACHED_RX.is_match(&text)
    {
        let slug = binge_group
            .and_then(comet_service_from)
            .or_else(|| mediafusion_abbrev_slug(&text))
            .or_else(|| addon_name_slug(addon_name));
        if let Some(slug) = slug {
            mark_uncached(slug, &mut out, &mut denied);
        }
    }

    let cache_set = |slug: &str, out: &mut BTreeMap<String, bool>, denied: &HashSet<String>| {
        if !denied.contains(slug) {
            out.insert(slug.to_string(), true);
        }
    };

    if RD_CACHE_RX.is_match(&text) {
        cache_set("rd", &mut out, &denied);
    }
    if TB_CACHE_RX.is_match(&text) {
        cache_set("tb", &mut out, &denied);
    }
    if AD_CACHE_RX.is_match(&text) {
        cache_set("ad", &mut out, &denied);
    }
    if PM_CACHE_RX.is_match(&text) {
        cache_set("pm", &mut out, &denied);
    }
    if DL_CACHE_RX.is_match(&text) {
        cache_set("dl", &mut out, &denied);
    }

    if let Some(c) = STREAMFUSION_SERVICE_RX.captures(&text) {
        if let Some(m) = c.get(1) {
            if let Some(slug) = service_name_to_slug(m.as_str().trim()) {
                if !denied.contains(slug) {
                    out.insert(slug.to_string(), true);
                }
            }
        }
    }

    if let Some(c) = SERVICE_CACHED_RX.captures(&text) {
        if let Some(slug) = service_name_to_slug(c.get(1).unwrap().as_str()) {
            if !denied.contains(slug) {
                out.insert(slug.to_string(), true);
            }
        }
    }

    let template_cached = AIOSTREAMS_PRISM_CACHED_RX.is_match(&text)
        || AIOSTREAMS_TORBOX_CACHED_RX.is_match(&text)
        || AIOSTREAMS_GDRIVE_CACHED_RX.is_match(&text)
        || STREAMFUSION_CACHED_RX.is_match(&text)
        || MEDIAFUSION_CACHED_RX.is_match(&text);
    if template_cached {
        let slug = binge_group
            .and_then(comet_service_from)
            .or_else(|| mediafusion_abbrev_slug(&text))
            .or_else(|| addon_name_slug(addon_name));
        if let Some(slug) = slug {
            if !denied.contains(slug) && !out.get(slug).copied().unwrap_or(false) {
                out.insert(slug.to_string(), true);
            }
        }
    }

    if let (Some(url), Some(name)) = (url, addon_name) {
        if let Some(slug) = addon_name_slug(Some(name)).or_else(|| url_debrid_slug(Some(url))) {
            if !denied.contains(slug) && !out.get(slug).copied().unwrap_or(false) {
                let is_http = URL_HTTP_RX.is_match(url);
                let looks_debrid = URL_DEBRID_RX.is_match(url);
                if is_http && (looks_debrid || is_debrid_aware_addon(name)) {
                    out.insert(slug.to_string(), true);
                }
            }
        }
    }

    out
}

fn mediafusion_abbrev_slug(text: &str) -> Option<&'static str> {
    if MF_TRB_RX.is_match(text) {
        return Some("tb");
    }
    if check_word_isolated(text, &MF_TB_RX) {
        return Some("tb");
    }
    if MF_RD_FULL_RX.is_match(text) {
        return Some("rd");
    }
    if check_word_isolated(text, &MF_RD_RX) {
        return Some("rd");
    }
    if MF_AD_FULL_RX.is_match(text) {
        return Some("ad");
    }
    if check_word_isolated(text, &MF_AD_RX) {
        return Some("ad");
    }
    if MF_PM_FULL_RX.is_match(text) {
        return Some("pm");
    }
    if check_word_isolated(text, &MF_PM_RX) {
        return Some("pm");
    }
    if MF_DL_FULL_RX.is_match(text) {
        return Some("dl");
    }
    if check_word_isolated(text, &MF_DL_RX) {
        return Some("dl");
    }
    None
}

fn check_word_isolated(text: &str, rx: &Regex) -> bool {
    for m in rx.find_iter(text) {
        let end = m.end();
        let next_char = text[end..].chars().next();
        let is_word = matches!(next_char, Some(c) if c.is_ascii_alphanumeric() || c == '_');
        if !is_word {
            return true;
        }
    }
    false
}

fn url_debrid_slug(url: Option<&str>) -> Option<&'static str> {
    let url = url?;
    let lower = url.to_lowercase();
    if lower.contains("torbox") {
        return Some("tb");
    }
    if lower.contains("realdebrid") || lower.contains("real-debrid") {
        return Some("rd");
    }
    if lower.contains("alldebrid") {
        return Some("ad");
    }
    if lower.contains("premiumize") {
        return Some("pm");
    }
    if lower.contains("debridlink") || lower.contains("debrid-link") {
        return Some("dl");
    }
    None
}

fn addon_name_slug(name: Option<&str>) -> Option<&'static str> {
    let name = name?;
    let lower = name.to_lowercase();
    static A_TORBOX_RX: Lazy<Regex> = Lazy::new(|| Regex::new(r"torbox|trb").unwrap());
    static A_RD_RX: Lazy<Regex> =
        Lazy::new(|| Regex::new(r"real[\s\-]?debrid|\brd\b").unwrap());
    static A_AD_RX: Lazy<Regex> =
        Lazy::new(|| Regex::new(r"all[\s\-]?debrid|\bad\b").unwrap());
    static A_PM_RX: Lazy<Regex> = Lazy::new(|| Regex::new(r"premiumize|\bpm\b").unwrap());
    static A_DL_RX: Lazy<Regex> =
        Lazy::new(|| Regex::new(r"debrid[\s\-]?link|\bdl\b").unwrap());
    if A_TORBOX_RX.is_match(&lower) {
        return Some("tb");
    }
    if A_RD_RX.is_match(&lower) {
        return Some("rd");
    }
    if A_AD_RX.is_match(&lower) {
        return Some("ad");
    }
    if A_PM_RX.is_match(&lower) {
        return Some("pm");
    }
    if A_DL_RX.is_match(&lower) {
        return Some("dl");
    }
    None
}

fn is_debrid_aware_addon(name: &str) -> bool {
    DEBRID_AWARE_ADDON_RX.is_match(name)
}

fn comet_service_from(binge_group: &str) -> Option<&'static str> {
    let c = COMET_BINGE_RX.captures(binge_group)?;
    let raw = c.get(1)?.as_str().to_lowercase();
    match raw.as_str() {
        "realdebrid" | "real-debrid" | "rd" => Some("rd"),
        "torbox" | "tb" => Some("tb"),
        "alldebrid" | "ad" => Some("ad"),
        "premiumize" | "pm" => Some("pm"),
        "debridlink" | "debrid-link" | "dl" => Some("dl"),
        _ => None,
    }
}

fn service_name_to_slug(s: &str) -> Option<&'static str> {
    let lower = s.to_lowercase();
    let n: String = lower.chars().filter(|c| !matches!(*c, ' ' | '-')).collect();
    match n.as_str() {
        "realdebrid" | "rd" => Some("rd"),
        "torbox" | "tb" => Some("tb"),
        "alldebrid" | "ad" => Some("ad"),
        "premiumize" | "pm" => Some("pm"),
        "debridlink" | "dl" => Some("dl"),
        _ => None,
    }
}

fn parse_edition(text: &str, ptt: &PttResult) -> Option<String> {
    if ptt.extended {
        return Some("EXTENDED".to_string());
    }
    if ptt.unrated {
        return Some("UNRATED".to_string());
    }
    if ptt.theatrical {
        return Some("THEATRICAL".to_string());
    }
    if ptt.uncut {
        return Some("UNCUT".to_string());
    }
    if ptt.remastered {
        return Some("REMASTERED".to_string());
    }
    if ptt.criterion {
        return Some("CRITERION".to_string());
    }
    if ptt.openmatte {
        return Some("OPEN MATTE".to_string());
    }
    let c = EDITION_RX.captures(text)?;
    let raw = c.get(1)?.as_str().to_uppercase();
    static ED_NORMALIZE_RX: Lazy<Regex> =
        Lazy::new(|| Regex::new(r"[\.\s]+").unwrap());
    Some(ED_NORMALIZE_RX.replace_all(&raw, " ").into_owned())
}

fn parse_year_range(text: &str) -> Option<(u16, u16)> {
    let c = YEAR_RANGE_RX.captures(text)?;
    let a: u16 = c.get(1)?.as_str().parse().ok()?;
    let b: u16 = c.get(2)?.as_str().parse().ok()?;
    let diff = b as i32 - a as i32;
    if diff > 0 && diff < 30 {
        Some((a, b))
    } else {
        None
    }
}

fn parse_season_pack(text: &str, ptt: &PttResult) -> bool {
    if ptt.season.is_some() && ptt.episode.is_none() {
        for c in SEASON_PACK_RX.captures_iter(text) {
            let raw = c.get(1).unwrap().as_str();
            let lower = raw.to_lowercase();
            if lower == "complete"
                || lower.starts_with("season")
                || lower.starts_with("season.")
                || lower.starts_with("season ")
            {
                return true;
            }
            if lower.starts_with('s') {
                let m = c.get(0).unwrap();
                let end = m.end();
                let after = &text[end..];
                if !after.to_uppercase().starts_with('E') {
                    return true;
                }
            }
        }
    }
    false
}

fn parse_disc(text: &str) -> Option<i32> {
    let c = DISC_RX.captures(text)?;
    c.get(1)?.as_str().parse().ok()
}

fn parse_repack_iteration(text: &str, ptt: &PttResult) -> i32 {
    if let Some(c) = REPACK_RX.captures(text) {
        if let Some(m) = c.get(1) {
            return m.as_str().parse().unwrap_or(1);
        }
        return 1;
    }
    if ptt.repack {
        1
    } else {
        0
    }
}

fn parse_anime_hash(text: &str) -> Option<String> {
    let c = ANIME_HASH_RX.captures(text)?;
    Some(c.get(1)?.as_str().to_uppercase())
}

fn compute_scam_score(source: Source, resolution: Resolution, size: Option<u64>) -> i32 {
    let mut s = 0;
    let kib: u64 = 1024;
    let mib = kib * kib;
    let gib = mib * kib;
    if resolution == Resolution::UHD {
        if let Some(sz) = size {
            if sz < 5 * gib {
                s += 3;
            }
        }
    }
    if resolution == Resolution::P1080 {
        if let Some(sz) = size {
            if sz < 700 * mib {
                s += 3;
            }
        }
    }
    if resolution == Resolution::P720 {
        if let Some(sz) = size {
            if sz < 250 * mib {
                s += 3;
            }
        }
    }
    if resolution == Resolution::SD {
        if let Some(sz) = size {
            if sz < 250 * mib {
                s += 3;
            }
        }
    }
    if resolution == Resolution::SD && source == Source::Other {
        s += 2;
    }
    s
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn mk_stream(title: &str, addon_name: &str) -> Stream {
        Stream {
            title: Some(title.to_string()),
            addon_id: "test".to_string(),
            addon_name: addon_name.to_string(),
            ..Default::default()
        }
    }

    #[test]
    fn parses_torrentio_1080p_webdl() {
        let s = mk_stream(
            "The.Matrix.1999.1080p.WEB-DL.DDP5.1.H.264-FLUX\n👤 25 💾 2.5 GB ⚡ Real-Debrid",
            "Torrentio",
        );
        let p = parse_stream(s);
        assert_eq!(p.resolution, Resolution::P1080);
        assert_eq!(p.codec, Codec::Avc);
        assert_eq!(p.source, Source::WebDl);
        assert_eq!(p.year, Some(1999));
        assert_eq!(p.audio.codec, AudioCodec::DdPlus);
        assert_eq!(p.audio.channels, 6);
        assert_eq!(p.release_group.as_deref(), Some("FLUX"));
        assert_eq!(p.release_group_normalized.as_deref(), Some("FLUX"));
        assert!(p.size.is_some());
        assert!(p.size.unwrap() > 2_000_000_000);
        assert_eq!(p.seeders, Some(25));
        assert!(p.cached.get("rd").copied().unwrap_or(false));
    }

    #[test]
    fn parses_yts_1080p_x265() {
        let s = mk_stream(
            "The.Dark.Knight.2008.1080p.BluRay.x265-YTS",
            "YTS",
        );
        let p = parse_stream(s);
        assert_eq!(p.resolution, Resolution::P1080);
        assert_eq!(p.codec, Codec::Hevc);
        assert_eq!(p.source, Source::BluRay);
        assert_eq!(p.year, Some(2008));
    }

    #[test]
    fn parses_cam_release_lowest_quality() {
        let s = mk_stream(
            "Some.Movie.2024.HDCAM.x264-NEW\n💾 1.2 GB",
            "Torrentio",
        );
        let p = parse_stream(s);
        assert_eq!(p.source, Source::CAM);
        assert_eq!(p.year, Some(2024));
    }

    #[test]
    fn parses_4k_dv_hdr10() {
        let s = mk_stream(
            "Dune.Part.Two.2024.2160p.UHD.BluRay.REMUX.DV.HDR10.HEVC.TrueHD.7.1.Atmos-FraMeSToR\n💾 80.5 GB",
            "Torrentio",
        );
        let p = parse_stream(s);
        assert_eq!(p.resolution, Resolution::UHD);
        assert_eq!(p.codec, Codec::Hevc);
        assert_eq!(p.source, Source::REMUX);
        assert_eq!(p.hdr_format, Some(HdrFormat::DvHdr10));
        assert!(p.remux);
        assert_eq!(p.audio.codec, AudioCodec::Atmos);
        assert_eq!(p.audio.channels, 8);
        assert_eq!(p.year, Some(2024));
        assert_eq!(p.release_group.as_deref(), Some("FraMeSToR"));
        assert_eq!(p.release_group_normalized.as_deref(), Some("FRAMESTOR"));
        assert!(is_trusted_group(p.release_group_normalized.as_deref()));
    }

    #[test]
    fn detects_season_pack() {
        let s = mk_stream(
            "Breaking.Bad.S01.Complete.1080p.BluRay.x264-DEMAND",
            "Torrentio",
        );
        let p = parse_stream(s);
        assert_eq!(p.season, Some(1));
        assert_eq!(p.episode, None);
        assert!(p.season_pack);
        assert_eq!(p.resolution, Resolution::P1080);
    }

    #[test]
    fn detects_episode_with_title() {
        let s = mk_stream(
            "The.Office.S03E10.A.Benihana.Christmas.720p.WEB-DL.x264.mkv",
            "Torrentio",
        );
        let p = parse_stream(s);
        assert_eq!(p.season, Some(3));
        assert_eq!(p.episode, Some(10));
        assert_eq!(p.resolution, Resolution::P720);
        assert!(p.episode_title.is_some());
        assert!(p.episode_title.unwrap().to_lowercase().contains("benihana"));
        assert_eq!(p.container, Some(Container::Mkv));
    }

    #[test]
    fn empty_stream_falls_back_to_defaults() {
        let s = Stream {
            addon_id: "x".into(),
            addon_name: "x".into(),
            ..Default::default()
        };
        let p = parse_stream(s);
        assert_eq!(p.resolution, Resolution::SD);
        assert_eq!(p.codec, Codec::Other);
        assert_eq!(p.source, Source::Other);
    }

    #[test]
    fn behavior_hints_video_size_used() {
        let mut s = mk_stream("Movie.2020.1080p.WEB-DL.x264", "Torrentio");
        s.behavior_hints = Some(json!({ "videoSize": 5_000_000_000_u64 }));
        let p = parse_stream(s);
        assert_eq!(p.size, Some(5_000_000_000));
    }
}
