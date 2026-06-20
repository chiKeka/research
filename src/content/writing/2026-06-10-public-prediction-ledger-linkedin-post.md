---
title: "Introducing the public prediction ledger - quantitative tools in a qualitative world, the experiment, the twin at high level"
date: "2026-06-11"
platform: "linkedin"
external_url: "https://www.linkedin.com/in/bruno-chikeka"
summary: "One of the recurring issues in forecasting for major programmes is that we rely on quantitative metrics in a highly qualitative environment. Anyone who has built forecasts from sch"
published: true
---

One of the recurring issues in forecasting for major programmes is that we rely on quantitative metrics in a highly qualitative environment. Anyone who has built forecasts from schedule and progress data knows how this goes: the forecast is rarely right, and you rebaseline, and then rebaseline again, as many times as the duration of the programme demands. Flyvbjerg's database of more than 16,000 projects puts a number on the feeling: 91.5 percent overrun on cost or schedule. And the tools are not the problem. They have genuinely improved, Monte Carlo simulation, probabilistic estimates, reference class methods, yet the rebaselining never stopped, because the tools are not measuring the thing that actually moves the programme.

So I believe the future of forecasting in major programmes will have to combine the quantitative and qualitative worlds. The hard part is the qualitative half. A major programme is a systems-of-systems problem: workstreams, institutions, stakeholders, politics, all interlinked, all evolving, humans in every loop. The open question is how you structurally encode qualitative data so it can be computed alongside the quantitative systems. Programme performance measurement will have to evolve to contain the qualitative element, or it will keep producing precise answers to the wrong question.

To test how this could work, I am running an experiment. I built a proprietary engine that runs predictive analysis across three categories: AI, institutions, and Africa. The board launched with ten claims and now holds sixteen open, each one verifiable over time, on a public ledger.

The ledger works like this. Every claim enters with a stated probability that locks the moment it is registered and is never edited afterwards. Each claim carries the test that resolves it, the deadline it must resolve by, and the base rate it has to beat. When the world answers, the outcome is scored against the locked probability. The record is public, the running tally is public, and the misses stay on the board.

Behind it runs Bruno Twin, an AI system I have been building on my own analytical frameworks. At a high level: it scans the world daily, registers falsifiable claims, monitors the open ones against new evidence, scores outcomes as they land, recalibrates its own confidence from its misses, and publishes the tally without me touching it. The running tally will tell us, and everyone watching, how well structured prediction performs in this environment, and future efforts will be geared toward scaling what works.

The board is live: github.com/chiKeka/ledger. The first resolution landed within a day, and the next wave comes through July.

Would your forecasts survive a public scoreboard? Mine now has to.
