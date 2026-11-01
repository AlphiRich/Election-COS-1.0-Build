# ECOS component reference

React primitives (React only, styled by `components.css` classes and token variables). Source lives in the design-system project under `components/<group>/<Name>.jsx` with `.d.ts` props.

## core

### Icon
Phosphor duotone icon glyph — use for every icon in ECOS; never emoji or hand-drawn SVG.
```jsx
<Icon name="shield-check" size={20} />
<Icon name="warning" label="Warning" />
```
Inherits currentColor. Common: shield-check, key, users-three, map-pin, identification-card, clock-countdown, wifi-slash, lock-simple, check-circle, warning, scroll.

Props:
```ts
export interface IconProps {
  /** Phosphor icon name, e.g. "shield-check", "key", "map-pin" */
  name: string;
  /** CSS size, e.g. 20 or "1.25em" */
  size?: number | string;
  /** Accessible label; omit for decorative icons */
  label?: string;
  className?: string;
  style?: React.CSSProperties;
}
```

### Button
Action button. Primary is Amber fill with Ink label — one per view; Blue secondary for "Request demo"-type actions.
```jsx
<Button variant="primary" icon="user-plus">Grant delegation</Button>
<Button variant="secondary">Request demo</Button>
<Button variant="destructive" icon="prohibit">Revoke</Button>
<Button size="lg" block>Start canvass</Button>
```
Use size="lg" (48px) on every Field (mobile) surface. Never put Amber text on Paper — Amber is a fill only.

Props:
```ts
export interface ButtonProps {
  /** primary = Amber fill + Ink label (main CTA); secondary = Blue + Paper; outline; ghost (Blue text); ink (on Paper, inverse emphasis); destructive (revoke/rotate) */
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'ink' | 'destructive';
  /** sm 32px · md 40px (War Room) · lg 48px (Field touch target) */
  size?: 'sm' | 'md' | 'lg';
  /** Phosphor icon name before label */
  icon?: string;
  iconRight?: string;
  block?: boolean;
  disabled?: boolean;
  type?: 'button' | 'submit' | 'reset';
  onClick?: (e: React.MouseEvent) => void;
  children?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}
```

### IconButton
Square icon-only button; always pass a label.
```jsx
<IconButton icon="dots-three-vertical" label="More actions" />
<IconButton icon="arrows-clockwise" label="Sync now" variant="outline" size="lg" />
```

Props:
```ts
export interface IconButtonProps {
  /** Phosphor icon name */
  icon: string;
  /** Required accessible label (also the title tooltip) */
  label: string;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'ink';
  size?: 'sm' | 'md' | 'lg';
  onClick?: (e: React.MouseEvent) => void;
  disabled?: boolean;
  className?: string;
  style?: React.CSSProperties;
}
```

### StatusBadge
Uppercase system status label, from the protocol's "BUILT · COMPLETE" / "ROADMAP · IN PROGRESS" examples.
```jsx
<StatusBadge status="built">Built</StatusBadge>
<StatusBadge status="roadmap">Roadmap</StatusBadge>
<StatusBadge status="neutral">Revoked</StatusBadge>
```
Keep labels to one or two words.

Props:
```ts
export interface StatusBadgeProps {
  /** built = Green (delivered/complete/active); roadmap = deep amber #8A6A2A (planned/in progress/expiring); info = Blue; neutral = Slate; ink = inverse; outline */
  status?: 'built' | 'roadmap' | 'info' | 'neutral' | 'ink' | 'outline';
  dot?: boolean;
  /** Short uppercase-able label: BUILT, ROADMAP, ACTIVE, REVOKED */
  children: React.ReactNode;
}
```

### CodeTag
IBM Plex Mono chip for identifiers — ward codes, VD numbers, IEC IDs, capability keys, financial figures. Never set these in Public Sans.
```jsx
<CodeTag>NW405-W07</CodeTag>
<CodeTag>household.write</CodeTag>
<CodeTag plain>R1,800</CodeTag>
```

Props:
```ts
export interface CodeTagProps {
  /** A ward code (NW405-W07), VD number, IEC tracking ID, capability key or Rand figure */
  children: React.ReactNode;
  plain?: boolean;
  inverse?: boolean;
  title?: string;
}
```

### Card
Hairline-bordered surface for genuinely discrete items (a role, a key, a ward). Not for page layout.
```jsx
<Card kicker="Ward" title="NW405-W07" meta={<StatusBadge status="built">Active</StatusBadge>}>4 voting districts · 12 canvassers</Card>
```

Props:
```ts
export interface CardProps {
  kicker?: React.ReactNode;
  title?: React.ReactNode;
  children?: React.ReactNode;
  meta?: React.ReactNode;
  interactive?: boolean;
  /** Ink border + Amber top marker */
  selected?: boolean;
  /** Ink field with Paper text, Amber kicker */
  inverse?: boolean;
  onClick?: () => void;
  style?: React.CSSProperties;
}
```

### Wordmark
Typeset product shorthand "Election-COS 1.0". The approved symbol was not supplied as a file, so this type-only mark stands in — never redraw the symbol.
```jsx
<Wordmark />
<Wordmark inverse size={28} />
```

Props:
```ts
export interface WordmarkProps {
  inverse?: boolean;
  /** font-size in px; digital minimum 24px for the symbol lockup, 120px primary lockup */
  size?: number;
}
```

## forms

### Field
Label + control + hint/error wrapper for any form control.
```jsx
<Field label="Valid until" hint="Required. Delegations expire." htmlFor="vu"><Input id="vu" type="date" /></Field>
```

Props:
```ts
export interface FieldProps {
  label?: React.ReactNode;
  hint?: React.ReactNode;
  /** Error replaces hint; rendered Ink semibold with Amber warning glyph (never Amber text) */
  error?: React.ReactNode;
  htmlFor?: string;
  children: React.ReactNode;
  style?: React.CSSProperties;
}
```

### Input
Native text input, themed.
```jsx
<Input placeholder="Search canvassers" />
<Input mono defaultValue="NW405-W07" />
```

Props:
```ts
export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  /** md 40px desktop · lg 48px Field */
  size?: 'md' | 'lg';
  /** Plex Mono — for ward codes, IDs, amounts */
  mono?: boolean;
  invalid?: boolean;
}
```

### Select
Native select with themed chevron.
```jsx
<Select options={[{value:'WARD_LEAD',label:'Field Coordinator'}]} />
```

Props:
```ts
export interface SelectProps extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'size'> {
  options: Array<string | { value: string; label: string; disabled?: boolean }>;
  size?: 'md' | 'lg';
}
```

### Checkbox
Native checkbox, Ink when checked.
```jsx
<Checkbox label="Voter gave POPIA consent" defaultChecked />
```

Props:
```ts
export interface CheckboxProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: React.ReactNode;
}
```

### Radio
Native radio, Ink ring when selected. Group with a shared name.
```jsx
<Radio name="scope" label="Ward NW405-W07" defaultChecked />
```

Props:
```ts
export interface RadioProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: React.ReactNode;
  name: string;
}
```

### Switch
On/off toggle for immediate settings; Green when on.
```jsx
<Switch label="Can delegate" defaultChecked />
```

Props:
```ts
export interface SwitchProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: React.ReactNode;
}
```

## feedback

### Alert
Inline notice. ECOS has no red — critical uses the Ink field; warnings use deep amber text with an Amber glyph.
```jsx
<Alert tone="warning" title="Token expires in 42 min">Reconnect to re-issue before your next shift.</Alert>
<Alert tone="critical" title="Signing key retired">3 devices hold tokens signed with ecos-2026-10.</Alert>
```

Props:
```ts
export interface AlertProps {
  /** info Blue · success Green · warning deep-amber · critical Ink field with Amber glyph */
  tone?: 'info' | 'success' | 'warning' | 'critical';
  title?: React.ReactNode;
  children?: React.ReactNode;
  action?: React.ReactNode;
  /** Override Phosphor icon */
  icon?: string;
}
```

### Toast
Transient Ink confirmation with Amber (or Green) top edge.
```jsx
<Toast tone="success" actionLabel="View log">Delegation granted · logged #4821</Toast>
```

Props:
```ts
export interface ToastProps {
  tone?: 'neutral' | 'success';
  children: React.ReactNode;
  actionLabel?: string;
  onAction?: () => void;
  onDismiss?: () => void;
}
```

### Dialog
Modal with Ink top rule, sunk action footer.
```jsx
<Dialog title="Grant delegation" kicker="Ward NW405-W07" onClose={close} actions={<><Button variant="outline">Cancel</Button><Button>Grant</Button></>}>…</Dialog>
```

Props:
```ts
export interface DialogProps {
  open?: boolean;
  title: React.ReactNode;
  kicker?: React.ReactNode;
  children?: React.ReactNode;
  /** Buttons, right-aligned in the sunk footer */
  actions?: React.ReactNode;
  onClose?: () => void;
  width?: number;
  /** Render without backdrop (for specimens) */
  inline?: boolean;
}
```

### Tooltip
Short Ink hint on hover/focus. Never hide vital info in a tooltip.
```jsx
<Tooltip tip="Delegations are one level only"><IconButton icon="info" label="About delegation" /></Tooltip>
```

Props:
```ts
export interface TooltipProps {
  tip: React.ReactNode;
  /** Force visible (specimens) */
  open?: boolean;
  children: React.ReactNode;
}
```

## navigation

### Tabs
Underline tabs; active = Ink text + Amber underline.
```jsx
<Tabs value={tab} onChange={setTab} tabs={[{value:'active',label:'Active',count:12},{value:'expired',label:'Expired'}]} />
```

Props:
```ts
export interface TabsProps {
  tabs: Array<{ value: string; label: React.ReactNode; count?: number }>;
  value: string;
  onChange?: (value: string) => void;
  style?: React.CSSProperties;
}
```

### SideNav
War Room left rail — an Ink field with Paper labels and an Amber active marker (Amber on Ink passes 5.24:1).
```jsx
<SideNav value="roles" onChange={go} sections={[{title:'Access',items:[{value:'roles',label:'Roles',icon:'users-three'}]}]} />
```

Props:
```ts
export interface SideNavProps {
  sections: Array<{ title?: string; items: Array<{ value: string; label: string; icon?: string; meta?: string }> }>;
  value: string;
  onChange?: (value: string) => void;
  footer?: React.ReactNode;
  style?: React.CSSProperties;
}
```

### AppBar
Paper top bar with breadcrumb and right-side controls.
```jsx
<AppBar crumbs={['Settings','Access']} title="Roles" right={<CodeTag>NW405</CodeTag>} />
```

Props:
```ts
export interface AppBarProps {
  title: React.ReactNode;
  crumbs?: React.ReactNode[];
  /** Right-side controls: tenant/municipality code, sync state, user */
  right?: React.ReactNode;
  style?: React.CSSProperties;
}
```

## data

### Table
Data table — 2px Ink header rule, hairline Line rows, numeric columns in Plex Mono.
```jsx
<Table columns={[{key:'ward',label:'Ward',render:r=><CodeTag>{r.ward}</CodeTag>},{key:'vds',label:'VDs',numeric:true}]} rows={rows} />
```

Props:
```ts
export interface TableColumn {
  key: string;
  label: React.ReactNode;
  numeric?: boolean;
  width?: number | string;
  render?: (row: any) => React.ReactNode;
}
export interface TableProps {
  columns: TableColumn[];
  rows: any[];
  dense?: boolean;
  rowKey?: string;
  onRowClick?: (row: any) => void;
}
```

### Stat
Key figure — uppercase label over a Plex Mono number. No boxes; space them with gap.
```jsx
<Stat label="Active delegations" value="47" delta="6 expire this week" />
```

Props:
```ts
export interface StatProps {
  label: React.ReactNode;
  /** Figure, set in Plex Mono */
  value: React.ReactNode;
  delta?: React.ReactNode;
  style?: React.CSSProperties;
}
```

## rbac

### RoleBadge
Shows a canonical ECOS role with its UI label (WARD_LEAD → "Field Coordinator", VOLUNTEER → "Canvasser"). Only the six roles in the `role` table — never WBS owner labels like COMPLIANCE_OFFICER.
```jsx
<RoleBadge role="WARD_LEAD" showKey />
```

Props:
```ts
export type EcosRole = 'HQ_ADMIN' | 'LOCAL_HEAD' | 'FINANCE_OFFICER' | 'WARD_LEAD' | 'VD_CAPTAIN' | 'VOLUNTEER';
export interface RoleBadgeProps {
  /** One of the six canonical roles in the `role` table */
  role: EcosRole;
  /** Also show the DB enum key in Plex Mono */
  showKey?: boolean;
}
```

### CapabilityCell
One cell of the role × capability matrix (role_capability grants).
```jsx
<CapabilityCell state="scoped" delegable label="WARD_LEAD · household.write" />
```

Props:
```ts
export interface CapabilityCellProps {
  /** granted = Ink filled; scoped = Blue tint (geographic scope applies); none = dash */
  state?: 'granted' | 'scoped' | 'none';
  /** Amber underline — the holder may delegate this capability */
  delegable?: boolean;
  onClick?: () => void;
  label?: string;
}
```

### RuleCheck
One line of a live policy check — e.g. the five delegation non-negotiables before a grant can submit.
```jsx
<RuleCheck status="pass">Delegator holds household.write</RuleCheck>
<RuleCheck status="fail">VD 10930020 is outside Ward NW405-W07</RuleCheck>
```

Props:
```ts
export interface RuleCheckProps {
  /** pass Green · fail deep-amber + semibold · pending Slate */
  status?: 'pass' | 'fail' | 'pending';
  children: React.ReactNode;
}
```

### CapabilityToken
Ink panel showing a signed, short-lived capability token's claims (sub, tenant_id, scope, capabilities, iat/exp, kid) — the offline proof a canvasser carries.
```jsx
<CapabilityToken sub="usr_8f2c" tenant="tn_nw405" kid="ecos-2026-11" scope={['VD 10930012']} capabilities={['household.read','consent.capture']} issued="06:00 SAST" expires="14:00 SAST" remaining={0.62} />
```

Props:
```ts
export interface CapabilityTokenProps {
  sub: string;
  tenant: string;
  /** Resolved at issuance: role defaults + active delegations */
  capabilities: string[];
  /** Ward / VD codes the token is valid within */
  scope: string[];
  issued: string;
  expires: string;
  /** rbac_signing_key id */
  kid: string;
  /** 0–1 lifetime remaining (Amber meter) */
  remaining?: number;
  status?: 'valid' | 'expiring' | 'revoked' | 'expired';
  style?: React.CSSProperties;
}
```
