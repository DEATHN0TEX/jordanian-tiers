// Gamemode configurations and descriptions for Jordanian MCTiers
// Icons use the official MCTiers SVG assets (stored in /icons/)

const INITIAL_GAMEMODES = [
  {
    id: "overall",
    name: "Overall",
    description: "Calculated average rank based on active gamemode standings. Reflects overall versatility in competitive PvP.",
    icon: `<img src="icons/overall.svg" alt="Overall" class="gm-icon-img">`,
    rules: "Overall standing is not tested directly. It is determined by the average score of your active tested gamemodes (e.g. if you are T1 Sword, T2 Pot, and T3 UHC, your overall will be calculated using weighted rankings)."
  },
  {
    id: "spear_mace",
    name: "Spear/Mace",
    description: "Combines high-damage Mace strikes with custom Spear thrusts and lunges. Requires advanced range control.",
    icon: `<img src="icons/spear.png" alt="Spear/Mace" class="gm-icon-img spear-icon-img">`,
    rules: `Standard Arena (20x20 blocks).
Gear:
- 1x Diamond Helmet (Protection IV)
- 1x Netherite Chestplate (Protection IV)
- 1x Diamond Leggings (Protection IV)
- 1x Diamond Boots (Protection IV)
- 1x Heavy Mace (Unbreaking III, Wind Burst I)
- 1x Spear (Trident with custom range mechanics)
- 64x Cooked Beef
- 1x Golden Apple (Standard)

Restrictions:
- No shields allowed.
- No ender pearls.
- Test format: Best-of-5 (BO5) duels. Tester will grade based on combo extensions and mace crits.`
  },
  {
    id: "vanilla",
    name: "Vanilla",
    description: "End Crystal PvP. Combines obsidian placement, crystal detonating, respawn anchor timing, and totem management.",
    icon: `<img src="icons/vanilla.svg" alt="Vanilla" class="gm-icon-img">`,
    rules: `Standard Obsidian Flat Grid.
Gear:
- Full Netherite Armor (Protection IV, Unbreaking III, Mending)
- 64x Obsidian
- 64x End Crystals
- 64x Respawn Anchors
- 64x Glowstone
- 5x Totems of Undying
- 1x Netherite Sword (Sharpness V, Knockback II)
- 1x Netherite Pickaxe (Efficiency V)
- 1x Crossbow (Quick Charge III, Multishot)
- 64x Golden Carrots
- 12x Golden Apples

Restrictions:
- No speed or strength potions.
- No hack client features (auto-anchor, auto-totem).
- Test format: Best-of-3 (BO3) or Best-of-5 (BO5).`
  },
  {
    id: "uhc",
    name: "UHC",
    description: "Ultra Hardcore PvP. High strategic depth utilizing rod tricking, lava placements, bow aiming, and healing conservation.",
    icon: `<img src="icons/uhc.svg" alt="UHC" class="gm-icon-img">`,
    rules: `Standard Grass/Dirt Arena (30x30 blocks).
Gear:
- Full Iron Armor (Protection II)
- 1x Diamond Sword (Sharpness I)
- 1x Bow & 24x Arrows
- 1x Fishing Rod
- 3x Golden Apples
- 1x Golden Head (Heals 4 hearts)
- 2x Lava Buckets & 2x Water Buckets
- 64x Oak Wood Planks

Restrictions:
- Fleeing out of boundaries results in round loss.
- High-ping accommodations can be adjusted.
- Test format: Best-of-5 (BO5).`
  },
  {
    id: "pot",
    name: "Pot",
    description: "Node / Potion PvP. Speed II and Instant Health II potion management. Demands perfect aiming, hotkeying, and pre-potting.",
    icon: `<img src="icons/pot.svg" alt="Pot" class="gm-icon-img">`,
    rules: `Standard Flat Arena (Speed II active).
Gear:
- Full Diamond Armor (Protection IV, Unbreaking III)
- 1x Diamond Sword (Sharpness V, Fire Aspect II optional)
- 33x Splash Potion of Healing (Instant Health II)
- 2x Potion of Swiftness (Speed II, 1:30)
- 1x Stack of Steak

Restrictions:
- No hacking, double-clicking above 20 CPS.
- Clean potting (throwing potions down while running) is highly graded.
- Test format: Best-of-5 (BO5).`
  },
  {
    id: "nethop",
    name: "NethOP",
    description: "Netherite Overpowered Potions. High defense Netherite gear with splash healing, strength buffs, and debuffs.",
    icon: `<img src="icons/nethop.svg" alt="NethOP" class="gm-icon-img">`,
    rules: `Standard Arena.
Gear:
- Full Netherite Armor (Protection IV, Unbreaking III)
- 1x Netherite Sword (Sharpness V, Fire Aspect II)
- 2x Splash Potion of Strength II
- 4x Potion of Swiftness II
- 28x Splash Potion of Healing II
- 64x Golden Carrots

Restrictions:
- Debuff potions (Poison/Slowness) are disallowed unless both parties agree.
- Test format: Best-of-5 (BO5).`
  },
  {
    id: "smp",
    name: "SMP",
    description: "Survival Multiplayer Style Combat. Incorporates Shields, Crossbows, Axe Crits, Netherite Armor, and Pearl setups.",
    icon: `<img src="icons/smp.svg" alt="SMP" class="gm-icon-img">`,
    rules: `Terrain Arena (with small hills, trees, and obstacles).
Gear:
- Full Netherite Armor (Protection IV)
- 1x Diamond Axe (Sharpness V, Efficiency V)
- 1x Diamond Sword (Sharpness V, Knockback I)
- 1x Shield (Unbreaking III)
- 1x Crossbow (Piercing IV, Quick Charge III)
- 16x Ender Pearls
- 64x Steak
- 4x Golden Apples

Restrictions:
- Shield disabling cooldown must be exploited using Axe crits.
- Terrain usage is allowed and encouraged.
- Test format: Best-of-3 (BO3).`
  },
  {
    id: "sword",
    name: "Sword",
    description: "1.8.9 styled legacy Sword PvP. High click speed (CPS), block-hitting, w-tapping, s-tapping, and strafing mechanics.",
    icon: `<img src="icons/sword.svg" alt="Sword" class="gm-icon-img">`,
    rules: `Standard Flat Arena (Speed I active).
Gear:
- Full Diamond Armor (Protection IV)
- 1x Diamond Sword (Sharpness V)
- 64x Cooked Steak
- 1x Golden Apple (Standard)

Restrictions:
- Auto-clickers or macros are strictly forbidden.
- Grade based on strafe quality, combo locking, and reach consistency.
- Test format: Best-of-7 (BO7).`
  },
  {
    id: "axe",
    name: "Axe",
    description: "1.9+ Axe combat. Features shield disabling, spacing, critical hits, and armor durability management.",
    icon: `<img src="icons/axe.svg" alt="Axe" class="gm-icon-img">`,
    rules: `Standard Arena.
Gear:
- Full Diamond Armor (Protection IV)
- 1x Diamond Axe (Sharpness V)
- 1x Shield
- 64x Steak

Restrictions:
- No swords allowed.
- Shields must be active.
- Grading based on axe crits timing and shield block setups.
- Test format: Best-of-5 (BO5).`
  },
  {
    id: "mace",
    name: "Mace",
    description: "Modern Minecraft Mace PvP. Utilizes high height drops, wind charge boosts, and explosive critical blows.",
    icon: `<img src="icons/mace.svg" alt="Mace" class="gm-icon-img">`,
    rules: `High-rise Arena with wind generators and elevators.
Gear:
- Full Netherite Armor (Protection IV)
- 1x Mace (Density V, Wind Burst I)
- 128x Wind Charges
- 128x Golden Apples

Restrictions:
- No potions allowed.
- Melee-only damage.
- Test format: Best-of-5 (BO5).`
  }
];