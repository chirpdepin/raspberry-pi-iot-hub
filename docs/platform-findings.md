# Platform findings — live end-to-end run, 2026-08-01

Findings from connecting a real RAK5146 hub to a real Chirp account. Everything
here was reproduced against production; each entry states what was measured, not
what was inferred.

Hardware: Raspberry Pi 4, RAK5146 (SX1303), gateway EUI `0016C001FF1E96BB`,
SONOFF Dongle Plus MG24 (EmberZNet 7.4.5).

---

## 1. `tc.trust` is incomplete — no third-party gateway can verify the LNS

**Severity: blocks every Basic Station gateway.**

`GET /nodes/signed-cert/{gateway_id}` returns a `tc.trust` containing **only**
the `ChirpWireless Intermediate CA`. The Root CA is absent, and the LNS serves a
**leaf-only** chain — one certificate, no intermediate.

So the trust path has no anchor at either end:

```
$ openssl s_client -connect lora-eu868.cloud.chirpwireless.io:443 \
      -servername lora-eu868.cloud.chirpwireless.io | grep -c "BEGIN CERT"
1                                    # leaf only, no chain

$ openssl verify -CAfile tc.trust server-leaf.pem
error 2 at 1 depth lookup: unable to get issuer certificate
```

It verifies only with `-partial_chain`, which Basic Station does not use.

Measured on the device, restarting Basic Station with different trust stores:

| `tc.trust` contents | TLS verify failures | HTTP 502 |
|---|---|---|
| **As Chirp ships it** (intermediate only) | 2 | 0 — never reaches HTTP |
| Intermediate + ISRG (Let's Encrypt) roots | 0 | 2 |
| ISRG roots only, no Chirp cert | 1 | 2 |

Every bundle checked shows this, staging and production, so it is systematic
rather than a one-off.

**Fix:** include the ChirpWireless **Root CA** in `tc.trust` (and ideally serve
the intermediate in the LNS chain).

---

## 2. The LNS ingress serves two different certificates and 502s on one path

**Severity: gateway cannot stay connected.**

`lora-eu868.cloud.chirpwireless.io:443` answers differently depending on SNI:

| Request | Certificate served | Websocket upgrade |
|---|---|---|
| **with** SNI | `CN=lora-eu868.cloud.chirpwireless.io` (ChirpWireless Intermediate) | `101 Switching Protocols` |
| **without** SNI | `CN=prod.chirpwireless.io` (Let's Encrypt, full chain) | **`502 Bad Gateway`** |

The 502 is the default vhost answering — it has no LNS route.

Basic Station reports exactly that 502 on the MUXS upgrade:

```
[TCE:INFO] Infos: 0016:c001:ff1e:96bb ... wss://.../gateway/0016c001ff1e96bb
[AIO:ERRO] [4] WS upgrade failed with HTTP status code: 502
```

Basic Station **does** send SNI — confirmed on the wire with `tcpdump` on
client→server packets only. And an equivalent request from the same Pi with the
same `tc.crt`/`tc.key` succeeds every time:

```
12 x  HTTP/1.1 101 Switching Protocols
```

Ruled out as causes: TLS version (1.2 and 1.3 both fine), ALPN, `Host` header
(hostname, host:port, and bare IP all return 101), request path (`/`,
`/router-info`, `/gateway/<eui>` all return 101), and `Sec-WebSocket-Protocol`.

That the third row of the table in finding 1 — ISRG roots with **no** Chirp
certificate at all — still gets far enough to receive a 502 is the clearest
evidence: some of Basic Station's connections are being served the Let's Encrypt
default-vhost certificate and routed to the backend that 502s.

**Fix (backend):** the ingress for `lora-*.cloud.chirpwireless.io` routes some
connections to the default vhost. That needs fixing at the ingress; nothing on
the device can work around it.

---

## 3. The Cloud MQTT broker's TLS certificate expired on 2026-07-23

**Severity: blocks every `mqtt_cloud` connector.**

```
subject=CN=mqtt-iot.chirpwireless.io
issuer =C=US, O=Let's Encrypt, CN=E7
notAfter=Jul 23 20:09:51 2026 GMT      # nine days before this run
```

Port 1884 is the only one open — 1883, 8883, 8083 and 8084 are closed — so there
is no non-TLS fallback. Mosquitto's bridge fails as expected:

```
OpenSSL Error ... error:0A000086:SSL routines::certificate verify failed
Client local.iot-hub.chirp-cloud disconnected: Protocol error.
```

The connector itself is **fine**. Connecting with verification disabled proves
the credentials and topic prefix are valid and the broker accepts the session:

```
CONNACK: accepted
PUBLISH sent, broker accepted the session
```

So this is purely a failed certificate renewal.

**Fix:** renew the certificate and check auto-renewal for `mqtt-iot`.

`mqtt-iot.dev.chirpwireless.io` is valid until 2026-09-07, so this is production
only.

### Everything downstream of it is proven

Publishing the lamp's real payload to the exact topic the bridge uses — stepping
past the expired certificate, and nothing else — makes the whole chain work:

```
topic:   iot/<org>/<connection>/zigbee2mqtt/0x00158d00053c075f
payload: {"brightness":80,"linkquality":188,"state":"ON"}
```

Chirp accepted it, resolved the device from the topic, parsed the JSON, and its
mapping picker — empty until then — offered exactly `state`, `brightness` and
`linkquality`, showing `state = OFF` with a timestamp. So topic construction,
device-ID resolution, payload parsing and sensor mapping are all correct, and
the expired certificate is the only thing between the hub and live telemetry.

That the picker is populated **from payloads actually received** also confirms
the onboarding design: mappings are proposed from what a device really sends,
so a device nobody has modelled still works.

---

## 4. Saving a sensor mapping without a normalized key silently discards it

**Severity: minor, but it costs real time.**

On the device's **Mapping** tab, selecting a *Device data key* and pressing
**Save** shows `Success — Device updated successfully`. Reload the page and the
row is empty: the mapping was never stored.

The cause is that the row also needs a **Normalized key**, and its picker is
empty until a metric exists — so on a fresh organization there is nothing to
choose. Creating a metric first (`+ Add new metric`) makes the identical save
persist.

Nothing in the UI says so. The success toast reports a change that was thrown
away, which is worse than an error would be: the natural conclusion is that
mapping is broken rather than that a prerequisite is missing.

**Fix:** either reject the save with "choose a normalized key first", or make
the Normalized key field visibly required. Do not report success for a discarded
change.

### Values are last-seen, not live

Worth stating because it reads as a bug: the **Value** column shows the last
value Chirp *received*, per key. With the bridge down (finding 3) nothing
updates it, so a lamp that is physically on can sit there showing `state = OFF`
from an earlier message indefinitely. Publishing the true state updates it
immediately — `state = ON` — and the mapping picker also learns new keys
cumulatively, gaining `color_mode` and `color_temp` once a payload containing
them arrived.

---

## 5. Corrections to our own assumptions

Not platform bugs — things this repo had wrong, now fixed.

| Assumption | Reality |
|---|---|
| Gateway bands from `device_provision_lorawan` | The console's picker lists **ten**: `AS923`, `AS923-2`, `AU915-0`, `EU433`, `EU868`, `IN865`, `KR920`, `RU864`, `US915-0`, `US915-1`. `AU915`/`US915` are wrong (sub-plan suffix), and CN470/CN779/ISM2400 are device-only |
| LNS host = `lora-{band}` | Correct, but the **sub-plan suffix is dropped**: `US915-0` → `lora-us915` |
| Remote MQTT prefix = `chirp/<eui>/` | **Assigned by Chirp**: `iot/<organization-id>/<connection-id>`, per connection. Not derivable on the device — a locally invented prefix publishes where Chirp does not read, so telemetry leaves the hub and silently goes nowhere |

Confirmed rather than changed: the LNS URL really is derivable (registering
EU868 displayed exactly the URL the code builds, so the user never types it);
`mqtt_cloud` is the right connector, since it issues credentials and the hub
dials out, needing no inbound path into home NAT; and the certificate ZIP
contains `tc.trust`, `tc.crt`, `tc.key` as documented, with `tc.key` in PKCS#1
form.

---

## What works today

- Gateway registration, certificate issue, and EUI/region handling
- Basic Station reaching the LNS, INFOS handshake, and MUXS URI resolution
- Cloud MQTT connector creation, credentials, and broker authentication
- Zigbee2MQTT on the MG24 coordinator, channel 15, join window control
- Pairing and driving a real device: Paulmann 50064 CCT spot
  `0x00158d00053c075f`, state, brightness and colour temperature all controlled
  from the hub and confirmed physically
- Chirp device provisioning, topic resolution, payload parsing and sensor
  mapping — proven by publishing the lamp's real payload past finding 3
- Mosquitto bridge configuration (connects as soon as finding 3 is fixed)

## What is blocked, and on whom

| Blocked | Owner |
|---|---|
| Gateway staying connected (findings 1 and 2) | Chirp backend / infrastructure |
| Zigbee telemetry reaching Chirp (finding 3) | Chirp infrastructure |
| Camera Twins | Lens team — no published image yet |
