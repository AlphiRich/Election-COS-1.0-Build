# ECOS design system: reconciliation with the app (1 Nov 2026)

Supplied: `ECOS_design_system_development.zip` (a skill, `tokens.css`, `components.css`, `components.md`, `rbac-ui.md`).
Kept here as **reference**, not as an active skill: two of its rules contradict recorded decisions (below), and a skill
that says "no red" and "six roles only" would steer later sessions against them.

`/design-sync` could not run: the DesignSync tool needs a design authorisation (`/design-login`) that a headless session
cannot give. Nothing was pushed to or pulled from a claude.ai/design project. To sync the live project, run `/design-login`
once in an interactive session, or use Claude Design's "Send to Claude Code Web".

## Matches (guarded by `src/design/designSystemSync.test.ts`)
| Design system | App token | Value |
|---|---|---|
| ink | `ink` | #1A2246 |
| paper | `paper` | #F7F4EE |
| amber | `gold` | #B7913F |
| slate | `slate` | #6A6E7E |
| blue | `teal` | #33427E |
| green | `green` | #2F7E4A |
| line | `line` | #DCD6C8 |
| roadmap | `roadmap` | #8A6A2A (**added now**; planned/in-progress and warning text; gold fails as text, 2.68:1) |

## Differences, and what was decided
1. **Red.** The system forbids red (no party-colour signifier; critical = Ink field + Amber glyph). The app has `maroon`
   #7E1F2E in 61 files, used for errors and refusals. **Not removed.** A palette-wide change in the last days before
   polling day is a larger risk than the colour, and maroon is used as text and border, never as a block fill beside a party
   term. Recorded by a test so it is not forgotten, and listed for the owner to decide after 4 November.
2. **Six roles.** The system lists only six login roles. The app has seven (`compliance-officer`), settled 13 Sep 2026 in the
   decision record ("do not re-open"). Labels also differ (system: "Field Coordinator", "Canvasser"; app: "Ward Lead",
   "Canvasser"). Not changed.
3. **Display face.** The system says Archivo 700 for headings. The app's war-room screens use Archivo **Narrow**
   deliberately (density; reason in `tokens.ts`); the public site uses Archivo, as the system says. Not changed.
4. **Hash-chained audit log.** The system's audit pattern shows a Hash column. The app's audit log has no hash chain and
   says so on the page; a hash column would claim a property the data lacks. Not adopted.
5. **Capability token panel** and **delegation form with five live checks**: no equivalent screen here; the delegation
   rules depend on database triggers this build (Firestore) does not have. Not built.
6. **Components (26 React primitives)**: the app already has `src/components/ui`. Not replaced; names and behaviours
   can be compared one at a time if a screen needs it.
