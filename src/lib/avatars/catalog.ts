export type AvatarItem = { id: string; name: string };
export type AvatarGroup = { group: string; items: AvatarItem[] };

export const avatarUrl = (id: string): string => `/avatars/${id}.webp`;

export const AVATAR_CATALOG: AvatarGroup[] = [
  {
    group: "South Park",
    items: [
      { id: "sp_anime_cartman", name: "Anime Cartman" },
      { id: "sp_anime_kenny", name: "Anime Kenny" },
      { id: "sp_anime_kyle", name: "Anime Kyle" },
      { id: "sp_anime_stan_v2", name: "Anime Stan" },
      { id: "cartoon_butters_stotch_south_park", name: "Butters" },
      { id: "eric_cartman", name: "Cartman" },
      { id: "cartman_cop", name: "Cartman (Cop)" },
      { id: "sp_chef", name: "Chef" },
      { id: "sp_jennifer_lopez", name: "Jennifer Lopez" },
      { id: "sp_gay_fish", name: "Kanye" },
      { id: "kenny", name: "Kenny" },
      { id: "kyle", name: "Kyle" },
      { id: "sp_mysterion", name: "Mysterion" },
      { id: "sp_professor_chaos", name: "Professor Chaos" },
      { id: "stan_marsh", name: "Stan" },
      { id: "sp_terrence", name: "Terrance" },
      { id: "sp_phillip", name: "Phillip" },
      { id: "sp_the_coon", name: "The Coon" },
      { id: "towelie", name: "Towelie" },
      { id: "sp_alien", name: "Visitor" },
    ],
  },
  {
    group: "Naruto",
    items: [
      { id: "hinata_hyuga", name: "Hinata" },
      { id: "itachi_akatsuki", name: "Itachi" },
      { id: "kakashi_sharingan", name: "Kakashi" },
      { id: "might_guy", name: "Might Guy" },
      { id: "naruto", name: "Naruto" },
      { id: "pain", name: "Pain" },
      { id: "sakura_haruno", name: "Sakura" },
      { id: "sasuke_rinnegan", name: "Sasuke" },
    ],
  },
  {
    group: "The Boondocks",
    items: [
      { id: "boondocks_slickback_v2", name: "A Pimp Named Slickback" },
      { id: "grandpa_freeman", name: "Granddad" },
      { id: "huey_freeman", name: "Huey" },
      { id: "riley_freeman", name: "Riley" },
      { id: "boondocks_stinkmeaner_v2", name: "Stinkmeaner" },
      { id: "thugnificent_v2", name: "Thugnificent" },
      { id: "boondocks_tom_dubois", name: "Tom DuBois" },
      { id: "uncle_ruckus_v2", name: "Uncle Ruckus" },
    ],
  },
  {
    group: "SpongeBob SquarePants",
    items: [
      { id: "chocolate_guy", name: "Chocolate Guy" },
      { id: "handsome_squidward", name: "Handsome Squidward" },
      { id: "mr_krabs", name: "Mr. Krabs" },
      { id: "patrick", name: "Patrick" },
      { id: "fishnet_patrick", name: "Patrick (Fishnets)" },
      { id: "spongebob", name: "SpongeBob" },
      { id: "squidward", name: "Squidward" },
    ],
  },
  {
    group: "Star Wars",
    items: [
      { id: "sw_grievous", name: "General Grievous" },
      { id: "grogu_v2", name: "Grogu" },
      { id: "hansolo", name: "Han Solo" },
      { id: "leia", name: "Leia" },
      { id: "lukeskywalker", name: "Luke Skywalker" },
      { id: "mando_v3", name: "The Mandalorian" },
      { id: "yoda_v2", name: "Yoda" },
    ],
  },
  {
    group: "The Office",
    items: [
      { id: "angela_martin", name: "Angela" },
      { id: "dwight_schrute", name: "Dwight" },
      { id: "jim_halpert", name: "Jim" },
      { id: "kevin_malone", name: "Kevin" },
      { id: "michael_scott", name: "Michael Scott" },
      { id: "pam_beesly", name: "Pam" },
      { id: "stanley_hudson", name: "Stanley" },
    ],
  },
  {
    group: "Breaking Bad",
    items: [
      { id: "gusfring", name: "Gus Fring" },
      { id: "heisenberg_final", name: "Heisenberg" },
      { id: "jessepinkman", name: "Jesse Pinkman" },
      { id: "lalosalamanca", name: "Lalo Salamanca" },
      { id: "mike_ehrmantraut", name: "Mike Ehrmantraut" },
      { id: "saul_goodman", name: "Saul Goodman" },
    ],
  },
  {
    group: "Dragon Ball",
    items: [
      { id: "android_18", name: "Android 18" },
      { id: "goku", name: "Goku" },
      { id: "master_roshi", name: "Master Roshi" },
      { id: "piccolo", name: "Piccolo" },
      { id: "trunks", name: "Trunks" },
      { id: "vegeta", name: "Vegeta" },
    ],
  },
  {
    group: "Friends",
    items: [
      { id: "cult_chandler_bing", name: "Chandler" },
      { id: "cult_joey_tribbiani", name: "Joey" },
      { id: "cult_monica_geller", name: "Monica" },
      { id: "cult_phoebe_buffay", name: "Phoebe" },
      { id: "cult_rachel_green_v2", name: "Rachel" },
      { id: "cult_ross_geller", name: "Ross" },
    ],
  },
  {
    group: "King of the Hill",
    items: [
      { id: "anime_bill_dauterive", name: "Bill Dauterive" },
      { id: "anime_bobby_hill", name: "Bobby Hill" },
      { id: "anime_boomhauer", name: "Boomhauer" },
      { id: "anime_dale_gribble", name: "Dale Gribble" },
      { id: "anime_hank_hill", name: "Hank Hill" },
      { id: "anime_peggy_hill", name: "Peggy Hill" },
    ],
  },
  {
    group: "Marvel",
    items: [
      { id: "matt_murdock", name: "Daredevil" },
      { id: "tonystark_v2", name: "Iron Man" },
      { id: "wilson_fisk", name: "Kingpin" },
      { id: "magneto", name: "Magneto" },
      { id: "professor_x", name: "Professor X" },
      { id: "wolverine", name: "Wolverine" },
    ],
  },
  {
    group: "One Piece",
    items: [
      { id: "op_ace", name: "Ace" },
      { id: "luffy", name: "Luffy" },
      { id: "op_mihawk", name: "Mihawk" },
      { id: "op_shanks", name: "Shanks" },
      { id: "op_whitebeard", name: "Whitebeard" },
      { id: "op_zoro", name: "Zoro" },
    ],
  },
  {
    group: "Power Rangers",
    items: [
      { id: "pr_black_ranger", name: "Black Ranger" },
      { id: "pr_blue_ranger", name: "Blue Ranger" },
      { id: "pr_green_ranger_v2", name: "Green Ranger" },
      { id: "pr_pink_ranger", name: "Pink Ranger" },
      { id: "pr_red_ranger", name: "Red Ranger" },
      { id: "pr_yellow_ranger", name: "Yellow Ranger" },
    ],
  },
  {
    group: "Adventure Time",
    items: [
      { id: "bmo", name: "BMO" },
      { id: "finn_the_human", name: "Finn" },
      { id: "gunther", name: "Gunther" },
      { id: "ice_king", name: "Ice King" },
      { id: "jake_the_dog", name: "Jake" },
      { id: "lemongrab", name: "Lemongrab" },
      { id: "marceline", name: "Marceline" },
      { id: "princess_bubblegum", name: "Princess Bubblegum" },
    ],
  },
  {
    group: "American Dad",
    items: [
      { id: "ad_roger", name: "Roger" },
      { id: "roger_jeannie_gold", name: "Roger (Jeannie Gold)" },
      { id: "roger_legman", name: "Roger (Legman)" },
      { id: "roger_ricky_spanish", name: "Roger (Ricky Spanish)" },
      { id: "roger_the_decider", name: "Roger (The Decider)" },
    ],
  },
  {
    group: "Bob's Burgers",
    items: [
      { id: "anime_bob_belcher", name: "Bob Belcher" },
      { id: "anime_gene_belcher", name: "Gene Belcher" },
      { id: "anime_linda_belcher", name: "Linda Belcher" },
      { id: "anime_louise_belcher", name: "Louise Belcher" },
      { id: "anime_tina_belcher", name: "Tina Belcher" },
    ],
  },
  {
    group: "Community",
    items: [
      { id: "abed_nadir", name: "Abed" },
      { id: "britta_perry", name: "Britta" },
      { id: "jeff_winger", name: "Jeff Winger" },
      { id: "senor_chang", name: "Senor Chang" },
      { id: "donald_glover_troy", name: "Troy" },
    ],
  },
  {
    group: "Doctor Who",
    items: [
      { id: "dalek", name: "Dalek" },
      { id: "doctor11", name: "Eleventh Doctor" },
      { id: "doctor4", name: "Fourth Doctor" },
      { id: "doctor10", name: "Tenth Doctor" },
      { id: "doctor12", name: "Twelfth Doctor" },
    ],
  },
  {
    group: "Footballers",
    items: [
      { id: "haaland", name: "Haaland" },
      { id: "mbappe", name: "Mbappe" },
      { id: "messi", name: "Messi" },
      { id: "neymar", name: "Neymar" },
      { id: "ronaldo", name: "Ronaldo" },
    ],
  },
  {
    group: "Futurama",
    items: [
      { id: "anime_bender", name: "Bender" },
      { id: "anime_zoidberg", name: "Dr. Zoidberg" },
      { id: "anime_philip_fry", name: "Fry" },
      { id: "anime_turanga_leela", name: "Leela" },
      { id: "anime_professor_farnsworth", name: "Professor Farnsworth" },
    ],
  },
  {
    group: "Heat",
    items: [
      { id: "mccauley_heist", name: "McCauley (Heist)" },
      { id: "mccauley", name: "Neil McCauley" },
      { id: "shiherlis_heist", name: "Shiherlis (Heist)" },
      { id: "trejo_heist", name: "Trejo" },
      { id: "vincenthanna", name: "Vincent Hanna" },
    ],
  },
  {
    group: "Kids Next Door",
    items: [
      { id: "numbuh1_v2", name: "Numbuh 1" },
      { id: "numbuh2", name: "Numbuh 2" },
      { id: "numbuh3", name: "Numbuh 3" },
      { id: "numbuh4", name: "Numbuh 4" },
      { id: "numbuh5", name: "Numbuh 5" },
    ],
  },
  {
    group: "Reservoir Dogs",
    items: [
      { id: "mrblonde", name: "Mr. Blonde" },
      { id: "mrbrown", name: "Mr. Brown" },
      { id: "mrorange", name: "Mr. Orange" },
      { id: "mrpink", name: "Mr. Pink" },
      { id: "mrwhite", name: "Mr. White" },
    ],
  },
  {
    group: "Saint Seiya",
    items: [
      { id: "saintseiya_hyoga", name: "Hyoga" },
      { id: "saintseiya_ikki", name: "Ikki" },
      { id: "saintseiya_seiya", name: "Seiya" },
      { id: "saintseiya_shiryu", name: "Shiryu" },
      { id: "saintseiya_shun", name: "Shun" },
    ],
  },
  {
    group: "Smiling Friends",
    items: [
      { id: "anime_alan_smiling", name: "Alan" },
      { id: "anime_charlie_smiling", name: "Charlie" },
      { id: "anime_glep_v2", name: "Glep" },
      { id: "anime_mrboss_smiling", name: "Mr. Boss" },
      { id: "anime_pim_v2", name: "Pim" },
    ],
  },
  {
    group: "Spirited Away",
    items: [
      { id: "chihiro", name: "Chihiro" },
      { id: "anime_haku_dragon", name: "Haku" },
      { id: "noface", name: "No-Face" },
      { id: "oshira_sama", name: "Oshira-sama" },
      { id: "anime_yubaba", name: "Yubaba" },
    ],
  },
  {
    group: "Steven Universe",
    items: [
      { id: "amethyst", name: "Amethyst" },
      { id: "connie", name: "Connie" },
      { id: "garnet", name: "Garnet" },
      { id: "pearl", name: "Pearl" },
      { id: "steven_universe", name: "Steven" },
    ],
  },
  {
    group: "Teen Titans",
    items: [
      { id: "tt_beast_boy_v2", name: "Beast Boy" },
      { id: "tt_cyborg_v4", name: "Cyborg" },
      { id: "tt_raven_v5", name: "Raven" },
      { id: "tt_robin", name: "Robin" },
      { id: "tt_starfire", name: "Starfire" },
    ],
  },
  {
    group: "The Big Bang Theory",
    items: [
      { id: "cult_bernadette", name: "Bernadette" },
      { id: "cult_howard_wolowitz", name: "Howard" },
      { id: "cult_leonard_hofstadter", name: "Leonard" },
      { id: "cult_raj_koothrappali", name: "Raj" },
      { id: "cult_sheldon_cooper", name: "Sheldon" },
    ],
  },
  {
    group: "The Lord of the Rings",
    items: [
      { id: "frodo_clean", name: "Frodo" },
      { id: "gandalf", name: "Gandalf" },
      { id: "gollum", name: "Gollum" },
      { id: "legolas_clean", name: "Legolas" },
      { id: "sauron", name: "Sauron" },
    ],
  },
  {
    group: "Yu-Gi-Oh!",
    items: [
      { id: "anime_exodia", name: "Exodia" },
      { id: "anime_joey_wheeler", name: "Joey Wheeler" },
      { id: "anime_seto_kaiba", name: "Seto Kaiba" },
      { id: "anime_solomon_muto", name: "Solomon Muto" },
      { id: "anime_yami_yugi", name: "Yami Yugi" },
    ],
  },
  {
    group: "Bleach",
    items: [
      { id: "aizen", name: "Aizen" },
      { id: "ichigo", name: "Ichigo" },
      { id: "kenpachi", name: "Kenpachi" },
      { id: "rukia", name: "Rukia" },
    ],
  },
  {
    group: "Chainsaw Man",
    items: [
      { id: "denji", name: "Denji" },
      { id: "makima", name: "Makima" },
      { id: "pochita", name: "Pochita" },
      { id: "power", name: "Power" },
    ],
  },
  {
    group: "Chainsmoker Cat",
    items: [{ id: "chainsmokercat", name: "Yani" }],
  },
  {
    group: "Dandadan",
    items: [
      { id: "momo", name: "Momo Ayase" },
      { id: "okarun", name: "Okarun" },
      { id: "turbogranny", name: "Turbo Granny" },
      { id: "turbogranny_cat", name: "Turbo Granny (Cat)" },
    ],
  },
  {
    group: "Death Note",
    items: [
      { id: "l", name: "L" },
      { id: "lightyagami", name: "Light Yagami" },
      { id: "misa_amane", name: "Misa Amane" },
      { id: "ryuk", name: "Ryuk" },
    ],
  },
  {
    group: "Despicable Me",
    items: [
      { id: "balthazar_bratt", name: "Balthazar Bratt" },
      { id: "gru", name: "Gru" },
      { id: "minion", name: "Minion" },
      { id: "vector", name: "Vector" },
    ],
  },
  {
    group: "Ed, Edd n Eddy",
    items: [
      { id: "ed", name: "Ed" },
      { id: "edd", name: "Edd" },
      { id: "eddy", name: "Eddy" },
      { id: "plank", name: "Plank" },
    ],
  },
  {
    group: "Formula 1",
    items: [
      { id: "fernando_alonso", name: "Alonso" },
      { id: "lewis_hamilton", name: "Hamilton" },
      { id: "lando_norris", name: "Norris" },
      { id: "max_verstappen", name: "Verstappen" },
    ],
  },
  {
    group: "Game of Thrones",
    items: [
      { id: "daenerys", name: "Daenerys" },
      { id: "jon_snow", name: "Jon Snow" },
      { id: "littlefinger", name: "Littlefinger" },
      { id: "tyrion_lannister", name: "Tyrion Lannister" },
    ],
  },
  {
    group: "Gravity Falls",
    items: [
      { id: "bill_cipher", name: "Bill Cipher" },
      { id: "dipper_pines_v2", name: "Dipper" },
      { id: "grunkle_stan", name: "Grunkle Stan" },
      { id: "mabel_pines_v2", name: "Mabel" },
    ],
  },
  {
    group: "Howl's Moving Castle",
    items: [
      { id: "calcifer_v2", name: "Calcifer" },
      { id: "howl_jenkins_v2", name: "Howl" },
      { id: "sophie_young", name: "Sophie" },
      { id: "turnip_head", name: "Turnip Head" },
    ],
  },
  {
    group: "Invincible",
    items: [
      { id: "anime_conquest", name: "Conquest" },
      { id: "anime_mark_grayson", name: "Mark Grayson" },
      { id: "anime_omni_man", name: "Omni-Man" },
      { id: "anime_thragg_v3", name: "Thragg" },
    ],
  },
  {
    group: "Modern Family",
    items: [
      { id: "cult_cameron_tucker", name: "Cameron" },
      { id: "cult_gloria_pritchett", name: "Gloria" },
      { id: "cult_manny_delgado", name: "Manny" },
      { id: "cult_mitchell_pritchett", name: "Mitchell" },
    ],
  },
  {
    group: "Scott Pilgrim",
    items: [
      { id: "cult_kim_pine", name: "Kim Pine" },
      { id: "cult_ramona_flowers", name: "Ramona Flowers" },
      { id: "cult_scott_pilgrim", name: "Scott Pilgrim" },
      { id: "cult_wallace_wells_v3", name: "Wallace Wells" },
    ],
  },
  {
    group: "Solo Leveling",
    items: [
      { id: "sungjinwoo", name: "Sung Jinwoo" },
      { id: "chahaein", name: "Cha Hae-In" },
    ],
  },
  {
    group: "You and I Are Polar Opposites",
    items: [
      { id: "polaroppositesboy", name: "Suzuki" },
      { id: "polaroppositesgirl", name: "Tsubaki" },
    ],
  },
  {
    group: "Spy x Family",
    items: [
      { id: "bondmanspyxfam", name: "Bondman" },
      { id: "anya", name: "Anya" },
      { id: "loid", name: "Loid" },
      { id: "yor", name: "Yor" },
    ],
  },
  {
    group: "Team America",
    items: [
      { id: "cult_gary_johnston", name: "Gary Johnston" },
      { id: "cult_lisa_teamamerica", name: "Lisa" },
      { id: "cult_matt_damon", name: "Matt Damon" },
    ],
  },
  {
    group: "Teletubbies",
    items: [
      { id: "teletubby_dipsy", name: "Dipsy" },
      { id: "teletubby_laalaa", name: "Laa-Laa" },
      { id: "teletubby_po", name: "Po" },
      { id: "teletubby_tinkywinky", name: "Tinky Winky" },
    ],
  },
  {
    group: "The Matrix",
    items: [
      { id: "agent_smith", name: "Agent Smith" },
      { id: "morpheus", name: "Morpheus" },
      { id: "neo", name: "Neo" },
      { id: "trinity_v2", name: "Trinity" },
    ],
  },
  {
    group: "The Muppets",
    items: [
      { id: "muppets_fozzie_bear", name: "Fozzie Bear" },
      { id: "muppets_gonzo", name: "Gonzo" },
      { id: "muppets_kermit_the_frog", name: "Kermit" },
      { id: "muppets_miss_piggy", name: "Miss Piggy" },
    ],
  },
  {
    group: "The Powerpuff Girls",
    items: [
      { id: "blossom", name: "Blossom" },
      { id: "bubbles", name: "Bubbles" },
      { id: "buttercup", name: "Buttercup" },
      { id: "professor_utonium", name: "Professor Utonium" },
    ],
  },
  {
    group: "The Ren & Stimpy Show",
    items: [
      { id: "anime_ren_classic", name: "Ren" },
      { id: "cult_ren_grossup", name: "Ren (Gross-Up)" },
      { id: "anime_stimpy_classic", name: "Stimpy" },
      { id: "cult_stimpy_grossup", name: "Stimpy (Gross-Up)" },
    ],
  },
  {
    group: "TMNT",
    items: [
      { id: "tmnt_donatello", name: "Donatello" },
      { id: "tmnt_leonardo", name: "Leonardo" },
      { id: "tmnt_michelangelo", name: "Michelangelo" },
      { id: "tmnt_raphael", name: "Raphael" },
    ],
  },
  {
    group: "Top Gear",
    items: [
      { id: "james_may", name: "James May" },
      { id: "jeremy_clarkson", name: "Jeremy Clarkson" },
      { id: "richard_hammond", name: "Richard Hammond" },
      { id: "the_stig", name: "The Stig" },
    ],
  },
  {
    group: "Turma da Monica",
    items: [
      { id: "global_cascao", name: "Cascao" },
      { id: "global_cebolinha", name: "Cebolinha" },
      { id: "global_magali", name: "Magali" },
      { id: "global_monica", name: "Monica" },
    ],
  },
  {
    group: "Willy Wonka",
    items: [
      { id: "cult_oompa_loompa_1971", name: "Oompa Loompa (1971)" },
      { id: "cult_oompa_loompa", name: "Oompa Loompa (2005)" },
      { id: "cult_willy_wonka_1971", name: "Willy Wonka (1971)" },
      { id: "cult_willy_wonka", name: "Willy Wonka (2005)" },
    ],
  },
  {
    group: "WWE",
    items: [
      { id: "sports_hulk_hogan", name: "Hulk Hogan" },
      { id: "johncena", name: "John Cena" },
      { id: "sports_macho_man", name: "Macho Man" },
      { id: "the_rock", name: "The Rock" },
    ],
  },
  {
    group: "Aqua Teen Hunger Force",
    items: [
      { id: "athf_frylock", name: "Frylock" },
      { id: "athf_master_shake", name: "Master Shake" },
      { id: "athf_meatwad", name: "Meatwad" },
    ],
  },
  {
    group: "Attack on Titan",
    items: [
      { id: "eren", name: "Eren" },
      { id: "levi", name: "Levi" },
      { id: "mikasa", name: "Mikasa" },
    ],
  },
  {
    group: "Austin Powers",
    items: [
      { id: "austin_powers", name: "Austin Powers" },
      { id: "drevil", name: "Dr. Evil" },
      { id: "minime", name: "Mini-Me" },
    ],
  },
  {
    group: "Berserk",
    items: [
      { id: "casca", name: "Casca" },
      { id: "griffith", name: "Griffith" },
      { id: "guts", name: "Guts" },
    ],
  },
  {
    group: "Chowder",
    items: [
      { id: "chowder", name: "Chowder" },
      { id: "mung_daal", name: "Mung Daal" },
      { id: "shnitzel", name: "Shnitzel" },
    ],
  },
  {
    group: "DC",
    items: [
      { id: "batman", name: "Batman" },
      { id: "joker", name: "Joker" },
      { id: "wonder_woman", name: "Wonder Woman" },
    ],
  },
  {
    group: "Django Unchained",
    items: [
      { id: "calvincandie", name: "Calvin Candie" },
      { id: "django", name: "Django" },
      { id: "schultz", name: "Dr. Schultz" },
    ],
  },
  {
    group: "El Chavo del Ocho",
    items: [
      { id: "chavo", name: "El Chavo" },
      { id: "girafales", name: "Prof. Jirafales" },
      { id: "quico", name: "Quico" },
    ],
  },
  {
    group: "Evangelion",
    items: [
      { id: "kaworu", name: "Kaworu" },
      { id: "rei", name: "Rei" },
      { id: "shinji", name: "Shinji" },
    ],
  },
  {
    group: "Family Guy",
    items: [
      { id: "fg_brian", name: "Brian" },
      { id: "fg_peter", name: "Peter" },
      { id: "fg_stewie", name: "Stewie" },
    ],
  },
  {
    group: "FLCL",
    items: [
      { id: "anime_canti_flcl", name: "Canti" },
      { id: "anime_haruko_haruhara_flcl", name: "Haruko" },
      { id: "anime_naota_nandaba_flcl", name: "Naota" },
    ],
  },
  {
    group: "Frieren",
    items: [
      { id: "fern", name: "Fern" },
      { id: "frieren", name: "Frieren" },
      { id: "himmel", name: "Himmel" },
    ],
  },
  {
    group: "Happy Tree Friends",
    items: [
      { id: "cartoon_cuddles_happy_tree_friends", name: "Cuddles" },
      { id: "cartoon_giggles_happy_tree_friends", name: "Giggles" },
      { id: "cartoon_lumpy_happy_tree_friends", name: "Lumpy" },
    ],
  },
  {
    group: "Harry Potter",
    items: [
      { id: "hagrid", name: "Hagrid" },
      { id: "harrypotter", name: "Harry Potter" },
      { id: "hermione", name: "Hermione" },
    ],
  },
  {
    group: "Hunter x Hunter",
    items: [
      { id: "gon", name: "Gon" },
      { id: "hisoka", name: "Hisoka" },
      { id: "killua", name: "Killua" },
    ],
  },
  {
    group: "Idiocracy",
    items: [
      { id: "frito_pendejo", name: "Frito" },
      { id: "joe_bauers", name: "Joe Bauers" },
      { id: "president_camacho", name: "President Camacho" },
    ],
  },
  {
    group: "Jackass",
    items: [
      { id: "jackass_bam", name: "Bam Margera" },
      { id: "jackass_knoxville", name: "Johnny Knoxville" },
      { id: "jackass_steveo", name: "Steve-O" },
    ],
  },
  {
    group: "James Bond",
    items: [
      { id: "bond_connery", name: "Bond (Connery)" },
      { id: "bond_craig", name: "Bond (Craig)" },
      { id: "bond_moore", name: "Bond (Moore)" },
    ],
  },
  {
    group: "John Wick",
    items: [
      { id: "charon_wick", name: "Charon" },
      { id: "johnwick_v2", name: "John Wick" },
      { id: "winston_wick", name: "Winston" },
    ],
  },
  {
    group: "Kick-Ass",
    items: [
      { id: "bigdaddy", name: "Big Daddy" },
      { id: "hitgirl", name: "Hit-Girl" },
      { id: "kickass", name: "Kick-Ass" },
    ],
  },
  {
    group: "Nicolas Cage",
    items: [
      { id: "cage_conair", name: "Con Air" },
      { id: "cage_faceoff", name: "Face/Off" },
      { id: "cage_nationaltreasure", name: "National Treasure" },
    ],
  },
  {
    group: "Popeye",
    items: [
      { id: "global_bluto", name: "Bluto" },
      { id: "global_olive_oyl", name: "Olive Oyl" },
      { id: "popeye", name: "Popeye" },
    ],
  },
  {
    group: "Pulp Fiction",
    items: [
      { id: "jules_winnfield", name: "Jules Winnfield" },
      { id: "mia_wallace", name: "Mia Wallace" },
      { id: "vincent_vega", name: "Vincent Vega" },
    ],
  },
  {
    group: "Regular Show",
    items: [
      { id: "mordecai", name: "Mordecai" },
      { id: "muscle_man", name: "Muscle Man" },
      { id: "rigby", name: "Rigby" },
    ],
  },
  {
    group: "Rick and Morty",
    items: [
      { id: "morty", name: "Morty" },
      { id: "pickle_rick", name: "Pickle Rick" },
      { id: "rick_sanchez", name: "Rick Sanchez" },
    ],
  },
  {
    group: "Sanrio",
    items: [
      { id: "hellokitty", name: "Hello Kitty" },
      { id: "kuromi", name: "Kuromi" },
      { id: "pompompurin", name: "Pompompurin" },
    ],
  },
  {
    group: "Soul Eater",
    items: [
      { id: "soul_eater_death_the_kid", name: "Death the Kid" },
      { id: "soul_eater_maka", name: "Maka" },
      { id: "soul_eater_soul", name: "Soul" },
    ],
  },
  {
    group: "Star Trek",
    items: [
      { id: "kirk", name: "Captain Kirk" },
      { id: "gorn", name: "Gorn" },
      { id: "spock", name: "Spock" },
    ],
  },
  {
    group: "Stranger Things",
    items: [
      { id: "eleven", name: "Eleven" },
      { id: "hopper", name: "Hopper" },
      { id: "steve_harrington", name: "Steve Harrington" },
    ],
  },
  {
    group: "Suits",
    items: [
      { id: "harvey_specter", name: "Harvey Specter" },
      { id: "louis_litt", name: "Louis Litt" },
      { id: "mike_ross", name: "Mike Ross" },
    ],
  },
  {
    group: "Super Troopers",
    items: [
      { id: "cult_farva_v2", name: "Farva" },
      { id: "cult_mac_supertroopers_v2", name: "Mac" },
      { id: "cult_thorny_v2", name: "Thorny" },
    ],
  },
  {
    group: "Supernatural",
    items: [
      { id: "live_action_castiel_supernatural", name: "Castiel" },
      { id: "live_action_dean_winchester_supernatural", name: "Dean Winchester" },
      { id: "live_action_sam_winchester_supernatural", name: "Sam Winchester" },
    ],
  },
  {
    group: "The Addams Family",
    items: [
      { id: "gomez_addams", name: "Gomez" },
      { id: "morticia_addams", name: "Morticia" },
      { id: "uncle_fester", name: "Uncle Fester" },
    ],
  },
  {
    group: "The Fairly OddParents",
    items: [
      { id: "cartoon_cosmo_fairly_oddparents", name: "Cosmo" },
      { id: "cartoon_timmy_turner_fairly_oddparents", name: "Timmy Turner" },
      { id: "cartoon_wanda_fairly_oddparents", name: "Wanda" },
    ],
  },
  {
    group: "The Hangover",
    items: [
      { id: "alan_hangover", name: "Alan" },
      { id: "phil_hangover", name: "Phil" },
      { id: "stu_hangover", name: "Stu" },
    ],
  },
  {
    group: "The Princess Bride",
    items: [
      { id: "andre", name: "Fezzik" },
      { id: "inigo", name: "Inigo Montoya" },
      { id: "dreadpirate", name: "Westley" },
    ],
  },
  {
    group: "ThunderCats",
    items: [
      { id: "anime_cheetara", name: "Cheetara" },
      { id: "anime_lion_o", name: "Lion-O" },
      { id: "anime_panthro", name: "Panthro" },
    ],
  },
  {
    group: "Tintin",
    items: [
      { id: "global_haddock", name: "Captain Haddock" },
      { id: "global_snowy", name: "Snowy" },
      { id: "global_tintin", name: "Tintin" },
    ],
  },
  {
    group: "Tom Cruise",
    items: [
      { id: "cruise_ethanhunt", name: "Ethan Hunt" },
      { id: "cruise_lesgrossman", name: "Les Grossman" },
      { id: "cruise_maverick", name: "Maverick" },
    ],
  },
  {
    group: "Trailer Park Boys",
    items: [
      { id: "tpb_bubbles", name: "Bubbles" },
      { id: "tpb_julian_perfect", name: "Julian" },
      { id: "tpb_ricky", name: "Ricky" },
    ],
  },
  {
    group: "White Chicks",
    items: [
      { id: "whitechick_kevin_v3", name: "Kevin" },
      { id: "terrycrews", name: "Latrell" },
      { id: "whitechick_marcus_v3", name: "Marcus" },
    ],
  },
  {
    group: "Yu Yu Hakusho",
    items: [
      { id: "hiei", name: "Hiei" },
      { id: "kurama", name: "Kurama" },
      { id: "yusuke", name: "Yusuke" },
    ],
  },
  {
    group: "Zoolander",
    items: [
      { id: "zoolander", name: "Derek Zoolander" },
      { id: "hansel", name: "Hansel" },
      { id: "mugatu", name: "Mugatu" },
    ],
  },
  {
    group: "21 Jump Street",
    items: [
      { id: "jenko", name: "Jenko" },
      { id: "schmidt", name: "Schmidt" },
    ],
  },
  {
    group: "Aesthetic",
    items: [
      { id: "eboy_manga_eyes_bw_zoomed", name: "Manga Boy" },
      { id: "egirl_manga_eyes_bw_zoomed_distinct", name: "Manga Girl" },
    ],
  },
  {
    group: "Airplane!",
    items: [
      { id: "otto_pilot", name: "Otto" },
      { id: "ted_striker", name: "Ted Striker" },
    ],
  },
  {
    group: "Arcane",
    items: [
      { id: "jinx_arcane", name: "Jinx" },
      { id: "vi", name: "Vi" },
    ],
  },
  {
    group: "Asterix",
    items: [
      { id: "global_asterix", name: "Asterix" },
      { id: "global_obelix", name: "Obelix" },
    ],
  },
  {
    group: "Athletes",
    items: [
      { id: "michael_jordan_full", name: "Michael Jordan" },
      { id: "tom_brady", name: "Tom Brady" },
    ],
  },
  {
    group: "Avatar: The Last Airbender",
    items: [
      { id: "aang", name: "Aang" },
      { id: "katara", name: "Katara" },
    ],
  },
  {
    group: "Beavis and Butt-Head",
    items: [
      { id: "anime_beavis", name: "Beavis" },
      { id: "anime_butthead", name: "Butt-Head" },
    ],
  },
  {
    group: "Beetlejuice",
    items: [
      { id: "beetlejuice", name: "Beetlejuice" },
      { id: "harry_the_hunter", name: "Harry the Hunter" },
    ],
  },
  {
    group: "Bill & Ted",
    items: [
      { id: "cult_bill_s_preston", name: "Bill S. Preston" },
      { id: "cult_ted_logan", name: "Ted Logan" },
    ],
  },
  {
    group: "Brendan Fraser",
    items: [
      { id: "brendan_fraser_mummy", name: "The Mummy" },
      { id: "brendan_fraser_whale", name: "The Whale" },
    ],
  },
  {
    group: "Cheech and Chong",
    items: [
      { id: "cheech", name: "Cheech" },
      { id: "tommy_chong", name: "Tommy Chong" },
    ],
  },
  {
    group: "Chiikawa",
    items: [
      { id: "chiikawa", name: "Chiikawa" },
      { id: "hachiware", name: "Hachiware" },
    ],
  },
  {
    group: "Cowboy Bebop",
    items: [
      { id: "anime_ein", name: "Ein" },
      { id: "spikespiegel", name: "Spike Spiegel" },
    ],
  },
  {
    group: "Cyberpunk: Edgerunners",
    items: [
      { id: "anime_david_martinez", name: "David Martinez" },
      { id: "anime_lucy", name: "Lucy" },
    ],
  },
  {
    group: "Die Antwoord",
    items: [
      { id: "cult_ninja_die_antwoord", name: "Ninja" },
      { id: "cult_yolandi_visser_die_antwoord", name: "Yolandi Visser" },
    ],
  },
  {
    group: "Dumb and Dumber",
    items: [
      { id: "cult_harry_dunne", name: "Harry Dunne" },
      { id: "cult_lloyd_christmas", name: "Lloyd Christmas" },
    ],
  },
  {
    group: "Fight Club",
    items: [
      { id: "marla_singer", name: "Marla Singer" },
      { id: "tyler_durden", name: "Tyler Durden" },
    ],
  },
  {
    group: "Fullmetal Alchemist",
    items: [
      { id: "anime_alphonse_elric", name: "Alphonse Elric" },
      { id: "edwardelric", name: "Edward Elric" },
    ],
  },
  {
    group: "Grease",
    items: [
      { id: "dannyzuko", name: "Danny Zuko" },
      { id: "sandy", name: "Sandy" },
    ],
  },
  {
    group: "Harold & Kumar",
    items: [
      { id: "harold", name: "Harold" },
      { id: "kumar", name: "Kumar" },
    ],
  },
  {
    group: "Hi Hi Puffy AmiYumi",
    items: [
      { id: "anime_ami", name: "Ami" },
      { id: "anime_yumi", name: "Yumi" },
    ],
  },
  {
    group: "Hot Fuzz",
    items: [
      { id: "danny_butterman", name: "Danny Butterman" },
      { id: "nicholas_angel", name: "Nicholas Angel" },
    ],
  },
  {
    group: "Invader Zim",
    items: [
      { id: "gir_dog", name: "GIR" },
      { id: "invader_zim", name: "Zim" },
    ],
  },
  {
    group: "Jujutsu Kaisen",
    items: [
      { id: "gojo", name: "Gojo" },
      { id: "sukuna", name: "Sukuna" },
    ],
  },
  {
    group: "Kill Bill",
    items: [
      { id: "oren_ishii", name: "O-Ren Ishii" },
      { id: "the_bride", name: "The Bride" },
    ],
  },
  {
    group: "Leon: The Professional",
    items: [
      { id: "leon", name: "Leon" },
      { id: "mathilda", name: "Mathilda" },
    ],
  },
  {
    group: "Lethal Weapon",
    items: [
      { id: "murtaugh_lethal_weapon", name: "Murtaugh" },
      { id: "riggs_lethal_weapon", name: "Riggs" },
    ],
  },
  {
    group: "Masha and the Bear",
    items: [
      { id: "global_bear_masha", name: "Bear" },
      { id: "global_masha", name: "Masha" },
    ],
  },
  {
    group: "Men in Black",
    items: [
      { id: "agentj", name: "Agent J" },
      { id: "agentk_v2", name: "Agent K" },
    ],
  },
  {
    group: "Money Heist",
    items: [
      { id: "lcdp_mask", name: "Dali Mask" },
      { id: "lcdp_professor", name: "The Professor" },
    ],
  },
  {
    group: "Monty Python",
    items: [
      { id: "frenchtaunter", name: "French Taunter" },
      { id: "kingarthur", name: "King Arthur" },
    ],
  },
  {
    group: "Mr. & Mrs. Smith",
    items: [
      { id: "cult_jane_smith", name: "Jane Smith" },
      { id: "cult_john_smith", name: "John Smith" },
    ],
  },
  {
    group: "One Punch Man",
    items: [
      { id: "genos", name: "Genos" },
      { id: "saitama", name: "Saitama" },
    ],
  },
  {
    group: "Prison Break",
    items: [
      { id: "lincoln_burrows", name: "Lincoln Burrows" },
      { id: "michael_scofield", name: "Michael Scofield" },
    ],
  },
  {
    group: "Pucca",
    items: [
      { id: "anime_garu", name: "Garu" },
      { id: "anime_pucca", name: "Pucca" },
    ],
  },
  {
    group: "RoboCop",
    items: [
      { id: "bixby_snyder", name: "Bixby Snyder" },
      { id: "robocop", name: "RoboCop" },
    ],
  },
  {
    group: "Samurai Jack",
    items: [
      { id: "anime_aku_samurai", name: "Aku" },
      { id: "samuraijack", name: "Samurai Jack" },
    ],
  },
  {
    group: "Scary Movie",
    items: [
      { id: "ghostface_wazup", name: "Ghostface" },
      { id: "cult_officer_doofy_v2", name: "Officer Doofy" },
    ],
  },
  {
    group: "Sharkboy and Lavagirl",
    items: [
      { id: "lavagirl", name: "Lavagirl" },
      { id: "sharkboy", name: "Sharkboy" },
    ],
  },
  {
    group: "Squid Game",
    items: [
      { id: "frontman", name: "Front Man" },
      { id: "gihun", name: "Gi-hun" },
    ],
  },
  {
    group: "Step Brothers",
    items: [
      { id: "brennan", name: "Brennan" },
      { id: "dale", name: "Dale" },
    ],
  },
  {
    group: "The Amazing World of Gumball",
    items: [
      { id: "darwin", name: "Darwin" },
      { id: "gumball", name: "Gumball" },
    ],
  },
  {
    group: "The Big Lebowski",
    items: [
      { id: "jesus_quintana", name: "Jesus Quintana" },
      { id: "cult_the_dude", name: "The Dude" },
    ],
  },
  {
    group: "The Boys",
    items: [
      { id: "billy_butcher", name: "Billy Butcher" },
      { id: "homelander", name: "Homelander" },
    ],
  },
  {
    group: "The Fresh Prince of Bel-Air",
    items: [
      { id: "carlton", name: "Carlton" },
      { id: "freshprince", name: "Will" },
    ],
  },
  {
    group: "The Pink Panther",
    items: [
      { id: "inspectorclouseau", name: "Inspector Clouseau" },
      { id: "pinkpanther", name: "Pink Panther" },
    ],
  },
  {
    group: "The Sopranos",
    items: [
      { id: "christopher", name: "Christopher" },
      { id: "tony_soprano", name: "Tony Soprano" },
    ],
  },
  {
    group: "The Walking Dead",
    items: [
      { id: "negan", name: "Negan" },
      { id: "rick_grimes", name: "Rick Grimes" },
    ],
  },
  {
    group: "The Wolf of Wall Street",
    items: [
      { id: "donnieazoff", name: "Donnie Azoff" },
      { id: "jordanbelfort", name: "Jordan Belfort" },
    ],
  },
  {
    group: "The X-Files",
    items: [
      { id: "live_action_dana_scully_xfiles", name: "Dana Scully" },
      { id: "live_action_fox_mulder_xfiles", name: "Fox Mulder" },
    ],
  },
  {
    group: "Tom and Jerry",
    items: [
      { id: "jerry", name: "Jerry" },
      { id: "tom", name: "Tom" },
    ],
  },
  {
    group: "Trigun",
    items: [
      { id: "anime_vash", name: "Vash" },
      { id: "anime_wolfwood", name: "Wolfwood" },
    ],
  },
  {
    group: "Twilight",
    items: [
      { id: "twilight_bella", name: "Bella" },
      { id: "twilight_edward", name: "Edward" },
    ],
  },
  {
    group: "A Clockwork Orange",
    items: [
      { id: "alex_delarge", name: "Alex DeLarge" },
    ],
  },
  {
    group: "A Nightmare on Elm Street",
    items: [
      { id: "horror_freddy", name: "Freddy Krueger" },
    ],
  },
  {
    group: "Alien",
    items: [
      { id: "alien_xenomorph", name: "Xenomorph" },
    ],
  },
  {
    group: "American Psycho",
    items: [
      { id: "bateman", name: "Patrick Bateman" },
    ],
  },
  {
    group: "Anchorman",
    items: [
      { id: "ronburgundy", name: "Ron Burgundy" },
    ],
  },
  {
    group: "Ancient Aliens",
    items: [
      { id: "internet_giorgio_tsoukalos_aliens", name: "Giorgio Tsoukalos" },
    ],
  },
  {
    group: "Ben 10",
    items: [
      { id: "ben10", name: "Ben 10" },
    ],
  },
  {
    group: "Big Hero 6",
    items: [
      { id: "baymax_v2", name: "Baymax" },
    ],
  },
  {
    group: "Borat",
    items: [
      { id: "cult_borat_v3", name: "Borat" },
    ],
  },
  {
    group: "Captain Tsubasa",
    items: [
      { id: "global_tsubasa", name: "Tsubasa" },
    ],
  },
  {
    group: "CatDog",
    items: [
      { id: "anime_catdog", name: "CatDog" },
    ],
  },
  {
    group: "Chappelle's Show",
    items: [
      { id: "tyrone_biggums", name: "Tyrone Biggums" },
    ],
  },
  {
    group: "Chappie",
    items: [
      { id: "cult_chappie", name: "Chappie" },
    ],
  },
  {
    group: "Chhota Bheem",
    items: [
      { id: "global_chhota_bheem", name: "Chhota Bheem" },
    ],
  },
  {
    group: "Coraline",
    items: [
      { id: "coraline", name: "Coraline" },
    ],
  },
  {
    group: "Courage the Cowardly Dog",
    items: [
      { id: "courage", name: "Courage" },
    ],
  },
  {
    group: "Danny Phantom",
    items: [
      { id: "dannyphantom", name: "Danny Phantom" },
    ],
  },
  {
    group: "Dexter",
    items: [
      { id: "dexterkiller", name: "Dexter Morgan" },
    ],
  },
  {
    group: "Dexter's Laboratory",
    items: [
      { id: "dexter_lab", name: "Dexter" },
    ],
  },
  {
    group: "Don't Be a Menace",
    items: [
      { id: "locdog", name: "Loc Dog" },
    ],
  },
  {
    group: "Donnie Darko",
    items: [
      { id: "cult_frank_rabbit", name: "Frank" },
    ],
  },
  {
    group: "Eastbound & Down",
    items: [
      { id: "cult_kenny_powers", name: "Kenny Powers" },
    ],
  },
  {
    group: "El Chapulin Colorado",
    items: [
      { id: "chapolin", name: "Chapulin" },
    ],
  },
  {
    group: "Fear and Loathing in Las Vegas",
    items: [
      { id: "cult_raoul_duke", name: "Raoul Duke" },
    ],
  },
  {
    group: "Grendizer",
    items: [
      { id: "grendizer", name: "Grendizer" },
    ],
  },
  {
    group: "Hellboy",
    items: [
      { id: "hellboy", name: "Hellboy" },
    ],
  },
  {
    group: "Her",
    items: [
      { id: "theodore_v2", name: "Theodore" },
    ],
  },
  {
    group: "Indiana Jones",
    items: [
      { id: "indiana_jones", name: "Indiana Jones" },
    ],
  },
  {
    group: "Inglourious Basterds",
    items: [
      { id: "aldoraine", name: "Aldo Raine" },
    ],
  },
  {
    group: "John Wayne",
    items: [
      { id: "johnwayne", name: "John Wayne" },
    ],
  },
  {
    group: "Johnny Bravo",
    items: [
      { id: "johnnybravo", name: "Johnny Bravo" },
    ],
  },
  {
    group: "Johnny Test",
    items: [
      { id: "johnny_test", name: "Johnny Test" },
    ],
  },
  {
    group: "Judge Dredd",
    items: [
      { id: "judgedredd", name: "Judge Dredd" },
    ],
  },
  {
    group: "Kimi ni Todoke",
    items: [
      { id: "sawako", name: "Sawako" },
    ],
  },
  {
    group: "Kung Fu Hustle",
    items: [
      { id: "kungfu_landlady", name: "The Landlady" },
    ],
  },
  {
    group: "Madoka Magica",
    items: [
      { id: "madoka", name: "Madoka" },
    ],
  },
  {
    group: "Magic Mike",
    items: [
      { id: "magicmike", name: "Magic Mike" },
    ],
  },
  {
    group: "Mars Attacks!",
    items: [
      { id: "cult_mars_attacks", name: "Martian" },
    ],
  },
  {
    group: "Maya the Bee",
    items: [
      { id: "global_maya_bee", name: "Maya" },
    ],
  },
  {
    group: "Mazinger Z",
    items: [
      { id: "mazinger", name: "Mazinger" },
    ],
  },
  {
    group: "Moomin",
    items: [
      { id: "global_moomin", name: "Moomin" },
    ],
  },
  {
    group: "Mr. Bean",
    items: [
      { id: "mrbean", name: "Mr. Bean" },
    ],
  },
  {
    group: "My Life as a Teenage Robot",
    items: [
      { id: "anime_jenny_robot", name: "Jenny" },
    ],
  },
  {
    group: "My Neighbor Totoro",
    items: [
      { id: "totoro", name: "Totoro" },
    ],
  },
  {
    group: "Nana",
    items: [
      { id: "nana", name: "Nana Osaki" },
    ],
  },
  {
    group: "Napoleon Dynamite",
    items: [
      { id: "cult_napoleon_dynamite", name: "Napoleon Dynamite" },
    ],
  },
  {
    group: "Narcos",
    items: [
      { id: "pabloescobar", name: "Pablo Escobar" },
    ],
  },
  {
    group: "No Country for Old Men",
    items: [
      { id: "antonchigurh", name: "Anton Chigurh" },
    ],
  },
  {
    group: "Obsession",
    items: [
      { id: "live_action_anna_barton_obsession", name: "Anna Barton" },
    ],
  },
  {
    group: "Ocean's Eleven",
    items: [
      { id: "dannyocean", name: "Danny Ocean" },
    ],
  },
  {
    group: "Pan's Labyrinth",
    items: [
      { id: "pale_man", name: "Pale Man" },
    ],
  },
  {
    group: "Parks and Recreation",
    items: [
      { id: "cult_ron_swanson", name: "Ron Swanson" },
    ],
  },
  {
    group: "Paul",
    items: [
      { id: "cult_paul_alien", name: "Paul" },
    ],
  },
  {
    group: "Peaky Blinders",
    items: [
      { id: "tommy_shelby", name: "Tommy Shelby" },
    ],
  },
  {
    group: "Pokemon",
    items: [
      { id: "ash_pikachu", name: "Ash & Pikachu" },
    ],
  },
  {
    group: "Ponyo",
    items: [
      { id: "ponyo", name: "Ponyo" },
    ],
  },
  {
    group: "Pororo",
    items: [
      { id: "global_pororo", name: "Pororo" },
    ],
  },
  {
    group: "Predator",
    items: [
      { id: "predator", name: "Predator" },
    ],
  },
  {
    group: "Primal",
    items: [
      { id: "spear_primal", name: "Spear" },
    ],
  },
  {
    group: "Princess Mononoke",
    items: [
      { id: "princess_mononoke_v2", name: "San" },
    ],
  },
  {
    group: "Rambo",
    items: [
      { id: "rambo", name: "Rambo" },
    ],
  },
  {
    group: "Romeo + Juliet",
    items: [
      { id: "romeo", name: "Romeo" },
    ],
  },
  {
    group: "Sailor Moon",
    items: [
      { id: "sailormoon", name: "Sailor Moon" },
    ],
  },
  {
    group: "Scarface",
    items: [
      { id: "tonymontana_v2", name: "Tony Montana" },
    ],
  },
  {
    group: "Scream",
    items: [
      { id: "ghostface_classic", name: "Ghostface" },
    ],
  },
  {
    group: "Serial Experiments Lain",
    items: [
      { id: "anime_lain_iwakura_serial_experiments_lain", name: "Lain" },
    ],
  },
  {
    group: "Seth Rogen",
    items: [
      { id: "seth_rogen", name: "Seth Rogen" },
    ],
  },
  {
    group: "Snatch",
    items: [
      { id: "boris_the_blade", name: "Boris the Blade" },
    ],
  },
  {
    group: "Spider-Verse",
    items: [
      { id: "milesmorales", name: "Miles Morales" },
      { id: "spider_gwen", name: "Spider-Gwen" },
      { id: "milesmorales_v2", name: "Spider-Man" },
    ],
  },
  {
    group: "Superbad",
    items: [
      { id: "mclovin", name: "McLovin" },
    ],
  },
  {
    group: "Talladega Nights",
    items: [
      { id: "rickybobby", name: "Ricky Bobby" },
    ],
  },
  {
    group: "Ted",
    items: [
      { id: "cult_ted_bear", name: "Ted" },
    ],
  },
  {
    group: "The Dictator",
    items: [
      { id: "cult_aladeen", name: "Aladeen" },
    ],
  },
  {
    group: "The Dollars Trilogy",
    items: [
      { id: "manwithnoname", name: "Man with No Name" },
    ],
  },
  {
    group: "The Godfather",
    items: [
      { id: "don_corleone", name: "Don Corleone" },
    ],
  },
  {
    group: "The Goonies",
    items: [
      { id: "sloth_goonies", name: "Sloth" },
    ],
  },
  {
    group: "The Mask",
    items: [
      { id: "the_mask", name: "The Mask" },
    ],
  },
  {
    group: "The Mummy",
    items: [
      { id: "ahmanet", name: "Ahmanet" },
    ],
  },
  {
    group: "The Munsters",
    items: [
      { id: "herman_munster", name: "Herman Munster" },
    ],
  },
  {
    group: "The Room",
    items: [
      { id: "wiseau_tommy", name: "Tommy Wiseau" },
    ],
  },
  {
    group: "The Terminator",
    items: [
      { id: "terminator", name: "Terminator" },
    ],
  },
  {
    group: "The Thing",
    items: [
      { id: "kurtrussell_thing", name: "MacReady" },
    ],
  },
  {
    group: "The Twilight Zone",
    items: [
      { id: "twilight_zone_gremlin", name: "Gremlin" },
    ],
  },
  {
    group: "The Witcher",
    items: [
      { id: "geralt", name: "Geralt" },
    ],
  },
  {
    group: "Titanic",
    items: [
      { id: "jackdawson", name: "Jack Dawson" },
    ],
  },
  {
    group: "Tokyo Ghoul",
    items: [
      { id: "kaneki", name: "Kaneki" },
    ],
  },
  {
    group: "Toradora",
    items: [
      { id: "taiga", name: "Taiga" },
    ],
  },
  {
    group: "Tropic Thunder",
    items: [
      { id: "kirklazarus_v2", name: "Kirk Lazarus" },
    ],
  },
  {
    group: "Twin Peaks",
    items: [
      { id: "twin_peaks_man", name: "The Man from Another Place" },
    ],
  },
  {
    group: "V for Vendetta",
    items: [
      { id: "v_for_vendetta", name: "V" },
    ],
  },
  {
    group: "Vicky the Viking",
    items: [
      { id: "global_vicky_viking", name: "Vicky" },
    ],
  },
  {
    group: "Walker, Texas Ranger",
    items: [
      { id: "chucknorris_sheriff", name: "Cordell Walker" },
    ],
  },
  {
    group: "Wednesday",
    items: [
      { id: "wednesday", name: "Wednesday" },
    ],
  },
  {
    group: "You",
    items: [
      { id: "live_action_joe_goldberg_you", name: "Joe Goldberg" },
    ],
  },
];

export const AVATAR_COUNT = 621;
