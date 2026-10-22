# Independent review: Walk chat and files

Reviewer: separate bounded security/review agent; parent integrated and rendered the final UI. Result: passed after corrections.

## Corrected findings

- Uploads lacked a request throttle. Added authenticated project40/15min and global1000/day checks before reading bytes; test verifies rejection without pulling request stream.
- Uncertain D1 acknowledgement could remove a referenced R2 object. Reconcile the unique object id/key before cleanup. Preserve private bytes when reconciliation is unavailable; tests cover both cases.
- Reply handler forced readers to newest messages. Removed forced scroll and recheck follow state inside queued animation so scrolling upward cancels auto-follow.
- Pending attachment restore could change id order and fail exact retry. Real composer now restores authoritative order; page maps the pending id order rather than filtering the upload library.
- Reset cleanup is bounded to the owned project and lease. Partial failures report incomplete cleanup honestly and support retry.

## Executed checks and boundaries

Independent backend/sketch run30passed. Frontend/provider run24passed before the final page order regression; coordinator fullsuite298passed after corrections. Actual file chooser, upload/send/reload/download and phone-width rendered evidence are coordinator checks. No production/customer-data mutations, malware certification, actual phone test or paid-model inference claimed.

Private downloads retain existing project ownership and no-store/nosniff/sandbox headers. Uploaded names render as text, allowlisted authenticated download paths only. Raw bytes/storage keys never enter provider payloads. Existing microphone and manual-review handoff remain. Public source contains synthetic fixtures and no customer attachments.
