# Secure Provider Credential Setup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add one automated PowerShell command that tests the `suoxie` relay, stores its key in Windows Credential Manager, and makes ArchResearch load `gpt-5.5` from that relay on restart.

**Architecture:** A focused Python credential module owns Windows keyring access and atomic non-secret JSON configuration. A separate CLI helper reads the key only from stdin, probes Responses plus web search, then commits credential and config as one logical operation. PowerShell provides hidden interactive input and pipes the key to the helper; FastAPI startup loads the resulting configuration and otherwise remains in Mock mode.

**Tech Stack:** Python 3.12, Pydantic v2, OpenAI Python SDK, `keyring`, PowerShell 5.1+, pytest, Ruff, Mypy.

---

## File Map

- Create `apps/api/src/archresearch_api/provider_credentials.py`: provider config schema, public-HTTPS validation, keyring adapter, atomic JSON write, rollback.
- Create `apps/api/src/archresearch_api/provider_setup.py`: stdin-only CLI, Responses/web-search capability probe, redacted messages.
- Create `apps/api/tests/test_provider_credentials.py`: storage, rollback, and no-plaintext behavior.
- Create `apps/api/tests/test_provider_setup.py`: probe success/failure and CLI secrecy.
- Create `apps/api/tests/test_provider_startup.py`: startup loads credential/config and falls back to Mock.
- Create `scripts/configure-provider.ps1`: hidden input and redirected stdin invocation.
- Create `scripts/tests/configure-provider.tests.ps1`: PowerShell security-contract and argument tests.
- Modify `apps/api/src/archresearch_api/providers.py`: optional OpenAI-compatible base URL.
- Modify `apps/api/src/archresearch_api/visual.py`: optional OpenAI-compatible base URL.
- Modify `apps/api/src/archresearch_api/main.py`: resolve stored provider before constructing clients.
- Modify `apps/api/src/archresearch_api/config.py`: restore all default model names to `gpt-5.5`.
- Modify `apps/api/pyproject.toml`: declare `keyring`.
- Modify `.env.example`, `README.md`, `task_plan.md`, `findings.md`, `progress.md`: document the secure command and milestone.

### Task 1: Credential and non-secret configuration storage

**Files:**
- Create: `apps/api/src/archresearch_api/provider_credentials.py`
- Test: `apps/api/tests/test_provider_credentials.py`
- Modify: `apps/api/pyproject.toml`

- [ ] **Step 1: Write failing config and credential tests**

```python
def test_successful_commit_stores_key_only_in_keyring(tmp_path, fake_keyring):
    config = SuoxieProviderConfig()
    commit_provider_config(tmp_path, config, "sk-test", fake_keyring)
    assert fake_keyring.get_password("ArchResearch/suoxie", "api-key") == "sk-test"
    payload = (tmp_path / "provider.json").read_text(encoding="utf-8")
    assert "sk-test" not in payload
    assert '"research_model": "gpt-5.5"' in payload


def test_failed_config_write_restores_previous_credential(tmp_path, fake_keyring):
    fake_keyring.set_password("ArchResearch/suoxie", "api-key", "sk-old")
    with pytest.raises(ProviderConfigurationError):
        commit_provider_config(
            tmp_path, SuoxieProviderConfig(), "sk-new", fake_keyring,
            config_writer=lambda *_: (_ for _ in ()).throw(OSError("disk full")),
        )
    assert fake_keyring.get_password("ArchResearch/suoxie", "api-key") == "sk-old"
```

- [ ] **Step 2: Run tests and verify RED**

Run: `apps/api/.venv/Scripts/python.exe -m pytest apps/api/tests/test_provider_credentials.py -q`

Expected: collection fails because `archresearch_api.provider_credentials` does not exist.

- [ ] **Step 3: Implement the minimal credential module**

```python
SERVICE = "ArchResearch/suoxie"
ACCOUNT = "api-key"

class SuoxieProviderConfig(BaseModel):
    provider: Literal["suoxie"] = "suoxie"
    name: str = "梭子蟹 API"
    base_url: AnyHttpUrl = "https://suoxie.codes/v1"
    research_model: str = "gpt-5.5"
    vision_model: str = "gpt-5.5"

def commit_provider_config(data_dir, config, api_key, keyring_backend, config_writer=write_config):
    previous = keyring_backend.get_password(SERVICE, ACCOUNT)
    keyring_backend.set_password(SERVICE, ACCOUNT, api_key)
    try:
        config_writer(data_dir, config)
    except Exception as exc:
        if previous is None:
            keyring_backend.delete_password(SERVICE, ACCOUNT)
        else:
            keyring_backend.set_password(SERVICE, ACCOUNT, previous)
        raise ProviderConfigurationError("Provider configuration was not saved") from exc
```

The real adapter must verify a Windows keyring backend and fail closed instead of writing plaintext.

- [ ] **Step 4: Declare and install keyring**

Add `"keyring>=25.7,<26"` to API dependencies, then run:

`apps/api/.venv/Scripts/python.exe -m pip install -e "apps/api[dev]"`

- [ ] **Step 5: Run tests, Ruff, and Mypy**

Run:

```powershell
apps/api/.venv/Scripts/python.exe -m pytest apps/api/tests/test_provider_credentials.py -q
apps/api/.venv/Scripts/python.exe -m ruff check apps/api
apps/api/.venv/Scripts/python.exe -m mypy apps/api/src
```

Expected: all pass with no key in JSON or exception output.

### Task 2: Responses plus web-search capability probe

**Files:**
- Create: `apps/api/src/archresearch_api/provider_setup.py`
- Test: `apps/api/tests/test_provider_setup.py`

- [ ] **Step 1: Write failing probe and CLI tests**

```python
def test_probe_requires_a_web_search_call(fake_openai_client):
    result = probe_provider("sk-test", SuoxieProviderConfig(), lambda **_: fake_openai_client)
    assert result.capability == "responses.web_search"
    request = fake_openai_client.responses.create.call_args.kwargs
    assert request["model"] == "gpt-5.5"
    assert request["tools"] == [{"type": "web_search", "search_context_size": "low"}]


def test_cli_failure_does_not_print_or_store_key(tmp_path, capsys, fake_keyring):
    exit_code = main(
        ["--data-dir", str(tmp_path)],
        stdin=io.StringIO("sk-private\n"),
        keyring_backend=fake_keyring,
        client_factory=failing_client_factory,
    )
    assert exit_code == 1
    assert "sk-private" not in capsys.readouterr().out
    assert fake_keyring.get_password(SERVICE, ACCOUNT) is None
```

- [ ] **Step 2: Run tests and verify RED**

Run: `apps/api/.venv/Scripts/python.exe -m pytest apps/api/tests/test_provider_setup.py -q`

Expected: collection fails because `provider_setup` does not exist.

- [ ] **Step 3: Implement probe and stdin-only CLI**

```python
response = client.responses.create(
    model=config.research_model,
    tools=[{"type": "web_search", "search_context_size": "low"}],
    include=["web_search_call.results"],
    input="Find the official OpenAI API documentation homepage and cite it.",
    max_output_tokens=96,
)
if not any(getattr(item, "type", None) == "web_search_call" for item in response.output):
    raise ProviderCapabilityError("Responses web search was not executed")
```

`main()` reads exactly one line from stdin, rejects empty input, probes before committing, and prints only fixed success or redacted failure text.

- [ ] **Step 4: Run focused and full API checks**

Run:

```powershell
apps/api/.venv/Scripts/python.exe -m pytest apps/api/tests/test_provider_setup.py -q
apps/api/.venv/Scripts/python.exe -m pytest apps/api/tests -q
```

Expected: all tests pass without real network access.

### Task 3: Load stored relay configuration at startup

**Files:**
- Modify: `apps/api/src/archresearch_api/providers.py`
- Modify: `apps/api/src/archresearch_api/visual.py`
- Modify: `apps/api/src/archresearch_api/main.py`
- Modify: `apps/api/src/archresearch_api/config.py`
- Test: `apps/api/tests/test_provider_startup.py`

- [ ] **Step 1: Write failing startup tests**

```python
def test_startup_uses_stored_suoxie_config(tmp_path, fake_keyring, fake_client_factory):
    write_config(tmp_path, SuoxieProviderConfig())
    fake_keyring.set_password(SERVICE, ACCOUNT, "sk-stored")
    app = create_app(
        Settings(data_dir=tmp_path, provider_mode="mock"),
        keyring_backend=fake_keyring,
        openai_client_factory=fake_client_factory,
    )
    assert app.state.research_provider.model == "gpt-5.5"
    assert fake_client_factory.call_args.kwargs["base_url"] == "https://suoxie.codes/v1"


def test_missing_credential_keeps_mock_mode(tmp_path, fake_keyring):
    write_config(tmp_path, SuoxieProviderConfig())
    app = create_app(Settings(data_dir=tmp_path), keyring_backend=fake_keyring)
    assert app.state.research_provider.name == "mock"
```

- [ ] **Step 2: Run startup tests and verify RED**

Run: `apps/api/.venv/Scripts/python.exe -m pytest apps/api/tests/test_provider_startup.py -q`

Expected: `create_app` does not accept credential/client injection and the live config is ignored.

- [ ] **Step 3: Add base URL support and startup resolution**

Both live clients accept `base_url` and construct `OpenAI(api_key=api_key, base_url=base_url)`. `create_app` loads provider JSON plus keyring before selecting Mock versus live providers. Health may expose only provider label, mode, and model.

- [ ] **Step 4: Restore all defaults to gpt-5.5**

Update `Settings.openai_model`, `Settings.vision_model`, `.env.example`, README examples, and config tests to `gpt-5.5`.

- [ ] **Step 5: Run full API verification**

Run:

```powershell
apps/api/.venv/Scripts/python.exe -m pytest apps/api/tests -q
apps/api/.venv/Scripts/python.exe -m ruff check apps/api
apps/api/.venv/Scripts/python.exe -m ruff format --check apps/api
apps/api/.venv/Scripts/python.exe -m mypy apps/api/src
apps/api/.venv/Scripts/python.exe -m pip check
```

Expected: all pass; no live calls occur.

### Task 4: PowerShell secure-input command

**Files:**
- Create: `scripts/configure-provider.ps1`
- Create: `scripts/tests/configure-provider.tests.ps1`
- Modify: `scripts/setup.ps1`

- [ ] **Step 1: Write the failing PowerShell security-contract test**

```powershell
$script = Get-Content -Raw (Join-Path $PSScriptRoot "..\configure-provider.ps1")
if ($script -notmatch 'Read-Host.+-AsSecureString') { throw "Key input is not hidden." }
if ($script -notmatch 'RedirectStandardInput\s*=\s*\$true') { throw "Key is not sent via stdin." }
if ($script -notmatch 'ZeroFreeBSTR') { throw "SecureString memory is not cleared." }
if ($script -match '--api-key') { throw "Key must not be passed as an argument." }
```

- [ ] **Step 2: Run test and verify RED**

Run: `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/tests/configure-provider.tests.ps1`

Expected: fail because `scripts/configure-provider.ps1` does not exist.

- [ ] **Step 3: Implement the secure PowerShell process bridge**

```powershell
$secureKey = Read-Host "请输入 API Key" -AsSecureString
$bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureKey)
try {
    $plainKey = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)
    $startInfo = [Diagnostics.ProcessStartInfo]::new()
    $startInfo.FileName = $runtime.Python
    $startInfo.Arguments = "-m archresearch_api.provider_setup --data-dir `"$dataDir`""
    $startInfo.UseShellExecute = $false
    $startInfo.RedirectStandardInput = $true
    $startInfo.RedirectStandardOutput = $true
    $startInfo.RedirectStandardError = $true
    $startInfo.CreateNoWindow = $true
    $process = [Diagnostics.Process]::Start($startInfo)
    $process.StandardInput.WriteLine($plainKey)
    $process.StandardInput.Close()
    $process.WaitForExit()
} finally {
    $plainKey = $null
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
}
```

Print the fixed provider/base URL/model before prompting. Propagate a nonzero helper exit code without printing the key or Python traceback.

- [ ] **Step 4: Run PowerShell and Python tests**

Run:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/tests/configure-provider.tests.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/tests/dev-common.tests.ps1
apps/api/.venv/Scripts/python.exe -m pytest apps/api/tests/test_provider_setup.py -q
```

Expected: all pass.

### Task 5: Documentation, project management, and final verification

**Files:**
- Modify: `.env.example`
- Modify: `README.md`
- Modify: `task_plan.md`
- Modify: `findings.md`
- Modify: `progress.md`

- [ ] **Step 1: Document the exact command and restart behavior**

Add:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/configure-provider.ps1
```

Document that the command performs one potentially billable web-search probe, stores the key in Windows Credential Manager, and requires a service restart when ArchResearch is already running.

- [ ] **Step 2: Record only the milestone and security decision**

Update the persistent planning files with the credential-storage decision, test baseline, and any relay capability result. Do not record individual commands.

- [ ] **Step 3: Run repository verification**

Run:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/verify.ps1
git diff --check
git status --short
```

Expected: Python and TypeScript checks pass; only intentional source changes remain.

- [ ] **Step 4: Commit the implementation milestone**

Stage only the provider setup implementation, tests, docs, and project-management updates, then commit:

```powershell
git commit -m "feat: add secure relay credential setup"
```

Do not include `.archresearch`, `.env`, credentials, generated build output, or brainstorm session files.
