/**
 * Role × capability matrix — read-only. Roles are static seed data in this
 * build (see PermissionsPage), so cells are not editable; per-person changes
 * go through the overrides on the staff cards below.
 */
import { SEED_ROLES } from '@/auth/seedRoles';
import { ALL_CAPABILITIES } from '@/auth/allCapabilities';
import { buildRoleMatrix, unassignedCapabilities } from './roleMatrix';

const matrix = buildRoleMatrix(SEED_ROLES, ALL_CAPABILITIES);
const unassigned = unassignedCapabilities(matrix);

export function RoleMatrixPanel() {
  return (
    <section className="space-y-3" aria-labelledby="role-matrix-title">
      <h2 id="role-matrix-title" className="text-label-caps font-display uppercase text-slate">
        Capability matrix
      </h2>
      <p className="text-body-md font-body text-slate">
        What each role holds by default. A person's own grants and revocations, set below, are applied on top.
      </p>
      <div className="overflow-x-auto bg-white border border-ink/10 rounded-lg">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-ink/10">
              <th scope="col" className="p-3 text-label-caps font-display uppercase text-slate">
                Capability
              </th>
              {SEED_ROLES.map((role) => (
                <th
                  key={role.id}
                  scope="col"
                  className="p-3 text-center text-label-caps font-display uppercase text-ink align-bottom"
                >
                  {role.label}
                  <span className="block text-data-mono font-mono normal-case text-slate">{role.geoScope}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {matrix.map((row, i) => (
              <tr
                key={row.capability}
                className={
                  'border-b border-ink/5 ' + (i > 0 && matrix[i - 1].group !== row.group ? 'border-t border-ink/20' : '')
                }
              >
                <th scope="row" className="p-3 text-data-mono font-mono font-normal text-ink">
                  {row.capability}
                </th>
                {row.held.map((held, c) => (
                  <td key={SEED_ROLES[c].id} className="p-3 text-center">
                    {held ? (
                      <span className="text-green font-semibold" role="img" aria-label="Held">
                        ●
                      </span>
                    ) : (
                      <span className="text-slate/40" role="img" aria-label="Not held">
                        –
                      </span>
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {unassigned.length > 0 && (
        <p className="text-body-md font-body text-slate">
          Held by no role by default (grant per person only):{' '}
          <span className="text-data-mono font-mono">{unassigned.join(', ')}</span>
        </p>
      )}
    </section>
  );
}
