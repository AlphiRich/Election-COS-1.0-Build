/**
 * The council pages that may carry an advert: every metro and local council elected on 4 November 2026, written out
 * literally (213 codes) so the allowlist in adPolicy.ts stays a list someone reviewed rather than a prefix.
 * councilAdPages.test.ts fails if this differs from the certified council list, so a council cannot be added or dropped
 * silently. Kept here rather than read from seats-2026.json, which is 176 KB and not needed on most pages.
 */
export const COUNCIL_AD_CODES: readonly string[] = [
  'BUF', 'CPT', 'EC101', 'EC102', 'EC104', 'EC105', 'EC106', 'EC108', 'EC109', 'EC121', 'EC122', 'EC123',
  'EC124', 'EC126', 'EC129', 'EC131', 'EC135', 'EC136', 'EC137', 'EC138', 'EC139', 'EC141', 'EC142', 'EC145',
  'EC153', 'EC154', 'EC155', 'EC156', 'EC157', 'EC441', 'EC442', 'EC443', 'EC444', 'EKU', 'ETH', 'FS161',
  'FS162', 'FS163', 'FS181', 'FS182', 'FS183', 'FS184', 'FS185', 'FS191', 'FS192', 'FS193', 'FS194', 'FS195',
  'FS196', 'FS201', 'FS203', 'FS204', 'FS205', 'GT421', 'GT422', 'GT423', 'GT481', 'GT484', 'GT485', 'JHB',
  'KZN212', 'KZN213', 'KZN214', 'KZN216', 'KZN221', 'KZN222', 'KZN223', 'KZN224', 'KZN225', 'KZN226', 'KZN227', 'KZN235',
  'KZN237', 'KZN238', 'KZN241', 'KZN242', 'KZN244', 'KZN245', 'KZN252', 'KZN253', 'KZN254', 'KZN261', 'KZN262', 'KZN263',
  'KZN265', 'KZN266', 'KZN271', 'KZN272', 'KZN275', 'KZN276', 'KZN281', 'KZN282', 'KZN284', 'KZN285', 'KZN286', 'KZN291',
  'KZN292', 'KZN293', 'KZN294', 'KZN433', 'KZN434', 'KZN435', 'KZN436', 'LIM331', 'LIM332', 'LIM333', 'LIM334', 'LIM335',
  'LIM341', 'LIM343', 'LIM344', 'LIM345', 'LIM351', 'LIM353', 'LIM354', 'LIM355', 'LIM361', 'LIM362', 'LIM366', 'LIM367',
  'LIM368', 'LIM471', 'LIM472', 'LIM473', 'LIM476', 'MAN', 'MP301', 'MP302', 'MP303', 'MP304', 'MP305', 'MP306',
  'MP307', 'MP311', 'MP312', 'MP313', 'MP314', 'MP315', 'MP316', 'MP321', 'MP324', 'MP325', 'MP326', 'NC061',
  'NC062', 'NC064', 'NC065', 'NC066', 'NC067', 'NC071', 'NC072', 'NC073', 'NC074', 'NC075', 'NC076', 'NC077',
  'NC078', 'NC082', 'NC084', 'NC085', 'NC086', 'NC087', 'NC091', 'NC092', 'NC093', 'NC094', 'NC451', 'NC452',
  'NC453', 'NMA', 'NW371', 'NW372', 'NW373', 'NW374', 'NW375', 'NW381', 'NW382', 'NW383', 'NW384', 'NW385',
  'NW392', 'NW393', 'NW394', 'NW396', 'NW397', 'NW403', 'NW404', 'NW405', 'TSH', 'WC011', 'WC012', 'WC013',
  'WC014', 'WC015', 'WC022', 'WC023', 'WC024', 'WC025', 'WC026', 'WC031', 'WC032', 'WC033', 'WC034', 'WC041',
  'WC042', 'WC043', 'WC044', 'WC045', 'WC047', 'WC048', 'WC051', 'WC052', 'WC053',
];
