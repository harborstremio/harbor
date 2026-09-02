import { t } from "@/lib/i18n";
import type { LearnTopic } from "./learn-types";

const TOPIC_SOURCE: LearnTopic[] = [
  {
    id: "space",
    title: "Space & Planets",
    emoji: "🚀",
    color: "#6366f1",
    cards: [
      {
        title: "The Sun",
        text: "The Sun is a giant star in the middle of our solar system. It gives us light and warmth every day.",
        funFact: "Wow! More than one million Earths could fit inside the Sun!",
        img: "https://upload.wikimedia.org/wikipedia/commons/thumb/8/83/The_Sun_in_white_light.jpg/500px-The_Sun_in_white_light.jpg",
      },
      {
        title: "The Moon",
        text: "The Moon is a big rock ball that travels around Earth. It shines at night by bouncing the Sun's light to us.",
        funFact: "Wow! Footprints on the Moon can last millions of years because there is no wind!",
        img: "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e1/FullMoon2010.jpg/500px-FullMoon2010.jpg",
      },
      {
        title: "Earth",
        text: "Earth is our home planet. It is the only planet we know with oceans, animals, and people.",
        funFact:
          "Wow! Earth is always spinning, so you are riding a giant spinning ball right now!",
        img: "https://upload.wikimedia.org/wikipedia/commons/thumb/2/2d/Meteosat-12-fci-march-equinox-2025-noon.jpg/500px-Meteosat-12-fci-march-equinox-2025-noon.jpg",
      },
      {
        title: "Mars",
        text: "Mars is called the Red Planet because its dust is rusty red. Robot rovers drive around and explore it!",
        funFact: "Wow! Mars has the tallest volcano in the whole solar system!",
        img: "https://upload.wikimedia.org/wikipedia/commons/thumb/0/0c/Mars_-_August_30_2021_-_Flickr_-_Kevin_M._Gill.png/500px-Mars_-_August_30_2021_-_Flickr_-_Kevin_M._Gill.png",
      },
      {
        title: "Jupiter",
        text: "Jupiter is the biggest planet in our solar system. It has a giant red storm that is bigger than Earth!",
        funFact: "Wow! All the other planets could fit inside Jupiter at the same time!",
        img: "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e2/Jupiter_OPAL_2024.png/500px-Jupiter_OPAL_2024.png",
      },
      {
        title: "Saturn",
        text: "Saturn is the planet with beautiful rings. The rings are made of sparkly ice and bits of rock.",
        funFact: "Wow! Saturn is so light it could float in a giant bathtub of water!",
        img: "https://upload.wikimedia.org/wikipedia/commons/thumb/4/43/Saturn_global_view_from_Cassini%2C_rings_open_Better_Colour.png/500px-Saturn_global_view_from_Cassini%2C_rings_open_Better_Colour.png",
      },
      {
        title: "Astronauts",
        text: "Astronauts are people who fly to space. They wear special suits to keep them safe and comfy.",
        funFact: "Wow! Astronauts float inside their spaceship, and their food can float too!",
        img: "https://upload.wikimedia.org/wikipedia/commons/thumb/9/91/Bruce_McCandless_II_during_EVA_in_1984.jpg/500px-Bruce_McCandless_II_during_EVA_in_1984.jpg",
      },
      {
        title: "Rockets",
        text: "Rockets are super fast machines that zoom up into space. They carry astronauts and satellites.",
        funFact: "Wow! A rocket can reach space in less than ten minutes!",
        img: "https://upload.wikimedia.org/wikipedia/commons/thumb/9/9a/Soyuz_TMA-9_launch.jpg/500px-Soyuz_TMA-9_launch.jpg",
      },
    ],
    quiz: [
      {
        q: "Which planet is called the Red Planet?",
        options: ["Jupiter", "Mars", "Saturn", "Earth"],
        answerIndex: 1,
      },
      {
        q: "What is the biggest planet in our solar system?",
        options: ["Earth", "Mars", "Saturn", "Jupiter"],
        answerIndex: 3,
      },
      {
        q: "What are Saturn's beautiful rings made of?",
        options: [
          "Ice and bits of rock",
          "Candy and cookies",
          "Clouds and rain",
          "Sand and seashells",
        ],
        answerIndex: 0,
      },
      {
        q: "What gives us light and warmth every day?",
        options: ["The Moon", "Mars", "The Sun", "A rocket"],
        answerIndex: 2,
      },
      {
        q: "What do astronauts ride to zoom up into space?",
        options: ["An airplane", "A rocket", "A boat", "A train"],
        answerIndex: 1,
      },
    ],
  },
  {
    id: "dinosaurs",
    title: "Dinosaurs",
    emoji: "🦖",
    color: "#4ade80",
    cards: [
      {
        title: "T. rex",
        text: "Tyrannosaurus rex was one of the biggest meat-eating dinosaurs. It had a giant head, sharp teeth, and very tiny arms!",
        funFact: "Wow! One T. rex tooth could be as big as a banana!",
        img: "https://upload.wikimedia.org/wikipedia/commons/thumb/9/94/Tyrannosaurus_Rex_Holotype.jpg/500px-Tyrannosaurus_Rex_Holotype.jpg",
      },
      {
        title: "Triceratops",
        text: "Triceratops had three horns on its face and a big bony frill around its neck. It ate plants like leaves and ferns.",
        funFact:
          "Wow! Triceratops had one of the biggest heads of any animal that ever walked on land!",
        img: "https://upload.wikimedia.org/wikipedia/commons/thumb/e/ec/LA-Triceratops_mount-2.jpg/500px-LA-Triceratops_mount-2.jpg",
      },
      {
        title: "Stegosaurus",
        text: "Stegosaurus had rows of big bony plates along its back and sharp spikes on its tail. It walked slowly and munched on plants.",
        funFact:
          "Wow! Stegosaurus was as big as a bus, but its brain was only the size of a walnut!",
        img: "https://upload.wikimedia.org/wikipedia/commons/thumb/b/bc/Journal.pone.0138352.g001A.jpg/500px-Journal.pone.0138352.g001A.jpg",
      },
      {
        title: "Velociraptor",
        text: "Velociraptor was a small, speedy dinosaur about the size of a turkey. It had feathers, just like a bird!",
        funFact: "Wow! Real Velociraptors were much smaller than the ones you see in the movies!",
        img: "https://upload.wikimedia.org/wikipedia/commons/thumb/3/3d/Velociraptor_skeleton_white_background.jpg/500px-Velociraptor_skeleton_white_background.jpg",
      },
      {
        title: "Brachiosaurus",
        text: "Brachiosaurus was a giant plant-eater with a super long neck. It could reach leaves at the very top of the tallest trees.",
        funFact: "Wow! Its neck was so long it could peek into a fourth-floor window!",
        img: "https://upload.wikimedia.org/wikipedia/commons/thumb/e/ed/Brachiosaurus_mount.jpg/500px-Brachiosaurus_mount.jpg",
      },
      {
        title: "Ankylosaurus",
        text: "Ankylosaurus was covered in tough, bony armor like a tank. It had a big heavy club on the end of its tail.",
        funFact: "Wow! Even its eyelids had bony armor to keep them safe!",
        img: "https://upload.wikimedia.org/wikipedia/commons/thumb/f/f0/Ankylosaur_head_-_cast_-_Custer_County_Montana_-_Museum_of_the_Rockies_-_2013-07-08.jpg/500px-Ankylosaur_head_-_cast_-_Custer_County_Montana_-_Museum_of_the_Rockies_-_2013-07-08.jpg",
      },
      {
        title: "Spinosaurus",
        text: "Spinosaurus had a tall sail on its back and a long snout like a crocodile. It loved the water and ate fish.",
        funFact: "Wow! Spinosaurus was even longer than a T. rex!",
        img: "https://upload.wikimedia.org/wikipedia/commons/thumb/f/f0/FSAC-KK-11888.jpg/500px-FSAC-KK-11888.jpg",
      },
      {
        title: "Fossils",
        text: "A fossil is the bones or footprints of an animal that slowly turned into rock. Scientists dig up dinosaur fossils to learn all about them.",
        funFact: "Wow! Some dinosaur fossils are more than 65 million years old!",
        img: "https://upload.wikimedia.org/wikipedia/commons/thumb/1/1a/Fossil_Diversity.png/500px-Fossil_Diversity.png",
      },
    ],
    quiz: [
      {
        q: "What was special about T. rex's arms?",
        options: [
          "They were very tiny",
          "They had big wings",
          "They were super long",
          "They glowed in the dark",
        ],
        answerIndex: 0,
      },
      {
        q: "How many horns did Triceratops have on its face?",
        options: ["One horn", "Ten horns", "Three horns", "No horns"],
        answerIndex: 2,
      },
      {
        q: "What did Stegosaurus have along its back?",
        options: ["Soft fluffy fur", "Big bony plates", "Bouncy balloons", "A comfy saddle"],
        answerIndex: 1,
      },
      {
        q: "Velociraptor was about the same size as which animal?",
        options: ["A big whale", "A tall giraffe", "A school bus", "A turkey"],
        answerIndex: 3,
      },
      {
        q: "What is a fossil?",
        options: [
          "A kind of candy",
          "Bones that turned into rock",
          "A baby dinosaur",
          "A type of tree",
        ],
        answerIndex: 1,
      },
    ],
  },
  {
    id: "world-animals",
    title: "Amazing Animals",
    emoji: "🦁",
    color: "#f97316",
    cards: [
      {
        title: "The Mighty Elephant",
        text: "Elephants are the biggest animals that live on land. They use their long trunks to grab snacks and spray water like a shower!",
        funFact: "An elephant's trunk has about 40,000 muscles, way more than your whole body!",
        img: "https://upload.wikimedia.org/wikipedia/commons/thumb/9/94/178_Male_African_bush_elephant_in_Etosha_National_Park_Photo_by_Giles_Laurent.jpg/500px-178_Male_African_bush_elephant_in_Etosha_National_Park_Photo_by_Giles_Laurent.jpg",
      },
      {
        title: "Speedy Cheetah",
        text: "The cheetah is the fastest runner of all the animals on land. It can zoom faster than a car on the highway!",
        funFact: "Cheetahs can't roar, but they can chirp like a bird and purr like a kitty!",
        img: "https://upload.wikimedia.org/wikipedia/commons/thumb/9/92/Male_cheetah_facing_left_in_South_Africa.jpg/500px-Male_cheetah_facing_left_in_South_Africa.jpg",
      },
      {
        title: "The Polar Bear",
        text: "Polar bears live in the snowy, icy Arctic. Their thick fur keeps them cozy, and they are amazing swimmers!",
        funFact: "Under its fluffy white fur, a polar bear's skin is actually black!",
        img: "https://upload.wikimedia.org/wikipedia/commons/thumb/6/66/Polar_Bear_-_Alaska_%28cropped%29.jpg/500px-Polar_Bear_-_Alaska_%28cropped%29.jpg",
      },
      {
        title: "Bouncy Kangaroos",
        text: "Kangaroos live in Australia and bounce around on their big, springy back legs. A baby kangaroo is called a joey, and it rides inside its mom's pouch!",
        funFact: "A newborn baby kangaroo is only about the size of a jelly bean!",
        img: "https://upload.wikimedia.org/wikipedia/commons/thumb/d/df/Forester_kangaroo_%28Macropus_giganteus_tasmaniensis%29_juvenile_hopping_Esk_Valley.jpg/500px-Forester_kangaroo_%28Macropus_giganteus_tasmaniensis%29_juvenile_hopping_Esk_Valley.jpg",
      },
      {
        title: "The Bald Eagle",
        text: "The bald eagle is a big, strong bird with super-sharp eyes. It can spot a fish in the water from way up in the sky!",
        funFact: "A bald eagle's giant stick nest can grow to be bigger than your bed!",
        img: "https://upload.wikimedia.org/wikipedia/commons/thumb/d/db/Bald_eagle_about_to_fly_in_Alaska_%282016%29.jpg/500px-Bald_eagle_about_to_fly_in_Alaska_%282016%29.jpg",
      },
      {
        title: "Clever Chameleon",
        text: "A chameleon is a lizard that can change its colors. Its eyes can look in two different directions at the very same time!",
        funFact: "A chameleon's sticky tongue can be longer than its whole body!",
        img: "https://upload.wikimedia.org/wikipedia/commons/thumb/8/8a/Panther_Chameleon_738367_%28cropped%29.jpg/500px-Panther_Chameleon_738367_%28cropped%29.jpg",
      },
      {
        title: "The Tall Giraffe",
        text: "Giraffes are the tallest animals in the whole world. Their long necks help them munch leaves from the tops of tall trees.",
        funFact: "A giraffe's tongue is purple-blue and longer than a school ruler!",
        img: "https://upload.wikimedia.org/wikipedia/commons/thumb/9/9e/Giraffe_Mikumi_National_Park.jpg/500px-Giraffe_Mikumi_National_Park.jpg",
      },
      {
        title: "The Blue Whale",
        text: "The blue whale is the biggest animal that has ever lived, even bigger than any dinosaur! It swims in the ocean and eats tiny sea creatures called krill.",
        funFact: "A blue whale's heart is as big as a small car!",
        img: "https://upload.wikimedia.org/wikipedia/commons/thumb/1/1c/Anim1754_-_Flickr_-_NOAA_Photo_Library.jpg/500px-Anim1754_-_Flickr_-_NOAA_Photo_Library.jpg",
      },
    ],
    quiz: [
      {
        q: "Which animal is the fastest runner on land?",
        options: ["The elephant", "The cheetah", "The polar bear", "The kangaroo"],
        answerIndex: 1,
      },
      {
        q: "Where does a baby kangaroo, called a joey, love to ride?",
        options: ["In its mom's pouch", "On an eagle's back", "Inside a whale", "Up in a treetop"],
        answerIndex: 0,
      },
      {
        q: "What amazing trick can a chameleon do?",
        options: ["Sing a song", "Hop to Australia", "Change its colors", "Build a giant nest"],
        answerIndex: 2,
      },
      {
        q: "Which animal is the biggest animal that has EVER lived?",
        options: ["The elephant", "The giraffe", "The polar bear", "The blue whale"],
        answerIndex: 3,
      },
      {
        q: "What color is a giraffe's tongue?",
        options: ["Pink", "Purple-blue", "Green", "Yellow"],
        answerIndex: 1,
      },
    ],
  },
  {
    id: "bugs",
    title: "Bugs & Insects",
    emoji: "🐝",
    color: "#facc15",
    cards: [
      {
        title: "Monarch Butterfly",
        text: "Monarch butterflies have beautiful orange and black wings. Every fall, big groups of them fly far away to spend winter where it is warm.",
        funFact: "Some monarchs fly more than 2,000 miles, all the way to Mexico!",
        img: "https://upload.wikimedia.org/wikipedia/commons/thumb/7/73/Monarch_Butterfly_Danaus_plexippus_Male_2664px.jpg/500px-Monarch_Butterfly_Danaus_plexippus_Male_2664px.jpg",
      },
      {
        title: "Honey Bee",
        text: "Honey bees sip sweet nectar from flowers and turn it into honey. They live together in big, busy families called hives.",
        funFact: "Honey bees do a waggle dance to tell their friends where the flowers are!",
        img: "https://upload.wikimedia.org/wikipedia/commons/thumb/4/4d/Apis_mellifera_Western_honey_bee.jpg/500px-Apis_mellifera_Western_honey_bee.jpg",
      },
      {
        title: "Mighty Ants",
        text: "Ants are tiny insects that live in big teams called colonies. They work together to find food and take care of their nest.",
        funFact: "One little ant can lift something many times heavier than its own body!",
        img: "https://upload.wikimedia.org/wikipedia/commons/thumb/d/db/Red_Ant_-_March_2025.jpg/500px-Red_Ant_-_March_2025.jpg",
      },
      {
        title: "Lucky Ladybug",
        text: "Ladybugs are small, round beetles with polka-dot spots. Their favorite snack is a teeny plant bug called an aphid, so gardens love them!",
        funFact:
          "A ladybug's bright colors are a secret message to birds that says, 'I don't taste yummy!'",
        img: "https://upload.wikimedia.org/wikipedia/commons/thumb/7/77/Coccinella-septempunctata-15-fws.jpg/500px-Coccinella-septempunctata-15-fws.jpg",
      },
      {
        title: "Glowing Fireflies",
        text: "Fireflies are gentle beetles that can make their own light. On warm summer nights, they blink and glow like tiny flying lanterns.",
        funFact: "Fireflies talk to each other with flashes of light!",
        img: "https://upload.wikimedia.org/wikipedia/commons/thumb/5/52/Photuris_lucicrescens.jpg/500px-Photuris_lucicrescens.jpg",
      },
      {
        title: "Dazzling Dragonfly",
        text: "Dragonflies have four sparkly wings and giant eyes. They are super fliers that can hover in one spot and even zoom backward.",
        funFact: "Dragonflies were zooming around Earth before the dinosaurs!",
        img: "https://upload.wikimedia.org/wikipedia/commons/thumb/b/b4/Red_grasshawk_%28Neurothemis_fluctuans%29_male_Phuket_2.jpg/500px-Red_grasshawk_%28Neurothemis_fluctuans%29_male_Phuket_2.jpg",
      },
      {
        title: "Wiggly Caterpillar",
        text: "A caterpillar is a baby butterfly or moth. It munches lots of leaves, then rests inside a cozy chrysalis and comes out with wings!",
        funFact: "Many baby caterpillars eat their own eggshell as their very first snack!",
        img: "https://upload.wikimedia.org/wikipedia/commons/thumb/f/f3/Chenille_de_Grand_porte_queue_%28macaon%29.jpg/500px-Chenille_de_Grand_porte_queue_%28macaon%29.jpg",
      },
      {
        title: "Jumpy Grasshopper",
        text: "Grasshoppers have strong back legs that help them make giant jumps. Some sing chirpy songs by rubbing their legs against their wings.",
        funFact: "A grasshopper's ears are on its belly!",
        img: "https://upload.wikimedia.org/wikipedia/commons/thumb/b/b7/American_Bird_Grasshopper.jpg/500px-American_Bird_Grasshopper.jpg",
      },
    ],
    quiz: [
      {
        q: "Where do monarch butterflies fly every fall?",
        options: [
          "Somewhere warm and cozy",
          "The North Pole",
          "The bottom of the sea",
          "Outer space",
        ],
        answerIndex: 0,
      },
      {
        q: "How do honey bees tell their friends where the flowers are?",
        options: [
          "They write tiny notes",
          "They do a waggle dance",
          "They whistle a song",
          "They draw a map",
        ],
        answerIndex: 1,
      },
      {
        q: "What is a ladybug's favorite snack?",
        options: ["Ice cream", "Acorns", "Teeny bugs called aphids", "Pizza"],
        answerIndex: 2,
      },
      {
        q: "Which amazing flier can zoom backward?",
        options: ["Ladybug", "Ant", "Grasshopper", "Dragonfly"],
        answerIndex: 3,
      },
      {
        q: "Where are a grasshopper's ears?",
        options: ["On its belly", "On its toes", "Inside its hat", "On its wings"],
        answerIndex: 0,
      },
    ],
  },
  {
    id: "human-body",
    title: "The Human Body",
    emoji: "🧠",
    color: "#f472b6",
    cards: [
      {
        title: "Your Heart",
        text: "Your heart is a muscle about the size of your fist. It pumps blood all around your body, all day and all night.",
        funFact: "Your heart beats about 100,000 times every single day!",
        img: "https://upload.wikimedia.org/wikipedia/commons/thumb/1/1b/Heart_anterior_exterior_view.png/500px-Heart_anterior_exterior_view.png",
      },
      {
        title: "Your Brain",
        text: "Your brain is the boss of your whole body. It helps you think, remember things, and move.",
        funFact: "Your brain keeps working even when you are fast asleep!",
        img: "https://upload.wikimedia.org/wikipedia/commons/thumb/8/89/Brain_autopsy_lateral_view.jpg/500px-Brain_autopsy_lateral_view.jpg",
      },
      {
        title: "Your Bones",
        text: "Bones are hard and strong, and they hold your body up like a frame. All your bones together are called your skeleton.",
        funFact: "Grown-ups have 206 bones, but babies are born with about 300!",
        img: "https://upload.wikimedia.org/wikipedia/commons/thumb/1/14/Human-Skeleton.jpg/500px-Human-Skeleton.jpg",
      },
      {
        title: "Your Muscles",
        text: "Muscles help you run, jump, and wave hello. They pull on your bones to make your body move.",
        funFact: "You use lots of little muscles just to smile at a friend!",
        img: "https://upload.wikimedia.org/wikipedia/commons/thumb/0/0d/Types_of_muscle.webp/500px-Types_of_muscle.webp.png",
      },
      {
        title: "Your Eyes",
        text: "Your eyes let you see the world in bright colors. They work like tiny cameras that send pictures to your brain.",
        funFact: "You blink about 15 times every minute without even thinking about it!",
        img: "https://upload.wikimedia.org/wikipedia/commons/thumb/8/8f/Human_eye_with_blood_vessels.jpg/500px-Human_eye_with_blood_vessels.jpg",
      },
      {
        title: "Your Ears",
        text: "Your ears help you hear music, voices, and happy sounds. They also help you keep your balance so you can stand up tall.",
        funFact: "Your ears keep hearing even while you are asleep!",
        img: "https://upload.wikimedia.org/wikipedia/commons/thumb/e/ed/Human_right_ear_%28cropped%29.jpg/500px-Human_right_ear_%28cropped%29.jpg",
      },
      {
        title: "Why We Sleep",
        text: "Sleep lets your body rest and grow. While you sleep, your brain tidies up everything you learned during the day.",
        funFact: "Kids need more sleep than grown-ups to help them grow big and strong!",
        img: "https://upload.wikimedia.org/wikipedia/commons/thumb/1/18/Domenico_Fetti_-_Sleeping_Girl_-_WGA7863.jpg/500px-Domenico_Fetti_-_Sleeping_Girl_-_WGA7863.jpg",
      },
      {
        title: "Yummy Food",
        text: "Food gives your body the energy to play and learn. Fruits and veggies help you grow healthy and strong.",
        funFact: "The energy in your food first came all the way from the Sun!",
        img: "https://upload.wikimedia.org/wikipedia/commons/thumb/6/6d/Good_Food_Display_-_NCI_Visuals_Online.jpg/500px-Good_Food_Display_-_NCI_Visuals_Online.jpg",
      },
    ],
    quiz: [
      {
        q: "What is the main job of your heart?",
        options: [
          "To pump blood all around your body",
          "To help you hear music",
          "To grow your fingernails",
          "To chew your food",
        ],
        answerIndex: 0,
      },
      {
        q: "Which body part helps you think and remember?",
        options: ["Your bones", "Your brain", "Your heart", "Your ears"],
        answerIndex: 1,
      },
      {
        q: "Your eyes work a little bit like what?",
        options: ["Little drums", "Little cars", "Little cameras", "Little clouds"],
        answerIndex: 2,
      },
      {
        q: "How many bones does a grown-up have?",
        options: ["Just 10", "About 1,000", "Only 2", "206"],
        answerIndex: 3,
      },
      {
        q: "Where did the energy in your food first come from?",
        options: ["The Sun", "The Moon", "A light switch", "The freezer"],
        answerIndex: 0,
      },
    ],
  },
  {
    id: "weather",
    title: "Weather & Nature",
    emoji: "🌈",
    color: "#38bdf8",
    cards: [
      {
        title: "Rainbows",
        text: "A rainbow appears when sunlight shines through raindrops. The drops split the light into many pretty colors.",
        funFact:
          "Wow! Sometimes you can see a double rainbow, and the second one has its colors flipped!",
        img: "https://upload.wikimedia.org/wikipedia/commons/thumb/5/5c/Double-alaskan-rainbow.jpg/500px-Double-alaskan-rainbow.jpg",
      },
      {
        title: "Lightning",
        text: "Lightning is a giant spark of electricity made by storm clouds. It lights up the sky in a quick flash!",
        funFact: "Wow! A lightning flash is hotter than the surface of the Sun!",
        img: "https://upload.wikimedia.org/wikipedia/commons/thumb/c/c2/Port_and_lighthouse_overnight_storm_with_lightning_in_Port-la-Nouvelle.jpg/500px-Port_and_lighthouse_overnight_storm_with_lightning_in_Port-la-Nouvelle.jpg",
      },
      {
        title: "Snow",
        text: "Snow is made of tiny ice crystals that grow inside cold clouds. They float down and cover the ground in soft white.",
        funFact: "Wow! Snowflakes almost always have exactly six sides!",
        img: "https://upload.wikimedia.org/wikipedia/commons/thumb/1/12/CargoNet_Di_12_Euro_4000_L%C3%B8nsdal_-_Bolna.jpg/500px-CargoNet_Di_12_Euro_4000_L%C3%B8nsdal_-_Bolna.jpg",
      },
      {
        title: "Clouds",
        text: "Clouds are made of millions of tiny water drops floating in the sky. Big gray clouds can bring rain.",
        funFact: "Wow! One fluffy cloud can weigh as much as 100 elephants!",
        img: "https://upload.wikimedia.org/wikipedia/commons/thumb/1/1d/ISS-40_Thunderheads_near_Borneo.jpg/500px-ISS-40_Thunderheads_near_Borneo.jpg",
      },
      {
        title: "Volcanoes",
        text: "A volcano is a mountain with an opening that goes deep into the Earth. Hot melted rock called lava can flow out of it.",
        funFact: "Wow! The biggest volcano we know is not on Earth, it is on Mars!",
        img: "https://upload.wikimedia.org/wikipedia/commons/thumb/4/48/Augustine_volcano_Jan_24_2006_-_Cyrus_Read.jpg/500px-Augustine_volcano_Jan_24_2006_-_Cyrus_Read.jpg",
      },
      {
        title: "The Seasons",
        text: "Many places have four seasons: spring, summer, fall, and winter. They change because the Earth is tilted as it travels around the Sun.",
        funFact:
          "Wow! When you are having summer, kids on the other side of the world are having winter!",
        img: "https://upload.wikimedia.org/wikipedia/commons/thumb/9/91/ChangingSeasons_NH_01.png/500px-ChangingSeasons_NH_01.png",
      },
      {
        title: "Rain",
        text: "Rain is water falling from clouds in little drops. It gives plants, animals, and people the water they need.",
        funFact:
          "Wow! Rain water is super old, so a dinosaur may have sipped the same water long, long ago!",
        img: "https://upload.wikimedia.org/wikipedia/commons/thumb/6/65/Hard_rain_on_a_roof.jpg/500px-Hard_rain_on_a_roof.jpg",
      },
      {
        title: "Wind",
        text: "Wind is air that is moving. You cannot see it, but you can feel it push kites, leaves, and clouds across the sky.",
        funFact: "Wow! Wind can blow desert dust all the way across the ocean!",
        img: "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e2/Cherry_tree_moving_in_the_wind_1.gif/500px-Cherry_tree_moving_in_the_wind_1.gif",
      },
    ],
    quiz: [
      {
        q: "What makes a rainbow appear?",
        options: [
          "Sunlight shining through raindrops",
          "The Moon painting the sky",
          "Birds flying in circles",
          "Snow falling at night",
        ],
        answerIndex: 0,
      },
      {
        q: "What is lightning?",
        options: [
          "A sleepy little cloud",
          "A giant spark of electricity",
          "A splash of rain",
          "A gust of wind",
        ],
        answerIndex: 1,
      },
      {
        q: "How many sides do snowflakes almost always have?",
        options: ["Two", "Ten", "Six", "One hundred"],
        answerIndex: 2,
      },
      {
        q: "What is the hot melted rock that flows out of a volcano called?",
        options: ["Snow", "Mud", "Sand", "Lava"],
        answerIndex: 3,
      },
      {
        q: "When it is summer where you live, what season is it on the other side of the world?",
        options: ["Winter", "Summer there too", "There are no seasons", "Rainbow season"],
        answerIndex: 0,
      },
    ],
  },
  {
    id: "plants",
    title: "Plants & Trees",
    emoji: "🌱",
    color: "#22c55e",
    cards: [
      {
        title: "Green Leaves",
        text: "Plants use their green leaves to catch sunlight. They turn sunlight, water, and air into their very own food!",
        funFact: "Wow! Each leaf is like a tiny kitchen that makes food using sunshine.",
        img: "https://upload.wikimedia.org/wikipedia/commons/thumb/c/c7/Lisc_lipy.jpg/500px-Lisc_lipy.jpg",
      },
      {
        title: "Giant Sequoia",
        text: "The giant sequoia is the biggest tree in the whole world. It grows super tall, super wide, and lives a very long time!",
        funFact: "Wow! Some giant sequoias have been alive for more than 2,000 years.",
        img: "https://upload.wikimedia.org/wikipedia/commons/thumb/1/1c/Grizzly_Giant_Mariposa_Grove.jpg/500px-Grizzly_Giant_Mariposa_Grove.jpg",
      },
      {
        title: "Sunflowers",
        text: "Sunflowers are big, bright yellow flowers. When they are young, they turn to follow the sun across the sky!",
        funFact: "Wow! Just one sunflower can hold more than 1,000 seeds in its round middle.",
        img: "https://upload.wikimedia.org/wikipedia/commons/thumb/4/40/Sunflower_sky_backdrop.jpg/500px-Sunflower_sky_backdrop.jpg",
      },
      {
        title: "Tiny Seeds",
        text: "Many plants start life as a little seed. With water, sunshine, and soil, a seed can grow into a big plant!",
        funFact: "Wow! Some seeds are so tiny they look like little specks of dust.",
        img: "https://upload.wikimedia.org/wikipedia/commons/thumb/d/dc/%D0%A0%D0%B0%D0%B7%D0%BD%D0%BE%D0%BE%D0%B1%D1%80%D0%B0%D0%B7%D0%B8%D0%B5_%D1%81%D0%B5%D0%BC%D1%8F%D0%BD.jpg/500px-%D0%A0%D0%B0%D0%B7%D0%BD%D0%BE%D0%BE%D0%B1%D1%80%D0%B0%D0%B7%D0%B8%D0%B5_%D1%81%D0%B5%D0%BC%D1%8F%D0%BD.jpg",
      },
      {
        title: "Giant Cactus",
        text: "The saguaro is a giant cactus that lives in the hot, sunny desert. It soaks up rain and stores the water inside to drink later!",
        funFact: "Wow! A saguaro cactus can live for more than 150 years.",
        img: "https://upload.wikimedia.org/wikipedia/commons/thumb/c/cd/Carnegiea_gigantea_in_Saguaro_National_Park_near_Tucson%2C_Arizona_during_November_%2858%29.jpg/500px-Carnegiea_gigantea_in_Saguaro_National_Park_near_Tucson%2C_Arizona_during_November_%2858%29.jpg",
      },
      {
        title: "Bamboo",
        text: "Bamboo is a tall plant that is really a kind of grass. It is one of the fastest growing plants on Earth!",
        funFact: "Wow! Some bamboo can grow up to 3 feet taller in just one day.",
        img: "https://upload.wikimedia.org/wikipedia/commons/thumb/f/f3/Bamboo_forest.jpg/500px-Bamboo_forest.jpg",
      },
      {
        title: "Venus Flytrap",
        text: "The Venus flytrap has leaves shaped like little mouths. When a tiny bug lands inside, the leaf gently snaps shut!",
        funFact: "Wow! A Venus flytrap can snap its trap shut in less than one second.",
        img: "https://upload.wikimedia.org/wikipedia/commons/thumb/3/37/Venus_Flytrap_showing_trigger_hairs.jpg/500px-Venus_Flytrap_showing_trigger_hairs.jpg",
      },
      {
        title: "Apple Trees",
        text: "Apples grow on trees, starting as pretty white and pink flowers. Inside every apple are little seeds that can grow into new trees!",
        funFact: "Wow! There are more than 7,500 different kinds of apples around the world.",
        img: "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a6/Pink_lady_and_cross_section.jpg/500px-Pink_lady_and_cross_section.jpg",
      },
    ],
    quiz: [
      {
        q: "What do plants use to catch sunlight and make their food?",
        options: ["Their green leaves", "Their roots", "The rocks nearby", "The wind"],
        answerIndex: 0,
      },
      {
        q: "Which of these is the biggest tree in the whole world?",
        options: ["A sunflower", "A blade of grass", "The giant sequoia", "A small bush"],
        answerIndex: 2,
      },
      {
        q: "What do young sunflowers do as the sun moves across the sky?",
        options: [
          "They dig into the ground",
          "They turn to follow the sun",
          "They swim in the sea",
          "They fly up to the clouds",
        ],
        answerIndex: 1,
      },
      {
        q: "Where does a giant saguaro cactus store water to drink later?",
        options: ["In the clouds", "In a water bottle", "In its flowers", "Inside its own body"],
        answerIndex: 3,
      },
      {
        q: "Bamboo grows very fast. What kind of plant is it really?",
        options: ["A kind of grass", "A kind of tree nut", "A kind of cactus", "A kind of flower"],
        answerIndex: 0,
      },
    ],
  },
  {
    id: "inventions",
    title: "Cool Inventions",
    emoji: "💡",
    color: "#a78bfa",
    cards: [
      {
        title: "The Wheel",
        text: "The wheel was invented more than 5,000 years ago. Wheels help carts, cars, and bikes roll along smoothly.",
        funFact:
          "Some of the very first wheels were not for riding at all, they were for spinning clay into pots!",
        img: "https://upload.wikimedia.org/wikipedia/commons/thumb/d/de/Landesmuseum_W%C3%BCrttemberg_Kelten_011.4.jpg/500px-Landesmuseum_W%C3%BCrttemberg_Kelten_011.4.jpg",
      },
      {
        title: "Amazing Airplanes",
        text: "An airplane has wings that lift it high into the sky. The Wright brothers flew the first airplane in 1903.",
        funFact: "The very first airplane flight lasted just 12 seconds!",
        img: "https://upload.wikimedia.org/wikipedia/commons/thumb/3/36/United_Airlines_Boeing_777-200_Meulemans.jpg/500px-United_Airlines_Boeing_777-200_Meulemans.jpg",
      },
      {
        title: "Terrific Telescopes",
        text: "A telescope makes faraway things look big and close. Long ago, Galileo used one to see mountains on the Moon!",
        funFact: "Some telescopes ride in space and take pictures of faraway baby stars!",
        img: "https://upload.wikimedia.org/wikipedia/commons/thumb/a/ac/100inchHooker.jpg/500px-100inchHooker.jpg",
      },
      {
        title: "Busy Robots",
        text: "A robot is a machine that can do jobs all by itself. Some robots help build cars, and some vacuum the floor!",
        funFact: "Robot rovers have driven around on Mars, taking pictures for us!",
        img: "https://upload.wikimedia.org/wikipedia/commons/thumb/0/05/HONDA_ASIMO.jpg/500px-HONDA_ASIMO.jpg",
      },
      {
        title: "Bicycles",
        text: "A bicycle has two wheels and pedals that make it go. The very first bikes had no pedals, so riders pushed the ground with their feet!",
        funFact: "Long ago, some bicycles had a giant front wheel taller than a kid!",
        img: "https://upload.wikimedia.org/wikipedia/commons/thumb/4/41/Left_side_of_Flying_Pigeon.jpg/500px-Left_side_of_Flying_Pigeon.jpg",
      },
      {
        title: "The Light Bulb",
        text: "Light bulbs turn electricity into bright light. Thomas Edison helped make light bulbs that people could use in their homes.",
        funFact: "Before light bulbs, families lit their homes with candles and oil lamps!",
        img: "https://upload.wikimedia.org/wikipedia/commons/thumb/b/b4/Gluehlampe_01_KMJ.png/500px-Gluehlampe_01_KMJ.png",
      },
      {
        title: "Hot Air Balloons",
        text: "A hot air balloon floats up when the air inside gets nice and hot. Balloons were one of the first ways people ever flew!",
        funFact: "The first balloon passengers were a sheep, a duck, and a rooster!",
        img: "https://upload.wikimedia.org/wikipedia/commons/thumb/8/8a/2006_Ojiya_balloon_festival_011.jpg/500px-2006_Ojiya_balloon_festival_011.jpg",
      },
      {
        title: "Roaring Rockets",
        text: "Rockets blast off by pushing hot gas out of the bottom. Big rockets carried astronauts all the way to the Moon!",
        funFact: "The Moon rocket was taller than a 30-story building!",
        img: "https://upload.wikimedia.org/wikipedia/commons/thumb/9/9a/Soyuz_TMA-9_launch.jpg/500px-Soyuz_TMA-9_launch.jpg",
      },
    ],
    quiz: [
      {
        q: "How long ago was the wheel invented?",
        options: ["Last year", "More than 5,000 years ago", "Only 100 years ago", "Last Tuesday"],
        answerIndex: 1,
      },
      {
        q: "Who flew the first airplane?",
        options: ["The Wright brothers", "A team of robots", "Galileo", "Thomas Edison"],
        answerIndex: 0,
      },
      {
        q: "What does a telescope do?",
        options: [
          "It makes music",
          "It cooks dinner",
          "It makes faraway things look big and close",
          "It pumps up bike tires",
        ],
        answerIndex: 2,
      },
      {
        q: "Who were the very first hot air balloon passengers?",
        options: [
          "Three astronauts",
          "A robot rover",
          "Two puppies",
          "A sheep, a duck, and a rooster",
        ],
        answerIndex: 3,
      },
      {
        q: "Where have robot rovers driven around and taken pictures?",
        options: ["On Mars", "In a candy shop", "At the playground", "Under your bed"],
        answerIndex: 0,
      },
    ],
  },
];

export const TOPICS: LearnTopic[] = TOPIC_SOURCE.map((topic) => ({
  ...topic,
  title: t(topic.title),
  cards: topic.cards.map((card) => ({
    ...card,
    title: t(card.title),
    text: t(card.text),
    funFact: t(card.funFact),
  })),
  quiz: topic.quiz.map((question) => ({
    ...question,
    q: t(question.q),
    options: question.options.map((option) => t(option)),
  })),
}));
