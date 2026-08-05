type HostId = "radiance" | "ellie" | "alia" | "ece";
type HostPortrait = "portraitRadiance" | "portraitEllie" | "portraitAlia" | "portraitEce";

type HostProfile = {
  id: HostId;
  name: "Radiance" | "Ellie" | "Alia" | "AI ECE";
  callSign: string;
  role: string;
  signal: string;
  tone: "solar" | "sapphire" | "crimson" | "emerald";
  portraitArt: HostPortrait;
  signatureCue: string;
  minimumAge: number;
};

type NarrativeBeat = {
  id: string;
  gameId: string;
  leadId: HostId;
  participants: readonly HostId[];
  focusIds: readonly HostId[];
  arc: string;
  scene: "signalFourAnchor" | "signalFourTension" | "signalFourRelay" | "signalFourFinale";
  interaction: string;
  paws: {
    present: boolean;
    action: string;
    beat: string;
    affectsOutcome: false;
  };
};

const constellationNodes: readonly { id: HostId; label: string; className: string }[] = [
  { id: "radiance", label: "R", className: "node-r" },
  { id: "ellie", label: "EL", className: "node-el" },
  { id: "alia", label: "A", className: "node-a" },
  { id: "ece", label: "EC", className: "node-ec" },
];

export function NightflightNarrative({ story, host }: { story: NarrativeBeat; host: HostProfile }) {
  return (
    <aside
      className={`demo-constellation-narrative cue-${host.tone}`}
      data-testid="nightflight-narrative"
      data-story-id={story.id}
      data-game-id={story.gameId}
      data-lead-id={story.leadId}
      data-participants={story.participants.join("|")}
      data-focus-ids={story.focusIds.join("|")}
      data-arc={story.arc}
      data-paws-present={String(story.paws.present)}
      data-paws-action={story.paws.action}
    >
      <div className="constellation-heartline" aria-hidden="true">
        {Array.from({ length: 6 }, (_, index) => <i className={`heartline-edge edge-${index + 1}`} key={index} />)}
        {constellationNodes.map((node) => (
          <span
            className={`heartline-node ${node.className}${story.focusIds.includes(node.id) ? " is-focus" : ""}`}
            data-member-id={node.id}
            data-focus={String(story.focusIds.includes(node.id))}
            key={node.id}
          >
            {node.label}
          </span>
        ))}
      </div>
      <div className="constellation-story-copy">
        <span>LOVE CONSTELLATION // {host.name.toUpperCase()}</span>
        <strong id="nightflight-narrative-summary">{story.interaction}</strong>
        <dl>
          <div><dt>SIGNAL</dt><dd>{host.signatureCue}</dd></div>
          <div><dt>PAWS</dt><dd>{story.paws.beat}</dd></div>
        </dl>
      </div>
    </aside>
  );
}
