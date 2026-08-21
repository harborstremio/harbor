/// A decade window for the feed's decade rows, ported 1:1 from `DECADES`.
typedef Decade = ({String label, String from, String to});

const List<Decade> kDecades = [
  (label: '70s', from: '1970-01-01', to: '1979-12-31'),
  (label: '80s', from: '1980-01-01', to: '1989-12-31'),
  (label: '90s', from: '1990-01-01', to: '1999-12-31'),
  (label: '2000s', from: '2000-01-01', to: '2009-12-31'),
  (label: '2010s', from: '2010-01-01', to: '2019-12-31'),
];

/// An original-language cinema strand for the feed, ported 1:1 from `LANGUAGES`.
typedef FeedLanguage = ({String code, String label});

const List<FeedLanguage> kFeedLanguages = [
  (code: 'fr', label: 'French Cinema'),
  (code: 'ja', label: 'Japanese Cinema'),
  (code: 'ko', label: 'Korean Cinema'),
  (code: 'es', label: 'Spanish-Language'),
  (code: 'it', label: 'Italian Cinema'),
  (code: 'de', label: 'German Cinema'),
  (code: 'sv', label: 'Swedish Cinema'),
  (code: 'da', label: 'Danish Cinema'),
  (code: 'zh', label: 'Chinese Cinema'),
  (code: 'hi', label: 'Indian Cinema'),
  (code: 'pt', label: 'Portuguese-Language'),
];
