# Barangay Connect interaction contract

Visual identity and runtime token ownership are documented in `DESIGN.md`. Business rules remain in `docs/CONTRACT.md` and the current profile, recovery, verification, facilities and assignments API contracts. This index records the existing owners; it does not override those rules.

| Capability | Canonical owner | Source of truth | Allowed variants | Verification |
| --- | --- | --- | --- | --- |
| Form | Existing page form models, `core/ui.js`, and `core/form-validation.js` | Existing domain/API contracts and DESIGN.md | Account, verification, Captain personnel, facilities | Existing page suites and actual SQL/HTTP acceptance |
| Select/Listbox | Shared `core/select.js` enhancement and Captain personnel selector | Existing domain/API contracts and DESIGN.md | Authored shared popup over native select semantics; native fallback | Existing keyboard/browser suites |
| Date | Existing native date inputs, `core/format.js` | Existing domain/API contracts and DESIGN.md | Calendar effective date; Asia/Manila display | Personnel calendar validation and browser input checks |
| Toast | `core/ui.js` | Existing domain/API contracts and DESIGN.md | Existing success/error tones and live region | Existing shared UI tests |
| Dialog | `core/ui.js`, change-password and forgot-password components | Existing domain/API contracts and DESIGN.md | Confirmation, form, existing responsive sheet | Focus, Escape, cancellation and original-page browser suites |
| Table | Official page models, `official-shared.js` pagination | Existing domain/API contracts and DESIGN.md | Existing desktop table/mobile card list | Existing filtering/paging/responsive suites |
| CRUD | `core/api.js` facade and reviewed backend domain factories | Existing domain/API contracts and DESIGN.md | Original list/detail destinations; explicit conflict review | Actual production-adapter tests plus original forms |
| Upload | Existing registration/personnel file pickers; shared HTTP FormData and form-owned submission intent | Existing domain/API contracts and DESIGN.md | Two residency documents or up to10 personnel requirements | Actual bytes/hash/privacy/rollback and browser tests |
| Session | `adapters/session.js`, shared HTTP/current-identity middleware | Existing domain/API contracts and DESIGN.md | Hydrated cookie session, immediate generation revocation | Existing identity browser and MySQL suites |
| Scrollbar | Existing application styles and natural document scroll | Existing domain/API contracts and DESIGN.md | Existing table/dialog internal overflow | Responsive/keyboard checks; no new overflow owner |

Save success requires a committed server result; retain the existing return-to-list/detail behavior and toast wording. Cancel closes the current dialog and discards its form-owned transient intent. Network errors retain inputs and the same original command key; changed input after an ambiguous submission requires reviewing/cancelling the original intent. Stale revisions never silently retry against new source data.

Backend mode never reads demo storage as a fallback. Factories/readers are explicitly selected in an isolated reviewed composition; missing services remain unavailable. Client role checks are presentation safeguards only. Laravel independently resolves authority, scope and source revisions.

Passwords/codes/reset authorizations stay in transient controls/closures and private server boundaries. No browser storage, URLs, analytics or event payloads retain them. Private documents use association-authorized same-origin downloads, never public object keys. Existing fake preview copy remains only in demo mode.

Registration creates only a resident and household, signs in through the existing login endpoint, then submits actual documents. Verification correction retains the application, approval is final, and rejected/expired applications may reapply. Captain role changes confirm their consequence; fixed Tanod membership is not CRUD. Facilities use scoped permissions and original revisions, preserving historical rescue snapshots.

Unsupported integration, loading, empty/error, stale/conflict, permission denial and session expiry must remain distinguishable. Existing drafts and focus handling are preserved. English labels, shared Asia/Manila formatting, visible labels, native semantics, focus rings and44px tablet/mobile actions remain the accessibility contract.
