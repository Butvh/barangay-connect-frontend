# Backend presentation feature matrix — November 4, 2026

Scope: actual P1/current owner source union in the isolated disposable profile. Frontend demo availability is not backend completion. The current integration-lock.json and PR49 CI evidence define tested pins. No public production path is enabled.

| Feature | Status and presentation boundary |
| --- | --- |
| Login, current identity, logout | Implemented in isolated profile: actual cookie session/CSRF/current role/scope/generation, revoked/removed access and no browser identity trust. Production identity remains disabled. |
| Profile/password/account registration/household | Partial: current self/household reads exist. Full profile/password/registration/household mutation endpoints and adapters are unavailable; frontend forms do not prove durable saves. |
| Recovery mail | Unavailable: frontend recovery workflow is not current real recovery API/mail acceptance. No real mail test or delivery claim. |
| Verification | Partial: current own latest verification/Approved eligibility reader. Queue/document upload/correction/resubmit/review administration is not implemented by civic-admin.php. |
| Captain personnel | Partial: current appointment/eligibility/capacity projections support dispatch. Staffing/Tanod management mutations are unavailable. Manual incident assignment is P2 operational work, not personnel administration. |
| Facilities | Partial: current visible local/shared directory and active rescue destination checks exist. Facility create/edit/deactivate administration is unavailable. |
| SOS/manual response/rescue/resolution | Implemented isolated core: real MySQL, original UI, frozen intents/revisions, manual assignment, both branches, explicit resolution/history/capacity/privacy; current-pin original browser gate required. |
| Announcements/feedback/reports | P2 services/SQL and adapters exist. Core browser suite is not exhaustive publication/feedback/report UI acceptance. Captain reports must use persisted fixtures; do not show invented historical aggregates. |
| In-app notifications | Actual typed outbox/writer/handler/recipient API with independent receipts, rollback/replay/revocation. Automated fixture dispatches in-app-only records; no autonomous production worker. |
| Private incident photos | Actual P1 byte/HTTP/cleanup service and tests now exist against ninth DBA metadata/model/exact P2 policy. Original form integration/positive controls remain unavailable pending P2 caller/replay and reviewed shared binding. See PRIVATE-PHOTO-SERVICE.md. |
| SMS consent | Schema/API/versions ratified; DBA3e632f3 now publishes tenth migration/model. P1 current authority follows this persistence; no granted preference is invented. |
| SMS/Make/carrier delivery | Unavailable positive flow: P2 producers stay in-app-only. Unsupported-intent exit2 is denial evidence. Needs persistence -> current P1 authority -> current DBA worker/P2 producer -> joint fake transport acceptance; real send/Make requires separate explicit authorization. |
| Public hosting/release | Unavailable. Static Pages is not Laravel; loopback profile is not production enablement or deployment. |

Escalate required rubric gaps before rehearsal: private uploads, full verification/account/staffing/facility administration and real SMS are not established by the core demo. Preserve the passing baseline; do not silently fill these with frontend storage or claim completion. Photos/SMS stay disabled if not jointly ready by Nov5 8AM; freeze noon.
