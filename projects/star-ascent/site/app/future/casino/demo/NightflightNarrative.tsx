type HostProfile = {
  name: "Radiance" | "Ellie" | "Alia";
  callSign: string;
  role: string;
  signal: string;
  tone: "solar" | "sapphire" | "crimson";
  imagePosition: string;
  tattoo: string;
  minimumAge: number;
};

type NarrativeBeat = {
  id: string;
  gameId: string;
  leadHost: HostProfile["name"];
  participants: readonly HostProfile["name"][];
  art: "gala" | "runway" | "constellation";
  interaction: string;
  pawsAction: string;
};

export function NightflightNarrative({ story, host }: { story: NarrativeBeat; host: HostProfile }) {
  return (
    <aside
      className={`demo-triangle-narrative cue-${host.tone}`}
      data-testid="nightflight-narrative"
      data-story-id={story.id}
      data-game-id={story.gameId}
      data-lead-host={story.leadHost}
      data-participants={story.participants.join("|")}
    >
      <div className="triangle-heartline" aria-hidden="true">
        <i className="heartline-edge edge-one" />
        <i className="heartline-edge edge-two" />
        <i className="heartline-edge edge-three" />
        <span className="heartline-node node-r">R</span>
        <span className="heartline-node node-e">E</span>
        <span className="heartline-node node-a">A</span>
      </div>
      <div className="triangle-story-copy">
        <span>TRIANGLE HEARTBEAT // {host.name.toUpperCase()}</span>
        <strong id="nightflight-narrative-summary">{story.interaction}</strong>
        <dl>
          <div><dt>VISIBLE CUE</dt><dd>{host.tattoo}</dd></div>
          <div><dt>PAWS</dt><dd>{story.pawsAction}</dd></div>
        </dl>
      </div>
    </aside>
  );
}
