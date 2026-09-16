// PrivacyQ "Harbor" type system (PRD §5.12): Source Serif 4 for headings/
// wordmark, Public Sans for UI/body.
//
// Self-hosted via @fontsource (not next/font/google): this build environment's
// egress policy blocks fonts.googleapis.com/fonts.gstatic.com at build time,
// which makes next/font/google unverifiable here and, more importantly, is a
// real reliability risk for repeatable Vercel builds (an external Google
// Fonts fetch dependency at build time). @fontsource ships the woff2/woff
// files inside the npm package — resolved once from the (unrestricted) npm
// registry, then always available at build time with no external network
// call. Weights match Nav.tsx usage: heading 600/700, body 400/500/600/700.
import "@fontsource/source-serif-4/600.css";
import "@fontsource/source-serif-4/700.css";
import "@fontsource/public-sans/400.css";
import "@fontsource/public-sans/500.css";
import "@fontsource/public-sans/600.css";
import "@fontsource/public-sans/700.css";
