# R.E.P.O Injury System

A BepInEx mod for R.E.P.O that adds a realistic injury system. When you take damage, body parts can get injured with different severity levels, affecting your movement, grip, vision, and stamina.

## How it works

Every time you take damage, there's a chance one of your body parts gets injured. The higher the damage, the higher the chance. Each body part has two severity levels: Minor and Severe.

**Head** injuries blur your vision. Minor gives a subtle blur, Severe adds strong blur with red flashes.

**Arms** injuries reduce your grip strength. Severe arm injuries can make you randomly drop objects.

**Legs** injuries slow you down. Severe leg injuries prevent sprinting entirely.

**Torso** injuries drain your stamina faster.

Injuries are displayed as compact HUD indicators near the health bar. Healing items restore injured body parts. All injuries reset at the end of each round.

## Controls

- **J** (configurable) — Toggle the injury HUD on/off
- **F8** — Debug: apply a random injury
- **F9** — Debug: heal all injuries

## Configuration

All values are configurable through BepInEx config:

- Injury chance on hit (default: 40%)
- Speed penalty for leg injuries
- Grip penalty for arm injuries
- Stamina drain multiplier for torso injuries
- HUD toggle key

## Installation

1. Install [BepInEx 5](https://github.com/BepInEx/BepInEx) for R.E.P.O
2. Download the latest `.dll` from [Releases](https://github.com/MathisBls/R.E.P.O-injury-system/releases)
3. Drop it in `BepInEx/plugins/`
4. Launch the game

## Build from source

Requires .NET SDK with `netstandard2.1` support.

```bash
cd source
dotnet build -c Release
```

The `.dll` will be in `source/bin/Release/netstandard2.1/`.

## License

GPL-3.0
