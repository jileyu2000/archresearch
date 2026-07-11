# ArchResearch Provider Credential Setup Design

## Outcome

Provide a single Windows PowerShell command that securely configures the
OpenAI-compatible relay used by ArchResearch. There is no settings page in the
board and no plaintext API key in the repository or local project files.

The fixed initial provider configuration is:

- Provider label: `梭子蟹 API`
- Base URL: `https://suoxie.codes/v1`
- API model: `gpt-5.5`
- Windows credential service: `ArchResearch/suoxie`
- Windows credential account: `api-key`

The `suoxie/gpt-5.5` identifier is specific to OpenCode provider routing.
ArchResearch sends `gpt-5.5` to the relay API.

## User Flow

The user runs:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/configure-provider.ps1
```

The script displays the non-sensitive provider settings, then reads the API
key with `Read-Host -AsSecureString`. It converts the value only long enough to
send it to a local Python helper over standard input. The key is never placed
in command-line arguments, environment variables, PowerShell history, or log
output.

The Python helper performs one explicit capability probe using the relay's
Responses API with the `web_search` tool. This call may be billable. Only when
the full probe succeeds does the helper store the key in Windows Credential
Manager and write the non-sensitive provider configuration.

Successful completion prints a short confirmation and tells the user to
restart ArchResearch if it is already running. A failed probe does not replace
the current credential or provider configuration.

## Components

### PowerShell entry point

`scripts/configure-provider.ps1` owns the interactive terminal experience. It
locates the workspace Python runtime using the existing `dev-common.ps1`,
collects the key with hidden input, pipes it to the Python helper, clears the
temporary BSTR in a `finally` block, and returns the helper's exit code.

### Credential service

`archresearch_api.provider_credentials` uses the Python `keyring` package. On
Windows, keyring delegates storage to Windows Credential Manager. The helper
uses a fixed service and account name so startup and configuration use the same
credential without enumerating unrelated credentials.

If a supported Windows keyring backend is unavailable, setup fails closed. It
must not fall back to plaintext storage.

### Non-sensitive configuration

After a successful probe, the helper atomically writes
`.archresearch/provider.json` containing only:

```json
{
  "provider": "suoxie",
  "name": "梭子蟹 API",
  "base_url": "https://suoxie.codes/v1",
  "research_model": "gpt-5.5",
  "vision_model": "gpt-5.5"
}
```

ArchResearch startup loads this file, retrieves the matching key from Windows
Credential Manager, and constructs both research and visual OpenAI clients
with the relay base URL. If either source is missing or invalid, startup stays
in deterministic Mock mode.

## Capability Probe

The probe sends a minimal, provider-neutral research request through the
OpenAI Python client configured with the relay base URL and model `gpt-5.5`.
It requires a successful Responses API call that invokes `web_search`. A basic
text-only response is not enough because ArchResearch depends on web search.

Probe output contains only a success flag, provider label, model, and capability
name. Exceptions are converted to short, redacted messages. API keys, request
headers, response bodies, and provider stack traces are never printed.

## Failure Behavior

- Empty input: exit with a validation error before any network call.
- Invalid HTTPS base URL: reject before any network call.
- Authentication, model, Responses, or web-search failure: retain the previous
  credential and provider file.
- Credential Manager failure after a successful probe: do not write
  `provider.json`; return a clear local-storage error.
- Provider file write failure: remove the newly stored credential when no prior
  credential existed, avoiding a half-configured live state.
- Startup with incomplete configuration: use Mock mode and expose no secret in
  health or Trace output.

## Security Boundaries

- The API key never appears in Git, SQLite, `.env`, JSON, URLs, process
  arguments, API responses, Trace events, or browser storage.
- Configuration is local to the current Windows user.
- The helper accesses only the fixed credential service/account pair.
- Provider URLs must be public HTTPS URLs without embedded credentials.
- No automatic fallback stores the key as plaintext.

## Tests

Tests are written before implementation and use injected fake keyring and
OpenAI clients. They cover:

- secure stdin input and absence of the key from process arguments/output;
- successful Responses plus web-search probe;
- probe failure preserving the previous credential and JSON file;
- atomic non-sensitive config writing;
- startup loading the relay configuration and key;
- missing keyring backend falling back to Mock without plaintext storage;
- model and base URL propagation to both research and visual clients;
- PowerShell runtime discovery and exit-code propagation.

The default suite never calls the real relay and requires no key.

## Scope Exclusions

- No board settings panel or setup webpage.
- No multiple-provider manager.
- No plaintext `.env` key writer.
- No Chat Completions fallback if Responses web search is unsupported.
- No automatic purchase, billing, or credential rotation workflow.
