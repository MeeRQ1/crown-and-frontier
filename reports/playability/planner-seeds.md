# The ground planner before and after commitment and detachment sizing, six seeds

The natural 40k case (`tools/concentration.ts --setup natural --weeks 40 --only auto,delegated`), seeds 1–6, on both
revisions of Europe 1936, with the planner as it was before the last two planner commits (with step lengths)
and as shipped. The same code otherwise; the AI plans its own war with the same planner in each case.
Averages over the six seeds; battles summed.

| Case | Map | Planner | Poland taken | Per seed | German men lost | Polish men lost | Battles won–lost |
|---|---|---|---|---|---|---|---|
| Poland alone, Auto-conquer | revision 1 | before | 32% of 31 | 9, 9, 8, 11, 14, 9 | 10.6k | 12.4k | 40–5 |
| Poland alone, Auto-conquer | revision 1 | shipped | 31% of 31 | 9, 13, 10, 7, 13, 5 | 8.4k | 6.9k | 19–3 |
| Poland alone, one conquest operation | revision 1 | before | 25% of 31 | 8, 4, 9, 10, 12, 4 | 14.0k | 8.5k | 30–9 |
| Poland alone, one conquest operation | revision 1 | shipped | 37% of 31 | 13, 12, 11, 9, 17, 7 | 10.0k | 9.9k | 29–5 |
| Poland alone, Auto-conquer | revision 2 | before | 20% of 42 | 8, 13, 10, 7, 6, 6 | 12.6k | 13.6k | 31–6 |
| Poland alone, Auto-conquer | revision 2 | shipped | 30% of 42 | 14, 9, 9, 25, 11, 8 | 12.0k | 12.0k | 27–9 |
| Poland alone, one conquest operation | revision 2 | before | 15% of 42 | 7, 6, 11, 4, 2, 7 | 16.0k | 7.0k | 11–10 |
| Poland alone, one conquest operation | revision 2 | shipped | 25% of 42 | 7, 11, 8, 15, 17, 4 | 12.7k | 12.3k | 30–7 |
| With its allies, Auto-conquer | revision 1 | before | 24% of 31 | 12, 4, 10, 5, 10, 3 | 11.7k | 9.2k | 23–6 |
| With its allies, Auto-conquer | revision 1 | shipped | 20% of 31 | 5, 6, 5, 6, 8, 8 | 11.5k | 5.7k | 21–6 |
| With its allies, one conquest operation | revision 1 | before | 18% of 31 | 7, 3, 7, 7, 7, 2 | 15.3k | 8.2k | 29–11 |
| With its allies, one conquest operation | revision 1 | shipped | 24% of 31 | 6, 8, 8, 3, 7, 13 | 10.4k | 5.7k | 16–7 |
| With its allies, Auto-conquer | revision 2 | before | 17% of 42 | 7, 3, 3, 12, 13, 5 | 16.8k | 16.9k | 30–8 |
| With its allies, Auto-conquer | revision 2 | shipped | 22% of 42 | 6, 3, 3, 16, 17, 10 | 14.5k | 6.7k | 14–10 |
| With its allies, one conquest operation | revision 2 | before | 11% of 42 | 0, 8, 1, 8, 10, 0 | 13.8k | 10.1k | 25–7 |
| With its allies, one conquest operation | revision 2 | shipped | 14% of 42 | 1, 6, 2, 11, 7, 9 | 14.6k | 4.5k | 11–15 |

| Map | Planner | Poland taken (mean of the four cases) | German men lost | Battles won–lost |
|---|---|---|---|---|
| revision 1 | before | 24.7% | 12.9k | 122–31 |
| revision 1 | shipped | 28.1% | 10.0k | 85–21 |
| revision 2 | before | 15.6% | 14.8k | 97–31 |
| revision 2 | shipped | 22.7% | 13.4k | 82–41 |
