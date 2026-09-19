import { ensureBucket } from "../src/lib/storage";
ensureBucket().then(() => { console.log("bucket ready"); process.exit(0); }).catch((e) => { console.error(e); process.exit(1); });
