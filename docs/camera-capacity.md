# How many cameras can a Raspberry Pi run?

Measured on real hardware on 2026-08-01. This is the provenance for the numbers
in `app/src/main/config/capacity.ts` — if you change that file, change this one,
and if a figure here is ever contradicted by a newer measurement, record both
rather than overwriting.

**Short answer: about 6 cameras on a Raspberry Pi 4, with 8 as the hard ceiling.**
That is the worst case — every camera watching constant motion at once.

---

## The bench

| | |
|---|---|
| Board | `Raspberry Pi 4 Model B Rev 1.5`, 4 × Cortex-A72, 7796 MiB, **no swap** |
| OS | Ubuntu 26.04 LTS Server arm64, kernel 7.0.0-raspi |
| Storage | SD card (`mmcblk0`) |
| Already running | `basicstation` + `mosquitto` — a hub is not only cameras |
| Twin image | `lens/twin:local`, built natively on the Pi (arm64) |
| Camera | Tapo C210 at 192.168.2.205 |

**Baseline before any camera: 866 MiB used, load 0.80.** That is the reserve in
`BOARD_COSTS.reservedRamMib`, rounded to 900.

Every Twin decoded the same stream profile: **h264 2304×1296 @ 15 fps, 30-frame
(2 s) GOP**, motion detection on, recording on motion, not paired to Lens.

---

## The curve

Motion footage — 3 minutes recorded off the live Tapo with a person moving in
frame, 755 kbit/s, looped. Each Twin holds its own RTSP session.

| Cameras | load1 (of 4 cores) | RSS/Twin | CPU/Twin (`docker stats`) | Temp | Throttled | Verdict |
|---|---|---|---|---|---|---|
| 6 | 1.57 (39%) | 137.4 MiB | 8.63% | 58.9 °C | no | comfortable |
| 8 | 3.96 (99%) | 145.6 MiB | 10.33% | 60.3 °C | no | at the ceiling |
| 10 | 5.09 (127%) | 159.4 MiB | 15.34% | 61.8 °C | no | over |
| 18 | ~24 (600%) | — | — | — | no | collapsed |

Static footage — the same camera at night, nearly nothing moving, 345 kbit/s.
Same resolution, frame rate and GOP:

| Cameras | load1 | RSS/Twin | CPU/Twin |
|---|---|---|---|
| 1 | 0.48 | 113.2 MiB | 4.30% |
| 2 | 0.51 | 114.6 MiB | 7.90% |
| 3 | 0.47 | 114.8 MiB | 6.00% |
| 4 | 0.91 | 112.4 MiB | 3.95% |
| 5 | 1.03 | 113.4 MiB | 4.20% |
| 6 | 1.19 | 113.2 MiB | 5.17% |
| 7 | 0.62 | 112.9 MiB | 4.97% |
| 18 | 1.75 | 67.8 MiB* | — |

\* 18-camera static row is not comparable — 9 of those Twins failed to configure
and were idle. It is kept only to document that the run happened.

---

## Five findings worth not rediscovering

### 1. Motion detection decodes keyframes only

Twin `machinery/src/computervision/main.go`:

```go
if len(pkt.Data) == 0 || !pkt.IsKeyFrame {
    continue
}
```

A camera's cost therefore scales with its **keyframe interval, not its frame
rate**. This camera sends a keyframe every 2 s, so each Twin decodes 0.5 frames
per second, not 15. A camera configured with a 1 s GOP — a common default —
decodes twice as often and costs proportionally more.

This is also why a healthy Twin reports ~0.5 "packets read from mainstream" per
second in its logs. That counter tracks keyframes; comparing it against a frame
rate will make a perfectly healthy Twin look stalled.

### 2. Scene content matters more than camera count

The same 18 Twins, the same resolution, frame rate and GOP:

| Footage | load1 |
|---|---|
| static night scene | 1.75 |
| real movement | ~24 |

**A factor of ~14 from content alone.** A static scene decodes a keyframe, finds
no motion, and stops. Real motion additionally *starts a recording* — muxing and
writing MP4s for every camera simultaneously — which is the expensive path.

Any capacity measurement taken on a quiet scene is worthless. The first version
of this measurement was taken at night against a still room and suggested ~20
cameras; it was wrong by a factor of three.

### 3. CPU percentage lies here; load average does not

At 6 cameras, `docker stats` reported **0.52 cores busy** while the real load was
**1.57**. The gap is processes blocked on I/O, which CPU% does not count.

Sizing on `docker stats` would have produced a limit of roughly 27 cameras
instead of 6 — wrong by more than 4×. **Use load average.**

### 4. RAM is not the binding constraint on a 4 GB or 8 GB Pi 4

At ~160 MiB per camera and a 900 MiB reserve:

| Board | Cameras RAM allows | Cameras CPU/IO allows | Binds |
|---|---|---|---|
| Pi 4 / 8 GB | ~43 | 6 | CPU + I/O |
| Pi 4 / 4 GB | ~18 | 6 | CPU + I/O |
| Pi 4 / 2 GB | 7 | 6 | CPU + I/O (just) |
| Pi 4 / 1 GB | 0 → floored to 1 | 6 | **RAM** |

So a 4 GB and an 8 GB Pi 4 have the **same** camera limit. The RAM term is kept
because it genuinely binds on 1 GB boards, and because there is no swap — running
out of memory is the OOM killer, not a slowdown.

### 5. The Tapo allows only 2 concurrent RTSP sessions

A third client is refused with `Operation not permitted`. Measured, not assumed.

This is why the ramp ran against **restreamed footage**: real camera bytes
(`-c copy`, no re-encode, identical profile) served from a desktop via mediamtx,
so each Twin gets its own session. Any future capacity work on one camera hits
the same wall.

---

## Method notes, including what went wrong

- **Saturation criteria were fixed before the run** — load > cores, MemAvailable
  < 300 MiB, a Twin's keyframe rate below 60% of the uncontended rate, the Twin's
  own `blocking mainstream` message, or the firmware throttle flag. Deciding
  afterwards what counts as "too slow" is how a measurement becomes an opinion.
- **`vcgencmd` needs privilege.** Without `sudo` it fails on `/dev/vcio` and the
  throttle and temperature columns silently fill with an error string.
- **Twins that fail to configure look exactly like saturation.** One run reported
  "SATURATED at 18" when 9 Twins had simply never received a camera source and
  were reporting zero keyframes. The harness now retries configuration per Twin
  and reports non-decoding Twins as failures rather than averaging them in.
- **The keyframe counter resets to 0** when a Twin restarts its machinery, which
  makes a naive `after − before` go hugely negative and fake a stall.
- **Throttling was never observed.** The board stayed at 51–62 °C throughout,
  `get_throttled` = `0x0` even at load 24. Heat is not the limit here.

## What is not covered

- **Cloud upload.** Every Twin measured here was unpaired
  (`HandleHeartBeat(): disabled`). Uploading recordings to Chirp adds TLS and
  network cost that is **not** in these numbers. Worth noting the Pi 4's
  Cortex-A72 has no ARM crypto extensions, so TLS runs in software.
- **Live viewing.** WebRTC to a watching browser is per-viewer cost, also not
  included.
- **Pi 5 and Pi 3.** Neither was measured. The Pi 5 row in `capacity.ts` is
  derived from its specs (A76 @ 2.4 GHz vs A72 @ 1.8 GHz, ≈2× per core, faster
  I/O) and is marked as such. The Pi 3 has no row at all, so the app shows
  nothing on it. **The Pi 4 is the minimum supported board.**
- **Other cameras.** One camera model, one resolution, one GOP. A 4K camera or a
  1 s GOP costs more.
