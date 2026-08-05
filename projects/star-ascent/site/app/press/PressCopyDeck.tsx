"use client";

import { useState } from "react";

const posts: ReadonlyArray<readonly [string, string]> = [
  [
    "SCHEDULE DRAFT",
    "DRAFT · DO NOT PUBLISH · NO WINDOW SCHEDULED\n\nIf a future launch window is formally scheduled, replace this draft with source-bound copy that states the exact reviewed UTC time.\n\nhttps://internalagency.io/launch",
  ],
  [
    "OPENING DRAFT",
    "DRAFT · DO NOT PUBLISH · NO WINDOW SCHEDULED\n\nNo launch room or claim route is open. If an opening is later approved, verify it through Signal → Launch Control → Proof Board.\n\nhttps://internalagency.io/signal",
  ],
  [
    "HOLD",
    "THE RECORD REMAINS ON HOLD UNTIL PUBLIC EVIDENCE IS AVAILABLE.\n\nDo not trust DMs, copied wallet links, or screenshots. Use the Proof Board.\n\nhttps://internalagency.io/proof",
  ],
  [
    "EVIDENCE",
    "THE PUBLIC RECORD IS THE ROUTE.\n\nCheck every verified update on the site, in the White Dossier, and on the broadcast screen together.\n\nhttps://internalagency.io/proof",
  ],
];

export function PressCopyDeck() {
  const [copied, setCopied] = useState<string | null>(null);

  const copy = async (label: string, body: string) => {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(body);
    } else {
      const field = document.createElement("textarea");
      field.value = body;
      field.setAttribute("readonly", "");
      field.style.position = "fixed";
      field.style.opacity = "0";
      document.body.appendChild(field);
      field.select();
      document.execCommand("copy");
      field.remove();
    }
    setCopied(label);
    window.setTimeout(() => setCopied(null), 1800);
  };

  return (
    <section className="press-copy-deck">
      <p>HOLD-SAFE DRAFT COPY</p>
      <h2>NOT FOR PUBLICATION UNTIL A WINDOW IS REVIEWED.</h2>
      <span className="press-copy-status" role="status" aria-live="polite">
        {copied ? `${copied} draft copied.` : ""}
      </span>
      <div>
        {posts.map(([label, body]) => (
          <article key={label}>
            <span>{label}</span>
            <pre>{body}</pre>
            <button type="button" onClick={() => copy(label, body)}>
              {copied === label ? "COPIED" : "COPY DRAFT"}
            </button>
          </article>
        ))}
      </div>
    </section>
  );
}
