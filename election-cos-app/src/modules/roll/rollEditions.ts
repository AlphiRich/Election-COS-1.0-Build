/**
 * Election Campaign OS — roll editions, client side.
 *
 * The admin edition screen reads `roll_meta` (via the DAL) and renders the
 * editions the server-side ingest has written. Activating one calls the
 * `setActiveRollEdition` function — roll_meta is `write: if false` to
 * clients, so the pointer is moved server-side with the admin SDK. The
 * guards live in functions/src/rollEditions.ts; this file is the view model
 * and the call.
 */
import { dal } from '@/dal';
import type { RollEditionMeta } from '@/dal/ports/roll';
import type { SessionContext } from '@/dal/ports/session';

export interface EditionRow extends RollEditionMeta {
  isActive: boolean;
  /** LOADED and not already active — the only state the Activate button is offered for. */
  canActivate: boolean;
}

/** The editions as rows, active first then newest, each marked active/activatable. */
export function editionRows(editions: RollEditionMeta[], activeEdition: string | null): EditionRow[] {
  return editions
    .map((e) => {
      const isActive = e.edition === activeEdition;
      return { ...e, isActive, canActivate: e.status === 'LOADED' && !isActive };
    })
    .sort((a, b) => Number(b.isActive) - Number(a.isActive) || b.edition.localeCompare(a.edition));
}

export type ActivateResult = { ok: true; edition: string } | { ok: false; message: string };

/** Move the live roll edition. Any failure (permission, second factor, not loaded) comes back as a message. */
export async function activateEdition(ctx: SessionContext, edition: string): Promise<ActivateResult> {
  try {
    const { edition: now } = await dal.roll.setActiveEdition(ctx, edition);
    return { ok: true, edition: now };
  } catch (error) {
    const e = error as { message?: string };
    return { ok: false, message: e?.message || 'The active edition could not be changed.' };
  }
}
