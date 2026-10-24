"use client";

import Link from "next/link";
import { BadgeCheck, Bot, CreditCard, UserCheck } from "lucide-react";
import LegalPage, { type LegalHighlight, type LegalSection } from "./LegalPage";
import { CREDIT_COSTS, PLAN_CREDITS, PRO_MONTHLY, PRO_YEARLY_TOTAL, TRIAL_DAYS, inr } from "@/lib/billing/plans";

const EFFECTIVE = "24 October 2026";

const HIGHLIGHTS: LegalHighlight[] = [
  { icon: UserCheck, title: "Your models are yours", text: "You own what you build. We only use it to run the service for you." },
  { icon: CreditCard, title: "Cancel any time", text: `Cancel a ${TRIAL_DAYS}-day trial and you're never charged. Paid plans run to the end of the period.` },
  { icon: Bot, title: "Check AI output", text: "AI suggestions can be wrong. Review them before you rely on them." },
  { icon: BadgeCheck, title: "Results are estimates", text: "Simulations model reality; they don't guarantee it. Decisions stay yours." },
];

const SECTIONS: LegalSection[] = [
  {
    id: "agreement",
    title: "Agreement to these terms",
    body: (
      <>
        <p>
          These Terms of Service (&ldquo;Terms&rdquo;) govern your use of JustCmul8, including the website, the simulation workspace, the AI assistant and
          any related services (together, the &ldquo;Service&rdquo;). &ldquo;We&rdquo;, &ldquo;us&rdquo; and &ldquo;our&rdquo; mean JustCmul8.
        </p>
        <p>
          By creating an account or using the Service you agree to these Terms and to our <Link href="/privacy">Privacy Policy</Link>. If you use the
          Service on behalf of an organisation, you confirm you&apos;re allowed to accept these Terms for it.
        </p>
      </>
    ),
  },
  {
    id: "service",
    title: "What JustCmul8 does",
    body: (
      <>
        <p>
          JustCmul8 is a no-code discrete-event simulation platform. You build models of real systems (queues, staff, machines, routes) on a visual
          canvas or by describing them to the AI assistant, run them, and analyse the results.
        </p>
        <ul>
          <li>Simulations run in your browser. Your model is executed on your own device; only the model and its results are saved to your account.</li>
          <li>The AI assistant is powered by Google&apos;s Gemini models. It can generate, explain and optimise models when you ask it to.</li>
          <li>You can invite collaborators to a project and create share links so others can view a simulation.</li>
        </ul>
      </>
    ),
  },
  {
    id: "accounts",
    title: "Your account",
    body: (
      <>
        <p>
          You can sign up with an email and password or with Google or GitHub. You must be at least 18 years old, or have the permission of a parent or
          guardian, to use the Service.
        </p>
        <ul>
          <li>Keep your login details safe. You&apos;re responsible for activity on your account.</li>
          <li>Give us accurate information and keep your email address up to date so we can reach you about your account and billing.</li>
          <li>Tell us straight away at <a href="mailto:hello@justcmul8.com">hello@justcmul8.com</a> if you think someone else has accessed your account.</li>
        </ul>
      </>
    ),
  },
  {
    id: "plans",
    title: "Plans, credits and billing",
    body: (
      <>
        <p>
          Some actions use credits. Running a simulation is always free. Creating a new simulation costs {CREDIT_COSTS.create_simulation} credits, an AI build{" "}
          {CREDIT_COSTS.ai_generate}, an AI optimisation {CREDIT_COSTS.ai_optimize} and an AI chat message {CREDIT_COSTS.ai_chat}.
        </p>
        <ul>
          <li>
            <strong>Free</strong> includes {PLAN_CREDITS.free} credits a month. <strong>Pro</strong> includes {PLAN_CREDITS.pro} credits a month plus
            collaboration, link sharing and CSV export, for {inr(PRO_MONTHLY)} a month or {inr(PRO_YEARLY_TOTAL)} a year.
          </li>
          <li>Credits refill to your plan&apos;s allowance once a month. Unused credits don&apos;t roll over and have no cash value.</li>
          <li>
            Pro starts with a {TRIAL_DAYS}-day free trial. If you cancel during the trial you return to Free right away and aren&apos;t charged. Otherwise
            your plan renews automatically at the end of each billing period until you cancel.
          </li>
          <li>
            Payments are processed by Razorpay. If you cancel a paid plan it stays active until the end of the period you&apos;ve paid for, then moves to
            Free. Apart from where the law requires it, we don&apos;t give refunds for partial periods.
          </li>
          <li>We may change prices. We&apos;ll tell you at least 30 days before a change affects your plan, and you can cancel before it takes effect.</li>
        </ul>
        <p>You can see your plan, credits and usage, and cancel, under <Link href="/settings?tab=billing">Settings → Billing</Link>.</p>
      </>
    ),
  },
  {
    id: "content",
    title: "Your content",
    body: (
      <>
        <p>
          Your models, scenarios, results, chat messages and anything else you add (&ldquo;Your Content&rdquo;) belong to you. You give us permission to
          store, process and display Your Content only as needed to run the Service for you, for example to save your projects, show them to the
          collaborators you invite, and send your prompts to the AI provider when you use the assistant.
        </p>
        <p>
          When you create a share link or invite someone, the people you share with can see the shared simulation. You can revoke share links and remove
          collaborators at any time.
        </p>
      </>
    ),
  },
  {
    id: "ai",
    title: "AI features",
    body: (
      <>
        <p>
          AI output is generated automatically and can be incomplete or wrong. Review generated models, parameters and recommendations before you rely
          on them. Don&apos;t put sensitive personal data or secrets into prompts; the text you send to the assistant is processed by Google to produce a
          reply.
        </p>
      </>
    ),
  },
  {
    id: "results",
    title: "Simulation results",
    body: (
      <>
        <p>
          A simulation is a model of a system, built from the assumptions you enter. Its results are estimates, not predictions or guarantees, and they
          are only as good as the model behind them.
        </p>
        <p className="note">
          JustCmul8 is a decision-support tool, not professional advice. You remain responsible for the decisions you make, including staffing,
          safety, medical, financial and operational ones, and for checking that a model fits your situation.
        </p>
      </>
    ),
  },
  {
    id: "acceptable-use",
    title: "Acceptable use",
    body: (
      <>
        <p>Please don&apos;t use the Service to:</p>
        <ul>
          <li>break the law or infringe anyone else&apos;s rights;</li>
          <li>try to access other people&apos;s accounts or data, or get around our security, rate limits or credit system;</li>
          <li>disrupt the Service, for example by overloading it, scraping it, or sending malware;</li>
          <li>resell the Service or use the AI features to build a competing product without our written permission.</li>
        </ul>
        <p>We may limit, suspend or close accounts that break these rules, and we&apos;ll tell you why unless the law or safety stops us.</p>
      </>
    ),
  },
  {
    id: "ours",
    title: "Our service and brand",
    body: (
      <p>
        The JustCmul8 software, design, name and logo belong to us and are protected by law. These Terms let you use the Service; they don&apos;t give you
        ownership of it. If you send us feedback or ideas, we can use them without owing you anything.
      </p>
    ),
  },
  {
    id: "availability",
    title: "Availability and changes",
    body: (
      <p>
        We work hard to keep JustCmul8 fast and available, but we can&apos;t promise it will never be interrupted. We may update, add or remove features. If
        we remove something you pay for, we&apos;ll give you reasonable notice.
      </p>
    ),
  },
  {
    id: "termination",
    title: "Ending your account",
    body: (
      <>
        <p>
          You can delete your account at any time under <Link href="/settings?tab=account">Settings → Account</Link>. Deleting it cancels any
          subscription and permanently removes your projects, simulation history and chat history. This can&apos;t be undone, so export anything you want to
          keep first.
        </p>
        <p>We may close accounts that seriously or repeatedly break these Terms, or if we&apos;re required to by law.</p>
      </>
    ),
  },
  {
    id: "liability",
    title: "Disclaimers and liability",
    body: (
      <>
        <p>
          The Service is provided &ldquo;as is&rdquo; and &ldquo;as available&rdquo;. To the extent the law allows, we don&apos;t give warranties that it will
          meet your needs or be error-free.
        </p>
        <p>
          To the extent the law allows, we aren&apos;t liable for indirect or consequential losses, such as lost profits or data, and our total liability for
          any claim is limited to the amount you paid us in the 12 months before the claim. Nothing in these Terms limits liability that can&apos;t be limited
          by law.
        </p>
      </>
    ),
  },
  {
    id: "law",
    title: "Governing law",
    body: <p>These Terms are governed by the laws of India. Any dispute will be handled by the courts of competent jurisdiction in India.</p>,
  },
  {
    id: "changes",
    title: "Changes to these terms",
    body: (
      <p>
        We may update these Terms as the Service grows. If a change is significant, we&apos;ll tell you by email or in the app before it takes effect. If you
        keep using the Service after that, the new Terms apply.
      </p>
    ),
  },
];

export default function TermsContent() {
  return (
    <LegalPage
      current="/terms"
      title={<>Terms of <span className="bg-gradient-to-r from-sf-8b5cf6 to-sf-5742ff bg-clip-text text-transparent">Service</span></>}
      intro="The rules for using JustCmul8, written to be read. Here's what you can expect from us, and what we ask of you."
      effective={EFFECTIVE}
      highlights={HIGHLIGHTS}
      sections={SECTIONS}
    />
  );
}
