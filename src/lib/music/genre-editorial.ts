/** Listening routes, not provider genre IDs. Track-led scenes never pull an artist's
 * whole catalog into a collection simply because one song belongs there. */
export type SceneRecording = { artist: string; title?: string };
export type EditorialScene = { artists: string[]; recordings?: SceneRecording[] };
const songs = (rows: [string, string][]): SceneRecording[] => rows.map(([artist,title])=>({artist,title}));
export const EDITORIAL_SCENES: Record<string, EditorialScene> = {
  'russian-rap': {
    artists: ['Kai Angel','9mice','Big Baby Tape','kizaru','Boulevard Depo','MAYOT','OG Buda','PHARAOH'],
  },
  'russian-hyperpop': {
    artists: ['Kill Eva','Мэйби Бэйби','GSPD','Lida','quiizzzmeow','Sqwore'],
  },
  'ukrainian-rap': {
    artists: ['YARMAK','SKOFKA','Kalush','alyona alyona','ТНМК','OTOY','ХАС','KRECHET'],
  },
  'ukrainian-wartime': {
    artists: ['OTOY','YARMAK','Варнак','Ницо Потворно','Третя Штурмова','хейтспіч','паліндром','Лінія Маннергейма','SKOFKA'],
    // Release context and primary artist interviews: work/handoffs/music-scenes-followup.md.
    // Lead with frontline rap; alternate artists instead of importing their entire catalogs.
    recordings: songs([
      ['OTOY','ЕНЕМІ'],['YARMAK','ВАВИЛОН'],['Варнак','Чому'],['Ницо Потворно','Покоління 300'],
      ['Третя Штурмова','Крейда'],['хейтспіч','наш дім горить'],['OTOY','ОКОЛОФРОНТ'],['YARMAK','ДИКЕ ПОЛЕ'],
      ['Варнак','Динаміт'],['Третя Штурмова','Кракен'],['паліндром','Як зупинити ранок'],['OTOY','МІЙ БРАТ'],
      ['YARMAK','RAGNAROK'],['Варнак','Приречений'],['Лінія Маннергейма','Де твоя лінія'],['SKOFKA','ЧУТИ ГІМН'],
      ['OTOY','ПОБУТ НОВИЙ'],['Третя Штурмова','Ми тут…'],['Ницо Потворно','Молодість'],['YARMAK','Хай нам брате пощастить'],
      ['Варнак','Задача (Phonk Version)'],['паліндром','Саудаде'],['Третя Штурмова','Балада'],['OTOY','FIND MY COUNTRY'],
      ['хейтспіч',"Я вб'ю всіх богів"],['Третя Штурмова','Дядя'],['OTOY','ДОНЕЦЬК'],['паліндром','Не торкає'],
      ['Третя Штурмова','Гоу таун'],['Варнак','Задача (Dub Version)'],['Третя Штурмова','Колір життя'],
    ]),
  },
  horrorcore: {
    artists: ['Gravediggaz','Geto Boys','Insane Clown Posse','Twiztid','Brotha Lynch Hung','Esham','Necro','Three 6 Mafia'],
  },
  goth: {
    artists: ['Bauhaus','The Sisters of Mercy','Siouxsie and the Banshees','Fields of the Nephilim','Christian Death','The Cure','Lebanon Hanover','She Past Away'],
  },
  emo: {
    artists: ['My Chemical Romance','Jimmy Eat World','American Football','Sunny Day Real Estate','The Get Up Kids','Taking Back Sunday','Dashboard Confessional','Rites of Spring'],
  },
  'internet-classics': {
    artists: ['Parry Gripp','Mr Weebl','Lemon Demon','The Gregory Brothers','Tay Zonday','Jonathan Coulton','Toby Fox','The Living Tombstone','Rick Astley','Ylvis','Caramella Girls'],
  },
};

export const SCENE_RECORDINGS_PER_PAGE = 16;
export function sceneRecordings(slug: string, page = 0): SceneRecording[] {
  const scene = EDITORIAL_SCENES[slug];
  if (!scene) return [];
  // Artist searches page through their real results; curated songs page through the list.
  return scene.recordings?.slice(page * SCENE_RECORDINGS_PER_PAGE, (page + 1) * SCENE_RECORDINGS_PER_PAGE)
    ?? scene.artists.map(artist => ({ artist }));
}
