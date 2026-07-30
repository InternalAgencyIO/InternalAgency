// Switchboard Common constructs an HTTPS agent at module load even in browsers.
// Browser fetch/axios ignores this Node-only option, so the console supplies the
// smallest inert compatibility class instead of shipping a Node TLS stack.
export class Agent {
  constructor(options = {}) {
    this.options = { ...options };
  }
}

const httpsBrowserShim = { Agent };

export default httpsBrowserShim;
