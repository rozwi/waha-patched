# WAHA NOWEB patched image

This image is built from `devlikeapro/waha:latest-2026.10.1` and applies two
temporary, build-verified patches to the Baileys version bundled by WAHA.

## Included patches

1. **Status acknowledgement**: acknowledges top-level WhatsApp `status` stanzas.
   This prevents the repeated `Stream Errored (ack)` loop reported in
   [WAHA #2346](https://github.com/devlikeapro/waha/issues/2346).
2. **Offline queue draining**: requests further `offline_batch` pages every five
   seconds until WhatsApp confirms the end of the offline queue. This prevents a
   session from remaining `WORKING` while live inbound events are held behind a
   queue greater than 100, reported in [WAHA #2349](https://github.com/devlikeapro/waha/issues/2349).

The scripts look for exact, unique source anchors. The Docker build fails if the
base image changes its bundled Baileys structure, avoiding a partial patch.

## EasyPanel deployment

1. Back up the existing WAHA service configuration and the persistent volume(s)
   that contain its session/authentication data.
2. Change the service source to this Git repository and select `Dockerfile` as
   the build file. Do not change the existing environment variables, ports,
   domain, or mounted volume paths.
3. Deploy the new build. The persisted session volume must be reused, so QR
   pairing should not be necessary.
4. Watch service logs for at least one reconnect cycle. Expected healthy output:
   `handled N offline messages/notifications`. The repeating `Stream Errored
   (ack)` and `Buffer timeout reached, auto-flushing` messages should stop.

## Rollback

Switch the EasyPanel source image back to:

```text
devlikeapro/waha:latest-2026.10.1
```

Keep the same persistent volumes when rolling back.

## Local build

```bash
docker build -t rozwi/waha-patched:2026.10.1 .
```

This repository deliberately contains no WAHA credentials or session data.
