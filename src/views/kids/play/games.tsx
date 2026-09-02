import { Expand, Gamepad2, Loader2, Minimize, RotateCcw } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useT } from "@/lib/i18n";

type Category = "Action" | "Puzzle" | "Learning" | "Sports & Racing" | "Build & Cook" | "Clickers";

type Game = { name: string; blurb: string; scratchId: number; cat: Category };

const GAMES: Game[] = [
  {
    name: "Paper Minecraft",
    blurb: "Build and explore in 2D",
    scratchId: 10128407,
    cat: "Build & Cook",
  },
  {
    name: "Miner Cat",
    blurb: "Dig deep, collect it all",
    scratchId: 336338957,
    cat: "Build & Cook",
  },
  {
    name: "Burger Maker",
    blurb: "Stack the tastiest burger",
    scratchId: 650886217,
    cat: "Build & Cook",
  },
  { name: "Appel", blurb: "Jumpy apple platformer", scratchId: 60917032, cat: "Action" },
  { name: "Platformer!", blurb: "Run, jump and bounce", scratchId: 853110869, cat: "Action" },
  {
    name: "Geometry Dash Wave",
    blurb: "Ride the wave, dodge spikes",
    scratchId: 728467856,
    cat: "Action",
  },
  { name: "Flappy Bird", blurb: "Flap between the pipes", scratchId: 195385320, cat: "Action" },
  { name: "Crossy Road", blurb: "Hop across safely", scratchId: 230324399, cat: "Action" },
  { name: "Getting Over It", blurb: "Climb up. Don't fall!", scratchId: 389464290, cat: "Action" },
  { name: "Rogue Knight", blurb: "Pixel knight adventure", scratchId: 437336918, cat: "Action" },
  { name: "Pacman Platformer", blurb: "Chomp and jump", scratchId: 273440163, cat: "Action" },
  { name: "Space Shooter", blurb: "Blast through space", scratchId: 562520973, cat: "Action" },
  { name: "Dino Runner", blurb: "The no-internet dinosaur", scratchId: 318868094, cat: "Action" },
  {
    name: "Dino Game Remastered",
    blurb: "Jump the cactuses, fancy",
    scratchId: 339875080,
    cat: "Action",
  },
  { name: "Tetris", blurb: "Stack the falling blocks", scratchId: 469540467, cat: "Puzzle" },
  { name: "2048", blurb: "Slide tiles, make big numbers", scratchId: 312722722, cat: "Puzzle" },
  { name: "Mini Pacman", blurb: "Eat dots, dodge ghosts", scratchId: 164237855, cat: "Puzzle" },
  { name: "Connect 4", blurb: "Four in a row wins", scratchId: 235787333, cat: "Puzzle" },
  { name: "Emoji Memory", blurb: "Find the emoji pairs", scratchId: 163456722, cat: "Puzzle" },
  { name: "Maze Game", blurb: "Find your way out", scratchId: 217898739, cat: "Puzzle" },
  { name: "Treasure Hunter", blurb: "A 3D maze adventure", scratchId: 214123473, cat: "Puzzle" },
  { name: "Tower Defense", blurb: "Stop the invaders", scratchId: 411210603, cat: "Puzzle" },
  { name: "Tower Defense 2", blurb: "Even bigger defenses", scratchId: 187139359, cat: "Puzzle" },
  { name: "Math Game", blurb: "Quick math challenges", scratchId: 621467787, cat: "Learning" },
  {
    name: "Rapid Multiplication",
    blurb: "Times tables, fast!",
    scratchId: 196194631,
    cat: "Learning",
  },
  { name: "Typing Game", blurb: "Type words like a pro", scratchId: 219477156, cat: "Learning" },
  { name: "Piano", blurb: "Play real songs", scratchId: 409714793, cat: "Learning" },
  { name: "Pixel Art Creator", blurb: "Draw with pixels", scratchId: 744659873, cat: "Learning" },
  { name: "Minecraft Obby", blurb: "Hop the tricky blocks", scratchId: 320275826, cat: "Action" },
  { name: "Pixel Parkour", blurb: "Leap rooftop to rooftop", scratchId: 211393717, cat: "Action" },
  { name: "Parkour Pursuit", blurb: "Run, wall-jump, escape", scratchId: 297231510, cat: "Action" },
  { name: "Sky Ninja", blurb: "Slice through the clouds", scratchId: 234172040, cat: "Action" },
  { name: "Asteroids", blurb: "Zap the space rocks", scratchId: 795338000, cat: "Action" },
  { name: "Frogger", blurb: "Help the frog cross", scratchId: 411129427, cat: "Action" },
  { name: "Jetpack Joyride", blurb: "Blast off and dodge", scratchId: 177334143, cat: "Action" },
  { name: "Snake", blurb: "Eat apples, grow long", scratchId: 407329986, cat: "Puzzle" },
  { name: "Pong", blurb: "The original paddle battle", scratchId: 244698177, cat: "Puzzle" },
  { name: "Breakout", blurb: "Smash all the bricks", scratchId: 580704486, cat: "Puzzle" },
  { name: "Minesweeper", blurb: "Clear the field carefully", scratchId: 199047441, cat: "Puzzle" },
  {
    name: "Super Tic-Tac-Toe",
    blurb: "Tic-tac-toe, leveled up",
    scratchId: 902399095,
    cat: "Puzzle",
  },
  { name: "Wordle", blurb: "Guess the secret word", scratchId: 639908378, cat: "Learning" },
  {
    name: "Solar System Sandbox",
    blurb: "Build your own planets",
    scratchId: 1020945768,
    cat: "Learning",
  },
  { name: "Lines", blurb: "A calm drawing puzzle", scratchId: 237232045, cat: "Learning" },
  { name: "Planet Clicker", blurb: "Grow a whole planet", scratchId: 377874630, cat: "Clickers" },
  { name: "Cookie Clicker", blurb: "Bake ALL the cookies", scratchId: 930655286, cat: "Clickers" },
  { name: "Money Clicker", blurb: "Tap your way to riches", scratchId: 208974963, cat: "Clickers" },
  {
    name: "Restaurant Tycoon",
    blurb: "Run your own restaurant",
    scratchId: 261028674,
    cat: "Clickers",
  },
  {
    name: "3D Ping Pong",
    blurb: "Table tennis in 3D",
    scratchId: 247987287,
    cat: "Sports & Racing",
  },
  { name: "3D Tennis", blurb: "Serve and smash", scratchId: 520716879, cat: "Sports & Racing" },
  {
    name: "Head Soccer",
    blurb: "Big-head soccer showdown",
    scratchId: 474230268,
    cat: "Sports & Racing",
  },
  { name: "Soccer Pong", blurb: "Soccer meets pong", scratchId: 184355332, cat: "Sports & Racing" },
  {
    name: "Nitro Racing",
    blurb: "Pedal to the metal",
    scratchId: 400349603,
    cat: "Sports & Racing",
  },
  {
    name: "Mini Golf",
    blurb: "Putt through silly courses",
    scratchId: 166369590,
    cat: "Sports & Racing",
  },
];

const FILTERS: Array<"All" | Category> = [
  "All",
  "Action",
  "Puzzle",
  "Learning",
  "Clickers",
  "Sports & Racing",
  "Build & Cook",
];

const STAGE_W = 480;
const STAGE_H = 360;
const EMBED_W = 485;
const EMBED_H = 402;
const CROP_TOP = 40;
const CROP_LEFT = 2.5;

const embedUrl = (id: number) => `https://scratch.mit.edu/projects/${id}/embed`;
const thumbUrl = (id: number) => `https://cdn2.scratch.mit.edu/get_image/project/${id}_480x360.png`;

export function GameArcade({
  exitSignal,
  onPlayingChange,
}: {
  exitSignal: number;
  onPlayingChange: (playing: boolean) => void;
}) {
  const t = useT();
  const [playing, setPlaying] = useState<Game | null>(null);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("All");

  useEffect(() => {
    if (exitSignal > 0) setPlaying(null);
  }, [exitSignal]);

  useEffect(() => {
    onPlayingChange(playing != null);
  }, [playing, onPlayingChange]);

  if (playing) return <GamePlayer game={playing} onBack={() => setPlaying(null)} />;

  const shown = filter === "All" ? GAMES : GAMES.filter((g) => g.cat === filter);

  return (
    <div className="flex h-full min-h-0 flex-col gap-4">
      <div className="flex flex-wrap items-center justify-center gap-2 px-8">
        {FILTERS.map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={`h-12 rounded-full px-6 text-[15.5px] font-bold transition-transform duration-150 active:scale-95 ${
              f === filter
                ? "bg-[#ffd166] text-[#4a3200]"
                : "bg-white/20 text-white hover:bg-white/30"
            }`}
          >
            {t(f)}
          </button>
        ))}
      </div>
      <div className="kids-big-scroll min-h-0 flex-1 overflow-y-auto px-8 pb-6">
        <div className="mx-auto grid w-full max-w-[980px] grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4">
          {shown.map((g, i) => (
            <button
              key={g.scratchId}
              type="button"
              onClick={() => setPlaying(g)}
              className="kids-card group flex flex-col overflow-hidden rounded-[22px] border-4 border-white/35 bg-white/95 text-start shadow-[0_18px_44px_-16px_rgba(0,20,40,0.6)] transition-transform duration-200 hover:scale-[1.04] active:scale-[0.98]"
              style={{ animationDelay: `${Math.min(i, 12) * 50}ms` }}
            >
              <span className="relative block aspect-[4/3] overflow-hidden bg-[#dceef5]">
                <img
                  src={thumbUrl(g.scratchId)}
                  alt=""
                  draggable={false}
                  loading="lazy"
                  className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                />
                <span className="absolute inset-0 flex items-center justify-center bg-[#062c47]/0 transition-colors duration-200 group-hover:bg-[#062c47]/30">
                  <span className="flex h-12 w-12 scale-75 items-center justify-center rounded-full bg-[#ffd166] text-[#4a3200] opacity-0 shadow-lg transition-all duration-200 group-hover:scale-100 group-hover:opacity-100">
                    <Gamepad2 size={22} strokeWidth={2.4} />
                  </span>
                </span>
              </span>
              <span className="flex flex-col gap-0.5 px-4 py-3">
                <span className="truncate font-display text-[17px] font-medium leading-tight text-[#123a52]">
                  {g.name}
                </span>
                <span className="truncate text-[12.5px] font-semibold text-[#3c6a84]">
                  {t(g.blurb)}
                </span>
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function GamePlayer({ game, onBack }: { game: Game; onBack: () => void }) {
  const t = useT();
  const areaRef = useRef<HTMLDivElement>(null);
  const frameHostRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLIFrameElement>(null);
  const [scale, setScale] = useState(1);
  const [state, setState] = useState<"loading" | "ready" | "failed">("loading");
  const [attempt, setAttempt] = useState(0);
  const [fullscreen, setFullscreen] = useState(false);

  useEffect(() => {
    const el = areaRef.current;
    if (!el) return;
    const update = () => {
      const rect = el.getBoundingClientRect();
      const pad = 8;
      const s = Math.max(
        0.5,
        Math.min((rect.width - pad) / STAGE_W, (rect.height - pad) / STAGE_H),
      );
      setScale(s);
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (state !== "loading") return;
    const id = window.setTimeout(() => {
      setState((s) => (s === "loading" ? "failed" : s));
    }, 15000);
    return () => window.clearTimeout(id);
  }, [state, attempt]);

  useEffect(() => {
    const onFs = () => setFullscreen(document.fullscreenElement === frameHostRef.current);
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);

  useEffect(() => {
    let restore = () => {};
    void import("@tauri-apps/api/core").then(({ invoke, isTauri }) => {
      if (!isTauri()) return;
      void invoke("harbor_set_context_menu", { enabled: false }).catch(() => {});
      restore = () => void invoke("harbor_set_context_menu", { enabled: true }).catch(() => {});
    });
    return () => restore();
  }, []);

  const focusGame = () => {
    window.setTimeout(() => frameRef.current?.focus(), 60);
  };

  const toggleFullscreen = () => {
    const host = frameHostRef.current;
    if (!host) return;
    if (document.fullscreenElement) void document.exitFullscreen();
    else void host.requestFullscreen().catch(() => {});
    focusGame();
  };

  const restart = () => {
    setState("loading");
    setAttempt((a) => a + 1);
    focusGame();
  };

  return (
    <div className="flex h-full min-h-0 flex-col items-center gap-3 px-8 pb-2">
      <div className="flex w-full max-w-[1000px] items-center gap-3">
        <span className="min-w-0 truncate font-display text-[24px] font-medium text-white drop-shadow-[0_2px_10px_rgba(0,20,40,0.5)]">
          {game.name}
        </span>
        <span className="shrink-0 rounded-full bg-white/20 px-3.5 py-1 text-[11px] font-bold uppercase tracking-[0.12em] text-white/85">
          {t("on Scratch")}
        </span>
        <div className="ms-auto flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={restart}
            title={t("Restart game")}
            className="flex h-12 w-12 items-center justify-center rounded-full border-4 border-white/40 bg-white/90 text-[#123a52] transition-transform duration-150 hover:scale-[1.06] active:scale-95"
          >
            <RotateCcw size={18} strokeWidth={2.6} />
          </button>
          <button
            type="button"
            onClick={toggleFullscreen}
            title={fullscreen ? t("Exit full screen") : t("Full screen")}
            className="flex h-12 w-12 items-center justify-center rounded-full border-4 border-white/40 bg-white/90 text-[#123a52] transition-transform duration-150 hover:scale-[1.06] active:scale-95"
          >
            {fullscreen ? (
              <Minimize size={18} strokeWidth={2.6} />
            ) : (
              <Expand size={18} strokeWidth={2.6} />
            )}
          </button>
        </div>
      </div>
      <div
        ref={areaRef}
        className="relative flex min-h-0 w-full max-w-[1000px] flex-1 items-center justify-center"
      >
        <div
          ref={frameHostRef}
          onClick={() => frameRef.current?.focus()}
          className="relative flex items-center justify-center overflow-hidden rounded-xl border-4 border-white/35 bg-[#04121e] shadow-[0_28px_70px_-24px_rgba(0,20,40,0.7)]"
          style={
            fullscreen
              ? { width: "100%", height: "100%", borderRadius: 0, borderWidth: 0 }
              : { width: STAGE_W * scale + 8, height: STAGE_H * scale + 8 }
          }
        >
          {state !== "failed" && (
            <FittedFrame
              key={attempt}
              game={game}
              frameRef={frameRef}
              fullscreen={fullscreen}
              scale={scale}
              onReady={() => {
                setState("ready");
                focusGame();
              }}
            />
          )}
          {state === "loading" && (
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-3 bg-[#04121e]/85">
              <Loader2 size={34} className="animate-spin text-white/80" />
              <span className="text-[15px] font-bold text-white/75">
                {t("Loading {name}...", { name: game.name })}
              </span>
            </div>
          )}
          {state === "failed" && (
            <div className="flex flex-col items-center gap-4 px-8 py-10 text-center">
              <img
                src="/kids/doodles/liloctored.png"
                alt=""
                draggable={false}
                className="h-20 w-auto"
              />
              <p className="font-display text-[22px] font-medium text-white">
                {t("This game couldn't load right now.")}
              </p>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={restart}
                  className="flex h-12 items-center gap-2 rounded-full bg-[#ffd166] px-6 text-[15px] font-bold text-[#4a3200] transition-transform duration-150 hover:scale-[1.04] active:scale-95"
                >
                  <RotateCcw size={16} strokeWidth={2.6} />
                  {t("Try again")}
                </button>
                <button
                  type="button"
                  onClick={onBack}
                  className="flex h-12 items-center rounded-full border-4 border-white/40 bg-white/90 px-5 text-[14px] font-bold text-[#123a52] transition-transform duration-150 hover:scale-[1.04] active:scale-95"
                >
                  {t("Pick another")}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function FittedFrame({
  game,
  frameRef,
  fullscreen,
  scale,
  onReady,
}: {
  game: Game;
  frameRef: React.RefObject<HTMLIFrameElement | null>;
  fullscreen: boolean;
  scale: number;
  onReady: () => void;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [fsScale, setFsScale] = useState(1);

  useEffect(() => {
    if (!fullscreen) return;
    const update = () => {
      setFsScale(Math.min(window.innerWidth / STAGE_W, window.innerHeight / STAGE_H));
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [fullscreen]);

  const s = fullscreen ? fsScale : scale;

  return (
    <div
      ref={hostRef}
      className="relative shrink-0 overflow-hidden"
      style={{ width: STAGE_W * s, height: STAGE_H * s }}
    >
      <div
        style={{
          transform: `scale(${s})`,
          transformOrigin: "top left",
          width: STAGE_W,
          height: STAGE_H,
          position: "relative",
          overflow: "hidden",
        }}
      >
        <iframe
          ref={frameRef}
          src={embedUrl(game.scratchId)}
          title={game.name}
          width={EMBED_W}
          height={EMBED_H}
          onLoad={onReady}
          sandbox="allow-scripts allow-same-origin allow-pointer-lock"
          allow="autoplay"
          allowFullScreen
          referrerPolicy="no-referrer"
          className="border-0"
          style={{ position: "absolute", top: -CROP_TOP, left: -CROP_LEFT }}
        />
      </div>
    </div>
  );
}
