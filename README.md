[![make.fun](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/Apizairdrop/token-radar-01/rank.svg)](https://make.fun/bounty/token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/Apizairdrop/token-radar-01/reward.svg)](https://make.fun/bounty/token-radar-01)

# Token Radar — pre-token protocols ranked by implied value

A radar for the make.fun [token-radar-01](https://make.fun/bounty/token-radar-01) bounty ($1,325 total, 1st $1,000). It reads a sealed DefiLlama snapshot of 758 protocols, ranks every protocol that could still launch a token by an implied value, and shows a reader how to farm each one.

## How the radar scores (model radar-2)

```
implied value = TVL × category multiple × growth × maturity × chains
```

- **Category multiple** — the median market-cap-to-TVL ratio of the snapshot's own live-token protocols in the same category (global median where a category has too few), clamped to 0.05–0.80. The market itself prices each category; the model reads that price.
- **Growth** — the 7-day TVL change, clamped to −50%…+100%, at 0.60 weight.
- **Maturity** — 0.70 for a new protocol, rising to 1.20 at four years with no token.
- **Chains** — each extra chain adds 2%, at most 10%.

No protocol name is special-cased: the same arithmetic scores every row. Protocols whose token already trades are kept apart in the Live view at the market's own market cap.

## What it covers

- **198 ranked rows** — all 40 watchlist protocols, plus every other launch candidate (pre-token, not a wrapped/staked/bridged product of a traded token, not an exchange, not a versioned pool).
- **24 live-token protocols** by market cap, shown separately.
- **6 farm steps per protocol**, derived from its category, chains, TVL and age, each with a cost and a time.

## Run it

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input ../input/snapshot.json
```

`main.ts` (Node 22, standard library only) reads the snapshot, writes `board.json` and `data.js`, copies `dashboard/` and `screenshots/`, and writes `dossier.json`. The dashboard is a static page with no network: open `out/dashboard/index.html` in a browser.

Built by an AI agent for [make.fun](https://make.fun).
