export type MarketingStat = { n: string; l: string };
export type CampaignPath = { kind: string; title: string; desc: string; tags: string[] };

export const marketingStats: MarketingStat[] = [
  { n: "4", l: "Campaigns" },
  { n: "26", l: "Challenges" },
  { n: "5", l: "Grader types" },
];

export const campaignPaths: CampaignPath[] = [
  {
    kind: "BEGINNER · 6 STAGES",
    title: "Boot Camp",
    desc: "Start here. Decode base64, ROT13, hex and binary, sum a column, and grep a secret out of a noisy log. Short, forgiving, and personalized — the moves every later campaign assumes.",
    tags: ["Base64", "ROT13", "Hex", "Binary", "Search"],
  },
  {
    kind: "INTERMEDIATE · 6 STAGES",
    title: "Field Work",
    desc: "Classical ciphers, a forged token, and logs that hide an intruder. Break Caesar and Vigenère, read a JWT, peel a layered blob, catch a scanner in an access log, and write a script the grader tests on unseen input.",
    tags: ["Caesar", "Vigenère", "JWT", "Forensics", "Scripting"],
  },
  {
    kind: "ADVANCED · 8 STAGES",
    title: "Project Janus",
    desc: "A personalized host, an unknown protocol, a broken service. Investigate a captured filesystem, reverse a binary protocol, write a decoder, do git archaeology, patch a C service, and rebuild what was lost.",
    tags: ["Network RE", "Decoder", "Git", "Systems", "Crypto"],
  },
  {
    kind: "EXPERT · 6 STAGES",
    title: "The Gauntlet",
    desc: "Six escalating puzzles with no scaffolding. Peel a layered cipher, break repeating-key XOR, pull a marker out of an image, walk a hash chain, write a stack-VM interpreter, and trace an injection through a log.",
    tags: ["Cipher", "XOR", "Stego", "Hash chain", "Interpreter", "Forensics"],
  },
];
