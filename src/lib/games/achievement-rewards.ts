/** Verified Steam IDs and reward links; provenance in docs/games/ACHIEVEMENT-REWARDS.md. */
export type AchievementReward = { appId: number; achievementId: string; achievementName: string; name: string; image: string; source: string; receivingAppId: number; receivingGame: string };
const rewards: readonly AchievementReward[] = [
  {
    "appId": 440,
    "achievementId": "TF_SCOUT_ACHIEVE_PROGRESS1",
    "achievementName": "Scout Milestone 1",
    "name": "Force-a-Nature",
    "image": "/games/rewards/tf2-scout-1.png",
    "source": "https://wiki.teamfortress.com/wiki/Force-a-Nature",
    "receivingAppId": 440,
    "receivingGame": "Team Fortress 2"
  },
  {
    "appId": 440,
    "achievementId": "TF_SCOUT_ACHIEVE_PROGRESS2",
    "achievementName": "Scout Milestone 2",
    "name": "Sandman",
    "image": "/games/rewards/tf2-scout-2.png",
    "source": "https://wiki.teamfortress.com/wiki/Sandman",
    "receivingAppId": 440,
    "receivingGame": "Team Fortress 2"
  },
  {
    "appId": 440,
    "achievementId": "TF_SCOUT_ACHIEVE_PROGRESS3",
    "achievementName": "Scout Milestone 3",
    "name": "Bonk! Atomic Punch",
    "image": "/games/rewards/tf2-scout-3.png",
    "source": "https://wiki.teamfortress.com/wiki/Bonk!_Atomic_Punch",
    "receivingAppId": 440,
    "receivingGame": "Team Fortress 2"
  },
  {
    "appId": 440,
    "achievementId": "TF_SOLDIER_ACHIEVE_PROGRESS1",
    "achievementName": "Soldier Milestone 1",
    "name": "Equalizer",
    "image": "/games/rewards/tf2-soldier-1.png",
    "source": "https://wiki.teamfortress.com/wiki/Equalizer",
    "receivingAppId": 440,
    "receivingGame": "Team Fortress 2"
  },
  {
    "appId": 440,
    "achievementId": "TF_SOLDIER_ACHIEVE_PROGRESS2",
    "achievementName": "Soldier Milestone 2",
    "name": "Direct Hit",
    "image": "/games/rewards/tf2-soldier-2.png",
    "source": "https://wiki.teamfortress.com/wiki/Direct_Hit",
    "receivingAppId": 440,
    "receivingGame": "Team Fortress 2"
  },
  {
    "appId": 440,
    "achievementId": "TF_SOLDIER_ACHIEVE_PROGRESS3",
    "achievementName": "Soldier Milestone 3",
    "name": "Buff Banner",
    "image": "/games/rewards/tf2-soldier-3.png",
    "source": "https://wiki.teamfortress.com/wiki/Buff_Banner",
    "receivingAppId": 440,
    "receivingGame": "Team Fortress 2"
  },
  {
    "appId": 440,
    "achievementId": "TF_PYRO_ACHIEVE_PROGRESS1",
    "achievementName": "Pyro Milestone 1",
    "name": "Flare Gun",
    "image": "/games/rewards/tf2-pyro-1.png",
    "source": "https://wiki.teamfortress.com/wiki/Flare_Gun",
    "receivingAppId": 440,
    "receivingGame": "Team Fortress 2"
  },
  {
    "appId": 440,
    "achievementId": "TF_PYRO_ACHIEVE_PROGRESS2",
    "achievementName": "Pyro Milestone 2",
    "name": "Backburner",
    "image": "/games/rewards/tf2-pyro-2.png",
    "source": "https://wiki.teamfortress.com/wiki/Backburner",
    "receivingAppId": 440,
    "receivingGame": "Team Fortress 2"
  },
  {
    "appId": 440,
    "achievementId": "TF_PYRO_ACHIEVE_PROGRESS3",
    "achievementName": "Pyro Milestone 3",
    "name": "Axtinguisher",
    "image": "/games/rewards/tf2-pyro-3.png",
    "source": "https://wiki.teamfortress.com/wiki/Axtinguisher",
    "receivingAppId": 440,
    "receivingGame": "Team Fortress 2"
  },
  {
    "appId": 440,
    "achievementId": "TF_DEMOMAN_ACHIEVE_PROGRESS1",
    "achievementName": "Demoman Milestone 1",
    "name": "Chargin' Targe",
    "image": "/games/rewards/tf2-demoman-1.png",
    "source": "https://wiki.teamfortress.com/wiki/Chargin%27_Targe",
    "receivingAppId": 440,
    "receivingGame": "Team Fortress 2"
  },
  {
    "appId": 440,
    "achievementId": "TF_DEMOMAN_ACHIEVE_PROGRESS2",
    "achievementName": "Demoman Milestone 2",
    "name": "Eyelander",
    "image": "/games/rewards/tf2-demoman-2.png",
    "source": "https://wiki.teamfortress.com/wiki/Eyelander",
    "receivingAppId": 440,
    "receivingGame": "Team Fortress 2"
  },
  {
    "appId": 440,
    "achievementId": "TF_DEMOMAN_ACHIEVE_PROGRESS3",
    "achievementName": "Demoman Milestone 3",
    "name": "Scottish Resistance",
    "image": "/games/rewards/tf2-demoman-3.png",
    "source": "https://wiki.teamfortress.com/wiki/Scottish_Resistance",
    "receivingAppId": 440,
    "receivingGame": "Team Fortress 2"
  },
  {
    "appId": 440,
    "achievementId": "TF_HEAVY_ACHIEVE_PROGRESS1",
    "achievementName": "Heavy Milestone 1",
    "name": "Sandvich",
    "image": "/games/rewards/tf2-heavy-1.png",
    "source": "https://wiki.teamfortress.com/wiki/Sandvich",
    "receivingAppId": 440,
    "receivingGame": "Team Fortress 2"
  },
  {
    "appId": 440,
    "achievementId": "TF_HEAVY_ACHIEVE_PROGRESS2",
    "achievementName": "Heavy Milestone 2",
    "name": "Natascha",
    "image": "/games/rewards/tf2-heavy-2.png",
    "source": "https://wiki.teamfortress.com/wiki/Natascha",
    "receivingAppId": 440,
    "receivingGame": "Team Fortress 2"
  },
  {
    "appId": 440,
    "achievementId": "TF_HEAVY_ACHIEVE_PROGRESS3",
    "achievementName": "Heavy Milestone 3",
    "name": "Killing Gloves of Boxing",
    "image": "/games/rewards/tf2-heavy-3.png",
    "source": "https://wiki.teamfortress.com/wiki/Killing_Gloves_of_Boxing",
    "receivingAppId": 440,
    "receivingGame": "Team Fortress 2"
  },
  {
    "appId": 440,
    "achievementId": "TF_ENGINEER_ACHIEVE_PROGRESS1",
    "achievementName": "Engineer Milestone 1",
    "name": "Frontier Justice",
    "image": "/games/rewards/tf2-engineer-1.png",
    "source": "https://wiki.teamfortress.com/wiki/Frontier_Justice",
    "receivingAppId": 440,
    "receivingGame": "Team Fortress 2"
  },
  {
    "appId": 440,
    "achievementId": "TF_ENGINEER_ACHIEVE_PROGRESS2",
    "achievementName": "Engineer Milestone 2",
    "name": "Gunslinger",
    "image": "/games/rewards/tf2-engineer-2.png",
    "source": "https://wiki.teamfortress.com/wiki/Gunslinger",
    "receivingAppId": 440,
    "receivingGame": "Team Fortress 2"
  },
  {
    "appId": 440,
    "achievementId": "TF_ENGINEER_ACHIEVE_PROGRESS3",
    "achievementName": "Engineer Milestone 3",
    "name": "Wrangler",
    "image": "/games/rewards/tf2-engineer-3.png",
    "source": "https://wiki.teamfortress.com/wiki/Wrangler",
    "receivingAppId": 440,
    "receivingGame": "Team Fortress 2"
  },
  {
    "appId": 440,
    "achievementId": "TF_MEDIC_ACHIEVE_PROGRESS1",
    "achievementName": "Medic Milestone 1",
    "name": "Blutsauger",
    "image": "/games/rewards/tf2-medic-1.png",
    "source": "https://wiki.teamfortress.com/wiki/Blutsauger",
    "receivingAppId": 440,
    "receivingGame": "Team Fortress 2"
  },
  {
    "appId": 440,
    "achievementId": "TF_MEDIC_ACHIEVE_PROGRESS2",
    "achievementName": "Medic Milestone 2",
    "name": "Kritzkrieg",
    "image": "/games/rewards/tf2-medic-2.png",
    "source": "https://wiki.teamfortress.com/wiki/Kritzkrieg",
    "receivingAppId": 440,
    "receivingGame": "Team Fortress 2"
  },
  {
    "appId": 440,
    "achievementId": "TF_MEDIC_ACHIEVE_PROGRESS3",
    "achievementName": "Medic Milestone 3",
    "name": "Übersaw",
    "image": "/games/rewards/tf2-medic-3.png",
    "source": "https://wiki.teamfortress.com/wiki/%C3%9Cbersaw",
    "receivingAppId": 440,
    "receivingGame": "Team Fortress 2"
  },
  {
    "appId": 440,
    "achievementId": "TF_SNIPER_ACHIEVE_PROGRESS1",
    "achievementName": "Sniper Milestone 1",
    "name": "Huntsman",
    "image": "/games/rewards/tf2-sniper-1.png",
    "source": "https://wiki.teamfortress.com/wiki/Huntsman",
    "receivingAppId": 440,
    "receivingGame": "Team Fortress 2"
  },
  {
    "appId": 440,
    "achievementId": "TF_SNIPER_ACHIEVE_PROGRESS2",
    "achievementName": "Sniper Milestone 2",
    "name": "Jarate",
    "image": "/games/rewards/tf2-sniper-2.png",
    "source": "https://wiki.teamfortress.com/wiki/Jarate",
    "receivingAppId": 440,
    "receivingGame": "Team Fortress 2"
  },
  {
    "appId": 440,
    "achievementId": "TF_SNIPER_ACHIEVE_PROGRESS3",
    "achievementName": "Sniper Milestone 3",
    "name": "Razorback",
    "image": "/games/rewards/tf2-sniper-3.png",
    "source": "https://wiki.teamfortress.com/wiki/Razorback",
    "receivingAppId": 440,
    "receivingGame": "Team Fortress 2"
  },
  {
    "appId": 440,
    "achievementId": "TF_SPY_ACHIEVE_PROGRESS1",
    "achievementName": "Spy Milestone 1",
    "name": "Ambassador",
    "image": "/games/rewards/tf2-spy-1.png",
    "source": "https://wiki.teamfortress.com/wiki/Ambassador",
    "receivingAppId": 440,
    "receivingGame": "Team Fortress 2"
  },
  {
    "appId": 440,
    "achievementId": "TF_SPY_ACHIEVE_PROGRESS2",
    "achievementName": "Spy Milestone 2",
    "name": "Cloak and Dagger",
    "image": "/games/rewards/tf2-spy-2.png",
    "source": "https://wiki.teamfortress.com/wiki/Cloak_and_Dagger",
    "receivingAppId": 440,
    "receivingGame": "Team Fortress 2"
  },
  {
    "appId": 440,
    "achievementId": "TF_SPY_ACHIEVE_PROGRESS3",
    "achievementName": "Spy Milestone 3",
    "name": "Dead Ringer",
    "image": "/games/rewards/tf2-spy-3.png",
    "source": "https://wiki.teamfortress.com/wiki/Dead_Ringer",
    "receivingAppId": 440,
    "receivingGame": "Team Fortress 2"
  },
  {
    "appId": 630,
    "achievementId": "ASW_PARA_HAT",
    "achievementName": "Hat Trick",
    "name": "Alien Swarm Parasite",
    "image": "/games/rewards/630.png",
    "source": "https://wiki.teamfortress.com/wiki/Alien_Swarm_Parasite",
    "receivingAppId": 440,
    "receivingGame": "Team Fortress 2"
  },
  {
    "appId": 99900,
    "achievementId": "REACHED_TERMINAL_1",
    "achievementName": "Mission Accomplished",
    "name": "Spiral Sallet",
    "image": "/games/rewards/99900.png",
    "source": "https://wiki.teamfortress.com/wiki/Spiral_Sallet",
    "receivingAppId": 440,
    "receivingGame": "Team Fortress 2"
  }
];
export const achievementRewards = (appId: number): readonly AchievementReward[] => rewards.filter(item => item.appId === appId);
export const achievementReward = (appId: number, achievementId: string): AchievementReward | undefined => rewards.find(item => item.appId === appId && item.achievementId === achievementId);
