"use client";

import Link from "next/link";
import { Ban, Cookie, Lock, Trash2 } from "lucide-react";
import LegalPage, { type LegalHighlight, type LegalSection } from "./LegalPage";

const EFFECTIVE = "24 October 2026";

const HIGHLIGHTS: LegalHighlight[] = [
  { icon: Ban, title: "We don't sell your data", text: "Not to advertisers, not to anyone. No ad trackers on JustCmul8." },
  { icon: Lock, title: "Only what we need", text: "Your account, your models and the minimum needed to run and bill the service." },
  { icon: Cookie, title: "No tracking cookies", text: "Just the sign-in cookie that keeps you logged in, plus a few local preferences." },
  { icon: Trash2, title: "Delete in one click", text: "Deleting your account removes your projects, results and chats for good." },
];

const SECTIONS: LegalSection[] = [
  {
    id: "overview",
    title: "Overview",
    body: (
      <p>
        This policy explains what personal data JustCmul8 collects, why, who we share it with and the choices you have. It applies to the website, the
        simulation workspace and the AI assistant. It works together with our <Link href="/terms">Terms of Service</Link>.
      </p>
    ),
  },
  {
    id: "collect",
    title: "What we collect",
    body: (
      <>
        <ul>
          <li>
            <strong>Account details.</strong> Your email address, and your name and profile picture if you sign in with Google or GitHub. Passwords are
            handled by our authentication provider and stored only as secure hashes.
          </li>
          <li>
            <strong>Profile you choose to add.</strong> Display name, role, company, team size and your default simulation domain.
          </li>
          <li>
            <strong>Your work.</strong> Projects, block models, scenarios, saved simulation results and your conversations with the AI assistant.
          </li>
          <li>
            <strong>Plan and usage.</strong> Your plan, trial dates, credit balance and a ledger of what used credits (for example &ldquo;new
            simulation&rdquo; or &ldquo;AI chat&rdquo;).
          </li>
          <li>
            <strong>Payment status.</strong> Razorpay processes payments. We receive and store your subscription ID and status, never your full card,
            UPI or bank details.
          </li>
          <li>
            <strong>Collaboration activity.</strong> When you work in a shared project, your name, colour, cursor position and selected block are shown
            live to the other people in that project.
          </li>
          <li>
            <strong>Technical data.</strong> Standard server logs (such as IP address, browser type and timestamps) that our hosting providers keep for
            security, abuse prevention and debugging.
          </li>
        </ul>
        <p className="note">Simulations run in your browser. The engine doesn&apos;t send your model anywhere to run it; we store the model and results so you can come back to them.</p>
      </>
    ),
  },
  {
    id: "use",
    title: "How we use it",
    body: (
      <ul>
        <li>To provide the Service: sign you in, save and sync your projects, and run collaboration and sharing.</li>
        <li>To run the AI assistant when you ask it something.</li>
        <li>To manage your plan, credits, trial and payments.</li>
        <li>To keep JustCmul8 secure: rate limits, abuse prevention and investigating problems.</li>
        <li>To email you about your account, billing and important changes. We don&apos;t send marketing email unless you ask for it.</li>
      </ul>
    ),
  },
  {
    id: "ai",
    title: "AI processing",
    body: (
      <p>
        When you use the AI assistant, your prompt and the parts of your model it needs (blocks, parameters and results) are sent to Google&apos;s Gemini
        API to generate a reply. Google processes this data to provide the service under its API terms. Only what you send to the assistant is shared,
        so please don&apos;t include sensitive personal information in prompts.
      </p>
    ),
  },
  {
    id: "sharing",
    title: "Who we share it with",
    body: (
      <>
        <p>We never sell your personal data. We share it only with the providers that help us run JustCmul8, and only as much as they need:</p>
        <ul>
          <li><strong>Supabase</strong>: database, authentication and real-time collaboration.</li>
          <li><strong>Vercel</strong>: website and application hosting.</li>
          <li><strong>Razorpay</strong>: payments and subscriptions.</li>
          <li><strong>Google</strong>: the Gemini AI models, Google sign-in if you use it, and Gmail for sending project invitation emails.</li>
          <li><strong>GitHub</strong>: GitHub sign-in, if you use it.</li>
        </ul>
        <p>
          We also share data with the people you choose: collaborators you invite and anyone with a share link you create. We may disclose data if
          the law requires it, or to protect the rights and safety of our users.
        </p>
      </>
    ),
  },
  {
    id: "cookies",
    title: "Cookies and local storage",
    body: (
      <>
        <p>We don&apos;t use advertising or third-party tracking cookies, and we don&apos;t run analytics trackers.</p>
        <ul>
          <li><strong>Sign-in cookie.</strong> Keeps you logged in. The Service can&apos;t work without it.</li>
          <li>
            <strong>Preferences in your browser.</strong> Your light or dark theme, the size and visibility of side panels, and your Reliability Lab
            scenario library are saved in your browser&apos;s local storage. They never leave your device.
          </li>
        </ul>
      </>
    ),
  },
  {
    id: "retention",
    title: "How long we keep it",
    body: (
      <p>
        We keep your data while your account is open. When you delete your account under <Link href="/settings?tab=account">Settings → Account</Link>,
        we permanently delete your profile, projects, simulation history and chat history. We keep billing records for as long as tax and accounting
        laws require, and a log of security-relevant actions (sign-in protection, billing, sharing, data exports and consent changes) for about one
        year, as the law requires.
      </p>
    ),
  },
  {
    id: "security",
    title: "How we protect it",
    body: (
      <p>
        Data is encrypted in transit and at rest. Every database table has row-level security, so you can only reach your own data and the projects
        shared with you. You can turn on two-factor sign-in in Settings → Account; once it is on, your data can&apos;t be reached without your code.
        Sensitive actions such as deleting your account need a recent sign-in, and our APIs are rate-limited. No system is perfectly secure, so
        if you notice anything suspicious, tell us at <a href="mailto:hello@justcmul8.com">hello@justcmul8.com</a>.
      </p>
    ),
  },
  {
    id: "rights",
    title: "Your rights and choices",
    body: (
      <>
        <p>Depending on where you live (including under India&apos;s Digital Personal Data Protection Act and the EU GDPR), you can ask to:</p>
        <ul>
          <li>access the personal data we hold about you, or get a copy of it;</li>
          <li>correct data that&apos;s wrong. You can edit most of it yourself in Settings;</li>
          <li>delete your data, which you can do yourself by deleting your account;</li>
          <li>withdraw consent or object to certain processing.</li>
        </ul>
        <p>When you sign up, we record that you accepted these terms, the date, and the version of this policy you accepted.</p>
        <p>
          In <Link href="/settings?tab=account">Settings → Account</Link> you can download all your data as one file, and turn AI processing off
          at any time (nothing is then sent to the AI assistant). You can also export results as CSV, HTML or PDF reports.
        </p>
        <p>
          <strong>Grievance Officer.</strong> For any question or complaint about your personal data, email{" "}
          <a href="mailto:hello@justcmul8.com">hello@justcmul8.com</a>. We reply within 30 days. If you are not satisfied with our answer, you can
          complain to the Data Protection Board of India.
        </p>
      </>
    ),
  },
  {
    id: "transfers",
    title: "International transfers",
    body: (
      <p>
        Our providers may store and process data in countries other than yours. When they do, we rely on their contractual and security safeguards to
        protect it.
      </p>
    ),
  },
  {
    id: "children",
    title: "Children",
    body: (
      <p>
        JustCmul8 isn&apos;t meant for children. You must be 18 or older to use it, and you confirm this when you create your account. If you believe
        someone under 18 has given us personal data, contact us and we&apos;ll delete it.
      </p>
    ),
  },
  {
    id: "changes",
    title: "Changes to this policy",
    body: (
      <p>
        We&apos;ll update this policy when our practices change and show the new date at the top. If a change is significant, we&apos;ll let you know by email or
        in the app before it takes effect.
      </p>
    ),
  },
];

export default function PrivacyContent() {
  return (
    <LegalPage
      current="/privacy"
      title={<>Privacy <span className="bg-linear-to-r from-sf-8b5cf6 to-sf-5742ff bg-clip-text text-transparent">Policy</span></>}
      intro="What we collect, why we collect it, and the control you have over it. No dark patterns, no small print."
      effective={EFFECTIVE}
      highlights={HIGHLIGHTS}
      sections={SECTIONS}
    />
  );
}
