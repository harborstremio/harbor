// GENERATED from web src/lib/avatars/catalog.ts — do not hand-edit the
// kAvatarCatalog list; regenerate from the source of truth.

/// A single ready-avatar entry: its catalog [id] (maps to the bundled asset
/// `assets/avatars/<id>.webp`) and a display [name].
class AvatarItem {
  const AvatarItem(this.id, this.name);
  final String id;
  final String name;
}

/// A named group of ready avatars (e.g. "South Park", "Naruto").
class AvatarGroup {
  const AvatarGroup(this.group, this.items);
  final String group;
  final List<AvatarItem> items;
}

/// The bundled Stremio default ("cat") avatar — the no-avatar fallback, web
/// `CatAvatar`/`stremio-default-avatar.png`.
const String kStremioDefaultAvatarAsset =
    'assets/brand/stremio-default-avatar.png';

/// The stored `profile.avatar` value for a catalog [id] — 1:1 with web
/// `avatarUrl(id)` so a profile is interchangeable with the web app.
String avatarStoredValue(String id) => '/avatars/$id.webp';

/// The 5 built-in kid avatars (web `KID_AVATARS`), stored as their raw
/// `/kids/avatars/kid-N.webp` path — separate from the character catalog and
/// guarded so they never leak into the shared Harbor identity.
const List<String> kKidAvatarValues = [
  '/kids/avatars/kid-1.webp',
  '/kids/avatars/kid-2.webp',
  '/kids/avatars/kid-3.webp',
  '/kids/avatars/kid-4.webp',
  '/kids/avatars/kid-5.webp',
];

/// Resolves a stored `profile.avatar` value to a bundled asset path, or null
/// when it is not a catalog / kid-avatar path (http/data/empty are handled by
/// ProfileAvatar directly). Ports the web `/avatars/<id>.webp` +
/// `/kids/avatars/<id>.webp` conventions to the bundled asset tree.
String? avatarAssetForStored(String? stored) {
  if (stored == null || stored.isEmpty) return null;
  const p = '/avatars/';
  const kp = '/kids/avatars/';
  if (stored.startsWith(kp)) {
    return 'assets/kids/avatars/${stored.substring(kp.length)}';
  }
  if (stored.startsWith(p)) {
    return 'assets/avatars/${stored.substring(p.length)}';
  }
  return null;
}

/// The 629 built-in ready avatars in 250 groups, ported 1:1 from web
/// `AVATAR_CATALOG`.
const List<AvatarGroup> kAvatarCatalog = [
  AvatarGroup('South Park', [
    AvatarItem('sp_anime_cartman', 'Anime Cartman'),
    AvatarItem('sp_anime_kenny', 'Anime Kenny'),
    AvatarItem('sp_anime_kyle', 'Anime Kyle'),
    AvatarItem('sp_anime_stan_v2', 'Anime Stan'),
    AvatarItem('cartoon_butters_stotch_south_park', 'Butters'),
    AvatarItem('eric_cartman', 'Cartman'),
    AvatarItem('cartman_cop', 'Cartman (Cop)'),
    AvatarItem('sp_chef', 'Chef'),
    AvatarItem('sp_jennifer_lopez', 'Jennifer Lopez'),
    AvatarItem('sp_gay_fish', 'Kanye'),
    AvatarItem('kenny', 'Kenny'),
    AvatarItem('kyle', 'Kyle'),
    AvatarItem('sp_mysterion', 'Mysterion'),
    AvatarItem('sp_professor_chaos', 'Professor Chaos'),
    AvatarItem('stan_marsh', 'Stan'),
    AvatarItem('sp_terrence', 'Terrance'),
    AvatarItem('sp_phillip', 'Phillip'),
    AvatarItem('sp_the_coon', 'The Coon'),
    AvatarItem('towelie', 'Towelie'),
    AvatarItem('sp_alien', 'Visitor'),
  ]),
  AvatarGroup('Naruto', [
    AvatarItem('hinata_hyuga', 'Hinata'),
    AvatarItem('itachi_akatsuki', 'Itachi'),
    AvatarItem('kakashi_sharingan', 'Kakashi'),
    AvatarItem('might_guy', 'Might Guy'),
    AvatarItem('naruto', 'Naruto'),
    AvatarItem('pain', 'Pain'),
    AvatarItem('sakura_haruno', 'Sakura'),
    AvatarItem('sasuke_rinnegan', 'Sasuke'),
  ]),
  AvatarGroup('The Boondocks', [
    AvatarItem('boondocks_slickback_v2', 'A Pimp Named Slickback'),
    AvatarItem('grandpa_freeman', 'Granddad'),
    AvatarItem('huey_freeman', 'Huey'),
    AvatarItem('riley_freeman', 'Riley'),
    AvatarItem('boondocks_stinkmeaner_v2', 'Stinkmeaner'),
    AvatarItem('thugnificent_v2', 'Thugnificent'),
    AvatarItem('boondocks_tom_dubois', 'Tom DuBois'),
    AvatarItem('uncle_ruckus_v2', 'Uncle Ruckus'),
  ]),
  AvatarGroup('SpongeBob SquarePants', [
    AvatarItem('chocolate_guy', 'Chocolate Guy'),
    AvatarItem('handsome_squidward', 'Handsome Squidward'),
    AvatarItem('mr_krabs', 'Mr. Krabs'),
    AvatarItem('patrick', 'Patrick'),
    AvatarItem('fishnet_patrick', 'Patrick (Fishnets)'),
    AvatarItem('spongebob', 'SpongeBob'),
    AvatarItem('squidward', 'Squidward'),
  ]),
  AvatarGroup('Star Wars', [
    AvatarItem('sw_grievous', 'General Grievous'),
    AvatarItem('grogu_v2', 'Grogu'),
    AvatarItem('hansolo', 'Han Solo'),
    AvatarItem('leia', 'Leia'),
    AvatarItem('lukeskywalker', 'Luke Skywalker'),
    AvatarItem('mando_v3', 'The Mandalorian'),
    AvatarItem('yoda_v2', 'Yoda'),
  ]),
  AvatarGroup('The Office', [
    AvatarItem('angela_martin', 'Angela'),
    AvatarItem('dwight_schrute', 'Dwight'),
    AvatarItem('jim_halpert', 'Jim'),
    AvatarItem('kevin_malone', 'Kevin'),
    AvatarItem('michael_scott', 'Michael Scott'),
    AvatarItem('pam_beesly', 'Pam'),
    AvatarItem('stanley_hudson', 'Stanley'),
  ]),
  AvatarGroup('Breaking Bad', [
    AvatarItem('gusfring', 'Gus Fring'),
    AvatarItem('heisenberg_final', 'Heisenberg'),
    AvatarItem('jessepinkman', 'Jesse Pinkman'),
    AvatarItem('lalosalamanca', 'Lalo Salamanca'),
    AvatarItem('mike_ehrmantraut', 'Mike Ehrmantraut'),
    AvatarItem('saul_goodman', 'Saul Goodman'),
  ]),
  AvatarGroup('Dragon Ball', [
    AvatarItem('android_18', 'Android 18'),
    AvatarItem('goku', 'Goku'),
    AvatarItem('master_roshi', 'Master Roshi'),
    AvatarItem('piccolo', 'Piccolo'),
    AvatarItem('trunks', 'Trunks'),
    AvatarItem('vegeta', 'Vegeta'),
  ]),
  AvatarGroup('Friends', [
    AvatarItem('cult_chandler_bing', 'Chandler'),
    AvatarItem('cult_joey_tribbiani', 'Joey'),
    AvatarItem('cult_monica_geller', 'Monica'),
    AvatarItem('cult_phoebe_buffay', 'Phoebe'),
    AvatarItem('cult_rachel_green_v2', 'Rachel'),
    AvatarItem('cult_ross_geller', 'Ross'),
  ]),
  AvatarGroup('King of the Hill', [
    AvatarItem('anime_bill_dauterive', 'Bill Dauterive'),
    AvatarItem('anime_bobby_hill', 'Bobby Hill'),
    AvatarItem('anime_boomhauer', 'Boomhauer'),
    AvatarItem('anime_dale_gribble', 'Dale Gribble'),
    AvatarItem('anime_hank_hill', 'Hank Hill'),
    AvatarItem('anime_peggy_hill', 'Peggy Hill'),
  ]),
  AvatarGroup('Marvel', [
    AvatarItem('matt_murdock', 'Daredevil'),
    AvatarItem('tonystark_v2', 'Iron Man'),
    AvatarItem('wilson_fisk', 'Kingpin'),
    AvatarItem('magneto', 'Magneto'),
    AvatarItem('professor_x', 'Professor X'),
    AvatarItem('wolverine', 'Wolverine'),
  ]),
  AvatarGroup('One Piece', [
    AvatarItem('op_ace', 'Ace'),
    AvatarItem('luffy', 'Luffy'),
    AvatarItem('op_mihawk', 'Mihawk'),
    AvatarItem('op_shanks', 'Shanks'),
    AvatarItem('op_whitebeard', 'Whitebeard'),
    AvatarItem('op_zoro', 'Zoro'),
  ]),
  AvatarGroup('Power Rangers', [
    AvatarItem('pr_black_ranger', 'Black Ranger'),
    AvatarItem('pr_blue_ranger', 'Blue Ranger'),
    AvatarItem('pr_green_ranger_v2', 'Green Ranger'),
    AvatarItem('pr_pink_ranger', 'Pink Ranger'),
    AvatarItem('pr_red_ranger', 'Red Ranger'),
    AvatarItem('pr_yellow_ranger', 'Yellow Ranger'),
  ]),
  AvatarGroup('Adventure Time', [
    AvatarItem('bmo', 'BMO'),
    AvatarItem('finn_the_human', 'Finn'),
    AvatarItem('gunther', 'Gunther'),
    AvatarItem('ice_king', 'Ice King'),
    AvatarItem('jake_the_dog', 'Jake'),
    AvatarItem('lemongrab', 'Lemongrab'),
    AvatarItem('marceline', 'Marceline'),
    AvatarItem('princess_bubblegum', 'Princess Bubblegum'),
  ]),
  AvatarGroup('American Dad', [
    AvatarItem('ad_roger', 'Roger'),
    AvatarItem('roger_jeannie_gold', 'Roger (Jeannie Gold)'),
    AvatarItem('roger_legman', 'Roger (Legman)'),
    AvatarItem('roger_ricky_spanish', 'Roger (Ricky Spanish)'),
    AvatarItem('roger_the_decider', 'Roger (The Decider)'),
  ]),
  AvatarGroup('Bob\'s Burgers', [
    AvatarItem('anime_bob_belcher', 'Bob Belcher'),
    AvatarItem('anime_gene_belcher', 'Gene Belcher'),
    AvatarItem('anime_linda_belcher', 'Linda Belcher'),
    AvatarItem('anime_louise_belcher', 'Louise Belcher'),
    AvatarItem('anime_tina_belcher', 'Tina Belcher'),
  ]),
  AvatarGroup('Community', [
    AvatarItem('abed_nadir', 'Abed'),
    AvatarItem('britta_perry', 'Britta'),
    AvatarItem('jeff_winger', 'Jeff Winger'),
    AvatarItem('senor_chang', 'Senor Chang'),
    AvatarItem('donald_glover_troy', 'Troy'),
  ]),
  AvatarGroup('Doctor Who', [
    AvatarItem('dalek', 'Dalek'),
    AvatarItem('doctor11', 'Eleventh Doctor'),
    AvatarItem('doctor4', 'Fourth Doctor'),
    AvatarItem('doctor10', 'Tenth Doctor'),
    AvatarItem('doctor12', 'Twelfth Doctor'),
  ]),
  AvatarGroup('Footballers', [
    AvatarItem('haaland', 'Haaland'),
    AvatarItem('mbappe', 'Mbappe'),
    AvatarItem('messi', 'Messi'),
    AvatarItem('neymar', 'Neymar'),
    AvatarItem('ronaldo', 'Ronaldo'),
  ]),
  AvatarGroup('Futurama', [
    AvatarItem('anime_bender', 'Bender'),
    AvatarItem('anime_zoidberg', 'Dr. Zoidberg'),
    AvatarItem('anime_philip_fry', 'Fry'),
    AvatarItem('anime_turanga_leela', 'Leela'),
    AvatarItem('anime_professor_farnsworth', 'Professor Farnsworth'),
  ]),
  AvatarGroup('Heat', [
    AvatarItem('mccauley_heist', 'McCauley (Heist)'),
    AvatarItem('mccauley', 'Neil McCauley'),
    AvatarItem('shiherlis_heist', 'Shiherlis (Heist)'),
    AvatarItem('trejo_heist', 'Trejo'),
    AvatarItem('vincenthanna', 'Vincent Hanna'),
  ]),
  AvatarGroup('Kids Next Door', [
    AvatarItem('numbuh1_v2', 'Numbuh 1'),
    AvatarItem('numbuh2', 'Numbuh 2'),
    AvatarItem('numbuh3', 'Numbuh 3'),
    AvatarItem('numbuh4', 'Numbuh 4'),
    AvatarItem('numbuh5', 'Numbuh 5'),
  ]),
  AvatarGroup('Reservoir Dogs', [
    AvatarItem('mrblonde', 'Mr. Blonde'),
    AvatarItem('mrbrown', 'Mr. Brown'),
    AvatarItem('mrorange', 'Mr. Orange'),
    AvatarItem('mrpink', 'Mr. Pink'),
    AvatarItem('mrwhite', 'Mr. White'),
  ]),
  AvatarGroup('Saint Seiya', [
    AvatarItem('saintseiya_hyoga', 'Hyoga'),
    AvatarItem('saintseiya_ikki', 'Ikki'),
    AvatarItem('saintseiya_seiya', 'Seiya'),
    AvatarItem('saintseiya_shiryu', 'Shiryu'),
    AvatarItem('saintseiya_shun', 'Shun'),
  ]),
  AvatarGroup('Smiling Friends', [
    AvatarItem('anime_alan_smiling', 'Alan'),
    AvatarItem('anime_charlie_smiling', 'Charlie'),
    AvatarItem('anime_glep_v2', 'Glep'),
    AvatarItem('anime_mrboss_smiling', 'Mr. Boss'),
    AvatarItem('anime_pim_v2', 'Pim'),
  ]),
  AvatarGroup('Spirited Away', [
    AvatarItem('chihiro', 'Chihiro'),
    AvatarItem('anime_haku_dragon', 'Haku'),
    AvatarItem('noface', 'No-Face'),
    AvatarItem('oshira_sama', 'Oshira-sama'),
    AvatarItem('anime_yubaba', 'Yubaba'),
  ]),
  AvatarGroup('Steven Universe', [
    AvatarItem('amethyst', 'Amethyst'),
    AvatarItem('connie', 'Connie'),
    AvatarItem('garnet', 'Garnet'),
    AvatarItem('pearl', 'Pearl'),
    AvatarItem('steven_universe', 'Steven'),
  ]),
  AvatarGroup('Teen Titans', [
    AvatarItem('tt_beast_boy_v2', 'Beast Boy'),
    AvatarItem('tt_cyborg_v4', 'Cyborg'),
    AvatarItem('tt_raven_v5', 'Raven'),
    AvatarItem('tt_robin', 'Robin'),
    AvatarItem('tt_starfire', 'Starfire'),
  ]),
  AvatarGroup('The Big Bang Theory', [
    AvatarItem('cult_bernadette', 'Bernadette'),
    AvatarItem('cult_howard_wolowitz', 'Howard'),
    AvatarItem('cult_leonard_hofstadter', 'Leonard'),
    AvatarItem('cult_raj_koothrappali', 'Raj'),
    AvatarItem('cult_sheldon_cooper', 'Sheldon'),
  ]),
  AvatarGroup('The Lord of the Rings', [
    AvatarItem('frodo_clean', 'Frodo'),
    AvatarItem('gandalf', 'Gandalf'),
    AvatarItem('gollum', 'Gollum'),
    AvatarItem('legolas_clean', 'Legolas'),
    AvatarItem('sauron', 'Sauron'),
  ]),
  AvatarGroup('Yu-Gi-Oh!', [
    AvatarItem('anime_exodia', 'Exodia'),
    AvatarItem('anime_joey_wheeler', 'Joey Wheeler'),
    AvatarItem('anime_seto_kaiba', 'Seto Kaiba'),
    AvatarItem('anime_solomon_muto', 'Solomon Muto'),
    AvatarItem('anime_yami_yugi', 'Yami Yugi'),
  ]),
  AvatarGroup('Bleach', [
    AvatarItem('aizen', 'Aizen'),
    AvatarItem('ichigo', 'Ichigo'),
    AvatarItem('kenpachi', 'Kenpachi'),
    AvatarItem('rukia', 'Rukia'),
  ]),
  AvatarGroup('Chainsaw Man', [
    AvatarItem('denji', 'Denji'),
    AvatarItem('makima', 'Makima'),
    AvatarItem('pochita', 'Pochita'),
    AvatarItem('power', 'Power'),
  ]),
  AvatarGroup('Chainsmoker Cat', [AvatarItem('chainsmokercat', 'Yani')]),
  AvatarGroup('Dandadan', [
    AvatarItem('momo', 'Momo Ayase'),
    AvatarItem('okarun', 'Okarun'),
    AvatarItem('turbogranny', 'Turbo Granny'),
    AvatarItem('turbogranny_cat', 'Turbo Granny (Cat)'),
  ]),
  AvatarGroup('Death Note', [
    AvatarItem('l', 'L'),
    AvatarItem('lightyagami', 'Light Yagami'),
    AvatarItem('misa_amane', 'Misa Amane'),
    AvatarItem('ryuk', 'Ryuk'),
  ]),
  AvatarGroup('Despicable Me', [
    AvatarItem('balthazar_bratt', 'Balthazar Bratt'),
    AvatarItem('gru', 'Gru'),
    AvatarItem('minion', 'Minion'),
    AvatarItem('vector', 'Vector'),
  ]),
  AvatarGroup('Ed, Edd n Eddy', [
    AvatarItem('ed', 'Ed'),
    AvatarItem('edd', 'Edd'),
    AvatarItem('eddy', 'Eddy'),
    AvatarItem('plank', 'Plank'),
  ]),
  AvatarGroup('Formula 1', [
    AvatarItem('fernando_alonso', 'Alonso'),
    AvatarItem('lewis_hamilton', 'Hamilton'),
    AvatarItem('lando_norris', 'Norris'),
    AvatarItem('max_verstappen', 'Verstappen'),
  ]),
  AvatarGroup('Game of Thrones', [
    AvatarItem('daenerys', 'Daenerys'),
    AvatarItem('jon_snow', 'Jon Snow'),
    AvatarItem('littlefinger', 'Littlefinger'),
    AvatarItem('tyrion_lannister', 'Tyrion Lannister'),
  ]),
  AvatarGroup('Gravity Falls', [
    AvatarItem('bill_cipher', 'Bill Cipher'),
    AvatarItem('dipper_pines_v2', 'Dipper'),
    AvatarItem('grunkle_stan', 'Grunkle Stan'),
    AvatarItem('mabel_pines_v2', 'Mabel'),
  ]),
  AvatarGroup('Howl\'s Moving Castle', [
    AvatarItem('calcifer_v2', 'Calcifer'),
    AvatarItem('howl_jenkins_v2', 'Howl'),
    AvatarItem('sophie_young', 'Sophie'),
    AvatarItem('turnip_head', 'Turnip Head'),
  ]),
  AvatarGroup('Invincible', [
    AvatarItem('anime_conquest', 'Conquest'),
    AvatarItem('anime_mark_grayson', 'Mark Grayson'),
    AvatarItem('anime_omni_man', 'Omni-Man'),
    AvatarItem('anime_thragg_v3', 'Thragg'),
  ]),
  AvatarGroup('Modern Family', [
    AvatarItem('cult_cameron_tucker', 'Cameron'),
    AvatarItem('cult_gloria_pritchett', 'Gloria'),
    AvatarItem('cult_manny_delgado', 'Manny'),
    AvatarItem('cult_mitchell_pritchett', 'Mitchell'),
  ]),
  AvatarGroup('Scott Pilgrim', [
    AvatarItem('cult_kim_pine', 'Kim Pine'),
    AvatarItem('cult_ramona_flowers', 'Ramona Flowers'),
    AvatarItem('cult_scott_pilgrim', 'Scott Pilgrim'),
    AvatarItem('cult_wallace_wells_v3', 'Wallace Wells'),
  ]),
  AvatarGroup('Solo Leveling', [
    AvatarItem('sungjinwoo', 'Sung Jinwoo'),
    AvatarItem('chahaein', 'Cha Hae-In'),
  ]),
  AvatarGroup('You and I Are Polar Opposites', [
    AvatarItem('polaroppositesboy', 'Suzuki'),
    AvatarItem('polaroppositesgirl', 'Tsubaki'),
  ]),
  AvatarGroup('Spy x Family', [
    AvatarItem('bondmanspyxfam', 'Bondman'),
    AvatarItem('anya', 'Anya'),
    AvatarItem('loid', 'Loid'),
    AvatarItem('yor', 'Yor'),
  ]),
  AvatarGroup('Team America', [
    AvatarItem('cult_gary_johnston', 'Gary Johnston'),
    AvatarItem('cult_lisa_teamamerica', 'Lisa'),
    AvatarItem('cult_matt_damon', 'Matt Damon'),
  ]),
  AvatarGroup('Teletubbies', [
    AvatarItem('teletubby_dipsy', 'Dipsy'),
    AvatarItem('teletubby_laalaa', 'Laa-Laa'),
    AvatarItem('teletubby_po', 'Po'),
    AvatarItem('teletubby_tinkywinky', 'Tinky Winky'),
  ]),
  AvatarGroup('The Matrix', [
    AvatarItem('agent_smith', 'Agent Smith'),
    AvatarItem('morpheus', 'Morpheus'),
    AvatarItem('neo', 'Neo'),
    AvatarItem('trinity_v2', 'Trinity'),
  ]),
  AvatarGroup('The Muppets', [
    AvatarItem('muppets_fozzie_bear', 'Fozzie Bear'),
    AvatarItem('muppets_gonzo', 'Gonzo'),
    AvatarItem('muppets_kermit_the_frog', 'Kermit'),
    AvatarItem('muppets_miss_piggy', 'Miss Piggy'),
  ]),
  AvatarGroup('The Powerpuff Girls', [
    AvatarItem('blossom', 'Blossom'),
    AvatarItem('bubbles', 'Bubbles'),
    AvatarItem('buttercup', 'Buttercup'),
    AvatarItem('professor_utonium', 'Professor Utonium'),
  ]),
  AvatarGroup('The Ren & Stimpy Show', [
    AvatarItem('anime_ren_classic', 'Ren'),
    AvatarItem('cult_ren_grossup', 'Ren (Gross-Up)'),
    AvatarItem('anime_stimpy_classic', 'Stimpy'),
    AvatarItem('cult_stimpy_grossup', 'Stimpy (Gross-Up)'),
  ]),
  AvatarGroup('TMNT', [
    AvatarItem('tmnt_donatello', 'Donatello'),
    AvatarItem('tmnt_leonardo', 'Leonardo'),
    AvatarItem('tmnt_michelangelo', 'Michelangelo'),
    AvatarItem('tmnt_raphael', 'Raphael'),
  ]),
  AvatarGroup('Top Gear', [
    AvatarItem('james_may', 'James May'),
    AvatarItem('jeremy_clarkson', 'Jeremy Clarkson'),
    AvatarItem('richard_hammond', 'Richard Hammond'),
    AvatarItem('the_stig', 'The Stig'),
  ]),
  AvatarGroup('Turma da Monica', [
    AvatarItem('global_cascao', 'Cascao'),
    AvatarItem('global_cebolinha', 'Cebolinha'),
    AvatarItem('global_magali', 'Magali'),
    AvatarItem('global_monica', 'Monica'),
  ]),
  AvatarGroup('Willy Wonka', [
    AvatarItem('cult_oompa_loompa_1971', 'Oompa Loompa (1971)'),
    AvatarItem('cult_oompa_loompa', 'Oompa Loompa (2005)'),
    AvatarItem('cult_willy_wonka_1971', 'Willy Wonka (1971)'),
    AvatarItem('cult_willy_wonka', 'Willy Wonka (2005)'),
  ]),
  AvatarGroup('WWE', [
    AvatarItem('sports_hulk_hogan', 'Hulk Hogan'),
    AvatarItem('johncena', 'John Cena'),
    AvatarItem('sports_macho_man', 'Macho Man'),
    AvatarItem('the_rock', 'The Rock'),
  ]),
  AvatarGroup('Aqua Teen Hunger Force', [
    AvatarItem('athf_frylock', 'Frylock'),
    AvatarItem('athf_master_shake', 'Master Shake'),
    AvatarItem('athf_meatwad', 'Meatwad'),
  ]),
  AvatarGroup('Attack on Titan', [
    AvatarItem('eren', 'Eren'),
    AvatarItem('levi', 'Levi'),
    AvatarItem('mikasa', 'Mikasa'),
  ]),
  AvatarGroup('Austin Powers', [
    AvatarItem('austin_powers', 'Austin Powers'),
    AvatarItem('drevil', 'Dr. Evil'),
    AvatarItem('minime', 'Mini-Me'),
  ]),
  AvatarGroup('Berserk', [
    AvatarItem('casca', 'Casca'),
    AvatarItem('griffith', 'Griffith'),
    AvatarItem('guts', 'Guts'),
  ]),
  AvatarGroup('Chowder', [
    AvatarItem('chowder', 'Chowder'),
    AvatarItem('mung_daal', 'Mung Daal'),
    AvatarItem('shnitzel', 'Shnitzel'),
  ]),
  AvatarGroup('DC', [
    AvatarItem('batman', 'Batman'),
    AvatarItem('joker', 'Joker'),
    AvatarItem('wonder_woman', 'Wonder Woman'),
  ]),
  AvatarGroup('Django Unchained', [
    AvatarItem('calvincandie', 'Calvin Candie'),
    AvatarItem('django', 'Django'),
    AvatarItem('schultz', 'Dr. Schultz'),
  ]),
  AvatarGroup('El Chavo del Ocho', [
    AvatarItem('chavo', 'El Chavo'),
    AvatarItem('girafales', 'Prof. Jirafales'),
    AvatarItem('quico', 'Quico'),
  ]),
  AvatarGroup('Evangelion', [
    AvatarItem('kaworu', 'Kaworu'),
    AvatarItem('rei', 'Rei'),
    AvatarItem('shinji', 'Shinji'),
  ]),
  AvatarGroup('Family Guy', [
    AvatarItem('fg_brian', 'Brian'),
    AvatarItem('fg_peter', 'Peter'),
    AvatarItem('fg_stewie', 'Stewie'),
  ]),
  AvatarGroup('FLCL', [
    AvatarItem('anime_canti_flcl', 'Canti'),
    AvatarItem('anime_haruko_haruhara_flcl', 'Haruko'),
    AvatarItem('anime_naota_nandaba_flcl', 'Naota'),
  ]),
  AvatarGroup('Frieren', [
    AvatarItem('fern', 'Fern'),
    AvatarItem('frieren', 'Frieren'),
    AvatarItem('himmel', 'Himmel'),
  ]),
  AvatarGroup('Happy Tree Friends', [
    AvatarItem('cartoon_cuddles_happy_tree_friends', 'Cuddles'),
    AvatarItem('cartoon_giggles_happy_tree_friends', 'Giggles'),
    AvatarItem('cartoon_lumpy_happy_tree_friends', 'Lumpy'),
  ]),
  AvatarGroup('Harry Potter', [
    AvatarItem('hagrid', 'Hagrid'),
    AvatarItem('harrypotter', 'Harry Potter'),
    AvatarItem('hermione', 'Hermione'),
  ]),
  AvatarGroup('Hunter x Hunter', [
    AvatarItem('gon', 'Gon'),
    AvatarItem('hisoka', 'Hisoka'),
    AvatarItem('killua', 'Killua'),
  ]),
  AvatarGroup('Idiocracy', [
    AvatarItem('frito_pendejo', 'Frito'),
    AvatarItem('joe_bauers', 'Joe Bauers'),
    AvatarItem('president_camacho', 'President Camacho'),
  ]),
  AvatarGroup('Jackass', [
    AvatarItem('jackass_bam', 'Bam Margera'),
    AvatarItem('jackass_knoxville', 'Johnny Knoxville'),
    AvatarItem('jackass_steveo', 'Steve-O'),
  ]),
  AvatarGroup('James Bond', [
    AvatarItem('bond_connery', 'Bond (Connery)'),
    AvatarItem('bond_craig', 'Bond (Craig)'),
    AvatarItem('bond_moore', 'Bond (Moore)'),
  ]),
  AvatarGroup('John Wick', [
    AvatarItem('charon_wick', 'Charon'),
    AvatarItem('johnwick_v2', 'John Wick'),
    AvatarItem('winston_wick', 'Winston'),
  ]),
  AvatarGroup('Kick-Ass', [
    AvatarItem('bigdaddy', 'Big Daddy'),
    AvatarItem('hitgirl', 'Hit-Girl'),
    AvatarItem('kickass', 'Kick-Ass'),
  ]),
  AvatarGroup('Nicolas Cage', [
    AvatarItem('cage_conair', 'Con Air'),
    AvatarItem('cage_faceoff', 'Face/Off'),
    AvatarItem('cage_nationaltreasure', 'National Treasure'),
  ]),
  AvatarGroup('Popeye', [
    AvatarItem('global_bluto', 'Bluto'),
    AvatarItem('global_olive_oyl', 'Olive Oyl'),
    AvatarItem('popeye', 'Popeye'),
  ]),
  AvatarGroup('Pulp Fiction', [
    AvatarItem('jules_winnfield', 'Jules Winnfield'),
    AvatarItem('mia_wallace', 'Mia Wallace'),
    AvatarItem('vincent_vega', 'Vincent Vega'),
  ]),
  AvatarGroup('Regular Show', [
    AvatarItem('mordecai', 'Mordecai'),
    AvatarItem('muscle_man', 'Muscle Man'),
    AvatarItem('rigby', 'Rigby'),
  ]),
  AvatarGroup('Rick and Morty', [
    AvatarItem('morty', 'Morty'),
    AvatarItem('pickle_rick', 'Pickle Rick'),
    AvatarItem('rick_sanchez', 'Rick Sanchez'),
  ]),
  AvatarGroup('Sanrio', [
    AvatarItem('hellokitty', 'Hello Kitty'),
    AvatarItem('kuromi', 'Kuromi'),
    AvatarItem('pompompurin', 'Pompompurin'),
  ]),
  AvatarGroup('Soul Eater', [
    AvatarItem('soul_eater_death_the_kid', 'Death the Kid'),
    AvatarItem('soul_eater_maka', 'Maka'),
    AvatarItem('soul_eater_soul', 'Soul'),
  ]),
  AvatarGroup('Star Trek', [
    AvatarItem('kirk', 'Captain Kirk'),
    AvatarItem('gorn', 'Gorn'),
    AvatarItem('spock', 'Spock'),
  ]),
  AvatarGroup('Stranger Things', [
    AvatarItem('eleven', 'Eleven'),
    AvatarItem('hopper', 'Hopper'),
    AvatarItem('steve_harrington', 'Steve Harrington'),
  ]),
  AvatarGroup('Suits', [
    AvatarItem('harvey_specter', 'Harvey Specter'),
    AvatarItem('louis_litt', 'Louis Litt'),
    AvatarItem('mike_ross', 'Mike Ross'),
  ]),
  AvatarGroup('Super Troopers', [
    AvatarItem('cult_farva_v2', 'Farva'),
    AvatarItem('cult_mac_supertroopers_v2', 'Mac'),
    AvatarItem('cult_thorny_v2', 'Thorny'),
  ]),
  AvatarGroup('Supernatural', [
    AvatarItem('live_action_castiel_supernatural', 'Castiel'),
    AvatarItem('live_action_dean_winchester_supernatural', 'Dean Winchester'),
    AvatarItem('live_action_sam_winchester_supernatural', 'Sam Winchester'),
  ]),
  AvatarGroup('The Addams Family', [
    AvatarItem('gomez_addams', 'Gomez'),
    AvatarItem('morticia_addams', 'Morticia'),
    AvatarItem('uncle_fester', 'Uncle Fester'),
  ]),
  AvatarGroup('The Fairly OddParents', [
    AvatarItem('cartoon_cosmo_fairly_oddparents', 'Cosmo'),
    AvatarItem('cartoon_timmy_turner_fairly_oddparents', 'Timmy Turner'),
    AvatarItem('cartoon_wanda_fairly_oddparents', 'Wanda'),
  ]),
  AvatarGroup('The Hangover', [
    AvatarItem('alan_hangover', 'Alan'),
    AvatarItem('phil_hangover', 'Phil'),
    AvatarItem('stu_hangover', 'Stu'),
  ]),
  AvatarGroup('The Princess Bride', [
    AvatarItem('andre', 'Fezzik'),
    AvatarItem('inigo', 'Inigo Montoya'),
    AvatarItem('dreadpirate', 'Westley'),
  ]),
  AvatarGroup('ThunderCats', [
    AvatarItem('anime_cheetara', 'Cheetara'),
    AvatarItem('anime_lion_o', 'Lion-O'),
    AvatarItem('anime_panthro', 'Panthro'),
  ]),
  AvatarGroup('Tintin', [
    AvatarItem('global_haddock', 'Captain Haddock'),
    AvatarItem('global_snowy', 'Snowy'),
    AvatarItem('global_tintin', 'Tintin'),
  ]),
  AvatarGroup('Tom Cruise', [
    AvatarItem('cruise_ethanhunt', 'Ethan Hunt'),
    AvatarItem('cruise_lesgrossman', 'Les Grossman'),
    AvatarItem('cruise_maverick', 'Maverick'),
  ]),
  AvatarGroup('Trailer Park Boys', [
    AvatarItem('tpb_bubbles', 'Bubbles'),
    AvatarItem('tpb_julian_perfect', 'Julian'),
    AvatarItem('tpb_ricky', 'Ricky'),
  ]),
  AvatarGroup('White Chicks', [
    AvatarItem('whitechick_kevin_v3', 'Kevin'),
    AvatarItem('terrycrews', 'Latrell'),
    AvatarItem('whitechick_marcus_v3', 'Marcus'),
  ]),
  AvatarGroup('Yu Yu Hakusho', [
    AvatarItem('hiei', 'Hiei'),
    AvatarItem('kurama', 'Kurama'),
    AvatarItem('yusuke', 'Yusuke'),
  ]),
  AvatarGroup('Zoolander', [
    AvatarItem('zoolander', 'Derek Zoolander'),
    AvatarItem('hansel', 'Hansel'),
    AvatarItem('mugatu', 'Mugatu'),
  ]),
  AvatarGroup('21 Jump Street', [
    AvatarItem('jenko', 'Jenko'),
    AvatarItem('schmidt', 'Schmidt'),
  ]),
  AvatarGroup('Aesthetic', [
    AvatarItem('eboy_manga_eyes_bw_zoomed', 'Manga Boy'),
    AvatarItem('egirl_manga_eyes_bw_zoomed_distinct', 'Manga Girl'),
  ]),
  AvatarGroup('Airplane!', [
    AvatarItem('otto_pilot', 'Otto'),
    AvatarItem('ted_striker', 'Ted Striker'),
  ]),
  AvatarGroup('Arcane', [
    AvatarItem('jinx_arcane', 'Jinx'),
    AvatarItem('vi', 'Vi'),
  ]),
  AvatarGroup('Asterix', [
    AvatarItem('global_asterix', 'Asterix'),
    AvatarItem('global_obelix', 'Obelix'),
  ]),
  AvatarGroup('Athletes', [
    AvatarItem('michael_jordan_full', 'Michael Jordan'),
    AvatarItem('tom_brady', 'Tom Brady'),
  ]),
  AvatarGroup('Avatar: The Last Airbender', [
    AvatarItem('aang', 'Aang'),
    AvatarItem('katara', 'Katara'),
  ]),
  AvatarGroup('Beavis and Butt-Head', [
    AvatarItem('anime_beavis', 'Beavis'),
    AvatarItem('anime_butthead', 'Butt-Head'),
  ]),
  AvatarGroup('Beetlejuice', [
    AvatarItem('beetlejuice', 'Beetlejuice'),
    AvatarItem('harry_the_hunter', 'Harry the Hunter'),
  ]),
  AvatarGroup('Bill & Ted', [
    AvatarItem('cult_bill_s_preston', 'Bill S. Preston'),
    AvatarItem('cult_ted_logan', 'Ted Logan'),
  ]),
  AvatarGroup('Brendan Fraser', [
    AvatarItem('brendan_fraser_mummy', 'The Mummy'),
    AvatarItem('brendan_fraser_whale', 'The Whale'),
  ]),
  AvatarGroup('Cheech and Chong', [
    AvatarItem('cheech', 'Cheech'),
    AvatarItem('tommy_chong', 'Tommy Chong'),
  ]),
  AvatarGroup('Chiikawa', [
    AvatarItem('chiikawa', 'Chiikawa'),
    AvatarItem('hachiware', 'Hachiware'),
  ]),
  AvatarGroup('Cowboy Bebop', [
    AvatarItem('anime_ein', 'Ein'),
    AvatarItem('spikespiegel', 'Spike Spiegel'),
  ]),
  AvatarGroup('Cyberpunk: Edgerunners', [
    AvatarItem('anime_david_martinez', 'David Martinez'),
    AvatarItem('anime_lucy', 'Lucy'),
  ]),
  AvatarGroup('Die Antwoord', [
    AvatarItem('cult_ninja_die_antwoord', 'Ninja'),
    AvatarItem('cult_yolandi_visser_die_antwoord', 'Yolandi Visser'),
  ]),
  AvatarGroup('Dumb and Dumber', [
    AvatarItem('cult_harry_dunne', 'Harry Dunne'),
    AvatarItem('cult_lloyd_christmas', 'Lloyd Christmas'),
  ]),
  AvatarGroup('Fight Club', [
    AvatarItem('marla_singer', 'Marla Singer'),
    AvatarItem('tyler_durden', 'Tyler Durden'),
  ]),
  AvatarGroup('Fullmetal Alchemist', [
    AvatarItem('anime_alphonse_elric', 'Alphonse Elric'),
    AvatarItem('edwardelric', 'Edward Elric'),
  ]),
  AvatarGroup('Grease', [
    AvatarItem('dannyzuko', 'Danny Zuko'),
    AvatarItem('sandy', 'Sandy'),
  ]),
  AvatarGroup('Harold & Kumar', [
    AvatarItem('harold', 'Harold'),
    AvatarItem('kumar', 'Kumar'),
  ]),
  AvatarGroup('Hi Hi Puffy AmiYumi', [
    AvatarItem('anime_ami', 'Ami'),
    AvatarItem('anime_yumi', 'Yumi'),
  ]),
  AvatarGroup('Hot Fuzz', [
    AvatarItem('danny_butterman', 'Danny Butterman'),
    AvatarItem('nicholas_angel', 'Nicholas Angel'),
  ]),
  AvatarGroup('Invader Zim', [
    AvatarItem('gir_dog', 'GIR'),
    AvatarItem('invader_zim', 'Zim'),
  ]),
  AvatarGroup('Jujutsu Kaisen', [
    AvatarItem('gojo', 'Gojo'),
    AvatarItem('sukuna', 'Sukuna'),
  ]),
  AvatarGroup('Kill Bill', [
    AvatarItem('oren_ishii', 'O-Ren Ishii'),
    AvatarItem('the_bride', 'The Bride'),
  ]),
  AvatarGroup('Leon: The Professional', [
    AvatarItem('leon', 'Leon'),
    AvatarItem('mathilda', 'Mathilda'),
  ]),
  AvatarGroup('Lethal Weapon', [
    AvatarItem('murtaugh_lethal_weapon', 'Murtaugh'),
    AvatarItem('riggs_lethal_weapon', 'Riggs'),
  ]),
  AvatarGroup('Masha and the Bear', [
    AvatarItem('global_bear_masha', 'Bear'),
    AvatarItem('global_masha', 'Masha'),
  ]),
  AvatarGroup('Men in Black', [
    AvatarItem('agentj', 'Agent J'),
    AvatarItem('agentk_v2', 'Agent K'),
  ]),
  AvatarGroup('Money Heist', [
    AvatarItem('lcdp_mask', 'Dali Mask'),
    AvatarItem('lcdp_professor', 'The Professor'),
  ]),
  AvatarGroup('Monty Python', [
    AvatarItem('frenchtaunter', 'French Taunter'),
    AvatarItem('kingarthur', 'King Arthur'),
  ]),
  AvatarGroup('Mr. & Mrs. Smith', [
    AvatarItem('cult_jane_smith', 'Jane Smith'),
    AvatarItem('cult_john_smith', 'John Smith'),
  ]),
  AvatarGroup('One Punch Man', [
    AvatarItem('genos', 'Genos'),
    AvatarItem('saitama', 'Saitama'),
  ]),
  AvatarGroup('Prison Break', [
    AvatarItem('lincoln_burrows', 'Lincoln Burrows'),
    AvatarItem('michael_scofield', 'Michael Scofield'),
  ]),
  AvatarGroup('Pucca', [
    AvatarItem('anime_garu', 'Garu'),
    AvatarItem('anime_pucca', 'Pucca'),
  ]),
  AvatarGroup('RoboCop', [
    AvatarItem('bixby_snyder', 'Bixby Snyder'),
    AvatarItem('robocop', 'RoboCop'),
  ]),
  AvatarGroup('Samurai Jack', [
    AvatarItem('anime_aku_samurai', 'Aku'),
    AvatarItem('samuraijack', 'Samurai Jack'),
  ]),
  AvatarGroup('Scary Movie', [
    AvatarItem('ghostface_wazup', 'Ghostface'),
    AvatarItem('cult_officer_doofy_v2', 'Officer Doofy'),
  ]),
  AvatarGroup('Sharkboy and Lavagirl', [
    AvatarItem('lavagirl', 'Lavagirl'),
    AvatarItem('sharkboy', 'Sharkboy'),
  ]),
  AvatarGroup('Squid Game', [
    AvatarItem('frontman', 'Front Man'),
    AvatarItem('gihun', 'Gi-hun'),
  ]),
  AvatarGroup('Step Brothers', [
    AvatarItem('brennan', 'Brennan'),
    AvatarItem('dale', 'Dale'),
  ]),
  AvatarGroup('The Amazing World of Gumball', [
    AvatarItem('darwin', 'Darwin'),
    AvatarItem('gumball', 'Gumball'),
  ]),
  AvatarGroup('The Big Lebowski', [
    AvatarItem('jesus_quintana', 'Jesus Quintana'),
    AvatarItem('cult_the_dude', 'The Dude'),
  ]),
  AvatarGroup('The Boys', [
    AvatarItem('billy_butcher', 'Billy Butcher'),
    AvatarItem('homelander', 'Homelander'),
  ]),
  AvatarGroup('The Fresh Prince of Bel-Air', [
    AvatarItem('carlton', 'Carlton'),
    AvatarItem('freshprince', 'Will'),
  ]),
  AvatarGroup('The Pink Panther', [
    AvatarItem('inspectorclouseau', 'Inspector Clouseau'),
    AvatarItem('pinkpanther', 'Pink Panther'),
  ]),
  AvatarGroup('The Sopranos', [
    AvatarItem('christopher', 'Christopher'),
    AvatarItem('tony_soprano', 'Tony Soprano'),
  ]),
  AvatarGroup('The Walking Dead', [
    AvatarItem('negan', 'Negan'),
    AvatarItem('rick_grimes', 'Rick Grimes'),
  ]),
  AvatarGroup('The Wolf of Wall Street', [
    AvatarItem('donnieazoff', 'Donnie Azoff'),
    AvatarItem('jordanbelfort', 'Jordan Belfort'),
  ]),
  AvatarGroup('The X-Files', [
    AvatarItem('live_action_dana_scully_xfiles', 'Dana Scully'),
    AvatarItem('live_action_fox_mulder_xfiles', 'Fox Mulder'),
  ]),
  AvatarGroup('Tom and Jerry', [
    AvatarItem('jerry', 'Jerry'),
    AvatarItem('tom', 'Tom'),
  ]),
  AvatarGroup('Trigun', [
    AvatarItem('anime_vash', 'Vash'),
    AvatarItem('anime_wolfwood', 'Wolfwood'),
  ]),
  AvatarGroup('Twilight', [
    AvatarItem('twilight_bella', 'Bella'),
    AvatarItem('twilight_edward', 'Edward'),
  ]),
  AvatarGroup('A Clockwork Orange', [
    AvatarItem('alex_delarge', 'Alex DeLarge'),
  ]),
  AvatarGroup('A Nightmare on Elm Street', [
    AvatarItem('horror_freddy', 'Freddy Krueger'),
  ]),
  AvatarGroup('Alien', [AvatarItem('alien_xenomorph', 'Xenomorph')]),
  AvatarGroup('American Psycho', [AvatarItem('bateman', 'Patrick Bateman')]),
  AvatarGroup('Anchorman', [AvatarItem('ronburgundy', 'Ron Burgundy')]),
  AvatarGroup('Ancient Aliens', [
    AvatarItem('internet_giorgio_tsoukalos_aliens', 'Giorgio Tsoukalos'),
  ]),
  AvatarGroup('Ben 10', [AvatarItem('ben10', 'Ben 10')]),
  AvatarGroup('Big Hero 6', [AvatarItem('baymax_v2', 'Baymax')]),
  AvatarGroup('Borat', [AvatarItem('cult_borat_v3', 'Borat')]),
  AvatarGroup('Captain Tsubasa', [AvatarItem('global_tsubasa', 'Tsubasa')]),
  AvatarGroup('CatDog', [AvatarItem('anime_catdog', 'CatDog')]),
  AvatarGroup('Chappelle\'s Show', [
    AvatarItem('tyrone_biggums', 'Tyrone Biggums'),
  ]),
  AvatarGroup('Chappie', [AvatarItem('cult_chappie', 'Chappie')]),
  AvatarGroup('Chhota Bheem', [
    AvatarItem('global_chhota_bheem', 'Chhota Bheem'),
  ]),
  AvatarGroup('Coraline', [AvatarItem('coraline', 'Coraline')]),
  AvatarGroup('Courage the Cowardly Dog', [AvatarItem('courage', 'Courage')]),
  AvatarGroup('Danny Phantom', [AvatarItem('dannyphantom', 'Danny Phantom')]),
  AvatarGroup('Dexter', [AvatarItem('dexterkiller', 'Dexter Morgan')]),
  AvatarGroup('Dexter\'s Laboratory', [AvatarItem('dexter_lab', 'Dexter')]),
  AvatarGroup('Don\'t Be a Menace', [AvatarItem('locdog', 'Loc Dog')]),
  AvatarGroup('Donnie Darko', [AvatarItem('cult_frank_rabbit', 'Frank')]),
  AvatarGroup('Eastbound & Down', [
    AvatarItem('cult_kenny_powers', 'Kenny Powers'),
  ]),
  AvatarGroup('El Chapulin Colorado', [AvatarItem('chapolin', 'Chapulin')]),
  AvatarGroup('Fear and Loathing in Las Vegas', [
    AvatarItem('cult_raoul_duke', 'Raoul Duke'),
  ]),
  AvatarGroup('Grendizer', [AvatarItem('grendizer', 'Grendizer')]),
  AvatarGroup('Hellboy', [AvatarItem('hellboy', 'Hellboy')]),
  AvatarGroup('Her', [AvatarItem('theodore_v2', 'Theodore')]),
  AvatarGroup('Indiana Jones', [AvatarItem('indiana_jones', 'Indiana Jones')]),
  AvatarGroup('Inglourious Basterds', [AvatarItem('aldoraine', 'Aldo Raine')]),
  AvatarGroup('John Wayne', [AvatarItem('johnwayne', 'John Wayne')]),
  AvatarGroup('Johnny Bravo', [AvatarItem('johnnybravo', 'Johnny Bravo')]),
  AvatarGroup('Johnny Test', [AvatarItem('johnny_test', 'Johnny Test')]),
  AvatarGroup('Judge Dredd', [AvatarItem('judgedredd', 'Judge Dredd')]),
  AvatarGroup('Kimi ni Todoke', [AvatarItem('sawako', 'Sawako')]),
  AvatarGroup('Kung Fu Hustle', [
    AvatarItem('kungfu_landlady', 'The Landlady'),
  ]),
  AvatarGroup('Madoka Magica', [AvatarItem('madoka', 'Madoka')]),
  AvatarGroup('Magic Mike', [AvatarItem('magicmike', 'Magic Mike')]),
  AvatarGroup('Mars Attacks!', [AvatarItem('cult_mars_attacks', 'Martian')]),
  AvatarGroup('Maya the Bee', [AvatarItem('global_maya_bee', 'Maya')]),
  AvatarGroup('Mazinger Z', [AvatarItem('mazinger', 'Mazinger')]),
  AvatarGroup('Moomin', [AvatarItem('global_moomin', 'Moomin')]),
  AvatarGroup('Mr. Bean', [AvatarItem('mrbean', 'Mr. Bean')]),
  AvatarGroup('My Life as a Teenage Robot', [
    AvatarItem('anime_jenny_robot', 'Jenny'),
  ]),
  AvatarGroup('My Neighbor Totoro', [AvatarItem('totoro', 'Totoro')]),
  AvatarGroup('Nana', [AvatarItem('nana', 'Nana Osaki')]),
  AvatarGroup('Napoleon Dynamite', [
    AvatarItem('cult_napoleon_dynamite', 'Napoleon Dynamite'),
  ]),
  AvatarGroup('Narcos', [AvatarItem('pabloescobar', 'Pablo Escobar')]),
  AvatarGroup('No Country for Old Men', [
    AvatarItem('antonchigurh', 'Anton Chigurh'),
  ]),
  AvatarGroup('Obsession', [
    AvatarItem('live_action_anna_barton_obsession', 'Anna Barton'),
  ]),
  AvatarGroup('Ocean\'s Eleven', [AvatarItem('dannyocean', 'Danny Ocean')]),
  AvatarGroup('Pan\'s Labyrinth', [AvatarItem('pale_man', 'Pale Man')]),
  AvatarGroup('Parks and Recreation', [
    AvatarItem('cult_ron_swanson', 'Ron Swanson'),
  ]),
  AvatarGroup('Paul', [AvatarItem('cult_paul_alien', 'Paul')]),
  AvatarGroup('Peaky Blinders', [AvatarItem('tommy_shelby', 'Tommy Shelby')]),
  AvatarGroup('Pokemon', [AvatarItem('ash_pikachu', 'Ash & Pikachu')]),
  AvatarGroup('Ponyo', [AvatarItem('ponyo', 'Ponyo')]),
  AvatarGroup('Pororo', [AvatarItem('global_pororo', 'Pororo')]),
  AvatarGroup('Predator', [AvatarItem('predator', 'Predator')]),
  AvatarGroup('Primal', [AvatarItem('spear_primal', 'Spear')]),
  AvatarGroup('Princess Mononoke', [AvatarItem('princess_mononoke_v2', 'San')]),
  AvatarGroup('Rambo', [AvatarItem('rambo', 'Rambo')]),
  AvatarGroup('Romeo + Juliet', [AvatarItem('romeo', 'Romeo')]),
  AvatarGroup('Sailor Moon', [AvatarItem('sailormoon', 'Sailor Moon')]),
  AvatarGroup('Scarface', [AvatarItem('tonymontana_v2', 'Tony Montana')]),
  AvatarGroup('Scream', [AvatarItem('ghostface_classic', 'Ghostface')]),
  AvatarGroup('Serial Experiments Lain', [
    AvatarItem('anime_lain_iwakura_serial_experiments_lain', 'Lain'),
  ]),
  AvatarGroup('Seth Rogen', [AvatarItem('seth_rogen', 'Seth Rogen')]),
  AvatarGroup('Snatch', [AvatarItem('boris_the_blade', 'Boris the Blade')]),
  AvatarGroup('Spider-Verse', [
    AvatarItem('milesmorales', 'Miles Morales'),
    AvatarItem('spider_gwen', 'Spider-Gwen'),
    AvatarItem('milesmorales_v2', 'Spider-Man'),
  ]),
  AvatarGroup('Superbad', [AvatarItem('mclovin', 'McLovin')]),
  AvatarGroup('Talladega Nights', [AvatarItem('rickybobby', 'Ricky Bobby')]),
  AvatarGroup('Ted', [AvatarItem('cult_ted_bear', 'Ted')]),
  AvatarGroup('The Dictator', [AvatarItem('cult_aladeen', 'Aladeen')]),
  AvatarGroup('The Dollars Trilogy', [
    AvatarItem('manwithnoname', 'Man with No Name'),
  ]),
  AvatarGroup('The Godfather', [AvatarItem('don_corleone', 'Don Corleone')]),
  AvatarGroup('The Goonies', [AvatarItem('sloth_goonies', 'Sloth')]),
  AvatarGroup('The Mask', [AvatarItem('the_mask', 'The Mask')]),
  AvatarGroup('The Mummy', [AvatarItem('ahmanet', 'Ahmanet')]),
  AvatarGroup('The Munsters', [AvatarItem('herman_munster', 'Herman Munster')]),
  AvatarGroup('The Room', [AvatarItem('wiseau_tommy', 'Tommy Wiseau')]),
  AvatarGroup('The Terminator', [AvatarItem('terminator', 'Terminator')]),
  AvatarGroup('The Thing', [AvatarItem('kurtrussell_thing', 'MacReady')]),
  AvatarGroup('The Twilight Zone', [
    AvatarItem('twilight_zone_gremlin', 'Gremlin'),
  ]),
  AvatarGroup('The Witcher', [AvatarItem('geralt', 'Geralt')]),
  AvatarGroup('Titanic', [AvatarItem('jackdawson', 'Jack Dawson')]),
  AvatarGroup('Tokyo Ghoul', [AvatarItem('kaneki', 'Kaneki')]),
  AvatarGroup('Toradora', [AvatarItem('taiga', 'Taiga')]),
  AvatarGroup('Tropic Thunder', [AvatarItem('kirklazarus_v2', 'Kirk Lazarus')]),
  AvatarGroup('Twin Peaks', [
    AvatarItem('twin_peaks_man', 'The Man from Another Place'),
  ]),
  AvatarGroup('V for Vendetta', [AvatarItem('v_for_vendetta', 'V')]),
  AvatarGroup('Vicky the Viking', [AvatarItem('global_vicky_viking', 'Vicky')]),
  AvatarGroup('Walker, Texas Ranger', [
    AvatarItem('chucknorris_sheriff', 'Cordell Walker'),
  ]),
  AvatarGroup('Wednesday', [AvatarItem('wednesday', 'Wednesday')]),
  AvatarGroup('You', [
    AvatarItem('live_action_joe_goldberg_you', 'Joe Goldberg'),
  ]),
];
