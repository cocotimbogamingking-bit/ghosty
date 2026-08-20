// Two fixes applied to the installed Scramjet 1.1.0 bundles. Both are in the shipped
// dist files, so they have to be reapplied after every install; npm runs this through
// the postinstall script. Idempotent: running it twice is a no-op.
//
// 1. The CSS rewriter matches url() with /url\(['"]?(.+?)['"]?\)/gm. On an empty url()
//    the lazy .+? cannot match nothing, so it runs past the closing paren and swallows
//    the rest of the declaration. On YouTube's stylesheet that destroys 8515 of 18697
//    rules and the page renders unstyled. Requiring one character that is neither a
//    quote nor a paren leaves an empty url() alone.
//
// 2. Set-Cookie notifications iterate with `for (const cookie in setCookieHeader)`.
//    `in` walks keys, so a single header string is walked character by character, and
//    each bogus message is awaited for non-document destinations. A page that never
//    answers stalls the request forever: Wikipedia's stylesheets never arrive. Iterate
//    the real cookies and dispatch without blocking. The authoritative jar update on
//    the following line is untouched.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const dist = path.join(here, "..", "node_modules", "@mercuryworkshop", "scramjet", "dist");

const BAD = `url\\(['"]?(.+?)['"]?\\)`;
const GOOD = `url\\(['"]?([^'")]+)['"]?\\)`;

const COOKIE_LOOP =
  /let (\w+)=(\w+)\["set-cookie"\]\|\|\[\];for\(let (\w+) in \1\)if\((\w+)\)\{let (\w+)=(\w+)\.dispatch\(\4,\{scramjet\$type:"cookie",cookie:\3,url:(\w+)\.href\}\);"document"!==(\w+)&&"iframe"!==\8&&await \5\}/;
const COOKIE_FIX =
  'let $1=$2["set-cookie"]||[];for(let $3 of(Array.isArray($1)?$1:[$1]))if($4)$6.dispatch($4,{scramjet$type:"cookie",cookie:$3,url:$7.href});';

if (!fs.existsSync(dist)) {
  console.log("patch-scramjet: no scramjet install found, nothing to do");
  process.exit(0);
}

for (const file of ["scramjet.all.js", "scramjet.bundle.js"]) {
  const target = path.join(dist, file);
  if (!fs.existsSync(target)) {
    console.log(`patch-scramjet: ${file} missing`);
    continue;
  }
  let src = fs.readFileSync(target, "utf8");
  const done = [];

  if (src.includes(GOOD)) done.push("url() already");
  else if (src.includes(BAD)) {
    src = src.replace(BAD, GOOD);
    done.push("url() patched");
  } else done.push("url() NOT FOUND");

  if (COOKIE_LOOP.test(src)) {
    src = src.replace(COOKIE_LOOP, COOKIE_FIX);
    done.push("cookies patched");
  } else if (src.includes('scramjet$type:"cookie",cookie:')) done.push("cookies already");
  else done.push("cookies NOT FOUND");

  fs.writeFileSync(target, src);
  console.log(`patch-scramjet: ${file} — ${done.join(", ")}`);
}
