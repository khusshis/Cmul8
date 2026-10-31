"use client";

import Link from "next/link";
import { Ban, Bot, ShieldCheck, Users } from "lucide-react";
import LegalPage, { type LegalHighlight, type LegalSection } from "./LegalPage";

const EFFECTIVE = "1 November 2026";

const HIGHLIGHTS: LegalHighlight[] = [
  { icon: Ban, title: "Nothing illegal or harmful", text: "Don't use JustCmul8 to break the law, harm people or infringe anyone's rights." },
  { icon: ShieldCheck, title: "Leave security alone", text: "No probing, scraping or bypassing limits. Found a hole? Tell us and we'll thank you." },
  { icon: Bot, title: "Use AI credits fairly", text: "No automating, reselling or gaming the AI features or the credit system." },
  { icon: Users, title: "Respect other people's data", text: "Only add personal data you're allowed to use, and share projects responsibly." },
];

const SECTIONS: LegalSection[] = [
  {
    id: "about",
    title: "About this policy",
    body: (
      <>
        <p>
          This Acceptable Use Policy explains what you may and may not do with JustCmul8. It is part of our{" "}
          <Link href="/terms">Terms of Service</Link> and expands on their &ldquo;Acceptable use&rdquo; section. It applies to everyone who uses the
          Service, including people you invite to a project or who open a project you share.
        </p>
        <p>If something isn&apos;t listed here but clearly harms the Service, its users or anyone else, it isn&apos;t allowed either.</p>
      </>
    ),
  },
  {
    id: "illegal",
    title: "Illegal, harmful or infringing use",
    body: (
      <>
        <p>Don&apos;t use the Service to:</p>
        <ul>
          <li>break any law that applies to you or to us, including Indian law;</li>
          <li>store, share or generate content that is unlawful, defamatory, harassing, hateful, or that exploits or endangers children;</li>
          <li>infringe copyright, trademarks or other rights, for example by uploading material you have no right to use;</li>
          <li>plan, model or promote activity meant to harm people, property or critical services;</li>
          <li>mislead people, for example by presenting simulation results or AI output as guaranteed real-world outcomes.</li>
        </ul>
      </>
    ),
  },
  {
    id: "security",
    title: "Security and system integrity",
    body: (
      <>
        <p>Don&apos;t:</p>
        <ul>
          <li>try to access accounts, projects or data that aren&apos;t yours, or to get around sign-in, permissions or share-link settings;</li>
          <li>probe, scan or test the Service for vulnerabilities, or run load tests against it, without our written permission;</li>
          <li>interfere with the Service, for example by overloading it, sending malware, or tampering with requests, the simulation engine or other users&apos; sessions;</li>
          <li>get around rate limits, captchas, credit limits or any other protection.</li>
        </ul>
        <p>
          Found a security problem? Please report it privately to <a href="mailto:hello@justcmul8.com">hello@justcmul8.com</a> (see also{" "}
          <a href="/.well-known/security.txt">security.txt</a>) and give us reasonable time to fix it before telling anyone else. Good-faith reports
          that follow this policy won&apos;t be treated as a breach of it.
        </p>
      </>
    ),
  },
  {
    id: "automation",
    title: "Automated access and scraping",
    body: (
      <>
        <p>
          Use the Service through its normal interface. Don&apos;t use bots, scrapers or scripts to create accounts, harvest content or data, or drive
          the Service at scale, unless we have agreed it with you in writing.
        </p>
        <p>Exporting your own projects and results through the features we provide (CSV, JSON, reports, &ldquo;Download my data&rdquo;) is always fine.</p>
      </>
    ),
  },
  {
    id: "ai-credits",
    title: "AI features and credits",
    body: (
      <>
        <p>Credits and the AI assistant are for your own modelling work. Don&apos;t:</p>
        <ul>
          <li>automate requests to the AI features, or use them to build or train a competing product or model;</li>
          <li>resell, share or transfer credits or plan benefits, or create multiple accounts to get more free credits or trials;</li>
          <li>try to make the AI reveal its instructions, other users&apos; data or our keys, or to produce content this policy forbids;</li>
          <li>exploit errors in billing or credits. If you notice one, please tell us.</li>
        </ul>
        <p>AI output can be wrong. You are responsible for checking it before you rely on it or share it.</p>
      </>
    ),
  },
  {
    id: "data",
    title: "Other people's data",
    body: (
      <>
        <p>
          Models rarely need personal data. If you do add any (for example names in block labels or uploaded files), make sure you have the right to use
          it under the Digital Personal Data Protection Act and any other law that applies, and add only what the model actually needs.
        </p>
        <p>
          When you invite collaborators or create a share link, you decide who can see the project. Don&apos;t share projects containing information the
          recipients shouldn&apos;t see, and revoke access you no longer need.
        </p>
      </>
    ),
  },
  {
    id: "enforcement",
    title: "What happens if this policy is broken",
    body: (
      <>
        <p>
          We may remove content, revoke share links, limit features or credits, or suspend or close an account that breaks this policy. Where we can,
          we&apos;ll tell you what happened and why, and give you a chance to fix it, unless the law or the safety of others stops us. Serious or
          illegal misuse may be reported to the authorities.
        </p>
        <p>
          To report misuse by someone else, or to ask about a decision we made, email <a href="mailto:hello@justcmul8.com">hello@justcmul8.com</a>.
        </p>
      </>
    ),
  },
  {
    id: "changes",
    title: "Changes to this policy",
    body: (
      <p>
        We may update this policy as the Service changes. We&apos;ll change the effective date above and, for significant changes, let you know in the app
        or by email.
      </p>
    ),
  },
];

export default function AcceptableUseContent() {
  return (
    <LegalPage
      current="/acceptable-use"
      title={<>Acceptable Use Policy</>}
      intro="What you can and can't do with JustCmul8, so the Service stays safe, fair and reliable for everyone."
      effective={EFFECTIVE}
      highlights={HIGHLIGHTS}
      sections={SECTIONS}
    />
  );
}
